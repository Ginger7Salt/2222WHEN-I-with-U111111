import Dexie from 'dexie';
import db from '../../db';
import { convertFileToBase64 } from '../../db/storageUtils';
import { BUILTIN_QUESTIONNAIRE_PRESETS, BUILTIN_TASK_PRESETS } from './presetSeedData';

// ============================================================
// 异地任务挑战（情侣任务打卡板）—— 数据层。
//
// 跟DIY小屋一样挂在"这个聊天"（chatId）上，不挂在角色身上。三张表：
//   - challengeBoards：每个聊天一行，装饰性内容（拍立得画廊/歌单/
//     情书便签），不跟任务数据绑定。
//   - challengePresets：情侣问卷/情侣任务模板库，全局共享，内置种子
//     + 用户自建都在同一张表（isBuiltin 区分）。
//   - challengeTasks：真正的任务卡，一条一行。
//
// Slice A 做了数据模型 + 面板能摆弄的部分（上传拍立得、管理歌单、手写
// 便签、从模板库或自定义文字创建"用户发起"的任务、用户给角色发起的
// 任务标记完成并写感想）。
//
// Slice B（这一版新增）接上了两块AI相关的：
//   1. generateLoveMemoNote —— 情书便签真正由角色AI生成，不再是用户
//      手写代笔（跟DIY小屋一样直接对 apiConfig 发 fetch，不经过
//      aiService.js——避免循环依赖，见 diyAreaService.js 顶部注释里
//      同样的理由：aiService.js 以后很可能要反过来导入本文件的内容
//      去拼系统提示词）。
//   2. completeTaskWithNote 现在会把用户写的完成感想，以一条
//      type:'challenge_complete' 的真实聊天消息落库（跟"和好券"用户
//      发出的券走真实消息同一个思路），这样角色在下一次正常回复时，
//      会通过 aiService.js 的 formatMsgContentForPrompt 自然看到这段
//      感想，不需要另外维护一套"有没有被AI看过"的已读标记。
//
// Slice B 第二部分接上了剩下两块，都靠 challengeScheduler.js 一次AI
// 调用里"最多选一样做"：
//   3. completeTaskByCharacter —— 角色自己判断要不要完成一条"用户
//      布置给TA"的任务，完成时顺带写一段第一人称"完成证明"短文，
//      当成一条真正的角色消息（sender:'character', type:'text'）发
//      出来，跟 rhythmReminderService.js 发寄语消息同一个落库方式。
//   4. createCharacterAssignedTask —— 角色自己判断要不要主动给用户
//      出一个新任务/问题（自己想的，或者从问卷/任务模板库里选），
//      同样当成一条真正的角色消息发出来，消息正文就是角色介绍/布置
//      这个任务时想说的话。
// 这两个都没有冷却——频率完全靠 challengeScheduler.js 的检查间隔和
// AI自己"大多数时候选择不做"的判断来控制，不另外叠加概率门槛。
// ============================================================

const nowIso = () => new Date().toISOString();

const RECENT_HISTORY_LIMIT_FOR_MEMO = 30;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

// 跟 diyAreaService.js 的 getRecentHistoryText 做法一样：直接查
// db.messages 的 [chatId+timestamp] 复合索引，不经过 aiService.js 的
// getRecentChatMessages（避免循环依赖）。导出给 challengeScheduler.js
// 复用，不用再抄一遍。
export const getRecentHistoryText = async (chatId, character) => {
  const recentMessages = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(RECENT_HISTORY_LIMIT_FOR_MEMO)
    .toArray()
    .then((rows) => rows.reverse());

  return recentMessages
    .filter((message) => message.type === 'text' && message.content)
    .map((message) => `${message.sender === 'user' ? '用户' : character.name}: ${message.content}`)
    .join('\n');
};

// 跟 diyAreaService.js 的拒绝理由生成同一个做法：直接对 apiConfig 发
// 一次 fetch，不走 aiService.js 的 generateResponse（原因见本文件
// 顶部注释）。返回纯文本（trim 之后的 content），失败则返回 null，
// 调用方自己决定兜底文案。导出给 challengeScheduler.js 复用。
export const callSingleCompletion = async (systemPrompt, { temperature = 0.9 } = {}) => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请按照上面的要求执行。' },
      ],
      temperature,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
};

// ---------------- 面板（拍立得 / 歌单 / 情书便签） ----------------

const createEmptyBoard = (chatId) => ({
  chatId,
  polaroids: [
    { slot: 0, imageBase64: null, caption: '' },
    { slot: 1, imageBase64: null, caption: '' },
    { slot: 2, imageBase64: null, caption: '' },
  ],
  playlist: [],
  memoNote: '',
  memoNoteUpdatedAt: null,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

export const getOrCreateChallengeBoard = async (chatId) => {
  if (!chatId) return null;

  const existing = await db.challengeBoards.where('chatId').equals(chatId).first();
  if (existing) return existing;

  const fresh = createEmptyBoard(chatId);
  const id = await db.challengeBoards.add(fresh);
  return { ...fresh, id };
};

const patchBoard = async (chatId, patch) => {
  const board = await getOrCreateChallengeBoard(chatId);
  if (!board) return null;

  const updated = { ...board, ...patch, updatedAt: nowIso() };
  await db.challengeBoards.put(updated);
  return updated;
};

// slot 是 0/1/2。file 是用户选的图片文件（走 convertFileToBase64 自动
// 压缩，不会把原图体积直接塞进数据库）；caption 是这张照片下面的说明文字。
// 两者可以只传一个（比如只改文案不换图）。
export const updatePolaroidSlot = async (chatId, slot, { file, caption } = {}) => {
  const board = await getOrCreateChallengeBoard(chatId);
  if (!board) return null;

  const polaroids = [0, 1, 2].map((s) => {
    const existing = (board.polaroids || []).find((p) => p.slot === s);
    return existing ? { ...existing } : { slot: s, imageBase64: null, caption: '' };
  });

  const target = polaroids[slot];
  if (!target) return board;

  if (file) {
    target.imageBase64 = await convertFileToBase64(file);
  }
  if (typeof caption === 'string') {
    target.caption = caption;
  }

  return patchBoard(chatId, { polaroids });
};

export const addPlaylistTrack = async (chatId, { title, artist, url }) => {
  const board = await getOrCreateChallengeBoard(chatId);
  if (!board) return null;

  const track = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: (title || '').trim(),
    artist: (artist || '').trim(),
    url: (url || '').trim(),
  };

  if (!track.title) return board;

  return patchBoard(chatId, { playlist: [...(board.playlist || []), track] });
};

export const removePlaylistTrack = async (chatId, trackId) => {
  const board = await getOrCreateChallengeBoard(chatId);
  if (!board) return null;

  return patchBoard(chatId, {
    playlist: (board.playlist || []).filter((t) => t.id !== trackId),
  });
};

// 用户在便签上手写/微调之后点"保存便签"——AI生成之后用户还是能自己
// 改一改再保存，不强制必须原文照用。
export const saveLoveMemoNote = async (chatId, text) => {
  return patchBoard(chatId, { memoNote: (text || '').trim(), memoNoteUpdatedAt: nowIso() });
};

// 点"重新生成"按钮时调用：让角色自己写一句给对方的便签留言，参考
// 角色人设+最近聊天语气，不需要罗列任务进度，纯粹是想说给TA听的一句
// 话。没有冷却限制、也不会自动定时触发——只有用户点按钮才会真的调用
// 一次AI。返回 { status: 'success', board } 或 { status: 'error' }，
// 失败时不改动已有的便签内容，调用方（ChallengeBoardPage.jsx）决定
// 失败提示怎么展示。
export const generateLoveMemoNote = async (chatId, character) => {
  if (!chatId || !character) return { status: 'error' };

  try {
    const historyText = await getRecentHistoryText(chatId, character);

    const systemPrompt = `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

最近的聊天内容（仅供参考语气和近况，不需要逐条回应）：
${historyText || '（暂时没有聊天记录）'}

你和用户在"异地任务挑战"这个打卡本里共用一张情书便签。请以第一人称、
符合以上人设的语气，给对方写一句简短的留言——可以是想念、鼓励、调侃、
期待下一个挑战之类，不需要罗列挑战进度，只是单纯想说给TA听的一句话。

严格要求：
- 2 到 4 句话，总长度不超过 80 个汉字；
- 不使用 Markdown、不使用编号、不要用引号把整段话包起来；
- 只输出这段留言本身，不要有任何多余说明。`;

    const rawText = await callSingleCompletion(systemPrompt, { temperature: 0.95 });
    const cleaned = (rawText || '').trim().replace(/^["“]/, '').replace(/["”]$/, '').trim();

    if (!cleaned) return { status: 'error' };

    const board = await patchBoard(chatId, { memoNote: cleaned, memoNoteUpdatedAt: nowIso() });
    return { status: 'success', board };
  } catch (error) {
    console.warn('[异地任务挑战] 情书便签生成失败：', error);
    return { status: 'error' };
  }
};

// ---------------- 模板库（情侣问卷 / 情侣任务） ----------------

let seedingPromise = null;

export const ensurePresetsSeeded = async () => {
  if (!seedingPromise) {
    seedingPromise = (async () => {
      const count = await db.challengePresets.count();
      if (count > 0) return;

      const now = nowIso();
      const rows = [
        ...BUILTIN_QUESTIONNAIRE_PRESETS.map((text) => ({
          type: 'questionnaire',
          text,
          isBuiltin: true,
          createdAt: now,
        })),
        ...BUILTIN_TASK_PRESETS.map((text) => ({
          type: 'task',
          text,
          isBuiltin: true,
          createdAt: now,
        })),
      ];

      await db.challengePresets.bulkAdd(rows);
    })();
  }

  return seedingPromise;
};

// type 传 'questionnaire' | 'task'，不传则两种都要。
export const getPresets = async (type) => {
  await ensurePresetsSeeded();

  const list = type
    ? await db.challengePresets.where('type').equals(type).toArray()
    : await db.challengePresets.toArray();

  return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const addCustomPreset = async (type, text) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  await ensurePresetsSeeded();

  const id = await db.challengePresets.add({
    type,
    text: trimmed,
    isBuiltin: false,
    createdAt: nowIso(),
  });

  return db.challengePresets.get(id);
};

export const updatePreset = async (id, text) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  await db.challengePresets.update(id, { text: trimmed });
  return db.challengePresets.get(id);
};

export const deletePreset = async (id) => {
  await db.challengePresets.delete(id);
};

// ---------------- 任务卡 ----------------

export const getTasksForChat = async (chatId) => {
  if (!chatId) return [];

  const tasks = await db.challengeTasks.where('chatId').equals(chatId).toArray();
  return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// 这一版的"+添加任务"只支持用户发起（assignedBy:'user'，也就是用户
// 想让角色去完成一件事）。角色主动给用户派任务（assignedBy:'character'）
// 要等下一个切片接上自主判断 + 定时调度之后才会真的出现数据，这里不
// 开放手动伪造一条"角色发起"的任务。
//
// sourceType 传 'custom'（用户自己打字）或 'preset'（从模板库选的）；
// 选模板库时 sourcePresetId 指向 challengePresets 的那一行，content 在
// 创建时就把模板文字复制过来存一份快照——以后模板库那条被改了/删了，
// 不会影响已经发出去的这张任务卡。
export const createUserAssignedTask = async (chatId, { sourceType, content, sourcePresetId = null }) => {
  const trimmed = (content || '').trim();
  if (!chatId || !trimmed) return null;

  const task = {
    chatId,
    assignedBy: 'user',
    sourceType,
    sourcePresetId,
    content: trimmed,
    status: 'pending',
    completionNote: null,
    completedAt: null,
    createdAt: nowIso(),
  };

  const id = await db.challengeTasks.add(task);
  return { ...task, id };
};

// 角色发起、用户去完成的任务（assignedBy:'character'）由用户点击标记
// 完成，必须附一句完成感想——这句话要喂给角色当上下文用，不是纯装饰，
// 所以这里强制非空。
//
// 落库之后顺带插一条 type:'challenge_complete' 的真实聊天消息（跟
// "和好券"用户发出的券走真实消息同一个思路），角色下次正常回复时会
// 通过 aiService.js 的 formatMsgContentForPrompt 自然看到这段感想并
// 作出反应，不需要另外维护一套"AI有没有看过"的已读标记。这就要求
// 这个任务当时所在的聊天窗还存在（能查到 chatId/characterId）——查不
// 到的话仍然正常标记任务完成，只是不再补发这条聊天消息。
export const completeTaskWithNote = async (taskId, completionNote) => {
  const trimmed = (completionNote || '').trim();
  if (!taskId || !trimmed) return null;

  const task = await db.challengeTasks.get(taskId);
  if (!task) return null;

  const completedAt = nowIso();

  await db.challengeTasks.update(taskId, {
    status: 'completed',
    completionNote: trimmed,
    completedAt,
  });

  const chat = await db.chats.get(task.chatId);
  if (chat?.characterId) {
    await db.messages.add({
      chatId: task.chatId,
      characterId: chat.characterId,
      sender: 'user',
      type: 'challenge_complete',
      content: trimmed,
      metadata: { taskId: task.id, taskContent: task.content },
      isRead: true,
      timestamp: completedAt,
    });

    await db.chats.update(task.chatId, { updatedAt: completedAt });

    dispatchLocalMessageEvent(task.chatId);
  }

  return db.challengeTasks.get(taskId);
};

// 用户发起、角色去完成的任务（assignedBy:'user'）按设计由角色自己
// 判断什么时候算完成——面板上没有"用户代TA点完成"的按钮，这类待完成
// 任务只展示「等待TA自己来完成」。真正的完成由 challengeScheduler.js
// 调用下面这个函数。
//
// proofText 是角色自己写的第一人称完成证明短文，会同时存进
// completionNote，也会以一条真正的角色消息（sender:'character',
// type:'text'）发到聊天记录里——跟 rhythmReminderService.js 发寄语
// 消息同一套落库方式（isRead:false，让未读角标正常显示）。
export const completeTaskByCharacter = async (taskId, proofText) => {
  const trimmed = (proofText || '').trim();
  if (!taskId || !trimmed) return null;

  const task = await db.challengeTasks.get(taskId);
  if (!task || task.status === 'completed') return null;

  const chat = await db.chats.get(task.chatId);
  if (!chat?.characterId) return null;

  const completedAt = nowIso();

  await db.challengeTasks.update(taskId, {
    status: 'completed',
    completionNote: trimmed,
    completedAt,
  });

  const metadata = { challengeTaskId: task.id, source: 'challenge-scheduler' };

  await db.messages.add({
    chatId: task.chatId,
    characterId: chat.characterId,
    sender: 'character',
    type: 'text',
    content: trimmed,
    metadata,
    versions: [{ type: 'text', content: trimmed, metadata, timestamp: completedAt }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: completedAt,
  });

  await db.chats.update(task.chatId, { updatedAt: completedAt });

  dispatchLocalMessageEvent(task.chatId);

  return db.challengeTasks.get(taskId);
};

// 角色主动给用户出的新任务（assignedBy:'character'）——跟用户手动的
// "+添加任务"不同，这个只由 challengeScheduler.js 调用，不对外暴露
// 手动创建入口。announcementText 是角色介绍/布置这个任务时想说的话，
// 同样发成一条真正的角色消息。
export const createCharacterAssignedTask = async (chatId, { sourceType, content, sourcePresetId = null, announcementText }) => {
  const trimmedContent = (content || '').trim();
  const trimmedAnnouncement = (announcementText || '').trim();
  if (!chatId || !trimmedContent || !trimmedAnnouncement) return null;

  const chat = await db.chats.get(chatId);
  if (!chat?.characterId) return null;

  const task = {
    chatId,
    assignedBy: 'character',
    sourceType,
    sourcePresetId,
    content: trimmedContent,
    status: 'pending',
    completionNote: null,
    completedAt: null,
    createdAt: nowIso(),
  };

  const taskId = await db.challengeTasks.add(task);

  const timestampIso = nowIso();
  const metadata = { challengeTaskId: taskId, source: 'challenge-scheduler' };

  await db.messages.add({
    chatId,
    characterId: chat.characterId,
    sender: 'character',
    type: 'text',
    content: trimmedAnnouncement,
    metadata,
    versions: [{ type: 'text', content: trimmedAnnouncement, metadata, timestamp: timestampIso }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: timestampIso,
  });

  await db.chats.update(chatId, { updatedAt: timestampIso });

  dispatchLocalMessageEvent(chatId);

  return { ...task, id: taskId };
};

export const deleteTask = async (taskId) => {
  if (!taskId) return;
  await db.challengeTasks.delete(taskId);
};