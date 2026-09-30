// src/apps/bubble/bubbleService.js
//
// 泡泡模式（Bubble Mode）房间和消息的增删查改。
// 参照 ensembleService.js / EnsembleApp.jsx 里 ensembleChats 表的写法——
// 房间本身是一条 bubbleRooms 记录，成员名单 selectedCharacterIds 是内联
// 的非索引数组字段，不单独建成员关系表。
//
// 切片B新增：bubbleMessages 表的读写（getBubbleMessages/addBubbleMessage）。
//
// 2026-09：这里原本还有一个 ensureCharacterChatId——把角色在房间里的回复
// 镜像写进它自己真实的一对一聊天记录，用于接入共享记忆系统。已经跟
// bubbleAiService.js 里调用它的那部分一起回退（见那个文件顶部注释），
// 泡泡模式暂时完全不碰共享记忆系统，这个函数也一并删掉，不留没人用的
// 死代码。
//
// 2026-09 新增：房间自己的滚动总结（跟共享记忆系统完全独立，纯粹是给
// bubbleAiService.js 的"上下文窗口截断"配套用的，参照 RP 模式
// rpService.js 的 summaryEntries 那一套）。跟RP不同的地方：RP一个会话
// 只对应一个角色，总结天然是会话级的；泡泡房间一个房间有好几个角色，
// 每个角色在房间里看到的历史是各自隔离的（见 bubbleAiService.js 的
// buildIsolatedHistory），所以总结也必须按"角色"分开存，不能整个房间共用
// 一份——跟用户确认过，存成 room.memberSummaries = { [characterId]: [条目...] }，
// 每个角色自己的条目数组结构跟 RP 的 summaryEntries 完全一样（每次总结
// 独立成一条，不覆盖，可以单独编辑/删除），只是外面多包一层按角色分类的
// 字段名。非索引附加字段，不需要 db 版本升级。
//
// @定向可见度（切片C）相关字段留到那时候再加。

import Dexie from 'dexie';
import db from '../../db';

export const MAX_MEMBERS = 8;

/**
 * 按更新时间倒序，取所有泡泡房间列表。
 */
export const getAllBubbleRooms = async () => {
  try {
    return await db.bubbleRooms.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    console.error('[bubbleService] 获取房间列表失败:', err);
    return [];
  }
};

/**
 * 获取单个房间详情。
 */
export const getBubbleRoomById = async (roomId) => {
  if (roomId === null || roomId === undefined) return null;
  try {
    return await db.bubbleRooms.get(Number(roomId));
  } catch (err) {
    console.error('[bubbleService] 获取房间详情失败:', err);
    return null;
  }
};

/**
 * 新建一个泡泡房间。
 * selectedCharacterIds 最多保留前 8 个，超出的静默截断
 * （创建入口的 UI 也会在勾选到第 8 个之后禁用其余选项，这里是兜底）。
 */
export const createBubbleRoom = async ({ title, selectedCharacterIds = [] } = {}) => {
  const trimmedTitle = String(title || '').trim();
  if (!trimmedTitle) return null;

  try {
    const now = Date.now();
    const newId = await db.bubbleRooms.add({
      title: trimmedTitle,
      selectedCharacterIds: selectedCharacterIds.slice(0, MAX_MEMBERS),
      createdAt: now,
      updatedAt: now,
    });
    return newId;
  } catch (err) {
    console.error('[bubbleService] 创建房间失败:', err);
    return null;
  }
};

/**
 * 删除一个泡泡房间，级联删掉这个房间下的所有 bubbleMessages。
 */
export const deleteBubbleRoom = async (roomId) => {
  if (roomId === null || roomId === undefined) return;
  const numericId = Number(roomId);

  try {
    await db.bubbleMessages.where('roomId').equals(numericId).delete();
    await db.bubbleRooms.delete(numericId);
  } catch (err) {
    console.error('[bubbleService] 删除房间失败:', err);
  }
};

/**
 * 按时间正序取一个房间的全部消息记录。切片B阶段房间消息量还不大，
 * 先不做分页；等真的有性能问题再照 ChatRoom.jsx 的
 * getRecentMessagesWindow 那一套加分页，不提前做。
 */
export const getBubbleMessages = async (roomId) => {
  if (roomId === null || roomId === undefined) return [];
  const numericId = Number(roomId);

  try {
    return await db.bubbleMessages
      .where('[roomId+timestamp]')
      .between([numericId, Dexie.minKey], [numericId, Dexie.maxKey])
      .toArray();
  } catch (err) {
    console.error('[bubbleService] 获取房间消息失败:', err);
    return [];
  }
};

/**
 * 新增一条房间消息。timestamp 缺省时用当前时间（ISO 字符串，
 * 跟 messages 表的时间戳格式保持一致，[roomId+timestamp] 复合索引才能
 * 正确排序）。
 */
export const addBubbleMessage = async (entry) => {
  const timestamp = entry.timestamp || new Date().toISOString();

  try {
    return await db.bubbleMessages.add({
      ...entry,
      timestamp,
    });
  } catch (err) {
    console.error('[bubbleService] 写入房间消息失败:', err);
    return null;
  }
};

const makeSummaryEntryId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

/**
 * 取某个角色在某个房间里当前的总结条目数组（纯函数，room 记录已经在手上
 * 时直接用这个，不用再查一次库）。room.memberSummaries 或者对应角色这个
 * key 还不存在时返回空数组，不是 null/undefined，方便调用方直接 .map。
 */
export const getBubbleMemberSummaryEntries = (room, characterId) => {
  const entries = room?.memberSummaries?.[characterId];
  return Array.isArray(entries) ? entries : [];
};

/**
 * 追加一条新的总结条目（bubbleAiService 的自动总结流程调用，每触发一次
 * 算一个独立条目，不覆盖之前该角色已有的条目）。
 */
export const addBubbleMemberSummaryEntry = async (roomId, characterId, { text, coveredFromMessageId, coveredThroughMessageId }) => {
  if (roomId === null || roomId === undefined) return;
  try {
    const numericId = Number(roomId);
    const room = await db.bubbleRooms.get(numericId);
    const existingMap = room?.memberSummaries || {};
    const existingEntries = Array.isArray(existingMap[characterId]) ? existingMap[characterId] : [];
    const now = Date.now();
    const entry = {
      id: makeSummaryEntryId(),
      text: String(text || ''),
      coveredFromMessageId: coveredFromMessageId ?? null,
      coveredThroughMessageId: coveredThroughMessageId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const nextMap = { ...existingMap, [characterId]: [...existingEntries, entry] };
    await db.bubbleRooms.update(numericId, { memberSummaries: nextMap });
    return nextMap;
  } catch (err) {
    console.error('[bubbleService] 追加房间总结条目失败:', err);
    return null;
  }
};

/**
 * 设置面板里编辑某个角色的某一条总结条目正文（不影响它的覆盖范围/顺序）。
 */
export const updateBubbleMemberSummaryEntryText = async (roomId, characterId, entryId, text) => {
  if (roomId === null || roomId === undefined) return;
  try {
    const numericId = Number(roomId);
    const room = await db.bubbleRooms.get(numericId);
    const existingMap = room?.memberSummaries || {};
    const existingEntries = Array.isArray(existingMap[characterId]) ? existingMap[characterId] : [];
    const nextEntries = existingEntries.map((entry) => (
      entry.id === entryId ? { ...entry, text: String(text || ''), updatedAt: Date.now() } : entry
    ));
    const nextMap = { ...existingMap, [characterId]: nextEntries };
    await db.bubbleRooms.update(numericId, { memberSummaries: nextMap });
    return nextMap;
  } catch (err) {
    console.error('[bubbleService] 编辑房间总结条目失败:', err);
    return null;
  }
};

/**
 * 设置面板里删除某个角色的某一条总结条目。删掉之后不会重新触发那一段
 * 消息的自动总结——"下一次覆盖到哪条消息"看的是这个角色剩下条目里最后
 * 一个的 coveredThroughMessageId，删掉中间某一条不影响这个判断，只是AI
 * 以后看不到那一段的提要了（原始消息本身没删）。
 */
export const deleteBubbleMemberSummaryEntry = async (roomId, characterId, entryId) => {
  if (roomId === null || roomId === undefined) return;
  try {
    const numericId = Number(roomId);
    const room = await db.bubbleRooms.get(numericId);
    const existingMap = room?.memberSummaries || {};
    const existingEntries = Array.isArray(existingMap[characterId]) ? existingMap[characterId] : [];
    const nextEntries = existingEntries.filter((entry) => entry.id !== entryId);
    const nextMap = { ...existingMap, [characterId]: nextEntries };
    await db.bubbleRooms.update(numericId, { memberSummaries: nextMap });
    return nextMap;
  } catch (err) {
    console.error('[bubbleService] 删除房间总结条目失败:', err);
    return null;
  }
};

export default {
  MAX_MEMBERS,
  getAllBubbleRooms,
  getBubbleRoomById,
  createBubbleRoom,
  deleteBubbleRoom,
  getBubbleMessages,
  addBubbleMessage,
  getBubbleMemberSummaryEntries,
  addBubbleMemberSummaryEntry,
  updateBubbleMemberSummaryEntryText,
  deleteBubbleMemberSummaryEntry,
};