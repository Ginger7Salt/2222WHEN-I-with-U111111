// src/apps/rp/rpService.js
//
// 长RP子应用 —— 切片A：只有 rpSessions 这一张表的增删查改，照抄
// bubbleService.js 当初切片A的做法（只建这一局真正需要的表，
// 消息表/预设表/世界书表全部留到各自要用到的切片再建，不提前铺）。
//
// rpSessions 记录本身携带一批非索引字段，切片A阶段先写入合理默认值，
// 后面每加一个切片（预设系统、世界书、签名徽章……）就往这条记录上
// 追加对应字段，不需要为这些新增字段单独升级 db 版本号
// （Dexie 的 .stores() 字符串只需要列出参与查询的索引字段）。
//
// 字段说明（非索引，创建时就先占位好，方便后面切片直接读写）：
//   - presetId：绑定的 prompt 预设 id，切片A还没有预设系统，先固定为 null
//   - contextWindowSize：上下文窗口大小，默认 60（可在设置里调节）
//   - summaryIntervalTurns：自动总结间隔，默认 50 轮
//   - userName / userAvatar / userPersona：本会话独立的user人设
//   - userTitle / userSignature / userBadgeImage：本会话独立的user签名徽章
//   - attachedWorldBookIds：挂载的世界书 id 数组，切片A还没有世界书表，先固定为 []
//   - collapseEarlierFloors：是否手动隐藏/折叠早期楼层
//   - allowHtml：是否允许AI输出的HTML内联CSS被渲染。跟用户确认过，这个
//     开关放在会话设置里，不放在预设（rpPresets）上——切片B补的字段。
//   - summaryText：滚动更新的"前情提要"文本，切片D补的字段。每次总结都是
//     "旧提要 + 新发生的剧情 -> 融合成新提要"整份覆盖，不是追加。
//   - summaryCoveredThroughMessageId：目前的 summaryText 已经覆盖到了
//     哪条消息（按 rpMessages 自增id），用来算"这次总结完之后又新发生了
//     多少条消息，够不够再触发一次"，不需要另外记一个计数器。

import db from '../../db';
import { deleteAllRpMessagesForSession } from './rpMessageService';

/**
 * 按更新时间倒序，取所有长RP会话列表。
 */
export const getAllRpSessions = async () => {
  try {
    return await db.rpSessions.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    console.error('[rpService] 获取会话列表失败:', err);
    return [];
  }
};

/**
 * 获取单个会话详情。
 */
export const getRpSessionById = async (sessionId) => {
  if (sessionId === null || sessionId === undefined) return null;
  try {
    return await db.rpSessions.get(Number(sessionId));
  } catch (err) {
    console.error('[rpService] 获取会话详情失败:', err);
    return null;
  }
};

/**
 * 新建一个长RP会话。角色一旦选定就不能中途更换（跟用户确认过：换角色
 * 等于换了一个人设，应该新建会话而不是改设置），所以这里的 characterId
 * 就是这条记录唯一一次写入 characterId 的地方。
 */
export const createRpSession = async ({ characterId, title } = {}) => {
  const trimmedTitle = String(title || '').trim();
  if (!characterId || !trimmedTitle) return null;

  try {
    const now = Date.now();
    const newId = await db.rpSessions.add({
      characterId: Number(characterId),
      title: trimmedTitle,
      createdAt: now,
      updatedAt: now,

      // 预设系统留到下一个切片，先占位
      presetId: null,

      // 上下文与总结（切片A就先按已确认的默认值写好，设置面板那个切片
      // 再做"调节"这个动作本身）
      contextWindowSize: 60,
      summaryIntervalTurns: 50,

      // 本会话独立的user人设/签名徽章
      userName: '',
      userAvatar: '',
      userPersona: '',
      userTitle: '',
      userSignature: '',
      userBadgeImage: '',

      // 世界书系统留到那个切片再建表，这里先占位空数组
      attachedWorldBookIds: [],

      // 楼层管理
      collapseEarlierFloors: false,

      // HTML内联CSS渲染开关（切片B：跟预设分开，属于会话设置）
      allowHtml: false,

      // 前情提要（切片D）
      summaryText: '',
      summaryCoveredThroughMessageId: null,
    });
    return newId;
  } catch (err) {
    console.error('[rpService] 创建会话失败:', err);
    return null;
  }
};

/**
 * 删除一个长RP会话，级联删掉这个会话下的所有 rpMessages
 * （照抄 bubbleService.deleteBubbleRoom 级联删 bubbleMessages 的做法）。
 */
export const deleteRpSession = async (sessionId) => {
  if (sessionId === null || sessionId === undefined) return;
  const numericId = Number(sessionId);
  try {
    await deleteAllRpMessagesForSession(numericId);
    await db.rpSessions.delete(numericId);
  } catch (err) {
    console.error('[rpService] 删除会话失败:', err);
  }
};

/**
 * 切换本会话绑定的预设。传 null 等于"取消绑定"——组装函数在
 * preset 找不到时会静默退回成只有历史文本，不会报错。
 */
export const updateRpSessionPreset = async (sessionId, presetId) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    await db.rpSessions.update(Number(sessionId), {
      presetId: presetId === null || presetId === undefined ? null : Number(presetId),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[rpService] 切换预设失败:', err);
  }
};

/**
 * 切换"折叠早期楼层"这个开关（纯UI显示偏好，不影响AI能看到多少历史——
 * AI那边永远是按 contextWindowSize 截取，跟这个开关是两件事）。
 */
export const updateRpSessionCollapse = async (sessionId, collapseEarlierFloors) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    await db.rpSessions.update(Number(sessionId), {
      collapseEarlierFloors: Boolean(collapseEarlierFloors),
    });
  } catch (err) {
    console.error('[rpService] 切换楼层折叠失败:', err);
  }
};

/**
 * 写入一次新的前情提要（rpAiService 的自动总结流程调用）。
 */
export const updateRpSessionSummary = async (sessionId, { summaryText, summaryCoveredThroughMessageId }) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    await db.rpSessions.update(Number(sessionId), {
      summaryText: String(summaryText || ''),
      summaryCoveredThroughMessageId,
    });
  } catch (err) {
    console.error('[rpService] 写入前情提要失败:', err);
  }
};

/**
 * 切换本会话挂载的世界书列表（整份覆盖，不是增量）。
 */
export const updateRpSessionWorldBooks = async (sessionId, attachedWorldBookIds) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    await db.rpSessions.update(Number(sessionId), {
      attachedWorldBookIds: Array.isArray(attachedWorldBookIds) ? attachedWorldBookIds : [],
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[rpService] 切换世界书挂载失败:', err);
  }
};

export default {
  getAllRpSessions,
  getRpSessionById,
  createRpSession,
  deleteRpSession,
  updateRpSessionPreset,
  updateRpSessionCollapse,
  updateRpSessionSummary,
  updateRpSessionWorldBooks,
};