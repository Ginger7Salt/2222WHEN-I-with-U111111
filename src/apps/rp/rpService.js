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
//   - summaryEntries：切片D字段，跟用户确认过不能做成"一份滚动覆盖的总结
//     整段文本"——每 summaryIntervalTurns 轮触发一次自动总结，都是单独一
//     个条目 { id, text, coveredFromMessageId, coveredThroughMessageId,
//     createdAt, updatedAt }，条目之间互不覆盖，各自可以单独编辑/删除。
//     "现在总结覆盖到哪条消息了"直接取最后一个条目的 coveredThroughMessageId
//     （没有条目就是0），不用另外维护一个游标字段。组装system prompt时把
//     所有条目的 text 按顺序拼起来当"前情提要"喂给AI。
//   - bgImage / bgOpacity / isBgDimmed：整个聊天室的背景图（设置面板补的
//     字段），跟 bubbleRooms 那套同名字段是同一个思路：isBgDimmed=true 时
//     背景图按 bgOpacity 淡化叠加在聊天室底色上，false 时显示原图。
//   - avatarBackdropEnabled / avatarBackdropImage：角色/user头像背后单独的
//     背景图开关（不同于上面整个聊天室的背景图，也不同于 RpMessageCard.jsx
//     里 message.sceneImage 那个每条消息各自的场景图）。关闭时头像背后是
//     透明的；开启且上传了图才显示。
//   - foldTagNames / thinkingLabelText：思维链折叠（设置面板补的字段）。
//     foldTagNames 是需要被折叠渲染的标签名数组（比如 ['thinking']），具体
//     折哪些标签由用户自己填，不是写死只认一种写法；清空数组等于关闭折叠。
//     thinkingLabelText 是折叠框收起时显示的那行字，同样是用户自己写的，
//     不是写死的"思考了一会"。这两个字段只影响渲染，message.content 在
//     数据库里永远保留AI原样输出的带标签全文。
//
// 2026-09 新增：
//   - userAvatar：本会话独立的user头像（之前这个字段一直存在、
//     RpMessageCard.jsx 也一直在读，但设置面板从来没给它做编辑入口——
//     现在补上，UI写法照抄 userBadgeImage 那一套 ImagePickerRow）。
//   - cardPresetId / cardCornerRadius：消息卡片的样式（字体/行距/圆角），
//     见 rpCardStylePresets.js。跟用户确认过的方案是"预设为主+可微调"：
//     cardPresetId 选中某一套预设（决定 fontFamily/lineHeight/圆角默认值），
//     cardCornerRadius 是圆角的手动微调覆盖值（null 就是跟着预设走）。
//     字号复用已经存在的 fontSize 字段（之前有读取但没有编辑入口，这次
//     一起把设置面板的输入框补上）。



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

      // 消息卡片样式（设置面板）：默认用"衬线古典"这套预设，圆角不覆盖
      // （跟着预设走），字号留空等于回退 RpMessageCard.jsx 里的 14.5px 默认值。
      cardPresetId: 'classic-serif',
      cardCornerRadius: null,
      fontSize: null,

      // 世界书系统留到那个切片再建表，这里先占位空数组
      attachedWorldBookIds: [],

      // 楼层管理
      collapseEarlierFloors: false,

      // HTML内联CSS渲染开关（切片B：跟预设分开，属于会话设置）
      allowHtml: false,

      // 前情提要（切片D）：每次自动总结是一个独立条目，见文件头注释
      summaryEntries: [],

      // 整个聊天室的背景图（设置面板）
      bgImage: '',
      bgOpacity: 0.3,
      isBgDimmed: true,

      // 头像背后的背景图开关（设置面板，跟整间聊天室的背景图分开）
      avatarBackdropEnabled: false,
      avatarBackdropImage: '',

      // 思维链折叠（设置面板）：foldTagNames 是需要被折叠的标签名数组，
      // 具体是哪些标签由用户自己填，不写死只认 <thinking>；清空这个数组
      // 就是关掉折叠功能。thinkingLabelText 是折叠框收起时显示的那行字，
      // 也是用户自己写的，不是写死的"思考了一会"。
      foldTagNames: ['thinking'],
      thinkingLabelText: '点击查看思考过程',
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

const makeSummaryEntryId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

/**
 * 追加一个新的总结条目（rpAiService 的自动总结流程调用，每触发一次算
 * 一个独立条目，不覆盖之前的）。
 */
export const addRpSessionSummaryEntry = async (sessionId, { text, coveredFromMessageId, coveredThroughMessageId }) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const numericId = Number(sessionId);
    const session = await db.rpSessions.get(numericId);
    const existing = Array.isArray(session?.summaryEntries) ? session.summaryEntries : [];
    const now = Date.now();
    const entry = {
      id: makeSummaryEntryId(),
      text: String(text || ''),
      coveredFromMessageId: coveredFromMessageId ?? null,
      coveredThroughMessageId: coveredThroughMessageId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.rpSessions.update(numericId, { summaryEntries: [...existing, entry] });
  } catch (err) {
    console.error('[rpService] 追加总结条目失败:', err);
  }
};

/**
 * 设置面板里编辑某一条总结条目的正文（不影响它的覆盖范围/顺序）。
 */
export const updateRpSessionSummaryEntryText = async (sessionId, entryId, text) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const numericId = Number(sessionId);
    const session = await db.rpSessions.get(numericId);
    const existing = Array.isArray(session?.summaryEntries) ? session.summaryEntries : [];
    const next = existing.map((entry) => (
      entry.id === entryId ? { ...entry, text: String(text || ''), updatedAt: Date.now() } : entry
    ));
    await db.rpSessions.update(numericId, { summaryEntries: next });
  } catch (err) {
    console.error('[rpService] 编辑总结条目失败:', err);
  }
};

/**
 * 设置面板里删除某一条总结条目。删除之后不会重新触发对应那一段消息的
 * 自动总结——"下一次覆盖到哪条消息"是看剩下条目里最后一个的
 * coveredThroughMessageId，删掉中间某一条不影响这个判断，只是AI以后看不
 * 到那一段的提要了（还是能看到原始消息，除非那批消息已经被存档移出）。
 */
export const deleteRpSessionSummaryEntry = async (sessionId, entryId) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const numericId = Number(sessionId);
    const session = await db.rpSessions.get(numericId);
    const existing = Array.isArray(session?.summaryEntries) ? session.summaryEntries : [];
    const next = existing.filter((entry) => entry.id !== entryId);
    await db.rpSessions.update(numericId, { summaryEntries: next });
  } catch (err) {
    console.error('[rpService] 删除总结条目失败:', err);
  }
};

/**
 * 设置面板里编辑本会话独立的user人设/签名徽章（同一批字段一次性提交）。
 */
export const updateRpSessionUserProfile = async (sessionId, { userName, userAvatar, userPersona, userTitle, userSignature, userBadgeImage } = {}) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const patch = {};
    if (userName !== undefined) patch.userName = String(userName || '').trim();
    if (userAvatar !== undefined) patch.userAvatar = userAvatar || '';
    if (userPersona !== undefined) patch.userPersona = String(userPersona || '').trim();
    if (userTitle !== undefined) patch.userTitle = String(userTitle || '').trim();
    if (userSignature !== undefined) patch.userSignature = String(userSignature || '').trim();
    if (userBadgeImage !== undefined) patch.userBadgeImage = userBadgeImage || '';
    await db.rpSessions.update(Number(sessionId), patch);
  } catch (err) {
    console.error('[rpService] 编辑user人设失败:', err);
  }
};

/**
 * 设置面板里编辑消息卡片样式：选中的预设 + 圆角手动覆盖值 + 字号。
 * cardCornerRadius 传 null 等于"跟着预设走，不手动覆盖"。
 */
export const updateRpSessionCardStyle = async (sessionId, { cardPresetId, cardCornerRadius, fontSize } = {}) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const patch = {};
    if (cardPresetId !== undefined) patch.cardPresetId = cardPresetId || 'classic-serif';
    if (cardCornerRadius !== undefined) patch.cardCornerRadius = cardCornerRadius === null ? null : Number(cardCornerRadius);
    if (fontSize !== undefined) patch.fontSize = fontSize === null ? null : Number(fontSize);
    await db.rpSessions.update(Number(sessionId), patch);
  } catch (err) {
    console.error('[rpService] 编辑消息卡片样式失败:', err);
  }
};

/**
 * 设置面板里编辑整个聊天室的背景图（bgImage 为空字符串等于清除背景图）。
 */
export const updateRpSessionBackground = async (sessionId, { bgImage, bgOpacity, isBgDimmed } = {}) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const patch = {};
    if (bgImage !== undefined) patch.bgImage = bgImage || '';
    if (bgOpacity !== undefined) patch.bgOpacity = Number(bgOpacity);
    if (isBgDimmed !== undefined) patch.isBgDimmed = Boolean(isBgDimmed);
    await db.rpSessions.update(Number(sessionId), patch);
  } catch (err) {
    console.error('[rpService] 编辑聊天室背景图失败:', err);
  }
};

/**
 * 设置面板里编辑头像背后的背景图开关（跟上面整个聊天室的背景图是两件事，
 * 关闭时头像背后透明）。
 */
export const updateRpSessionAvatarBackdrop = async (sessionId, { avatarBackdropEnabled, avatarBackdropImage } = {}) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const patch = {};
    if (avatarBackdropEnabled !== undefined) patch.avatarBackdropEnabled = Boolean(avatarBackdropEnabled);
    if (avatarBackdropImage !== undefined) patch.avatarBackdropImage = avatarBackdropImage || '';
    await db.rpSessions.update(Number(sessionId), patch);
  } catch (err) {
    console.error('[rpService] 编辑头像背景图失败:', err);
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

/**
 * 设置面板里编辑思维链折叠配置：要折叠哪些标签、折叠框收起时显示什么字。
 */
export const updateRpSessionThinkingFold = async (sessionId, { foldTagNames, thinkingLabelText } = {}) => {
  if (sessionId === null || sessionId === undefined) return;
  try {
    const patch = {};
    if (foldTagNames !== undefined) patch.foldTagNames = Array.isArray(foldTagNames) ? foldTagNames : [];
    if (thinkingLabelText !== undefined) patch.thinkingLabelText = String(thinkingLabelText || '').trim();
    await db.rpSessions.update(Number(sessionId), patch);
  } catch (err) {
    console.error('[rpService] 编辑思维链折叠设置失败:', err);
  }
};

export default {
  getAllRpSessions,
  getRpSessionById,
  createRpSession,
  deleteRpSession,
  updateRpSessionPreset,
  updateRpSessionCollapse,
  addRpSessionSummaryEntry,
  updateRpSessionSummaryEntryText,
  deleteRpSessionSummaryEntry,
  updateRpSessionWorldBooks,
  updateRpSessionUserProfile,
  updateRpSessionCardStyle,
  updateRpSessionBackground,
  updateRpSessionAvatarBackdrop,
  updateRpSessionThinkingFold,
};