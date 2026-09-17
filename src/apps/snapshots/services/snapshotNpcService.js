// src/apps/snapshots/services/snapshotNpcService.js
//
// 【新建文件说明】
// 替代旧的全局 `db.snapshotSettings.get('npcs')` 存储方式。
// NPC 现在按 chatId 专属，存在 db.snapshotNpcs 表（见 db v49 迁移）。
//
import db from '../../../db';

/**
 * 获取某个 chat（世界线）下的所有 NPC，按创建时间升序排列。
 */
export const getNpcsByChatId = async (chatId) => {
  if (!chatId) return [];
  try {
    const numericChatId = Number(chatId);
    const list = await db.snapshotNpcs
      .where('chatId')
      .equals(numericChatId)
      .sortBy('createdAt');
    return list;
  } catch (err) {
    console.error('[snapshotNpcService] 获取 NPC 列表失败:', err);
    return [];
  }
};

/**
 * 获取单个 NPC。
 */
export const getNpcById = async (npcId) => {
  if (npcId === null || npcId === undefined) return null;
  try {
    return await db.snapshotNpcs.get(Number(npcId));
  } catch (err) {
    console.error('[snapshotNpcService] 获取 NPC 详情失败:', err);
    return null;
  }
};

/**
 * 新增一个 NPC，归属到指定 chatId。
 */
export const addNpc = async (chatId, { name, roleTag, avatar } = {}) => {
  if (!chatId || !name || !String(name).trim()) return null;
  try {
    const numericChatId = Number(chatId);
    const newId = await db.snapshotNpcs.add({
      chatId: numericChatId,
      name: String(name).trim(),
      roleTag: (roleTag && String(roleTag).trim()) || '路人NPC',
      avatar: avatar || '',
      createdAt: Date.now()
    });
    return newId;
  } catch (err) {
    console.error('[snapshotNpcService] 新增 NPC 失败:', err);
    return null;
  }
};

/**
 * 删除一个 NPC。
 * 注意：不级联删除该 NPC 已发出的历史动态/评论，保留历史记录的完整性，
 * 仅从"可选人选池"中移除，避免以后再被抽中或在设置里再被选择。
 */
export const deleteNpc = async (npcId) => {
  if (npcId === null || npcId === undefined) return;
  try {
    await db.snapshotNpcs.delete(Number(npcId));
  } catch (err) {
    console.error('[snapshotNpcService] 删除 NPC 失败:', err);
  }
};

export default {
  getNpcsByChatId,
  getNpcById,
  addNpc,
  deleteNpc
};