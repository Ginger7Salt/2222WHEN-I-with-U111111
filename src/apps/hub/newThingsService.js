// src/apps/hub/newThingsService.js
// 首页「新东西」订阅条的数据层：只做一件事——后台自动功能的更新提醒。
// 用完即扔：没有 isRead 状态，collect（收下）直接把这一行物理删除。
// 覆盖范围（2026-10 确认）：心情日历判定/日记（小伙伴+角色）/潮汐贝壳/徽章解锁/和好券到账。
// 不覆盖：DIY小屋新布置、异地任务挑战/文字游戏大厅这类"匹配类"通知、
//        QuickBoard 自己的"N条新留言"未读角标（两者是不同的东西）。
import db from '../../db';

const listeners = new Set();

const notify = () => {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error('newThingsService listener error:', err);
    }
  });
};

// 任何地方想在列表变化时刷新（目前只有 NewThingsBar 自己用），订阅这个即可。
export const subscribeBackgroundUpdates = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

// source: 'mood' | 'diary' | 'cdiary' | 'shell' | 'badge' | 'coupon'
// chatId 可选——心情日历/日记/和好券通常挂在某个聊天上，徽章/贝壳大多是全局性的。
// extra 按 source 存一点展示用的小信息（mood 的心情名、shell 的星级等），不做索引。
export const addBackgroundUpdate = async ({ source, chatId = null, title, sub = '', extra = null }) => {
  if (!source || !title) {
    console.warn('addBackgroundUpdate: missing source/title, skipped.', { source, title });
    return;
  }
  try {
    await db.backgroundUpdates.add({
      source,
      chatId,
      title,
      sub,
      extra,
      createdAt: Date.now(),
    });
    notify();
  } catch (err) {
    console.error('Failed to add background update:', err);
  }
};

// 按时间倒序返回全部——不分页、不做已读，列表本身就应该很短（用完即扔）。
export const getBackgroundUpdates = async () => {
  try {
    return await db.backgroundUpdates.orderBy('createdAt').reverse().toArray();
  } catch (err) {
    console.error('Failed to load background updates:', err);
    return [];
  }
};

// 收下一条 = 直接删除这一行（纯提醒用完就扔，不保留历史）。
export const takeBackgroundUpdate = async (id) => {
  try {
    await db.backgroundUpdates.delete(id);
    notify();
  } catch (err) {
    console.error('Failed to take background update:', err);
  }
};

export const takeAllBackgroundUpdates = async () => {
  try {
    await db.backgroundUpdates.clear();
    notify();
  } catch (err) {
    console.error('Failed to clear background updates:', err);
  }
};

export default {
  subscribeBackgroundUpdates,
  addBackgroundUpdate,
  getBackgroundUpdates,
  takeBackgroundUpdate,
  takeAllBackgroundUpdates,
};