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

/*
 * "发出第 100 个表情包""第一次收到心意"这几类里程碑不是靠聊天消息本身算出来的，
 * 而是来自别的功能模块自己的数据表（回忆录 / 日记 / 信箱）。这里只按 chatId（或
 * characterId）读一下时间戳，不改动那些模块的任何代码，读取失败就当没有这类信号，
 * 不影响其余里程碑正常显示。
 *
 * 信箱（askBoxQuestions）是按 characterId 存的，不是按 chatId——同一个角色开了
 * 多个聊天窗，会共用同一份信箱记录，"第一次投进信箱"因此不是这一个聊天窗独有的
 * 首次事件，而是跟这个角色相关的全部聊天窗共享。
 */
const collectSignals = async (chatId) => {
  const signals = {};

  try {
    const chat = await db.chats.get(chatId);
    const characterId = chat?.characterId ?? null;

    const [memoirs, diaries, mailbox] = await Promise.all([
      db.memoirs ? db.memoirs.where('chatId').equals(chatId).toArray().catch(() => []) : [],
      db.diaries ? db.diaries.where('chatId').equals(chatId).toArray().catch(() => []) : [],
      characterId && db.askBoxQuestions
        ? db.askBoxQuestions.where('characterId').equals(characterId).toArray().catch(() => [])
        : [],
    ]);

    const giftTimes = (Array.isArray(memoirs) ? memoirs : [])
      .filter(
        (item) =>
          item &&
          ['food', 'transfer'].includes(item.eventType) &&
          item.direction === 'character_to_user'
      )
      .map((item) => toMs(item.timestamp))
      .filter(Boolean);

    if (giftTimes.length) signals.firstGiftAt = Math.min(...giftTimes);

    const diaryTimes = (Array.isArray(diaries) ? diaries : [])
      .filter((item) => item && item.author === 'user')
      .map((item) => toMs(item.timestamp))
      .filter(Boolean);

    if (diaryTimes.length) signals.firstDiaryAt = Math.min(...diaryTimes);

    const mailboxTimes = (Array.isArray(mailbox) ? mailbox : [])
      .filter((item) => item && item.sender === 'user')
      .map((item) => toMs(item.createdAt))
      .filter(Boolean);

    if (mailboxTimes.length) signals.firstMailboxAt = Math.min(...mailboxTimes);
  } catch (error) {
    console.warn('[Almanac] 读取跨模块里程碑信号失败：', error);
  }

  return signals;
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

  const stickerTimestamps = usable
    .filter((message) => message.sender === 'user' && message.type === 'sticker')
    .map((message) => toMs(message.timestamp))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const reactionTimestamps = messages
    .flatMap((message) => (Array.isArray(message?.reactions) ? message.reactions : []))
    .filter((reaction) => reaction?.by === 'user')
    .map((reaction) => toMs(reaction.at))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const extraSignals = await collectSignals(chatId);

  if (reactionTimestamps.length) extraSignals.firstReactionAt = reactionTimestamps[0];
  if (stickerTimestamps.length) extraSignals.stickerTimestamps = stickerTimestamps;

  const helpers = {
    getDateKey: (ts) => getDateKey(ts, timeZone),
    getLocalHour: (ts) => getLocalHour(ts, timeZone),
  };

  const result = evaluateMilestones({
    allTimes: stamped.map((item) => item.ts),
    userTimes: stamped.filter((item) => item.sender === 'user').map((item) => item.ts),
    helpers,
    now: Date.now(),
    signals: extraSignals,
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