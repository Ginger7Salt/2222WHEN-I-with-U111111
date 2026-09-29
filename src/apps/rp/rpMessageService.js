// src/apps/rp/rpMessageService.js
//
// 长RP子应用切片C：rpMessages 表的增删查改。
//
// 表结构（确认过：一次AI回合=一条记录，不做 ||| 多气泡拆分，段落靠
// 消息内容里的换行直接表现，一个卡片完全放得下）：
//   - sessionId：属于哪个长RP会话
//   - senderType：'user' | 'character'
//   - content：当前展示/参与拼装历史的正文（= versions[currentVersionIndex]）
//   - versions：这条消息的所有版本（纯文本数组）。用户消息通常只有一个
//     版本（编辑时直接覆盖，不留历史版本）；角色消息在"重新生成"时会往
//     这个数组追加新版本，配合 currentVersionIndex 做"翻页"式的版本切换，
//     跟 messages 表 msg.versions/currentVersionIndex 是同一个思路。
//   - currentVersionIndex：当前展示的是 versions 里的第几个
//   - sceneImage：这条消息装饰用的场景图（data URL），可以为空。切片C
//     阶段只有数据结构和渲染器认这个字段，composer 还没有上传入口
//     （跟用户确认过，上传入口留到以后）。
//   - timestamp：ISO字符串，跟 [sessionId+timestamp] 复合索引配合排序

import Dexie from 'dexie';
import db from '../../db';

/**
 * 按时间正序取一个长RP会话的全部消息。
 */
export const getRpMessages = async (sessionId) => {
  if (sessionId === null || sessionId === undefined) return [];
  const numericId = Number(sessionId);

  try {
    return await db.rpMessages
      .where('[sessionId+timestamp]')
      .between([numericId, Dexie.minKey], [numericId, Dexie.maxKey])
      .toArray();
  } catch (err) {
    console.error('[rpMessageService] 获取消息列表失败:', err);
    return [];
  }
};

/**
 * 新增一条消息。content 会被同时写成 versions 的第一个（唯一）元素，
 * 调用方不需要自己拼 versions/currentVersionIndex。
 */
export const addRpMessage = async ({ sessionId, senderType, content, sceneImage = '', timestamp } = {}) => {
  const trimmed = String(content || '');
  try {
    return await db.rpMessages.add({
      sessionId: Number(sessionId),
      senderType,
      content: trimmed,
      versions: [trimmed],
      currentVersionIndex: 0,
      sceneImage,
      timestamp: timestamp || new Date().toISOString(),
    });
  } catch (err) {
    console.error('[rpMessageService] 写入消息失败:', err);
    return null;
  }
};

/**
 * 给一条已有的角色消息追加一个新版本（重新生成用），并把
 * currentVersionIndex 指向新追加的这一个——重新生成完，用户当然是先看
 * 新结果，不满意再自己往回翻。
 */
export const appendRpMessageVersion = async (messageId, newContent) => {
  if (messageId === null || messageId === undefined) return;
  try {
    const msg = await db.rpMessages.get(Number(messageId));
    if (!msg) return;

    const versions = [...(msg.versions || [msg.content]), String(newContent || '')];
    await db.rpMessages.update(Number(messageId), {
      versions,
      currentVersionIndex: versions.length - 1,
      content: versions[versions.length - 1],
    });
  } catch (err) {
    console.error('[rpMessageService] 追加版本失败:', err);
  }
};

/**
 * 翻版本（左右箭头），纯粹在已有 versions 数组里挪 currentVersionIndex，
 * 不产生新的AI请求。direction 是 -1 或 1。
 */
export const switchRpMessageVersion = async (messageId, direction) => {
  if (messageId === null || messageId === undefined) return null;
  try {
    const msg = await db.rpMessages.get(Number(messageId));
    if (!msg || !Array.isArray(msg.versions) || msg.versions.length <= 1) return null;

    const nextIndex = msg.currentVersionIndex + direction;
    if (nextIndex < 0 || nextIndex >= msg.versions.length) return null;

    await db.rpMessages.update(Number(messageId), {
      currentVersionIndex: nextIndex,
      content: msg.versions[nextIndex],
    });
    return nextIndex;
  } catch (err) {
    console.error('[rpMessageService] 切换版本失败:', err);
    return null;
  }
};

/**
 * 编辑一条消息并截断：更新这条消息当前版本的文字（不新增版本，直接覆盖
 * ——编辑不是"重新生成的另一种可能"，是"这句话原本就该是这样"），然后
 * 硬删除这个会话里、这条消息之后的所有消息。调用方负责在这之前弹确认
 * 对话框——这里不问，传进来就真删。
 */
export const editRpMessageAndTruncate = async (sessionId, messageId, newContent) => {
  if (sessionId === null || messageId === null || messageId === undefined) return;
  const numericSessionId = Number(sessionId);
  const numericMessageId = Number(messageId);

  try {
    const target = await db.rpMessages.get(numericMessageId);
    if (!target) return;

    const versions = [...(target.versions || [target.content])];
    versions[target.currentVersionIndex] = String(newContent || '');

    await db.rpMessages.update(numericMessageId, {
      content: versions[target.currentVersionIndex],
      versions,
    });

    await db.rpMessages
      .where('[sessionId+timestamp]')
      .between([numericSessionId, target.timestamp], [numericSessionId, Dexie.maxKey])
      .filter((m) => m.id !== numericMessageId)
      .delete();
  } catch (err) {
    console.error('[rpMessageService] 编辑并截断失败:', err);
  }
};

/**
 * 删除一个会话下的全部消息——rpService.deleteRpSession 级联删除时调用。
 */
export const deleteAllRpMessagesForSession = async (sessionId) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    await db.rpMessages.where('sessionId').equals(Number(sessionId)).delete();
  } catch (err) {
    console.error('[rpMessageService] 级联删除会话消息失败:', err);
  }
};

export default {
  getRpMessages,
  addRpMessage,
  appendRpMessageVersion,
  switchRpMessageVersion,
  editRpMessageAndTruncate,
  deleteAllRpMessagesForSession,
};