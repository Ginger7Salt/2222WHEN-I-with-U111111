// src/apps/bubble/bubbleService.js
//
// 泡泡模式（Bubble Mode）切片A：房间的增删查改。
// 参照 ensembleService.js / EnsembleApp.jsx 里 ensembleChats 表的写法——
// 房间本身是一条 bubbleRooms 记录，成员名单 selectedCharacterIds 是内联
// 的非索引数组字段，不单独建成员关系表。
//
// 这一版只做房间外壳，不含消息收发（切片B）、@定向可见度（切片C）、
// 记忆写入（切片D），相关字段/表会在对应切片里再加，这里先不预留。

import db from '../../db';

const MAX_MEMBERS = 8;

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
 * 删除一个泡泡房间。
 * 切片A还没有 bubbleMessages 表，暂时不需要级联删消息；
 * 切片B加上消息表之后，这里要记得补上级联删除。
 */
export const deleteBubbleRoom = async (roomId) => {
  if (roomId === null || roomId === undefined) return;
  try {
    await db.bubbleRooms.delete(Number(roomId));
  } catch (err) {
    console.error('[bubbleService] 删除房间失败:', err);
  }
};

export default {
  MAX_MEMBERS,
  getAllBubbleRooms,
  getBubbleRoomById,
  createBubbleRoom,
  deleteBubbleRoom,
};