// src/apps/memoir/memoirService.js
//
// 回忆录核心逻辑：记一条"共同经历"（点外卖 / 转账 / 使用 MCP），双向都记
// （MCP 只记角色主动使用这一侧）。事件本身由各自的调用方（aiService.js /
// ChatRoom.jsx）在事情真实发生的那一刻记下，"角色的感受"是可选的后补信息，
// 来自隐藏 tag 解析（见 memoirNoteDirective.js），没有也不影响事件被记录。

import db from '../../db';
import { isValidMemoirEmotion } from './memoirEmotions';

export const MEMOIR_EVENT_TYPES = {
  FOOD: 'food',
  TRANSFER: 'transfer',
  MCP: 'mcp',
};

export const MEMOIR_DIRECTIONS = {
  CHARACTER_TO_USER: 'character_to_user',
  USER_TO_CHARACTER: 'user_to_character',
};

const buildFoodSummary = (metadata = {}, direction) => {
  const item = metadata.item || '一份外卖';
  const store = metadata.store || '';
  const storeSuffix = store ? `（${store}）` : '';

  return direction === MEMOIR_DIRECTIONS.CHARACTER_TO_USER
    ? `TA给你点了${item}${storeSuffix}`
    : `你给TA点了${item}${storeSuffix}`;
};

const buildTransferSummary = (metadata = {}, content, direction) => {
  const amount = metadata.amount || '';
  const note = String(content || '').trim();
  const noteSuffix = note ? `，留言：${note}` : '';

  return direction === MEMOIR_DIRECTIONS.CHARACTER_TO_USER
    ? `TA给你转账 ¥${amount}${noteSuffix}`
    : `你给TA转账 ¥${amount}${noteSuffix}`;
};

const buildMcpSummary = (toolLabel) => `TA用「${toolLabel || '一个功能'}」帮你办了件事`;

const clampFeeling = (feeling) => String(feeling || '').trim().slice(0, 80);

/**
 * 记一条回忆。emotion/feeling 可以先留空（比如 user 送出心意的那一刻还
 * 不知道角色的反应），之后用 backfillMemoirFeeling 补上。
 */
export const recordMemoir = async ({
  chatId,
  characterId,
  eventType,
  direction,
  summary,
  toolName = '',
  sourceMessageId = null,
  emotion = null,
  feeling = '',
  timestamp = new Date().toISOString(),
}) => {
  if (!chatId || !characterId || !eventType || !direction || !summary) {
    return null;
  }

  try {
    return await db.memoirs.add({
      chatId,
      characterId,
      eventType,
      direction,
      summary,
      toolName,
      sourceMessageId: sourceMessageId ?? null,
      emotion: isValidMemoirEmotion(emotion) ? emotion : null,
      feeling: clampFeeling(feeling),
      timestamp,
    });
  } catch (error) {
    console.error('[Memoir] 记录回忆失败：', error);
    return null;
  }
};

export const recordFoodMemoir = ({
  chatId,
  characterId,
  direction,
  metadata,
  sourceMessageId,
  emotion,
  feeling,
  timestamp,
}) => recordMemoir({
  chatId,
  characterId,
  eventType: MEMOIR_EVENT_TYPES.FOOD,
  direction,
  summary: buildFoodSummary(metadata, direction),
  sourceMessageId,
  emotion,
  feeling,
  timestamp,
});

export const recordTransferMemoir = ({
  chatId,
  characterId,
  direction,
  metadata,
  content,
  sourceMessageId,
  emotion,
  feeling,
  timestamp,
}) => recordMemoir({
  chatId,
  characterId,
  eventType: MEMOIR_EVENT_TYPES.TRANSFER,
  direction,
  summary: buildTransferSummary(metadata, content, direction),
  sourceMessageId,
  emotion,
  feeling,
  timestamp,
});

export const recordMcpMemoir = ({
  chatId,
  characterId,
  toolName,
  toolLabel,
  sourceMessageId,
  emotion,
  feeling,
  timestamp,
}) => recordMemoir({
  chatId,
  characterId,
  eventType: MEMOIR_EVENT_TYPES.MCP,
  direction: MEMOIR_DIRECTIONS.CHARACTER_TO_USER,
  summary: buildMcpSummary(toolLabel || toolName),
  toolName,
  sourceMessageId,
  emotion,
  feeling,
  timestamp,
});

/**
 * user 主动给角色点外卖/转账时调用（ChatRoom.jsx 的通用发送入口）。
 * 这一刻角色还没回复，所以先不带情绪/感受，等角色下一次回复带了
 * [MEMORY_NOTE: ...] 标签，再用 backfillMemoirFeeling 补上。
 */
export const recordUserGiftMemoir = ({
  chatId,
  characterId,
  eventType,
  metadata,
  content,
  sourceMessageId,
  timestamp,
}) => {
  if (eventType === MEMOIR_EVENT_TYPES.FOOD) {
    return recordFoodMemoir({
      chatId,
      characterId,
      direction: MEMOIR_DIRECTIONS.USER_TO_CHARACTER,
      metadata,
      sourceMessageId,
      timestamp,
    });
  }

  if (eventType === MEMOIR_EVENT_TYPES.TRANSFER) {
    return recordTransferMemoir({
      chatId,
      characterId,
      direction: MEMOIR_DIRECTIONS.USER_TO_CHARACTER,
      metadata,
      content,
      sourceMessageId,
      timestamp,
    });
  }

  return null;
};

/**
 * 角色下一次回复里如果带了感受标签，回填给"user 之前送出的那份心意"对应
 * 的回忆行。只补一次：已经有 feeling 的行不会被覆盖，避免之后反复聊到
 * 同一件事时把最初的感受冲掉。
 */
export const backfillMemoirFeeling = async ({ sourceMessageId, emotion, feeling }) => {
  if (!sourceMessageId || !feeling) return;

  try {
    const row = await db.memoirs
      .where('sourceMessageId')
      .equals(sourceMessageId)
      .first();

    if (!row || row.feeling) return;

    await db.memoirs.update(row.id, {
      emotion: isValidMemoirEmotion(emotion) ? emotion : row.emotion,
      feeling: clampFeeling(feeling),
    });
  } catch (error) {
    console.error('[Memoir] 回填回忆感受失败：', error);
  }
};

/**
 * 回忆录页面用：某个聊天窗的全部回忆，按时间从新到旧排列。
 */
export const getMemoirsForChat = async (chatId) => {
  if (!chatId) return [];

  const rows = await db.memoirs
    .where('chatId')
    .equals(chatId)
    .sortBy('timestamp');

  return rows.reverse();
};