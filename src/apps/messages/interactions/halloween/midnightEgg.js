// src/apps/messages/interactions/halloween/midnightEgg.js
//
// 深夜彩蛋：0 点到 5 点之间打开/停留在这个聊天窗时，一晚只撞一次（按
// 聊天窗各自计次，不是全局共享——跟贝壳app"每天最多打捞次数"是同一个
// 惯例）。用 chat.lastMidnightEggDate（YYYY-M-D 格式的本地日期）记录
// 上一次触发的日期，不需要数据库版本升级，就是一个新的非索引字段。

import db from '../../../../db';
import { isHalloweenSeasonActive } from './halloweenSeason';

const MIDNIGHT_WINDOW_START_HOUR = 0;
const MIDNIGHT_WINDOW_END_HOUR = 5;

const toDateKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const isWithinMidnightWindow = (date = new Date()) => {
  const hour = date.getHours();
  return hour >= MIDNIGHT_WINDOW_START_HOUR && hour < MIDNIGHT_WINDOW_END_HOUR;
};

/**
 * 检查这个聊天窗今晚是否应该触发一次深夜彩蛋；如果应该，顺带把
 * lastMidnightEggDate 落库，调用方不需要再自己写一遍。
 */
export const checkAndMarkMidnightEgg = async (chat) => {
  if (!chat?.id || !isHalloweenSeasonActive()) return false;

  const now = new Date();
  if (!isWithinMidnightWindow(now)) return false;

  const todayKey = toDateKey(now);
  if (chat.lastMidnightEggDate === todayKey) return false;

  try {
    await db.chats.update(chat.id, { lastMidnightEggDate: todayKey });
  } catch (error) {
    console.error('[MidnightEgg] 记录触发日期失败：', error);
    return false;
  }

  return true;
};