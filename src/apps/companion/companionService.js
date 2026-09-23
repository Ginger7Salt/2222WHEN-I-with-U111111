/*
 * "小伙伴"（#6 聊天窗宠物）核心逻辑：领养、状态衰减、喂食/清洁/玩耍、
 * ❤️ 计算、商店购买/穿戴、角色自主互动。
 *
 * 完全新建的一套，不 import、不修改 src/apps/pet/、src/apps/habitat/
 * 的任何代码和数据；写法借鉴 habitatService.js（衰减、共同照料）和
 * petWidgetService.js（AI 反应、图片压缩），细节见下方注释。
 */

import db from '../../db';
import {
  generateFreeActionFeedback,
  generateAutonomousCareNote,
} from './companionAiService';
import { findShopItem } from './companionShopData';

// ---- 数值状态衰减（参照 habitatService.js 的 applyTimeDecay）----
const DECAY_PER_HOUR = { satiety: 4, mood: 2 };
const MIN_DECAY_HOURS = 0.25; // 不到 15 分钟不结算，省计算

// ---- 直接互动（喂食/清洁/玩耍）的即时加成，含 ❤️ ----
const FREE_ACTION_EFFECT = {
  feed: { satiety: 25, mood: 5, hearts: 2 },
  clean: { satiety: 0, mood: 12, hearts: 2 },
  play: { satiety: -5, mood: 18, hearts: 2 },
};

const ACTION_LOG_TEXT = { feed: '喂食', clean: '清洁', play: '玩耍' };

// ---- 聊天回应换 ❤️（同一聊天窗、按天计算）----
// 前 10 次回应 = 1 心；此后每 20 次 = 0.5 心；当天通过聊天获得的心封顶 5。
const CHAT_HEART_FIRST_TIER_EVERY = 10;
const CHAT_HEART_FIRST_TIER_AMOUNT = 1;
const CHAT_HEART_LATER_TIER_EVERY = 20;
const CHAT_HEART_LATER_TIER_AMOUNT = 0.5;
const CHAT_HEART_DAILY_CAP = 5;

// ---- 用户不在时，角色自主互动小伙伴（见启动包第 9.2 节问题 7：b+c）----
// b：用户点"回应"时，角色顺便去看一眼的概率。
const AUTO_CARE_CHAT_TRIGGER_PROBABILITY = 0.25;
// c：定时巡检——多久没人（含角色）互动算"冷落"，冷落之后每次巡检的触发概率。
const AUTO_CARE_NEGLECT_HOURS = 6;
const AUTO_CARE_NEGLECT_PROBABILITY = 0.3;
// 不管哪种触发方式，两次自主互动之间至少间隔这么久，避免刷屏。
const AUTO_CARE_MIN_GAP_HOURS = 2;
// 定时巡检本身也不必每 60 秒都掷一次骰子，同一只宠物这么久才重新掷一次。
const AUTO_CARE_ROLL_COOLDOWN_HOURS = 1;
const AUTO_CARE_EFFECT = { satiety: 10, mood: 15, hearts: 2 };

const clamp100 = (value) => Math.max(0, Math.min(100, Math.round(value)));

const todayDateStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const hoursSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  return (now - timestamp) / 3600000;
};

// ---- 领养 ----

export const getCompanionByChat = async (chatId) => {
  if (chatId === null || chatId === undefined) return null;
  const companion = await db.companions.where('chatId').equals(chatId).first();
  if (!companion) return null;
  return await applyTimeDecay(companion);
};

export const adoptCompanion = async ({ chatId, characterId, name, avatarUrl }) => {
  const existing = await db.companions.where('chatId').equals(chatId).first();
  if (existing) return existing;

  const now = Date.now();
  const record = {
    chatId,
    characterId,
    name: String(name || '小伙伴').slice(0, 20),
    avatarUrl: avatarUrl || null,
    mood: 80,
    satiety: 80,
    hearts: 0,
    equippedOutfit: null,
    lastInteractionAt: now,
    lastDecayedAt: now,
    lastAutoCareAt: null,
    lastAutoCareRollAt: null,
    chatHeartProgress: { dateStr: todayDateStr(), responseCount: 0, heartsAwardedToday: 0 },
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.companions.add(record);
  record.id = id;

  await db.companionLogs.add({
    companionId: id,
    logType: 'user_action',
    actionType: 'adopt',
    content: `${record.name} 从今天开始加入了你们。`,
    timestamp: now,
  });

  return record;
};

/*
 * "一张图不定终身"（用户在 9.2 第 3 条改了主意）：领养之后，
 * 宠物页面里随时可以重新上传/更换形态图，这里就是那个更换入口。
 */
export const updateCompanionAvatar = async (companionId, avatarUrl) => {
  const now = Date.now();
  await db.companions.update(companionId, { avatarUrl, updatedAt: now });
  return await db.companions.get(companionId);
};

// ---- 状态衰减 ----

const applyTimeDecay = async (companion) => {
  const now = Date.now();
  const lastDecayed = companion.lastDecayedAt || companion.createdAt || now;
  const hoursElapsed = hoursSince(lastDecayed, now);

  if (hoursElapsed < MIN_DECAY_HOURS) {
    return companion;
  }

  const updated = {
    ...companion,
    satiety: clamp100(companion.satiety - hoursElapsed * DECAY_PER_HOUR.satiety),
    mood: clamp100(companion.mood - hoursElapsed * DECAY_PER_HOUR.mood),
    lastDecayedAt: now,
  };

  await db.companions.put(updated);
  return updated;
};

// ---- 直接互动：喂食 / 清洁 / 玩耍 ----

export const performFreeAction = async (companionId, actionType) => {
  const effect = FREE_ACTION_EFFECT[actionType];
  if (!effect) return null;

  let companion = await db.companions.get(companionId);
  if (!companion) return null;
  companion = await applyTimeDecay(companion);

  const now = Date.now();
  const updated = {
    ...companion,
    satiety: clamp100(companion.satiety + effect.satiety),
    mood: clamp100(companion.mood + effect.mood),
    hearts: Math.round((companion.hearts + effect.hearts) * 10) / 10,
    lastInteractionAt: now,
    updatedAt: now,
  };

  await db.companions.put(updated);

  const chat = await db.chats.get(companion.chatId);
  const character = chat ? await db.characters.get(chat.characterId) : null;

  let feedbackText = `完成了一次${ACTION_LOG_TEXT[actionType] || actionType}。`;
  try {
    if (chat && character) {
      feedbackText = await generateFreeActionFeedback({
        chatId: companion.chatId,
        chat,
        character,
        companion: updated,
        actionType,
      });
    }
  } catch (error) {
    console.error('[Companion] 互动反馈生成失败:', error);
  }

  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType,
    content: feedbackText,
    timestamp: now,
  });

  return { companion: updated, feedbackText };
};

// ---- 聊天回应换 ❤️ + 顺带触发角色自主互动（b） ----

const computeChatHeartDelta = (previousCount, newCount) => {
  let delta = 0;

  for (let count = previousCount + 1; count <= newCount; count += 1) {
    if (count <= CHAT_HEART_FIRST_TIER_EVERY) {
      if (count === CHAT_HEART_FIRST_TIER_EVERY) {
        delta += CHAT_HEART_FIRST_TIER_AMOUNT;
      }
    } else if ((count - CHAT_HEART_FIRST_TIER_EVERY) % CHAT_HEART_LATER_TIER_EVERY === 0) {
      delta += CHAT_HEART_LATER_TIER_AMOUNT;
    }
  }

  return delta;
};

/*
 * 从 ChatRoom.jsx 的 handleTriggerAi 里调用（用户点"触发伴侣回应"时）。
 * 找不到这个聊天窗的小伙伴时直接跳过，不影响正常聊天流程。
 */
export const recordChatResponseForCompanion = async (chatId) => {
  try {
    const companion = await db.companions.where('chatId').equals(chatId).first();
    if (!companion) return;

    const dateStr = todayDateStr();
    const progress = companion.chatHeartProgress?.dateStr === dateStr
      ? companion.chatHeartProgress
      : { dateStr, responseCount: 0, heartsAwardedToday: 0 };

    const newCount = progress.responseCount + 1;
    const rawDelta = computeChatHeartDelta(progress.responseCount, newCount);
    const remainingCap = Math.max(0, CHAT_HEART_DAILY_CAP - progress.heartsAwardedToday);
    const delta = Math.min(rawDelta, remainingCap);

    const newProgress = {
      dateStr,
      responseCount: newCount,
      heartsAwardedToday: Math.round((progress.heartsAwardedToday + delta) * 10) / 10,
    };

    await db.companions.update(companion.id, {
      hearts: Math.round((companion.hearts + delta) * 10) / 10,
      chatHeartProgress: newProgress,
      updatedAt: Date.now(),
    });

    // b：聊天回应触发角色顺便去看一眼小伙伴（轻量、独立日志，不进聊天记录）。
    if (
      Math.random() < AUTO_CARE_CHAT_TRIGGER_PROBABILITY
      && hoursSince(companion.lastAutoCareAt) >= AUTO_CARE_MIN_GAP_HOURS
    ) {
      setTimeout(() => {
        triggerCompanionAutonomousCare(companion.id);
      }, 2000);
    }
  } catch (error) {
    console.error('[Companion] 记录聊天回应失败:', error);
  }
};

// ---- 角色自主照顾（b 的执行体 + c 的执行体共用）----

export const triggerCompanionAutonomousCare = async (companionId) => {
  const companion = await db.companions.get(companionId);
  if (!companion) return;

  const chat = await db.chats.get(companion.chatId);
  const character = chat ? await db.characters.get(chat.characterId) : null;
  if (!chat || !character) return;

  const now = Date.now();
  const updated = {
    ...companion,
    satiety: clamp100(companion.satiety + AUTO_CARE_EFFECT.satiety),
    mood: clamp100(companion.mood + AUTO_CARE_EFFECT.mood),
    hearts: Math.round((companion.hearts + AUTO_CARE_EFFECT.hearts) * 10) / 10,
    lastInteractionAt: now,
    lastAutoCareAt: now,
    updatedAt: now,
  };

  await db.companions.put(updated);

  try {
    const note = await generateAutonomousCareNote({
      chatId: companion.chatId,
      chat,
      character,
      companion: updated,
    });

    await db.companionLogs.add({
      companionId,
      logType: 'co_care',
      actionType: 'co_care',
      content: note,
      timestamp: now,
    });
  } catch (error) {
    console.error('[Companion] 自主照顾日志生成失败:', error);
  }
};

/*
 * c：定时巡检，多久没人互动就有概率让角色自己去看看。
 *
 * 刻意复用已有的调度器（scheduledMessageService.js 里"每 60 秒 + 切回
 * 前台"那一个），不新增 setInterval/监听器——见启动包第 1 节的要求。
 * 全程 try/catch，任何一步失败都不应该影响预约消息本身的处理。
 */
export const checkCompanionsForNeglect = async () => {
  try {
    const companions = await db.companions.toArray();
    const now = Date.now();

    for (const companion of companions) {
      if (hoursSince(companion.lastInteractionAt, now) < AUTO_CARE_NEGLECT_HOURS) continue;
      if (hoursSince(companion.lastAutoCareRollAt, now) < AUTO_CARE_ROLL_COOLDOWN_HOURS) continue;
      if (hoursSince(companion.lastAutoCareAt, now) < AUTO_CARE_MIN_GAP_HOURS) continue;

      await db.companions.update(companion.id, { lastAutoCareRollAt: now });

      if (Math.random() < AUTO_CARE_NEGLECT_PROBABILITY) {
        await triggerCompanionAutonomousCare(companion.id);
      }
    }
  } catch (error) {
    console.error('[Companion] 定时巡检失败:', error);
  }
};

// ---- 商店：购买食物（买 = 立即喂）/ 购买衣服（永久拥有，可穿脱）----

export const getInventory = async (companionId) => (
  db.companionInventory.where('companionId').equals(companionId).toArray()
);

export const buyShopItem = async (companionId, itemId) => {
  const item = findShopItem(itemId);
  if (!item) throw new Error('商品不存在');

  const companion = await db.companions.get(companionId);
  if (!companion) throw new Error('小伙伴不存在');

  if (companion.hearts < item.price) {
    throw new Error('❤️ 不够');
  }

  const now = Date.now();
  const isFood = Number.isFinite(item.satiety) || Number.isFinite(item.mood);

  if (isFood) {
    const updated = {
      ...companion,
      hearts: Math.round((companion.hearts - item.price) * 10) / 10,
      satiety: clamp100(companion.satiety + (item.satiety || 0)),
      mood: clamp100(companion.mood + (item.mood || 0)),
      lastInteractionAt: now,
      updatedAt: now,
    };
    await db.companions.put(updated);
    await db.companionLogs.add({
      companionId,
      logType: 'user_action',
      actionType: 'shop_food',
      content: `在商店买了「${item.name}」给它吃。`,
      timestamp: now,
    });
    return updated;
  }

  // 衣服：先查是否已拥有，拥有就不重复购买/扣费。
  const owned = await db.companionInventory
    .where({ companionId, category: 'clothing' })
    .toArray();

  if (owned.some((row) => row.itemId === itemId)) {
    throw new Error('已经拥有这件了');
  }

  await db.companions.update(companionId, {
    hearts: Math.round((companion.hearts - item.price) * 10) / 10,
    updatedAt: now,
  });

  await db.companionInventory.add({
    companionId,
    itemId,
    category: 'clothing',
    acquiredAt: now,
  });

  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType: 'shop_clothing',
    content: `在商店买了「${item.name}」。`,
    timestamp: now,
  });

  return await db.companions.get(companionId);
};

export const equipOutfit = async (companionId, itemNameOrNull) => {
  await db.companions.update(companionId, {
    equippedOutfit: itemNameOrNull,
    updatedAt: Date.now(),
  });
  return await db.companions.get(companionId);
};

// ---- 日志 ----

export const getRecentLogs = async (companionId, limit = 30) => (
  db.companionLogs
    .where('companionId')
    .equals(companionId)
    .reverse()
    .sortBy('timestamp')
    .then((rows) => rows.slice(0, limit))
);