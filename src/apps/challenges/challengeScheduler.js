import db from '../../db';
import {
  getRecentHistoryText,
  callSingleCompletion,
  getTasksForChat,
  getPresets,
  completeTaskByCharacter,
  createCharacterAssignedTask,
} from './challengeService';

// ============================================================
// 异地任务挑战——角色自主判断要不要「完成一个用户布置给TA的任务」，
// 或者「主动给用户出一个新任务」。
//
// 这两件事共用同一次AI调用，让角色从「完成任务 / 布置新任务 / 什么都
// 不做」里最多选一样（大多数时候应该选"什么都不做"，这应该是偶尔的、
// 自然发生的事，不是每次检查都要有动静）——跟DIY小屋的
// selfUpdateDiyArea、来电调度器(callScheduler.js)的来电判断同一个
// "相信角色自己判断节奏"的思路：没有冷却，频率完全靠下面的检查间隔
// 和AI自己的判断来控制。
//
// 挂进 globalChatScheduler.js 的共享基准tick，不另起一个 setInterval
// （codebase在v67之后把这类"定期扫一遍所有聊天窗"的检查都合并到那
// 一个调度器里了）。
// ============================================================

const DONE_TAG = /^\[CHALLENGE_DONE:\s*([^\]]+)\]\s*/i;
const ASSIGN_PRESET_TAG = /^\[CHALLENGE_ASSIGN_PRESET:\s*([^\]]+)\]\s*/i;
const ASSIGN_TAG = /^\[CHALLENGE_ASSIGN\]\s*/i;
const NO_ACTION_SENTINEL = 'NO_ACTION';

let isChecking = false;

const buildDecisionPrompt = ({ character, historyText, pendingForCharacter, pendingFromCharacter, presets }) => {
  const pendingForCharacterText = pendingForCharacter.length
    ? pendingForCharacter.map((t) => `- ${t.content}`).join('\n')
    : '（目前没有，用户还没有给你布置任务）';

  const pendingFromCharacterText = pendingFromCharacter.length
    ? pendingFromCharacter.map((t) => `- ${t.content}`).join('\n')
    : '（目前没有）';

  const presetExamplesText = presets.length
    ? presets.map((p) => `- ${p.type === 'questionnaire' ? '问卷' : '任务'}：${p.text}`).join('\n')
    : '（题库暂时是空的）';

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

最近的聊天内容（仅供参考语气和近况，不需要逐条回应）：
${historyText || '（暂时没有聊天记录）'}

你和用户在"异地任务挑战"这个打卡本里有以下记录：

【用户布置给你、你还没完成的任务】（如果想完成其中一个，就原样挑一条）：
${pendingForCharacterText}

【你之前已经主动布置给用户、还没完成的任务】（避免再出重复或太相似的）：
${pendingFromCharacterText}

【题库举例，供你布置新任务时参考（可以挑一条，也可以自己想一个新的）】：
${presetExamplesText}

现在请你从下面三种行为里最多选一种（大多数时候应该选"什么都不做"，
这应该是偶尔、自然发生的，不要每次都想做点什么）：

1. 完成"用户布置给你"的某一个任务，并写一段第一人称的"完成证明"短文：
   第一行输出 [CHALLENGE_DONE: 原样复制上面列表1里的任务文字]
   第二行开始写这段完成证明（2到5句话，符合你的人设语气，像是在跟
   用户汇报/撒娇一样说这件事做完了）。
   （如果列表1是空的，就不能选这个行为。）

2. 主动给用户出一个新任务/问题：
   如果是你自己想的新内容：第一行输出 [CHALLENGE_ASSIGN]
   如果是用上面题库举例里的某一条：第一行输出
   [CHALLENGE_ASSIGN_PRESET: 原样复制那一条的文字（不要带"问卷："/
   "任务："这个前缀）]
   第二行开始写你想对用户说的话，用来介绍/布置这个任务（2到5句话，
   符合你的人设语气）。

3. 什么都不做：只输出 ${NO_ACTION_SENTINEL}，不要输出任何其他内容。

严格要求：
- 最多只选一种行为，不要同时输出两个标签；
- 标签必须单独占第一行，方括号格式要跟上面完全一致；
- 标签里引用的任务/题库文字必须和列表里的原文一字不差，一个字都不能改；
- 大多数情况下应该选行为3（什么都不做），只有偶尔真的想做点什么才
  选 1 或 2。`;
};

const handleDecision = async (chatId, rawText, { pendingForCharacter, presets }) => {
  const trimmed = (rawText || '').trim();
  if (!trimmed || trimmed === NO_ACTION_SENTINEL) return;

  const doneMatch = DONE_TAG.exec(trimmed);
  if (doneMatch) {
    const taskText = doneMatch[1].trim();
    const proofText = trimmed.slice(doneMatch[0].length).trim();
    const task = pendingForCharacter.find((t) => t.content.trim() === taskText);

    if (!task) {
      console.warn('[异地任务挑战] 角色想完成的任务文字对不上列表，跳过：', taskText);
      return;
    }

    await completeTaskByCharacter(task.id, proofText);
    return;
  }

  const presetMatch = ASSIGN_PRESET_TAG.exec(trimmed);
  if (presetMatch) {
    const presetText = presetMatch[1].trim();
    const announcementText = trimmed.slice(presetMatch[0].length).trim();
    const preset = presets.find((p) => p.text.trim() === presetText);

    if (!preset) {
      console.warn('[异地任务挑战] 角色想用的题库条目对不上，跳过：', presetText);
      return;
    }

    await createCharacterAssignedTask(chatId, {
      sourceType: 'preset',
      content: preset.text,
      sourcePresetId: preset.id,
      announcementText,
    });
    return;
  }

  const assignMatch = ASSIGN_TAG.exec(trimmed);
  if (assignMatch) {
    const content = trimmed.slice(assignMatch[0].length).trim();
    await createCharacterAssignedTask(chatId, {
      sourceType: 'custom',
      content,
      announcementText: content,
    });
  }
};

/**
 * 扫描所有已经打开过"异地任务挑战"面板的聊天窗（没开过的 chatId 不会有
 * challengeBoards 行，直接跳过，省掉用不上这个功能的聊天窗的AI调用），
 * 逐个用一次AI调用决定这次要不要有动作。串行执行，避免同时打好几个
 * AI请求。
 */
export const runChallengeScheduler = async (providedChats = null) => {
  if (isChecking) return;
  isChecking = true;

  try {
    const chats = providedChats || (await db.chats.toArray());

    const eligibleChats = [];
    for (const chat of chats) {
      if (!chat?.id || !chat?.characterId) continue;
      // eslint-disable-next-line no-await-in-loop
      const hasBoard = (await db.challengeBoards.where('chatId').equals(chat.id).count()) > 0;
      if (hasBoard) eligibleChats.push(chat);
    }

    if (eligibleChats.length === 0) return;

    const presets = await getPresets();

    for (const chat of eligibleChats) {
      try {
        const character = await db.characters.get(chat.characterId);
        if (!character) continue;

        const tasks = await getTasksForChat(chat.id);
        const pendingForCharacter = tasks.filter((t) => t.assignedBy === 'user' && t.status === 'pending');
        const pendingFromCharacter = tasks.filter((t) => t.assignedBy === 'character' && t.status === 'pending');

        const historyText = await getRecentHistoryText(chat.id, character);

        const systemPrompt = buildDecisionPrompt({
          character,
          historyText,
          pendingForCharacter,
          pendingFromCharacter,
          presets,
        });

        const rawText = await callSingleCompletion(systemPrompt, { temperature: 0.9 });
        if (!rawText) continue;

        await handleDecision(chat.id, rawText, { pendingForCharacter, presets });
      } catch (err) {
        console.error(`[异地任务挑战] chatId=${chat.id} 检查失败：`, err);
      }
    }
  } catch (err) {
    console.error('[异地任务挑战] 调度检查失败：', err);
  } finally {
    isChecking = false;
  }
};