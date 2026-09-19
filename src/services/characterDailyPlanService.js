import db from '../db';
import { buildRhythmPersonaBrief } from './rhythmReminderService';
import { inspectMemorySignals } from '../apps/memory/memorySignals';

// "今日角色安排"是角色自己对今天的大致想法/安排，不是精确日程表，
// 也刻意跟用户的真实课表/工作日程完全独立——这是角色自己的一天，
// 跟平行轨迹的"独立生活"是同一个精神，只是从"事后记录"变成"当下的打算"。
//
// 数据按角色维度存储（characterId），跟 Rhythm App 本身按
// currentCharacterId 展示的方式保持一致。一个角色如果同时挂在
// 多个聊天窗下，共用同一份"今日安排"。

// 一天分成 5 个大时段，覆盖完整 24 小时，不重不漏。
const PERIOD_DEFS = [
  { key: 'morning', label: '清晨与上午', hourStart: 5, hourEnd: 11 },
  { key: 'noon', label: '中午', hourStart: 11, hourEnd: 14 },
  { key: 'afternoon', label: '下午', hourStart: 14, hourEnd: 18 },
  { key: 'evening', label: '傍晚', hourStart: 18, hourEnd: 21 },
  { key: 'night', label: '夜晚', hourStart: 21, hourEnd: 29 }
];

// AI 返回内容解析失败、或者字段缺失时使用的兜底文案，
// 保持平淡、生活化的语气，不制造"出错了"的痕迹。
const DEFAULT_PLAN_TEXT = [
  { title: '晨间的日常', blurb: '按部就班地开始新的一天，没什么特别的安排。' },
  { title: '安静的午后', blurb: '处理一点琐事，暂时没有特别的计划。' },
  { title: '下午的时段', blurb: '照常忙自己的事，谈不上有什么特别。' },
  { title: '傍晚的间隙', blurb: '一天渐渐慢下来，想歇一歇。' },
  { title: '夜里的时光', blurb: '一天快结束了，准备好好休息。' }
];

// 碎碎念的生成冷却：这是一个"更高频、有机会就想加一条"的轻量彩蛋，
// 不需要像寄语那样克制，但也不能每次调度都刷新，2 小时是一个折中。
const MURMUR_COOLDOWN_MS = 2 * 60 * 60 * 1000;

// 碎碎念是否要考虑用户情绪：只回看最近几条消息，
// 复用记忆系统里已有的 emotion 高优先级信号识别，不新增规则。
const EMOTION_SIGNAL_LOOKBACK = 8;

const pad = (n) => String(n).padStart(2, '0');

const getTodayDateStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * 根据当前小时，判断落在 PERIOD_DEFS 的第几个时段（0-4）。
 * "夜晚" 时段跨过午夜（21 点到次日 5 点前），需要单独处理。
 */
export const getCurrentPeriodIndex = (hour) => {
  if (hour >= 21 || hour < 5) return 4;
  if (hour >= 5 && hour < 11) return 0;
  if (hour >= 11 && hour < 14) return 1;
  if (hour >= 14 && hour < 18) return 2;
  return 3;
};

const fetchAiText = async (apiConfig, systemPrompt) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ],
      temperature: 0.85,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    throw new Error(
      `API 请求失败：${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return String(data?.choices?.[0]?.message?.content || '').trim();
};

const buildDailyPlanPrompt = ({ character, worldBookText, extraNotesText }) => {
  const periodLines = PERIOD_DEFS.map((period) => period.label).join('\n');

  const exampleLines = PERIOD_DEFS
    .map((period) => `${period.label}|||标题|||一句话描述`)
    .join('\n');

  return `你正在为角色「${character.name}」写下ta对今天的大致想法和安排。
这不是精确的日程表，是ta自己心里对今天的打算，允许含糊、简单、留白，
也允许出现"没什么特别安排""随便看看书"这种平淡的时刻。

人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

请分别针对以下 5 个时段各写一条简短安排（标题 + 一句话描述）：

${periodLines}

严格按以下格式输出，每个时段一行，字段之间用 ||| 分隔，
一共 5 行，不要标题、不要编号、不要 Markdown、不要多余说明：

${exampleLines}

要求：
- 全站零 Emoji。
- 标题控制在 8 个字以内，描述控制在 30 字以内。
- 5 条安排之间要有生活的连续性和合理性，不要互相矛盾。
- 这是角色自己独立的生活安排，不需要处理用户的事情，也不需要提及用户。
- 保持平淡、真实、生活化，不需要每一段都有戏剧性或转折。`;
};

const parseDailyPlanResponse = (rawText) => {
  const lines = String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return PERIOD_DEFS.map((period, index) => {
    const line = lines[index];
    const parts = line ? line.split('|||').map((part) => part.trim()) : [];

    let title = DEFAULT_PLAN_TEXT[index].title;
    let blurb = DEFAULT_PLAN_TEXT[index].blurb;

    if (parts.length >= 2) {
      // 兼容模型把时段名也一起返回：只取最后两段作为标题和描述。
      const candidateTitle = parts[parts.length - 2];
      const candidateBlurb = parts[parts.length - 1];

      if (candidateTitle) title = candidateTitle;
      if (candidateBlurb) blurb = candidateBlurb;
    }

    return {
      id: `${period.key}_${Date.now()}_${index}`,
      periodKey: period.key,
      periodLabel: period.label,
      title: title.slice(0, 20),
      blurb: blurb.slice(0, 60)
    };
  });
};

/**
 * 判断这个角色是否已经有过任何一次用户互动（跨所有聊天窗）。
 * 避免刚创建、从没聊过的角色也被自动写一份"今日安排"，白白消耗 Token。
 */
const hasAnyCharacterActivity = async (characterId) => {
  const chats = await db.chats.where('characterId').equals(characterId).toArray();

  for (const chat of chats) {
    const hasUserMessage = await db.messages
      .where('chatId')
      .equals(chat.id)
      .filter((message) => message?.sender === 'user')
      .first();

    if (hasUserMessage) {
      return true;
    }
  }

  return false;
};

/**
 * 取这个角色下"最近更新"的聊天窗，作为碎碎念读取用户情绪信号的来源。
 * 一个角色如果挂在多个聊天窗下，只用最活跃的那个来判断用户状态。
 */
const resolvePrimaryChatForCharacter = async (characterId) => {
  const chats = await db.chats.where('characterId').equals(characterId).toArray();

  if (chats.length === 0) {
    return null;
  }

  return chats.reduce((latest, chat) => {
    const latestTime = new Date(latest?.updatedAt || 0).getTime();
    const currentTime = new Date(chat?.updatedAt || 0).getTime();

    return currentTime > latestTime ? chat : latest;
  }, chats[0]);
};

/**
 * 读取角色今天的安排（不生成，只读）。
 */
export const getTodayDailyPlan = async (characterId) => {
  if (!characterId) {
    return null;
  }

  const todayStr = getTodayDateStr();

  const plan = await db.characterDailyPlans
    .where('[characterId+dateStr]')
    .equals([characterId, todayStr])
    .first();

  return plan || null;
};

/**
 * 如果角色今天还没有"今日安排"，生成一份。
 * 已存在则直接返回已有记录，不重复生成。
 */
export const generateDailyPlanIfNeeded = async (characterId) => {
  if (!characterId) {
    return { status: 'no_character' };
  }

  try {
    const character = await db.characters.get(characterId);

    if (!character) {
      return { status: 'no_character' };
    }

    const todayStr = getTodayDateStr();

    const existing = await db.characterDailyPlans
      .where('[characterId+dateStr]')
      .equals([characterId, todayStr])
      .first();

    if (existing) {
      return { status: 'already_exists', plan: existing };
    }

    const hasActivity = await hasAnyCharacterActivity(characterId);

    if (!hasActivity) {
      return { status: 'no_user_activity' };
    }

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return { status: 'no_api_config' };
    }

    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

    const systemPrompt = buildDailyPlanPrompt({
      character,
      worldBookText,
      extraNotesText
    });

    const rawResponse = await fetchAiText(apiConfig, systemPrompt);
    const items = parseDailyPlanResponse(rawResponse);

    const nowIso = new Date().toISOString();

    const newPlan = {
      characterId,
      dateStr: todayStr,
      generatedAt: nowIso,
      items,
      murmur: null
    };

    const insertedId = await db.characterDailyPlans.add(newPlan);

    return {
      status: 'success',
      plan: { id: insertedId, ...newPlan }
    };
  } catch (err) {
    console.error('[characterDailyPlanService] 生成今日安排失败：', err);

    return {
      status: 'error',
      error: err?.message || 'unknown_error'
    };
  }
};

const buildMurmurPrompt = ({
  character,
  worldBookText,
  extraNotesText,
  targetItem,
  moodContext
}) => {
  return `你正在扮演角色「${character.name}」。
现在你心里冒出一个关于用户的念头，想在自己"今日安排"里的一项旁边
随手写一句碎碎念——这不是发给用户的消息，只是你自己心里的悄悄话，
用户之后可能会翻看到，但你现在并不知道ta会不会看到。

人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

你今天在这个时段安排的事情是：
《${targetItem.title}》——${targetItem.blurb}

${
  moodContext
    ? `你隐约察觉到用户最近可能不太好，ta说过类似这样的话："${moodContext}"。这只是一种模糊的感知，不是确切的事实，不要在碎碎念里直接引用、复述或点破这句话。`
    : '这一刻你只是单纯地想到了用户，没有特别的原因。'
}

写一句第一人称的碎碎念，控制在 30 字以内。

要求：
- 严禁使用任何 Emoji。
- 这只是一个念头，不是消息，不需要称呼、问候或系统式的关心话术。
- 不要说自己"取消了""改了""推掉了"安排里的事情——安排本身并没有真的发生变化，
  这只是心里一闪而过的念头。
- 不要写得像在向用户交代什么，保持私人、松散、真实的语气。
- 直接输出这句话，不要引号、不要标题、不要 Markdown。`;
};

/**
 * 视情况为角色今天的安排生成一句碎碎念。
 *
 * 触发节奏：只受冷却时间限制（默认 2 小时），不要求必须检测到
 * 用户情绪信号——检测到时，碎碎念会带一点隐约的关切；
 * 没检测到时，就是单纯"想到你了"式的念头，保持更高的出现频率。
 */
export const maybeGenerateCharacterMurmur = async (characterId) => {
  if (!characterId) {
    return { status: 'no_character' };
  }

  try {
    const now = Date.now();
    const cooldownKey = `lastDailyPlanMurmurTime_${characterId}`;
    const lastTimeSetting = await db.settings.get(cooldownKey);
    const lastTime = Number(lastTimeSetting?.value || 0);

    if (now - lastTime < MURMUR_COOLDOWN_MS) {
      return { status: 'cooldown' };
    }

    const character = await db.characters.get(characterId);

    if (!character) {
      return { status: 'no_character' };
    }

    const todayStr = getTodayDateStr();

    const plan = await db.characterDailyPlans
      .where('[characterId+dateStr]')
      .equals([characterId, todayStr])
      .first();

    if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) {
      return { status: 'no_plan' };
    }

    const chat = await resolvePrimaryChatForCharacter(characterId);

    let moodContext = '';

    if (chat) {
      const recentMessages = await db.messages
        .where('chatId')
        .equals(chat.id)
        .reverse()
        .limit(EMOTION_SIGNAL_LOOKBACK)
        .toArray();

      recentMessages.reverse();

      const { signals } = inspectMemorySignals(recentMessages);
      const emotionSignal = signals.find((signal) => signal.type === 'emotion');

      if (emotionSignal?.excerpt) {
        moodContext = emotionSignal.excerpt;
      }
    }

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return { status: 'no_api_config' };
    }

    const currentHour = new Date().getHours();
    const periodIndex = getCurrentPeriodIndex(currentHour);
    const targetItem = plan.items[periodIndex] || plan.items[0];

    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

    const systemPrompt = buildMurmurPrompt({
      character,
      worldBookText,
      extraNotesText,
      targetItem,
      moodContext
    });

    const rawResponse = await fetchAiText(apiConfig, systemPrompt);
    const murmurText = rawResponse.replace(/["'“”]/g, '').trim();

    if (!murmurText) {
      return { status: 'empty_response' };
    }

    const nowIso = new Date().toISOString();

    await db.transaction(
      'rw',
      db.characterDailyPlans,
      db.settings,
      async () => {
        await db.characterDailyPlans.update(plan.id, {
          murmur: {
            itemId: targetItem.id,
            text: murmurText.slice(0, 60),
            createdAt: nowIso,
            triggeredByMood: Boolean(moodContext)
          }
        });

        await db.settings.put({
          key: cooldownKey,
          value: String(now)
        });
      }
    );

    return { status: 'success', text: murmurText };
  } catch (err) {
    console.error('[characterDailyPlanService] 生成碎碎念失败：', err);

    return {
      status: 'error',
      error: err?.message || 'unknown_error'
    };
  }
};