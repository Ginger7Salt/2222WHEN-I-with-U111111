/*
 * "小伙伴"特殊事件——判定/发放/领取逻辑。数据目录在 companionEventData.js，
 * 这里只负责：组装判定用的上下文、按顺序过一遍事件定义、把命中的事件写进
 * companion.activeEvents、以及用户点开事件卡片后的"领取"处理。
 *
 * 跟衰减/喂食逻辑一样，完全是新写的一份，不 import src/apps/pet/ 或
 * src/apps/habitat/ 的任何代码。
 *
 * 【用户确认过的规则】
 *   - 每次最多同时展示 2 个未处理的事件（activeEvents 里未过期的数量
 *     达到 2 就不再判定新的）。
 *   - 事件自然存在 3 天（按自然日，从触发当天 0 点算起，第 4 天 0 点
 *     就自动消失，不管有没有被领取）。
 *   - 判定本身在打开小伙伴页面时触发，但同一只宠物不会每次挂载都重新
 *     判定一遍——至少间隔 EVENT_ROLL_COOLDOWN_MS 才会重新判定一次，
 *     避免来回切页面把概率事件刷爆。
 */

import db from '../../db';
import {
  EVENT_KINDS,
  findEventDef,
  FLAVOR_EVENTS,
  LEGENDARY_GRANT_EVENTS,
  RARE_UNLOCK_EVENTS,
} from './companionEventData';
import { findShopItem } from './companionShopData';

const MAX_ACTIVE_EVENTS = 2;
const EVENT_ACTIVE_DAYS = 3; // 自然日
const EVENT_ROLL_COOLDOWN_MS = 25 * 60 * 1000; // 25 分钟
const MIN_LEGENDARY_GRANT_GAP_HOURS = 20;

const clamp100 = (value) => Math.max(0, Math.min(100, Math.round(value)));

const hoursSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  return (now - timestamp) / 3600000;
};

const daysSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  return (now - timestamp) / 86400000;
};

// 事件在"触发当天 0 点 + EVENT_ACTIVE_DAYS 天"的 0 点自动消失，
// 即触发当天 + 之后 2 个完整自然日都还看得见，第 4 天就没了。
const computeExpiresAt = (triggeredAt) => {
  const d = new Date(triggeredAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + EVENT_ACTIVE_DAYS);
  return d.getTime();
};

const getActiveEventsRaw = (companion) => companion.activeEvents || [];

// 未过期（不管有没有被领取）的事件列表，给 UI 展示用。
export const getActiveEvents = (companion, now = Date.now()) => (
  getActiveEventsRaw(companion).filter((event) => event.expiresAt > now)
);

const buildEventContext = (companion, now) => ({
  mood: companion.mood ?? 80,
  satiety: companion.satiety ?? 80,
  hearts: companion.hearts ?? 0,
  daysSinceAdopt: daysSince(companion.createdAt, now),
  daysSinceLastOpen: daysSince(companion.lastPageOpenAt, now),
  moodFullStreak: companion.moodFullStreak || 0,
  cleanActionCount: companion.cleanActionCount || 0,
  feedCount: companion.feedCount || 0,
  totalInteractionCount: companion.totalInteractionCount || 0,
});

const rollProbability = (def, ctx) => {
  if (typeof def.getProbability === 'function') return Math.random() < def.getProbability(ctx);
  if (typeof def.probability === 'number') return Math.random() < def.probability;
  return true; // 没写概率的事件，条件满足就算命中（非随机、条件型）
};

const buildActiveEventEntry = (def, now) => ({
  id: `${def.id}-${now}-${Math.random().toString(36).slice(2, 7)}`,
  defId: def.id,
  kind: def.kind,
  title: def.title,
  bannerText: def.bannerText,
  grantsFoodId: def.grantsFoodId || null,
  createdAt: now,
  expiresAt: computeExpiresAt(now),
  claimed: false,
});

/*
 * 核心判定：返回 { triggeredEvents, patch }。
 *   - triggeredEvents：这次新命中的事件（完整定义 + 生成的 activeEvent 条目），
 *     调用方用它们去插入聊天消息、决定要不要弹窗。
 *   - patch：需要写回 companion 记录的字段（activeEvents、
 *     unlockedRareFoodIds、legendaryStock、lastLegendaryGrantAt、
 *     firedMilestoneEventIds、lastEventRollAt 等）。
 *
 * 纯逻辑函数，不读写 db——方便以后要写测试。
 */
export const evaluateCompanionEvents = (companion, now = Date.now()) => {
  const activeEvents = getActiveEvents(companion, now);
  const triggeredEvents = [];

  const unlockedRareFoodIds = [...(companion.unlockedRareFoodIds || [])];
  const legendaryStock = { ...(companion.legendaryStock || {}) };
  const firedMilestoneEventIds = [...(companion.firedMilestoneEventIds || [])];
  let lastLegendaryGrantAt = companion.lastLegendaryGrantAt || null;

  const ctx = buildEventContext(companion, now);
  let slotsLeft = MAX_ACTIVE_EVENTS - activeEvents.length;

  const tryTrigger = (def) => {
    if (slotsLeft <= 0) return;
    if (def.isAutoRollable === false) return;
    if (def.oncePerLifetime && firedMilestoneEventIds.includes(def.id)) return;
    if (!def.check(ctx)) return;
    if (!rollProbability(def, ctx)) return;

    const entry = buildActiveEventEntry(def, now);
    triggeredEvents.push({ def, entry });
    activeEvents.push(entry);
    slotsLeft -= 1;

    if (def.oncePerLifetime) firedMilestoneEventIds.push(def.id);
  };

  // 稀有解锁：已经解锁过的食物不再重复判定。
  RARE_UNLOCK_EVENTS.forEach((def) => {
    if (unlockedRareFoodIds.includes(def.grantsFoodId)) return;
    tryTrigger(def);
  });

  // 传说发放：全局冷却，避免短时间内连续刷到。
  if (hoursSince(lastLegendaryGrantAt, now) >= MIN_LEGENDARY_GRANT_GAP_HOURS) {
    LEGENDARY_GRANT_EVENTS.forEach((def) => {
      if (slotsLeft <= 0) return;
      const before = triggeredEvents.length;
      tryTrigger(def);
      if (triggeredEvents.length > before) lastLegendaryGrantAt = now;
    });
  }

  // 氛围小事件：随便触发，不解锁/不发放任何东西。
  FLAVOR_EVENTS.forEach((def) => tryTrigger(def));

  // 把这次真正命中的"解锁/发放"事件落到对应的持久状态上。
  triggeredEvents.forEach(({ def }) => {
    if (def.kind === EVENT_KINDS.RARE_UNLOCK) {
      if (!unlockedRareFoodIds.includes(def.grantsFoodId)) {
        unlockedRareFoodIds.push(def.grantsFoodId);
      }
    } else if (def.kind === EVENT_KINDS.LEGENDARY_GRANT) {
      legendaryStock[def.grantsFoodId] = (legendaryStock[def.grantsFoodId] || 0) + 1;
    }
  });

  const patch = {
    activeEvents,
    unlockedRareFoodIds,
    legendaryStock,
    firedMilestoneEventIds,
    lastLegendaryGrantAt,
    lastEventRollAt: now,
  };

  return { triggeredEvents, patch };
};

/*
 * 打开小伙伴页面时调用：按冷却决定要不要真正判定一次，命中的事件会
 * 写进 db，并且（如果这个聊天窗能找到对应角色）往聊天里插一条角色的
 * 话——用的是跟 challengeService.js/interactionService.js 一样的
 * "直接 db.messages.add + dispatch 'new-local-message-inserted'"套路，
 * 不经过 aiService.js 的在线回复流程。
 *
 * 返回这次新出现的事件（完整带 title/bannerText 的那种，供页面弹窗用），
 * 没有新事件就返回空数组——调用方应该始终用 getActiveEvents(companion)
 * 来渲染"当前挂着的事件横幅"，这个返回值只用来决定"要不要自动弹一个
 * 新事件的详情弹窗"。
 */
export const checkCompanionEvents = async (companionId) => {
  const companion = await db.companions.get(companionId);
  if (!companion) return { companion: null, newEvents: [] };

  const now = Date.now();

  // 冷却内直接跳过判定，只做一次"过期事件自然消失"的轻量清理即可。
  if (hoursSince(companion.lastEventRollAt, now) < EVENT_ROLL_COOLDOWN_MS / 3600000) {
    return { companion, newEvents: [] };
  }

  const { triggeredEvents, patch } = evaluateCompanionEvents(companion, now);

  if (triggeredEvents.length === 0) {
    await db.companions.update(companionId, { lastEventRollAt: now });
    return { companion: { ...companion, lastEventRollAt: now }, newEvents: [] };
  }

  await db.companions.update(companionId, patch);
  const updated = { ...companion, ...patch };

  // 往聊天里插一句角色台词，让事件也能在聊天记录里看到。
  try {
    const chat = await db.chats.get(companion.chatId);
    const character = chat ? await db.characters.get(chat.characterId) : null;

    if (chat && character) {
      for (const { def } of triggeredEvents) {
        const line = typeof def.characterLine === 'function'
          ? def.characterLine(companion.name)
          : def.characterLine;
        if (!line) continue;

        const timestampIso = new Date().toISOString();
        const metadata = { companionEventId: def.id };

        // eslint-disable-next-line no-await-in-loop
        await db.messages.add({
          chatId: companion.chatId,
          characterId: chat.characterId,
          sender: 'character',
          type: 'text',
          content: line,
          metadata,
          versions: [{ type: 'text', content: line, metadata, timestamp: timestampIso }],
          currentVersionIndex: 0,
          isRead: false,
          timestamp: timestampIso,
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('new-local-message-inserted', { detail: { chatId: companion.chatId } })
        );
      }
    }
  } catch (error) {
    console.error('[CompanionEvent] 写入聊天消息失败:', error);
  }

  return {
    companion: updated,
    newEvents: triggeredEvents.map(({ def, entry }) => ({ ...entry, bannerText: def.bannerText, title: def.title })),
  };
};

/*
 * 用户点开事件卡片领取：
 *   - flavor：按定义里的 reward 加一点数值/心心。
 *   - rare_unlock：食物已经在 evaluateCompanionEvents 命中时就解锁了，
 *     这里只是把卡片标记为"已领取"（纯 UI 状态，不影响解锁本身）。
 *   - legendary_grant：传说食物同理，已经在命中时发到库存里了，
 *     这里也只是标记已领取。
 */
export const claimCompanionEvent = async (companionId, activeEventId) => {
  const companion = await db.companions.get(companionId);
  if (!companion) return null;

  const activeEvents = getActiveEventsRaw(companion);
  const index = activeEvents.findIndex((event) => event.id === activeEventId);
  if (index === -1) return companion;

  const target = activeEvents[index];
  if (target.claimed) return companion;

  const def = findEventDef(target.defId);
  const now = Date.now();

  let moodDelta = 0;
  let heartsDelta = 0;
  if (def?.kind === EVENT_KINDS.FLAVOR && def.reward) {
    moodDelta = def.reward.mood || 0;
    heartsDelta = def.reward.hearts || 0;
  }

  const nextActiveEvents = [...activeEvents];
  nextActiveEvents[index] = { ...target, claimed: true };

  const updated = {
    ...companion,
    activeEvents: nextActiveEvents,
    mood: clamp100((companion.mood ?? 80) + moodDelta),
    hearts: Math.round(((companion.hearts || 0) + heartsDelta) * 10) / 10,
    updatedAt: now,
  };

  await db.companions.put(updated);
  return updated;
};

export const findShopItemForEvent = (foodId) => findShopItem(foodId);