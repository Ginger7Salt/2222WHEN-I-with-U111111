// src/apps/offline/offlineSceneStatusService.js
//
// 线下场景状态栏的"每 10 条消息刷新一次"逻辑：
// 生成角色此刻的心情 / 场景天气状态 / 一句内心独白，
// 写回 db.offlineSessions（sceneMood / sceneWeather / sceneMonologue /
// statusUpdatedAtMessageCount），不需要新增数据表或数据库升级版本。
//
// 只负责判断"要不要生成 + 生成 + 落库"，UI 展示交给 OfflineChatRoom.jsx。
import db from '../../db';
import { generateResponse } from '../../services/aiService';

const STATUS_UPDATE_INTERVAL = 10;

// 防止同一个 session 并发触发多次生成（比如短时间内 loadData 被连续调用）。
const inFlightSessionIds = new Set();

const buildRecentDialogueText = (messages, limit = 10) => (
  messages
    .slice(-limit)
    .map((message) => {
      if (message.sender === 'user') {
        return `用户: ${message.content || ''}`;
      }
      if (message.sender === 'character') {
        return `角色: ${message.content || ''}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n')
);

const parseStatusResponse = (rawText, defaults) => {
  if (!rawText || typeof rawText !== 'string') {
    return defaults;
  }

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      sceneMood: parsed.mood || defaults.sceneMood,
      sceneWeather: parsed.weather || defaults.sceneWeather,
      sceneMonologue: parsed.monologue || defaults.sceneMonologue,
    };
  } catch {
    return defaults;
  }
};

/**
 * 检查某个线下场景是否到了该刷新状态栏的时机（每 10 条消息一次），
 * 到了就生成并落库，返回最新的状态字段；没到时机则返回 null。
 */
export const maybeUpdateOfflineSceneStatus = async ({
  chatId,
  offlineSessionId,
  session,
  character,
  offlineMessages,
}) => {
  if (!session || !character || !Array.isArray(offlineMessages)) {
    return null;
  }

  const messageCount = offlineMessages.length;
  const lastUpdatedAt = session.statusUpdatedAtMessageCount || 0;

  const isDue =
    messageCount > 0 &&
    messageCount % STATUS_UPDATE_INTERVAL === 0 &&
    messageCount > lastUpdatedAt;

  if (!isDue) {
    return null;
  }

  if (inFlightSessionIds.has(offlineSessionId)) {
    return null;
  }

  inFlightSessionIds.add(offlineSessionId);

  const defaults = {
    sceneMood: session.sceneMood || '平静自在',
    sceneWeather: session.sceneWeather || '微风和煦',
    sceneMonologue: session.sceneMonologue || '',
  };

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return null;
    }

    const dialogueText = buildRecentDialogueText(offlineMessages, 10);

    const systemPrompt = `你正在扮演角色 [${character.name}]，此刻正身处一次线下见面的场景中。

【场景】：${session.sceneLabel || '一次线下见面'}
【场景细节】：${session.sceneDescription || '无'}
【角色人设】：${character.bio || '无'}
【补充设定】：${character.extraNotes || '无'}

【最近对话片段】：
${dialogueText || '（暂无对话）'}

【任务】：
请基于以上场景与对话氛围，输出你此刻（角色视角）的状态。必须是合法 JSON，包含三个字段：
- "mood": 角色此刻的心情，8字以内，例如"雀跃又有点紧张"；
- "weather": 这个场景此刻的天气/环境氛围，10字以内，例如"傍晚微凉，风里有桂花香"；
- "monologue": 角色此刻一句简短的内心独白，20字以内，第一人称，不要引号包裹。

绝对禁止输出 Markdown 语法、禁止使用任何 Emoji，只输出纯 JSON。`;

    const rawText = await generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请给出你此刻的心情、天气与内心独白。' },
    ]);

    const statusFields = parseStatusResponse(rawText, defaults);

    await db.offlineSessions.update(offlineSessionId, {
      ...statusFields,
      statusUpdatedAtMessageCount: messageCount,
    });

    return statusFields;
  } catch (error) {
    console.warn('[OfflineSceneStatus] 状态栏刷新失败（已忽略）:', error?.message);
    return null;
  } finally {
    inFlightSessionIds.delete(offlineSessionId);
  }
};