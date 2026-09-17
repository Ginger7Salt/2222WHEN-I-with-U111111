// src/apps/snapshots/services/snapshotRelationService.js
//
// 【新建文件说明】
// 通用关系服务：支持"角色↔角色"、"角色↔NPC"、"NPC↔NPC"任意组合的关系配置，
// 且关系被限定在具体某个 chatId（世界线）之下（配合 db v49 的 snapshotRelations 新结构）。
//
// 同时提供"官配"概念：每个 chat 绑定的 character 默认就是 user 的伴侣，
// 这个关系不存于 snapshotRelations 表里，而是直接从 chats 表推导。
//
import db from '../../../db';

/**
 * 获取某个 chat 绑定的"官配"角色 ID（即该世界线里 user 的男/女朋友）。
 * 返回 null 表示该 chat 未绑定任何角色。
 */
export const getOfficialCoupleCharacterId = async (chatId) => {
  if (!chatId) return null;
  try {
    const chat = await db.chats.get(Number(chatId));
    return chat?.characterId ? Number(chat.characterId) : null;
  } catch (err) {
    console.error('[snapshotRelationService] 获取官配角色失败:', err);
    return null;
  }
};

/**
 * 获取某个 chat 世界线下的全部关系记录（供设置页展示用）。
 * 不包含旧版软废弃数据（chatId 为 null 的历史记录）。
 */
export const getRelationsByChatId = async (chatId) => {
  if (!chatId) return [];
  try {
    const numericChatId = Number(chatId);
    return await db.snapshotRelations
      .where('chatId')
      .equals(numericChatId)
      .toArray();
  } catch (err) {
    console.error('[snapshotRelationService] 获取关系列表失败:', err);
    return [];
  }
};

/**
 * 双向查找 A<->B 之间是否配置了关系。
 * sourceType/targetType: 'character' | 'npc'
 * 顺序不敏感：查询 (A,B) 或 (B,A) 任一方向命中即返回。
 */
export const findRelation = async (chatId, aType, aId, bType, bId) => {
  if (!chatId || aId === null || aId === undefined || bId === null || bId === undefined) {
    return null;
  }
  try {
    const numericChatId = Number(chatId);
    const numericAId = Number(aId);
    const numericBId = Number(bId);

    const all = await db.snapshotRelations
      .where('chatId')
      .equals(numericChatId)
      .toArray();

    const matched = all.find((rel) => {
      const forward =
        rel.sourceType === aType && Number(rel.sourceId) === numericAId &&
        rel.targetType === bType && Number(rel.targetId) === numericBId;
      const backward =
        rel.sourceType === bType && Number(rel.sourceId) === numericBId &&
        rel.targetType === aType && Number(rel.targetId) === numericAId;
      return forward || backward;
    });

    return matched || null;
  } catch (err) {
    console.error('[snapshotRelationService] 查找关系失败:', err);
    return null;
  }
};

/**
 * 新增一条关系记录。
 * source/target 格式: { type: 'character'|'npc', id: number }
 */
export const addRelation = async (chatId, source, target, relationText) => {
  if (!chatId || !source?.type || !source?.id || !target?.type || !target?.id) return null;
  if (source.type === target.type && Number(source.id) === Number(target.id)) return null;
  if (!relationText || !String(relationText).trim()) return null;

  try {
    const newId = await db.snapshotRelations.add({
      chatId: Number(chatId),
      sourceType: source.type,
      sourceId: Number(source.id),
      targetType: target.type,
      targetId: Number(target.id),
      relation: String(relationText).trim(),
      createdAt: Date.now()
    });
    return newId;
  } catch (err) {
    console.error('[snapshotRelationService] 新增关系失败:', err);
    return null;
  }
};

/**
 * 删除一条关系记录。
 */
export const deleteRelation = async (relationId) => {
  if (relationId === null || relationId === undefined) return;
  try {
    await db.snapshotRelations.delete(Number(relationId));
  } catch (err) {
    console.error('[snapshotRelationService] 删除关系失败:', err);
  }
};

export default {
  getOfficialCoupleCharacterId,
  getRelationsByChatId,
  findRelation,
  addRelation,
  deleteRelation
};