// src/apps/snapshots/services/snapshotNpcService.js
//
// 【新建文件说明】
// 替代旧的全局 `db.snapshotSettings.get('npcs')` 存储方式。
// NPC 现在按 chatId 专属，存在 db.snapshotNpcs 表（见 db v49 迁移）。
//
import db from '../../../db';
import { extractOrInventNpcs, generateNpcPersonaText } from './snapshotAiService';

const AUTO_NPC_TARGET_COUNT = 3;
const autoSeedSettingKey = (chatId) => `snapshotNpcAutoSeeded_${chatId}`;

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
 * source: 'manual'（用户自己在设置里加的，默认值） | 'auto'（AI自动补齐的）——
 * 只是个标记字段，用来在 NPC 管理列表里区分来源，不影响任何发帖/评论逻辑。
 */
export const addNpc = async (chatId, { name, roleTag, avatar, source } = {}) => {
  if (!chatId || !name || !String(name).trim()) return null;
  try {
    const numericChatId = Number(chatId);
    const newId = await db.snapshotNpcs.add({
      chatId: numericChatId,
      name: String(name).trim(),
      roleTag: (roleTag && String(roleTag).trim()) || '路人NPC',
      avatar: avatar || '',
      source: source === 'auto' ? 'auto' : 'manual',
      createdAt: Date.now()
    });
    return newId;
  } catch (err) {
    console.error('[snapshotNpcService] 新增 NPC 失败:', err);
    return null;
  }
};

/**
 * 背景调度器每轮巡检时调用：如果这个 chat 从来没有任何 NPC（用户没手动加，
 * 也从没自动补过），就跑一次 AI 补齐——优先从角色人设里找已经提到的配角，
 * 不够再自由发挥凑够 ${AUTO_NPC_TARGET_COUNT} 个，写进 NPC 库长期持续
 * （跟手动添加的 NPC 完全一样，能在 NPC 管理里看到、编辑、删除）。
 *
 * 只会自动补这一次：用 db.settings 里的 `snapshotNpcAutoSeeded_${chatId}`
 * 标记"是否已经尝试过"，避免用户之后手动删光了 NPC 又被自动重新填满。
 * 这个标记只在 AI 调用真正跑完（不管成功生成几个）之后才会写入——如果
 * 中途报错（例如临时网络问题），不标记，下一轮巡检还会再试一次。
 */
export const ensureAutoNpcPool = async (chatId, character, chat = null) => {
  if (!chatId) return;
  const numericChatId = Number(chatId);

  try {
    const existing = await getNpcsByChatId(numericChatId);
    if (existing.length > 0) return;

    const seededFlag = await db.settings.get(autoSeedSettingKey(numericChatId));
    if (seededFlag?.value) return;

    const userAliases = chat
      ? { userName: chat.userName || '', userPersona: chat.userPersona || '' }
      : null;

    const invented = await extractOrInventNpcs(character, AUTO_NPC_TARGET_COUNT, userAliases);
    for (const item of invented) {
      await addNpc(numericChatId, { name: item.name, roleTag: item.roleTag, source: 'auto' });
    }

    await db.settings.put({ key: autoSeedSettingKey(numericChatId), value: true });
  } catch (err) {
    console.error('[snapshotNpcService] 自动补齐 NPC 失败:', err);
  }
};

/**
 * 确保某个 NPC 已经有固化的人设/说话风格描述（npc.personaSummary，
 * 存在 db.snapshotNpcs 的一个新增的、不需要建索引的普通字段上）。
 * 已经有的话原样返回；没有的话调用AI生成一次并永久写回数据库，
 * 之后每次这个NPC发帖/评论/回复都复用同一份，保证长期人设一致，
 * 也是这次修"NPC容易被char夺舍/OOC"问题的关键——之前NPC只有
 * name+roleTag，人设太单薄，容易被prompt里其他人的语气带跑偏。
 *
 * 返回值是"确保已带上 personaSummary"的npc对象（不是void），方便
 * 调用方直接拿返回值继续往下传给 generateNpcPost/generateSnapshotComment
 * /generateSnapshotReply，不需要调用方自己再查一次数据库。
 */
export const ensureNpcPersona = async (npc, character) => {
  if (!npc) return npc;
  if (npc.personaSummary) return npc;

  try {
    const personaSummary = await generateNpcPersonaText(npc, character);
    if (npc.id !== null && npc.id !== undefined) {
      await db.snapshotNpcs.update(Number(npc.id), { personaSummary });
    }
    return { ...npc, personaSummary };
  } catch (err) {
    console.error(`[snapshotNpcService] NPC(${npc?.name}) 人设固化失败:`, err);
    return npc;
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
  deleteNpc,
  ensureAutoNpcPool,
  ensureNpcPersona
};