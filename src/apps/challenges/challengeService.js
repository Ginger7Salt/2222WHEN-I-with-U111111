import db from '../../db';
import { convertFileToBase64 } from '../../db/storageUtils';
import { BUILTIN_QUESTIONNAIRE_PRESETS, BUILTIN_TASK_PRESETS } from './presetSeedData';

// ============================================================
// 异地任务挑战（情侣任务打卡板）—— 数据层，Slice A。
//
// 跟DIY小屋一样挂在"这个聊天"（chatId）上，不挂在角色身上。三张表：
//   - challengeBoards：每个聊天一行，装饰性内容（拍立得画廊/歌单/
//     情书便签），不跟任务数据绑定。
//   - challengePresets：情侣问卷/情侣任务模板库，全局共享，内置种子
//     + 用户自建都在同一张表（isBuiltin 区分）。
//   - challengeTasks：真正的任务卡，一条一行。
//
// 这一版只做数据模型 + 面板能摆弄的部分（上传拍立得、管理歌单、手写
// 便签、从模板库或自定义文字创建"用户发起"的任务、用户给角色发起的
// 任务标记完成并写感想）。AI相关的部分——便签真正由角色生成、角色自主
// 判断何时给用户派任务、角色自己任务的完成证明短文、用户完成感想喂给
// AI当上下文——留到下一个切片接，本文件里用 TODO 标出对应位置。
// ============================================================

const nowIso = () => new Date().toISOString();

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

// TODO（下一个切片）：这里应该换成调用AI让角色自己生成情书便签，现在
// 先允许用户自己手写/编辑便签内容，只是把文本存起来、打个时间戳。
export const saveLoveMemoNote = async (chatId, text) => {
  return patchBoard(chatId, { memoNote: (text || '').trim(), memoNoteUpdatedAt: nowIso() });
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
// 完成，必须附一句完成感想——这句话要喂给角色当上下文用（见下方TODO），
// 不是纯装饰，所以这里强制非空。
export const completeTaskWithNote = async (taskId, completionNote) => {
  const trimmed = (completionNote || '').trim();
  if (!taskId || !trimmed) return null;

  await db.challengeTasks.update(taskId, {
    status: 'completed',
    completionNote: trimmed,
    completedAt: nowIso(),
  });

  // TODO（下一个切片）：把 completionNote 喂给对应角色当聊天上下文，
  // 让TA能在接下来的回复里看到/回应用户写的这段完成感想。
  return db.challengeTasks.get(taskId);
};

// 用户发起、角色去完成的任务（assignedBy:'user'）按设计应该由角色自己
// 判断什么时候算完成、自己写完成证明短文（走下一个切片的定时调度），
// 这里先不提供"用户代TA点完成"的入口，面板上这类待完成任务只展示
// 「等待TA自己来完成」，没有可点的盖章按钮。

export const deleteTask = async (taskId) => {
  if (!taskId) return;
  await db.challengeTasks.delete(taskId);
};