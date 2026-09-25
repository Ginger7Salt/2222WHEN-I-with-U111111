// src/services/apiCallLogService.js
//
// 「信号沙漏」子应用的数据层：记一笔主聊天模型请求（哪个 chat、哪个角色、
// 什么时候、成功/失败、耗时），以及按保留天数清理旧记录。
//
// 只记"请求本身"——不保存 systemPrompt、消息正文、API Key 等敏感内容，
// 出于同样的顾虑（参考 mcpChatTraceService.js 的做法）。
//
// MCP 工具调用不在这张表里：那部分数据已经存在 messages.metadata.mcpTrace
// 里了，「信号沙漏」页面直接读现有消息表，不重复记录。

import db from '../db';

const RETENTION_SETTING_KEY = 'apiCallLogRetentionDays';
export const DEFAULT_RETENTION_DAYS = 14;
export const RETENTION_DAY_OPTIONS = [7, 14, 30];

const nowIso = () => new Date().toISOString();

const clampText = (value, maxLength = 120) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
};

/**
 * 记一笔主聊天模型请求。刻意不抛错——记录失败不该影响正常聊天。
 */
export const logChatApiCall = async ({
  chatId = null,
  characterId = null,
  model = '',
  baseUrl = '',
  status = 'success',
  latencyMs = 0,
  errorMessage = '',
  // 用量：不是所有 API/模型都会返回，读不到就存 null，页面里对 null 单独
  // 处理（不显示这条的用量），不会被误当成 0。
  promptTokens = null,
  completionTokens = null,
  totalTokens = null,
} = {}) => {
  try {
    let host = '';
    try {
      host = baseUrl ? new URL(baseUrl).host : '';
    } catch {
      host = clampText(baseUrl, 60);
    }

    const toTokenCount = (value) =>
      Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

    await db.apiCallLogs.add({
      chatId: chatId === undefined || chatId === null ? null : Number(chatId),
      characterId:
        characterId === undefined || characterId === null
          ? null
          : Number(characterId),
      model: clampText(model, 60) || 'gpt-3.5-turbo',
      host: clampText(host, 80),
      status: status === 'error' ? 'error' : 'success',
      latencyMs: Number.isFinite(latencyMs) ? Math.round(latencyMs) : 0,
      errorMessage: clampText(errorMessage, 160),
      promptTokens: toTokenCount(promptTokens),
      completionTokens: toTokenCount(completionTokens),
      totalTokens: toTokenCount(totalTokens),
      timestamp: nowIso(),
    });
  } catch (error) {
    console.warn('[ApiCallLog] 记录调用日志失败：', error);
  }
};

export const getRetentionDays = async () => {
  try {
    const setting = await db.settings.get(RETENTION_SETTING_KEY);
    const value = Number(setting?.value);
    return RETENTION_DAY_OPTIONS.includes(value) ? value : DEFAULT_RETENTION_DAYS;
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
};

export const setRetentionDays = async (days) => {
  const normalized = RETENTION_DAY_OPTIONS.includes(Number(days))
    ? Number(days)
    : DEFAULT_RETENTION_DAYS;

  await db.settings.put({
    key: RETENTION_SETTING_KEY,
    value: normalized,
  });

  return normalized;
};

/**
 * 删掉超出保留天数的旧记录。页面每次打开时调用一次即可，不需要单独的
 * 后台定时器。
 */
export const pruneApiCallLogs = async () => {
  try {
    const retentionDays = await getRetentionDays();
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const staleIds = await db.apiCallLogs
      .where('timestamp')
      .below(cutoff)
      .primaryKeys();

    if (staleIds.length > 0) {
      await db.apiCallLogs.bulkDelete(staleIds);
    }

    return staleIds.length;
  } catch (error) {
    console.warn('[ApiCallLog] 清理旧日志失败：', error);
    return 0;
  }
};

export const getApiCallLogs = async () => {
  const rows = await db.apiCallLogs.orderBy('timestamp').reverse().toArray();
  return rows;
};

export const clearApiCallLogs = async () => {
  await db.apiCallLogs.clear();
};