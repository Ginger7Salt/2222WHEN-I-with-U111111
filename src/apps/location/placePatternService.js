// src/apps/location/placePatternService.js
//
// "你常在这里找 TA 聊天"：给每个已命名地点统计用户来这里聊过几次、多在什么时段。
// 全部由代码统计，不调用 AI，也不新建数据库表——数据直接存在地点记录上：
//   chatCount          在这里聊过几次（一场聊天只算 1 次）
//   chatDayparts       { morning, day, evening, night } 各时段的次数
//   lastChatCountedAt  上一次计数的时间（ISO），用来判断是不是"同一场聊天"
//
// 什么时候算一次：角色要回复用户时（triggerAiResponse），同时满足——
//   地点功能开着、用户此刻在一个已命名的地点、最近一次定位不太旧、
//   用户刚发过消息（不是系统或定时任务触发的回复）、距离上一次计数已经隔了一阵。

import db from '../../db';
import { getLocationFixAgeMs } from './placeService';

// 至少聊过这么多次，才算"规律"，才会告诉角色（避免把偶然当成规律）。
export const CHAT_PATTERN_MIN_COUNT = 3;

// 同一个地点上，两次计数之间至少隔多久，否则算同一场聊天。
export const CHAT_SESSION_GAP_MS = 3 * 60 * 60 * 1000;

// 用户最近一条消息必须在多久之内，才算"刚发过消息"。
export const CHAT_MESSAGE_FRESH_MS = 30 * 60 * 1000;

// 定位比这个更旧，就不计数（可能已经不在这个地点了）。
export const CHAT_FIX_MAX_AGE_MS = 60 * 60 * 1000;

// 某个时段的次数占比达到这个值、并且这个时段本身至少有 CHAT_PATTERN_MIN_COUNT 次，
// 才说"多在某个时段"（次数太少时，凑巧的分布不算倾向）。
const TENDENCY_RATIO = 0.6;

const DAYPART_LABELS = {
  morning: '早上',
  day: '白天',
  evening: '晚上',
  night: '深夜',
};

export const getDaypart = (date) => {
  const hour = date.getHours();

  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  if (hour >= 18 && hour < 23) return 'evening';

  return 'night';
};

/**
 * 角色要回复用户时调用：满足条件就给当前地点记一次"在这里聊过"。
 * 返回 true 表示这次真的记了一次。任何失败都安全降级，绝不能影响正常聊天。
 */
export const recordChatAtCurrentPlace = async ({ chatId, userMessageAt, now = Date.now() }) => {
  try {
    const sentAt = new Date(userMessageAt).getTime();

    if (!Number.isFinite(sentAt) || now - sentAt > CHAT_MESSAGE_FRESH_MS) return false;

    let counted = false;

    // 放进事务里，两个回复同时触发也不会重复计数。
    await db.transaction('rw', db.places, db.locationSettings, async () => {
      const settings = await db.locationSettings.get(chatId);

      if (!settings?.enabled || !settings.currentPlaceId) return;
      if (getLocationFixAgeMs(settings, now) > CHAT_FIX_MAX_AGE_MS) return;

      const place = await db.places.get(settings.currentPlaceId);

      if (!place?.isNamed) return;

      const lastCountedAt = new Date(place.lastChatCountedAt || 0).getTime();

      if (lastCountedAt && now - lastCountedAt < CHAT_SESSION_GAP_MS) return;

      const dayparts = {
        morning: 0,
        day: 0,
        evening: 0,
        night: 0,
        ...(place.chatDayparts || {}),
      };
      const part = getDaypart(new Date(now));

      dayparts[part] += 1;

      await db.places.update(place.id, {
        chatCount: (Number(place.chatCount) || 0) + 1,
        chatDayparts: dayparts,
        lastChatCountedAt: new Date(now).toISOString(),
      });

      counted = true;
    });

    return counted;
  } catch (error) {
    console.warn('[Location] 记录聊天次数失败：', error);
    return false;
  }
};

/**
 * 读出一个地点的聊天规律。从没聊过返回 null。
 * tendency 只有在次数够多、且某个时段明显更多时才有值（比如"晚上"）。
 */
export const getChatPattern = (place) => {
  const count = Number(place?.chatCount) || 0;

  if (count <= 0) return null;

  const dayparts = place.chatDayparts || {};
  const total = Object.values(dayparts).reduce((sum, value) => sum + (Number(value) || 0), 0);

  let tendency = '';

  if (count >= CHAT_PATTERN_MIN_COUNT && total > 0) {
    const [topKey, topValue] = Object.entries(dayparts)
      .filter(([key]) => DAYPART_LABELS[key])
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))[0] || [];

    const topCount = Number(topValue) || 0;

    if (topKey && topCount >= CHAT_PATTERN_MIN_COUNT && topCount / total >= TENDENCY_RATIO) {
      tendency = DAYPART_LABELS[topKey];
    }
  }

  return {
    count,
    tendency,
    isPattern: count >= CHAT_PATTERN_MIN_COUNT,
  };
};

/** 小册子里地点那一行的小字，比如"在这里找小夜聊过 5 次 · 多在晚上"；没聊过返回空字符串。 */
export const formatChatPatternText = (place, characterName) => {
  const pattern = getChatPattern(place);

  if (!pattern) return '';

  return `在这里找${characterName || ' TA '}聊过 ${pattern.count} 次${
    pattern.tendency ? ` · 多在${pattern.tendency}` : ''
  }`;
};

/** 放进角色提示词的一行；次数不够（还算不上规律）就是空字符串。 */
export const getChatPatternPromptLine = (place) => {
  const pattern = getChatPattern(place);

  if (!pattern?.isPattern) return '';

  return `- 用户已经在这里找你聊过 ${pattern.count} 次${
    pattern.tendency ? `，多在${pattern.tendency}` : ''
  }。这只是根据聊天次数统计出来的规律：只在自然贴切时才提起，不要每次都说，也不要因此给用户下判断或贴标签。\n`;
};

export default {
  recordChatAtCurrentPlace,
  getChatPattern,
  formatChatPatternText,
  getChatPatternPromptLine,
};