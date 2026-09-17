import db from '../../../db';

const hasStore = () => Boolean(db.almanacImportantDates);

const sortByUpcoming = (items = [], now = new Date()) => {
  return [...items].sort((a, b) => {
    const aDays = getDaysRemaining(a, now);
    const bDays = getDaysRemaining(b, now);

    if (aDays === null && bDays === null) return 0;
    if (aDays === null) return 1;
    if (bDays === null) return -1;

    return aDays - bDays;
  });
};

const getDateOnly = (value) => {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * 计算某个重要日期距离今天还有多少天。
 *
 * isRecurringYearly = true 时（生日/纪念日）：
 *   自动换算成今年或明年最近的那一次。
 *
 * isRecurringYearly = false 时（一次性日子）：
 *   直接使用原始日期，过去的日子返回负数天数（表示已过去）。
 */
export const getDaysRemaining = (importantDate, now = new Date()) => {
  const originalDate = getDateOnly(importantDate?.date);

  if (!originalDate) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!importantDate.isRecurringYearly) {
    const diff = Math.round(
      (originalDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    return diff;
  }

  const thisYear = new Date(
    today.getFullYear(),
    originalDate.getMonth(),
    originalDate.getDate()
  );

  const target = thisYear >= today
    ? thisYear
    : new Date(
        today.getFullYear() + 1,
        originalDate.getMonth(),
        originalDate.getDate()
      );

  return Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
};

export const getAlmanacImportantDates = async (chatId) => {
  if (!chatId || !hasStore()) {
    return [];
  }

  try {
    const items = await db.almanacImportantDates
      .where('chatId')
      .equals(chatId)
      .toArray();

    return sortByUpcoming(items);
  } catch (error) {
    console.warn('[Almanac] 读取重要日期失败：', error);
    return [];
  }
};

export const createAlmanacImportantDate = async ({
  chatId,
  title,
  date,
  isRecurringYearly = false,
}) => {
  if (!chatId || !hasStore() || !title?.trim() || !date) {
    return null;
  }

  const now = new Date().toISOString();

  const record = {
    chatId,
    title: title.trim(),
    date,
    isRecurringYearly: Boolean(isRecurringYearly),
    createdAt: now,
    updatedAt: now,
  };

  return db.almanacImportantDates.add(record);
};

export const updateAlmanacImportantDate = async (id, patch = {}) => {
  if (!id || !hasStore()) {
    return null;
  }

  const current = await db.almanacImportantDates.get(id);

  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    title: String(patch.title ?? current.title).trim(),
    updatedAt: new Date().toISOString(),
  };

  await db.almanacImportantDates.put(next);

  return next;
};

export const deleteAlmanacImportantDate = async (id) => {
  if (!id || !hasStore()) {
    return false;
  }

  await db.almanacImportantDates.delete(id);

  return true;
};

/**
 * 供 AI 上下文使用：找出最近、且在 leadDays 天内即将到来的一个重要日期。
 * 只返回一条，避免每次都塞进太多信息。
 */
export const getUpcomingImportantDateForPrompt = async (
  chatId,
  { now = new Date(), leadDays = 7 } = {}
) => {
  const items = await getAlmanacImportantDates(chatId);

  const withDays = items
    .map((item) => ({
      ...item,
      daysRemaining: getDaysRemaining(item, now),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.daysRemaining) &&
        item.daysRemaining >= 0 &&
        item.daysRemaining <= leadDays
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return withDays[0] || null;
};

export default {
  getAlmanacImportantDates,
  createAlmanacImportantDate,
  updateAlmanacImportantDate,
  deleteAlmanacImportantDate,
  getUpcomingImportantDateForPrompt,
  getDaysRemaining,
};