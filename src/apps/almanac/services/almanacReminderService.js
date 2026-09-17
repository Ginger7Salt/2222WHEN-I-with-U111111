import db from '../../../db';
import { getDateKey, getUserTimeZone, getAlmanacConfig } from './almanacService';

const hasStore = () => Boolean(db.almanacReminders);

export const MAX_REMINDERS = 10;

const parseTime = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute, totalMinutes: hour * 60 + minute };
};

export const getAlmanacReminders = async (chatId) => {
  if (!chatId || !hasStore()) {
    return [];
  }

  try {
    const items = await db.almanacReminders
      .where('chatId')
      .equals(chatId)
      .toArray();

    return items.sort((a, b) =>
      String(a.time || '').localeCompare(String(b.time || ''))
    );
  } catch (error) {
    console.warn('[Almanac] 读取轻提醒失败：', error);
    return [];
  }
};

export const createAlmanacReminder = async ({
  chatId,
  content,
  time,
  enabled = true,
}) => {
  if (!chatId || !hasStore() || !content?.trim() || !parseTime(time)) {
    return null;
  }

  const existingCount = await db.almanacReminders
    .where('chatId')
    .equals(chatId)
    .count();

  if (existingCount >= MAX_REMINDERS) {
    return null;
  }

  const now = new Date().toISOString();

  const record = {
    chatId,
    content: content.trim(),
    time,
    enabled: Boolean(enabled),
    lastFiredDateKey: null,
    createdAt: now,
    updatedAt: now,
  };

  return db.almanacReminders.add(record);
};

export const updateAlmanacReminder = async (id, patch = {}) => {
  if (!id || !hasStore()) {
    return null;
  }

  const current = await db.almanacReminders.get(id);

  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    content: String(patch.content ?? current.content).trim(),
    updatedAt: new Date().toISOString(),
  };

  await db.almanacReminders.put(next);

  return next;
};

export const deleteAlmanacReminder = async (id) => {
  if (!id || !hasStore()) {
    return false;
  }

  await db.almanacReminders.delete(id);

  return true;
};

/**
 * 检查某个聊天窗下所有轻提醒，找出"现在正好到时间、且今天还没触发过"的一条。
 * 每次只返回最多一条，避免同一轮检查触发多条提醒消息。
 */
export const getDueReminder = async (chatId, now = new Date()) => {
  if (!chatId || !hasStore()) {
    return null;
  }

  const config = await getAlmanacConfig(chatId);
  const timeZone = getUserTimeZone(config);
  const dateKey = getDateKey(now, timeZone);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const reminders = await getAlmanacReminders(chatId);

  const due = reminders.find((reminder) => {
    if (!reminder.enabled) return false;
    if (reminder.lastFiredDateKey === dateKey) return false;

    const parsed = parseTime(reminder.time);

    if (!parsed) return false;

    return currentMinutes >= parsed.totalMinutes;
  });

  if (!due) {
    return null;
  }

  return { ...due, dateKey };
};

export const markReminderFired = async (id, dateKey) => {
  if (!id || !hasStore()) {
    return null;
  }

  return updateAlmanacReminder(id, { lastFiredDateKey: dateKey });
};

export default {
  getAlmanacReminders,
  createAlmanacReminder,
  updateAlmanacReminder,
  deleteAlmanacReminder,
  getDueReminder,
  markReminderFired,
  MAX_REMINDERS,
};