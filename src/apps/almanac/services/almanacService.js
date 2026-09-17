import db from '../../../db';

const hasAlmanacStores = () => Boolean(
  db.almanacConfigs && db.almanacRecords
);

export const ALMANAC_EVENT_TYPES = {
  CHAT_OPEN: 'chat_open',
  USER_MESSAGE: 'user_message',
  MORNING_GREETING: 'morning_greeting',
  NIGHT_GREETING: 'night_greeting',
  LIGHT_REMINDER: 'light_reminder',
};

// ---------------------------------------------
// 时间工具
// ---------------------------------------------

const safeDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const getSafeTimestamp = (value) => {
  const date = safeDate(value);
  return date ? date.getTime() : null;
};

export const getDateKey = (value = Date.now(), timeZone) => {
  const date = safeDate(value) || new Date();

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const result = {};

    parts.forEach((part) => {
      if (part.type !== 'literal') {
        result[part.type] = part.value;
      }
    });

    if (result.year && result.month && result.day) {
      return `${result.year}-${result.month}-${result.day}`;
    }
  } catch {
    // 降级为本地时间
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getLocalHour = (value = Date.now(), timeZone) => {
  const date = safeDate(value) || new Date();

  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .find((part) => part.type === 'hour')?.value;

    const parsedHour = Number.parseInt(hour, 10);

    if (Number.isInteger(parsedHour)) {
      return parsedHour === 24 ? 0 : parsedHour;
    }
  } catch {
    // 降级为本地时间
  }

  return date.getHours();
};

export const getDeviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const isValidTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

export const getUserTimeZone = (config = null) => {
  const configuredTimeZone = config?.timezone;

  if (isValidTimeZone(configuredTimeZone)) {
    return configuredTimeZone;
  }

  return getDeviceTimeZone();
};

export const isUsingDeviceTimeZone = (config = null) => {
  return !isValidTimeZone(config?.timezone);
};

// ---------------------------------------------
// 配置读写
// ---------------------------------------------

export const getDefaultAlmanacConfig = (chatId) => ({
  chatId,

  initializationCompleted: false,

  /*
   * milestones_only：从今天开始记录，但保留重要日期，不分析过去记录。
   * fresh_start：从今天开始记录，不保留过去的重要日期。
   * all_history：使用现有全部记录进行分析。
   */
  dataMode: null,

  observationStartedAt: null,
  observationResetAt: null,

  timezone: null,
  timezoneSource: 'device',
  deviceTimeZone: null,
  timezoneNoticeDismissed: false,
  timezoneNoticeLastShownAt: null,

  rhythmInferenceEnabled: false,

  importantDateReminderLeadDays: 7,

  morningGreetingEnabled: false,
  morningGreetingTime: '08:30',

  nightGreetingEnabled: false,
  nightGreetingTime: '23:30',

  allowMissedGreeting: false,
  skipIfUserChattedToday: true,

  updatedAt: new Date().toISOString(),
});

export const getAlmanacConfig = async (chatId) => {
  if (!chatId || !hasAlmanacStores()) {
    return getDefaultAlmanacConfig(chatId);
  }

  try {
    const saved = await db.almanacConfigs.get(chatId);

    return {
      ...getDefaultAlmanacConfig(chatId),
      ...(saved || {}),
    };
  } catch (error) {
    console.warn('[Almanac] 读取配置失败：', error);
    return getDefaultAlmanacConfig(chatId);
  }
};

export const saveAlmanacConfig = async (chatId, patch) => {
  if (!chatId || !hasAlmanacStores()) {
    return {
      ...getDefaultAlmanacConfig(chatId),
      ...patch,
    };
  }

  const current = await getAlmanacConfig(chatId);

  const next = {
    ...current,
    ...patch,
    chatId,
    updatedAt: new Date().toISOString(),
  };

  await db.almanacConfigs.put(next);

  return next;
};

// ---------------------------------------------
// 事件记录（内部统一为"按天聚合"，对外签名不变）
// ---------------------------------------------

const getDailyRecord = async ({ chatId, eventType, dateKey }) => {
  const records = await db.almanacRecords
    .where('[chatId+eventType+dateKey]')
    .equals([chatId, eventType, dateKey])
    .toArray();

  return records[0] || null;
};

/**
 * 记录一次 Almanac 事件。
 *
 * 对外签名保持不变：
 *   recordAlmanacEvent({ chatId, characterId, eventType, timestamp, metadata })
 *
 * 内部实现：同一天、同一 chatId、同一 eventType 的记录会自动合并成一条，
 * 累加 count，并按小时分桶记录在 localHourBuckets 里。
 * 不保存消息正文，只保存时间与次数，保护隐私。
 */
export const recordAlmanacEvent = async ({
  chatId,
  characterId = null,
  eventType,
  timestamp = Date.now(),
  metadata = {},
}) => {
  if (!chatId || !eventType || !hasAlmanacStores()) {
    return null;
  }

  const safeTimestamp = getSafeTimestamp(timestamp);

  if (!safeTimestamp) {
    return null;
  }

  const config = await getAlmanacConfig(chatId);
  const timeZone = getUserTimeZone(config);

  const dateKey = getDateKey(safeTimestamp, timeZone);
  const localHour = getLocalHour(safeTimestamp, timeZone);
  const nowIso = new Date(safeTimestamp).toISOString();

  try {
    const current = await getDailyRecord({ chatId, eventType, dateKey });

    const hourBuckets = {
      ...(current?.localHourBuckets || {}),
      [localHour]: Number(current?.localHourBuckets?.[localHour] || 0) + 1,
    };

    const nextRecord = {
      id: current?.id,
      chatId,
      characterId: characterId || current?.characterId || null,
      eventType,
      timestamp: nowIso,
      dateKey,
      timezone: isValidTimeZone(timeZone) ? timeZone : 'UTC',

      count: Number(current?.count || 0) + 1,

      firstTimestamp: current?.firstTimestamp || nowIso,
      lastTimestamp: nowIso,

      localHour,
      localHourBuckets: hourBuckets,

      metadata: {
        ...(current?.metadata || {}),
        source: metadata?.source || current?.metadata?.source || 'almanac',
      },
    };

    if (current?.id) {
      await db.almanacRecords.put(nextRecord);
      return current.id;
    }

    delete nextRecord.id;
    return await db.almanacRecords.add(nextRecord);
  } catch (error) {
    console.warn('[Almanac] 记录事件失败：', error);
    return null;
  }
};

export const filterAlmanacRecordsByConfig = (records = [], config = null) => {
  if (!Array.isArray(records)) {
    return [];
  }

  if (config?.dataMode === 'all_history') {
    return records;
  }

  const startedAt = getSafeTimestamp(config?.observationStartedAt);

  if (!startedAt) {
    return records;
  }

  return records.filter((record) => {
    const timestamp = getSafeTimestamp(record.timestamp);
    return timestamp && timestamp >= startedAt;
  });
};

export const getAlmanacRecords = async (chatId) => {
  if (!chatId || !hasAlmanacStores()) {
    return [];
  }

  try {
    return await db.almanacRecords
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');
  } catch (error) {
    console.warn('[Almanac] 读取观察记录失败：', error);
    return [];
  }
};

export const getFilteredAlmanacRecords = async (chatId) => {
  const [config, records] = await Promise.all([
    getAlmanacConfig(chatId),
    getAlmanacRecords(chatId),
  ]);

  return filterAlmanacRecordsByConfig(records, config);
};

export const restartAlmanacFromToday = async (chatId) => {
  if (!chatId) {
    return getDefaultAlmanacConfig(chatId);
  }

  const now = new Date().toISOString();

  return saveAlmanacConfig(chatId, {
    initializationCompleted: true,
    dataMode: 'fresh_start',
    observationStartedAt: now,
    observationResetAt: now,
  });
};

export const clearAlmanacRecords = async (chatId) => {
  if (!chatId || !hasAlmanacStores()) {
    return 0;
  }

  const records = await db.almanacRecords
    .where('chatId')
    .equals(chatId)
    .toArray();

  if (records.length === 0) {
    return 0;
  }

  await db.almanacRecords.bulkDelete(
    records.map((record) => record.id).filter(Boolean)
  );

  return records.length;
};

// ---------------------------------------------
// 统计与热力图（基于聚合记录的 count 字段计算）
// ---------------------------------------------

export const getAlmanacStats = (records = []) => {
  const validRecords = records
    .map((record) => ({
      ...record,
      timestamp: getSafeTimestamp(record.timestamp),
    }))
    .filter((record) => record.timestamp);

  const activeDates = new Set(
    validRecords.map((record) => record.dateKey).filter(Boolean)
  );

  const userMessages = validRecords.filter(
    (record) => record.eventType === ALMANAC_EVENT_TYPES.USER_MESSAGE
  );

  const chatOpens = validRecords.filter(
    (record) => record.eventType === ALMANAC_EVENT_TYPES.CHAT_OPEN
  );

  const sumCount = (list) =>
    list.reduce(
      (total, record) =>
        total + (Number.isFinite(Number(record.count)) ? Number(record.count) : 1),
      0
    );

  const firstTimestamp = validRecords.length
    ? Math.min(...validRecords.map((record) => record.timestamp))
    : null;

  const latestTimestamp = validRecords.length
    ? Math.max(...validRecords.map((record) => record.timestamp))
    : null;

  return {
    totalRecords: validRecords.length,
    activeDays: activeDates.size,
    userMessageCount: sumCount(userMessages),
    chatOpenCount: sumCount(chatOpens),
    firstTimestamp,
    latestTimestamp,
  };
};

export const getHeatmapData = (records = []) => {
  const result = new Map();

  records.forEach((record) => {
    if (!record?.dateKey) return;

    const current = result.get(record.dateKey) || {
      dateKey: record.dateKey,
      count: 0,
      hours: new Set(),
      eventTypes: new Set(),
    };

    current.count += Number.isFinite(Number(record.count))
      ? Number(record.count)
      : 1;

    if (Number.isInteger(record.localHour)) {
      current.hours.add(record.localHour);
    }

    if (record.eventType) {
      current.eventTypes.add(record.eventType);
    }

    result.set(record.dateKey, current);
  });

  return Array.from(result.values()).map((item) => ({
    dateKey: item.dateKey,
    count: item.count,
    hours: Array.from(item.hours).sort((a, b) => a - b),
    eventTypes: Array.from(item.eventTypes),
  }));
};

export default {
  ALMANAC_EVENT_TYPES,
  getSafeTimestamp,
  getDateKey,
  getLocalHour,
  getDeviceTimeZone,
  isValidTimeZone,
  getUserTimeZone,
  isUsingDeviceTimeZone,
  getDefaultAlmanacConfig,
  getAlmanacConfig,
  saveAlmanacConfig,
  recordAlmanacEvent,
  filterAlmanacRecordsByConfig,
  getAlmanacRecords,
  getFilteredAlmanacRecords,
  restartAlmanacFromToday,
  clearAlmanacRecords,
  getAlmanacStats,
  getHeatmapData,
};