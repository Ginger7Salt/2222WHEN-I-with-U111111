// src/apps/bubble/bubbleService.js
//
// 泡泡模式（Bubble Mode）房间和消息的增删查改。
// 参照 ensembleService.js / EnsembleApp.jsx 里 ensembleChats 表的写法——
// 房间本身是一条 bubbleRooms 记录，成员名单 selectedCharacterIds 是内联
// 的非索引数组字段，不单独建成员关系表。
//
// 切片B新增：bubbleMessages 表的读写（getBubbleMessages/addBubbleMessage），
// 以及 ensureCharacterChatId——把一个角色的回复镜像写进它自己真实的一对一
// 聊天记录（用于免费接入现有记忆系统，见 bubbleAiService.js 顶部注释）时，
// 如果这个角色压根还没有一对一聊天记录，就悄悄帮它建一个空的（跟
// messages/NewChatModal.jsx 新建聊天时的默认字段保持一致），这是跟用户
// 确认过的方案。
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

/**
 * 确保一个角色有一条真实的一对一聊天记录（chats 表），没有就静默建一个
 * 空的——字段照抄 messages/NewChatModal.jsx 新建聊天时的默认值，这样
 * 用户万一自己点进这条聊天，看到的是正常的空聊天而不是残缺数据。
 *
 * 泡泡模式用这条聊天的 chatId 给角色在房间里的回复挂记忆（见
 * bubbleAiService.js），角色自己一对一聊天的消息列表/AI上下文永远不会
 * 读到泡泡模式写进去的内容（那些消息打了 mode:'bubble' 标记，
 * ChatRoom.jsx / aiService.js 读取消息的几处已经排除掉这个 mode）。
 */
export const ensureCharacterChatId = async (characterId) => {
  try {
    const existing = await db.chats.where('characterId').equals(characterId).first();
    if (existing) return existing.id;

    const character = await db.characters.get(characterId);
    if (!character) return null;

    const now = new Date().toISOString();

    return await db.chats.add({
      characterId,
      mode: 'real',
      title: character.name,
      updatedAt: now,
      userName: character.userName || '',
      userAvatar: character.userAvatar || '',
      userPersona: character.userPersona || '',
      inputPlaceholder: `与 ${character.name} 倾诉...`,
      typingText: '',
      keepAlive: false,
    });
  } catch (err) {
    console.error('[bubbleService] 确保角色一对一聊天记录失败:', err);
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
  ensureCharacterChatId,
};