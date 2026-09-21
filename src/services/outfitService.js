// src/services/outfitService.js
//
// "今日穿搭"的数据服务（Rhythm 里的小区域使用）。
// 数据按聊天窗（chatId）+ 日期（dateStr）+ 归属（owner）存储：
//   owner = 'user'  用户自己的穿搭
//   owner = 'char'  角色的穿搭（后续版本使用）
//
// 只存文字，不存图片。超过保留天数的记录会在用户打开穿搭页时被清理，
// 不需要后台定时任务（网页在后台本来也跑不了）。

import db from '../db';

export const OUTFIT_PARTS = [
  { key: 'top', label: '上衣' },
  { key: 'bottom', label: '下装' },
  { key: 'outer', label: '外套' },
  { key: 'shoes', label: '鞋' },
  { key: 'accessory', label: '配饰' },
];

// 手动选择的天气。后续接入天气服务后，这里仍然可以作为兜底。
export const WEATHER_OPTIONS = ['晴', '多云', '阴', '雨', '雪', '风', '雾'];

export const RETENTION_OPTIONS = [5, 7];
export const DEFAULT_RETENTION_DAYS = 7;

export const MAX_PART_LENGTH = 30;
export const MAX_NOTE_LENGTH = 60;
export const MAX_TEMP_LENGTH = 8;

const RETENTION_SETTING_KEY = 'outfitRetentionDays';
const DATE_STR_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => String(n).padStart(2, '0');

export const formatDateStr = (dateObj) =>
  `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;

export const getTodayDateStr = () => formatDateStr(new Date());

/**
 * 保留"今天 + 之前 N-1 天"，共 N 天。
 * 返回最早需要保留的那一天；比它更早的记录会被清理。
 * 用年月日字段构造日期，避免夏令时造成的偏差。
 */
export const getCutoffDateStr = (retentionDays, now = new Date()) => {
  const days = Math.max(1, Number(retentionDays) || DEFAULT_RETENTION_DAYS);
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (days - 1),
  );

  return formatDateStr(cutoff);
};

export const getRetentionDays = async () => {
  try {
    const setting = await db.settings.get(RETENTION_SETTING_KEY);
    const value = Number(setting?.value);

    return RETENTION_OPTIONS.includes(value) ? value : DEFAULT_RETENTION_DAYS;
  } catch (err) {
    console.error('[outfitService] 读取保留天数失败：', err);
    return DEFAULT_RETENTION_DAYS;
  }
};

export const setRetentionDays = async (days) => {
  const value = RETENTION_OPTIONS.includes(Number(days))
    ? Number(days)
    : DEFAULT_RETENTION_DAYS;

  await db.settings.put({ key: RETENTION_SETTING_KEY, value });

  return value;
};

/**
 * 清理超过保留天数的穿搭记录（所有聊天窗一起清）。
 * 任何失败都安全降级，返回 0，不影响页面使用。
 */
export const cleanupOldOutfits = async (now = new Date()) => {
  try {
    const retentionDays = await getRetentionDays();
    const cutoff = getCutoffDateStr(retentionDays, now);

    return await db.outfitRecords.where('dateStr').below(cutoff).delete();
  } catch (err) {
    console.error('[outfitService] 清理旧穿搭失败：', err);
    return 0;
  }
};

const cleanText = (value, maxLength) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const sanitizeParts = (parts) => {
  const result = {};

  OUTFIT_PARTS.forEach(({ key }) => {
    const text = cleanText(parts?.[key], MAX_PART_LENGTH);

    if (text) {
      result[key] = text;
    }
  });

  return result;
};

const sanitizeWeather = (weather) => {
  const label = cleanText(weather?.label, 8);
  const temp = cleanText(weather?.temp, MAX_TEMP_LENGTH);

  if (!label && !temp) {
    return null;
  }

  return { label, temp };
};

/**
 * 把各部位的文字用" / "连成一行，用于列表展示。
 */
export const summarizeParts = (parts) =>
  OUTFIT_PARTS.map(({ key }) => parts?.[key])
    .filter(Boolean)
    .join(' / ');

const findRecord = async (chatId, dateStr, owner) => {
  const rows = await db.outfitRecords
    .where('[chatId+dateStr]')
    .equals([chatId, dateStr])
    .toArray();

  return rows.find((row) => row.owner === owner) || null;
};

export const getOutfit = async (chatId, dateStr = getTodayDateStr(), owner = 'user') => {
  if (!chatId) return null;

  try {
    return await findRecord(chatId, dateStr, owner);
  } catch (err) {
    console.error('[outfitService] 读取穿搭失败：', err);
    return null;
  }
};

/**
 * 保存（新建或更新）用户某一天的穿搭。
 * 各部位和备注都为空时不保存，返回 { status: 'empty' }。
 */
export const saveUserOutfit = async ({
  chatId,
  dateStr = getTodayDateStr(),
  parts,
  note,
  weather,
}) => {
  if (!chatId) return { status: 'no_chat' };
  if (!DATE_STR_PATTERN.test(dateStr)) return { status: 'bad_date' };

  const cleanParts = sanitizeParts(parts);
  const cleanNote = cleanText(note, MAX_NOTE_LENGTH);

  if (Object.keys(cleanParts).length === 0 && !cleanNote) {
    return { status: 'empty' };
  }

  const nowIso = new Date().toISOString();
  const cleanWeather = sanitizeWeather(weather);

  // 放进事务，防止连点保存按钮时生成两条同一天的记录。
  const record = await db.transaction('rw', db.outfitRecords, async () => {
    const existing = await findRecord(chatId, dateStr, 'user');

    if (existing) {
      const updated = {
        ...existing,
        parts: cleanParts,
        note: cleanNote,
        weather: cleanWeather,
        updatedAt: nowIso,
      };

      await db.outfitRecords.put(updated);

      return updated;
    }

    const created = {
      chatId,
      dateStr,
      owner: 'user',
      parts: cleanParts,
      note: cleanNote,
      weather: cleanWeather,
      source: 'manual',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const id = await db.outfitRecords.add(created);

    return { id, ...created };
  });

  return { status: 'success', record };
};

/**
 * 列出这个聊天窗里所有保留下来的日子，最新的在前。
 * 返回 [{ dateStr, user, char }]。
 */
export const listOutfitDays = async (chatId) => {
  if (!chatId) return [];

  try {
    const rows = await db.outfitRecords.where('chatId').equals(chatId).toArray();
    const byDate = new Map();

    rows.forEach((row) => {
      if (!byDate.has(row.dateStr)) {
        byDate.set(row.dateStr, { dateStr: row.dateStr, user: null, char: null });
      }

      byDate.get(row.dateStr)[row.owner === 'char' ? 'char' : 'user'] = row;
    });

    return Array.from(byDate.values()).sort((a, b) =>
      a.dateStr < b.dateStr ? 1 : -1,
    );
  } catch (err) {
    console.error('[outfitService] 读取往期穿搭失败：', err);
    return [];
  }
};

export const deleteOutfitDay = async (chatId, dateStr, owner = 'user') => {
  if (!chatId || !DATE_STR_PATTERN.test(dateStr)) return 0;

  const rows = await db.outfitRecords
    .where('[chatId+dateStr]')
    .equals([chatId, dateStr])
    .toArray();

  const ids = rows.filter((row) => row.owner === owner).map((row) => row.id);

  if (ids.length === 0) return 0;

  await db.outfitRecords.bulkDelete(ids);

  return ids.length;
};

/**
 * 从还保留着的用户记录里，取每个部位最近穿过的几个不同的值，
 * 用来在输入框下面做快速选择。没有专门的"衣柜"，用的是最近的记录。
 */
export const getRecentPartValues = async (chatId, limit = 4) => {
  const result = {};

  OUTFIT_PARTS.forEach(({ key }) => {
    result[key] = [];
  });

  if (!chatId) return result;

  try {
    const rows = await db.outfitRecords.where('chatId').equals(chatId).toArray();

    rows
      .filter((row) => row.owner === 'user')
      .sort((a, b) => (a.dateStr < b.dateStr ? 1 : -1))
      .forEach((row) => {
        OUTFIT_PARTS.forEach(({ key }) => {
          const value = row.parts?.[key];

          if (value && result[key].length < limit && !result[key].includes(value)) {
            result[key].push(value);
          }
        });
      });
  } catch (err) {
    console.error('[outfitService] 读取最近穿搭失败：', err);
  }

  return result;
};