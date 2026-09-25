import db from '../../../db';

import {
  getAlmanacConfig,
  saveAlmanacConfig,
  getDateKey,
  getLocalHour,
  getUserTimeZone,
} from './almanacService';

import { evaluateMilestones, orderMilestones } from './almanacMilestoneCatalog';

/*
 * 里程碑的读写部分。
 * 点亮时间存在 almanacConfigs 的两个新增字段里（不新建表、不升数据库版本）：
 *   achievements      { 节点id: 点亮时间(ISO) }
 *   achievementsSeen  [ 已经提示过"新的节点点亮了"的节点id ]
 * 第一次读取时，已经满足条件的节点全部记为"已看过"，不会一下子弹出一堆提示。
 */

const VALID_SENDERS = ['user', 'character', 'ai', 'assistant'];

const toMs = (value) => {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const loadMilestones = async (chatId) => {
  if (!chatId) return null;

  const config = await getAlmanacConfig(chatId);
  const timeZone = getUserTimeZone(config);

  let messages = [];

  try {
    messages = await db.messages.where('chatId').equals(chatId).toArray();
  } catch (error) {
    console.warn('[Almanac] 读取消息失败：', error);
    return null;
  }

  const usable = messages.filter(
    (message) => message && message.type !== 'error' && VALID_SENDERS.includes(message.sender)
  );

  const stamped = usable
    .map((message) => ({ ts: toMs(message.timestamp), sender: message.sender }))
    .filter((item) => item.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  const helpers = {
    getDateKey: (ts) => getDateKey(ts, timeZone),
    getLocalHour: (ts) => getLocalHour(ts, timeZone),
  };

  const result = evaluateMilestones({
    allTimes: stamped.map((item) => item.ts),
    userTimes: stamped.filter((item) => item.sender === 'user').map((item) => item.ts),
    helpers,
    now: Date.now(),
  });

  if (!result.hasData) {
    return { ...result, nodes: [], newIds: [], config };
  }

  const isFirstRun = config.achievements === undefined;
  const stored = { ...(config.achievements || {}) };
  const seen = new Set(config.achievementsSeen || []);
  let changed = false;

  result.nodes.forEach((node) => {
    if (!node.lit) return;

    if (!stored[node.id]) {
      stored[node.id] = new Date(node.unlockedAt ?? Date.now()).toISOString();
      changed = true;
      if (isFirstRun) seen.add(node.id);
    }
  });

  if (isFirstRun) changed = true;

  let nextConfig = config;

  if (changed) {
    try {
      nextConfig = await saveAlmanacConfig(chatId, {
        achievements: stored,
        achievementsSeen: Array.from(seen),
      });
    } catch (error) {
      console.warn('[Almanac] 保存里程碑失败：', error);
    }
  }

  // 用已保存的点亮时间覆盖现算的，保证日期不会跳动
  const nodes = orderMilestones(
    result.nodes.map((node) =>
      node.lit && stored[node.id] ? { ...node, unlockedAt: toMs(stored[node.id]) } : node
    ),
    stored
  );

  const newIds = nodes.filter((node) => node.lit && !seen.has(node.id)).map((node) => node.id);

  return { ...result, nodes, newIds, config: nextConfig, timeZone };
};

export const markMilestonesSeen = async (chatId, ids) => {
  if (!chatId || !ids?.length) return null;

  const config = await getAlmanacConfig(chatId);
  const seen = new Set(config.achievementsSeen || []);

  ids.forEach((id) => seen.add(id));

  return saveAlmanacConfig(chatId, { achievementsSeen: Array.from(seen) });
};

export default { loadMilestones, markMilestonesSeen };