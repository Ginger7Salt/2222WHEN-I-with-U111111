import db from '../../../db';

import {
  getAlmanacConfig,
  saveAlmanacConfig,
  filterAlmanacRecordsByConfig,
  getAlmanacRecords,
} from './almanacService';

import {
  analyzeUserRecords,
  resolveRoutineProfile,
  buildRoutinePromptLines,
} from './almanacRoutineProfileLogic';

/*
 * 「TA 眼中的你」的读写部分。
 * 数据存在 almanacConfigs 这条每聊天配置上的 userRoutineProfile 字段里（新增字段，不升数据库版本）：
 *   {
 *     enabled,            // 是否让 TA 参考这份画像，缺省视为开启
 *     chronotype,         // 只在用户自己选过类型时保存
 *     chronotypeSource,   // 'declared'
 *     guidance,           // 用户改过的"TA 会这样对你"，没改过就是空
 *     declaredNote,       // 用户手写补充
 *     observations: [{ id, text, category, source, evidenceDays, confidence, status, enabled, updatedAt }]
 *   }
 * 推断出来的作息类型不落库，每次现算，避免过期。
 */

const getSchedulesForChat = async (chatId) => {
  try {
    const chat = await db.chats.get(chatId);

    if (!chat?.characterId || !db.schedules) {
      return [];
    }

    return await db.schedules.where('characterId').equals(chat.characterId).toArray();
  } catch (error) {
    console.warn('[Almanac] 读取日程失败：', error);
    return [];
  }
};

export const loadRoutineProfile = async ({ chatId, records }) => {
  const config = await getAlmanacConfig(chatId);
  const schedules = await getSchedulesForChat(chatId);
  const stats = analyzeUserRecords(records);

  return {
    config,
    view: resolveRoutineProfile({
      stored: config.userRoutineProfile,
      stats,
      schedules,
    }),
  };
};

export const saveRoutineProfilePatch = async (chatId, patch) => {
  const config = await getAlmanacConfig(chatId);

  return saveAlmanacConfig(chatId, {
    userRoutineProfile: {
      ...(config.userRoutineProfile || {}),
      ...patch,
    },
  });
};

/**
 * 把合并后的观察列表写回配置（页面打开时调用）。
 * 只有内容真的变了才写，避免每次打开都产生一次数据库写入。
 */
export const syncRoutineObservations = async (chatId, config, observations) => {
  const stored = config?.userRoutineProfile?.observations || [];

  if (JSON.stringify(stored) === JSON.stringify(observations)) {
    return null;
  }

  return saveRoutineProfilePatch(chatId, { observations });
};

/**
 * 给聊天 AI 的提示词片段。读取或拼装出错时返回空数组，不影响聊天。
 * 不写库：观察列表在内存里合并，只读。
 */
export const getRoutineProfilePromptLines = async (chatId) => {
  try {
    const config = await getAlmanacConfig(chatId);

    if (config?.userRoutineProfile?.enabled === false) {
      return [];
    }

    const allRecords = await getAlmanacRecords(chatId);
    const records = filterAlmanacRecordsByConfig(allRecords, config);
    const schedules = await getSchedulesForChat(chatId);

    const view = resolveRoutineProfile({
      stored: config.userRoutineProfile,
      stats: analyzeUserRecords(records),
      schedules,
    });

    return buildRoutinePromptLines(view);
  } catch (error) {
    console.warn('[Almanac] 作息画像提示词已安全跳过：', error);
    return [];
  }
};

export default {
  loadRoutineProfile,
  saveRoutineProfilePatch,
  syncRoutineObservations,
  getRoutineProfilePromptLines,
};