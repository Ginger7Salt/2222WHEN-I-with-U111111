// src/services/outfitAiService.js
//
// "今日穿搭"里需要 AI 参与的部分：
//   1. 角色决定自己今天穿什么（用户保存了自己的穿搭之后才会生成，
//      角色可以自己决定要不要和用户呼应，也就是情侣装）；
//   2. 用户点"让 TA 帮我搭配"时，角色给用户搭一套。
//
// 都是单独的一次性请求，只带这一次需要的资料，
// 不写进聊天记录，也不进聊天的总提示词。

import db from '../db';
import { generateResponse } from './aiService';
import { buildRhythmPersonaBrief } from './rhythmReminderService';
import {
  OUTFIT_PARTS,
  MAX_PART_LENGTH,
  MAX_NOTE_LENGTH,
  formatDateStr,
  getOutfit,
  getTodayDateStr,
  summarizeParts,
} from './outfitService';

const REQUEST_TIMEOUT_MS = 60000;

// 最近几天里如果已经有过一次情侣装，今天就不允许再呼应，
// 让它保持"偶尔的惊喜"，而不是每天都有。
const MATCH_COOLDOWN_DAYS = 2;

// 提示词里带上角色最近几天的穿搭，避免天天穿一样的。
const RECENT_CHAR_OUTFIT_LIMIT = 3;

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const LABEL_TO_KEY = {
  上衣: 'top',
  上身: 'top',
  下装: 'bottom',
  下身: 'bottom',
  裤子: 'bottom',
  外套: 'outer',
  鞋: 'shoes',
  鞋子: 'shoes',
  配饰: 'accessory',
  饰品: 'accessory',
  呼应: 'match',
  情侣装: 'match',
  一句话: 'line',
};

const EMPTY_VALUES = new Set(['无', '没有', '不穿', '不戴', '暂无', '无。', '-', '—']);

const cleanText = (value, maxLength) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const isConfigMissingError = (err) =>
  String(err?.message || '').includes('请先在系统设置中配置');

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

const formatDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  return `${m}月${d}日 ${WEEKDAY_LABELS[dateObj.getDay()]}`;
};

const formatWeatherText = (weather) => {
  const text = [weather?.label, weather?.temp].filter(Boolean).join('，');

  return text || '';
};

/**
 * 把 AI 返回的文本解析成 { parts, match, line }。
 * 格式是每行一项、用 ||| 分隔："上衣|||白衬衫"。
 * 对模型多写的编号、星号、空行、顺序错乱都做了容错。
 */
export const parseOutfitResponse = (rawText) => {
  const result = { parts: {}, match: false, line: '' };

  String(rawText || '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) return;

      const segments = line.split(/\|\|\||｜｜｜/);

      if (segments.length < 2) return;

      const label = segments[0].replace(/[\s*#>·•:：\d.、()（）【】「」"'-]/g, '');
      const key = LABEL_TO_KEY[label];

      if (!key) return;

      const value = segments[1]
        .replace(/^[\s*"“「]+|[\s*"”」]+$/g, '')
        .trim();

      if (key === 'match') {
        result.match = value.includes('是') && !value.includes('否');
        return;
      }

      if (key === 'line') {
        result.line = cleanText(value, MAX_NOTE_LENGTH);
        return;
      }

      if (value && !EMPTY_VALUES.has(value)) {
        result.parts[key] = cleanText(value, MAX_PART_LENGTH);
      }
    });

  return result;
};

const hasEnoughParts = (parts) => Object.keys(parts).length >= 2;

const loadContext = async (chatId) => {
  const chat = await db.chats.get(chatId);

  if (!chat) return null;

  const character = await db.characters.get(chat.characterId);

  if (!character) return null;

  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

  const userName = String(chat.userName || character.userName || '对方').trim();
  const userPersona = String(chat.userPersona || character.userPersona || '').trim();

  return { chat, character, userName, userPersona, worldBookText, extraNotesText };
};

const buildPersonaBlock = ({ character, userName, userPersona, worldBookText, extraNotesText }) =>
  `人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}
你对用户的称呼是「${userName}」。${userPersona ? `用户的人设：${userPersona}。` : ''}`;

const PART_FORMAT_LINES = `上衣|||...
下装|||...
外套|||...（不穿写"无"）
鞋|||...
配饰|||...（不戴写"无"）`;

/**
 * 读取这个聊天窗最近几天（不含今天）角色的穿搭，最新的在前。
 */
const getRecentCharOutfits = async (chatId, dateStr) => {
  const rows = await db.outfitRecords.where('chatId').equals(chatId).toArray();

  return rows
    .filter((row) => row.owner === 'char' && row.dateStr < dateStr)
    .sort((a, b) => (a.dateStr < b.dateStr ? 1 : -1));
};

const getDateStrDaysBefore = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);

  return formatDateStr(new Date(y, m - 1, d - days));
};

/**
 * 今天能不能呼应：最近 MATCH_COOLDOWN_DAYS 天内已经呼应过，就不能。
 */
export const canMatchToday = (recentCharOutfits, dateStr) => {
  const earliest = getDateStrDaysBefore(dateStr, MATCH_COOLDOWN_DAYS);

  return !recentCharOutfits.some(
    (row) => row.coordinated && row.dateStr >= earliest && row.dateStr < dateStr,
  );
};

export const buildCharOutfitPrompt = ({
  context,
  dateStr,
  weather,
  userRecord,
  recentCharOutfits,
  mayMatch,
}) => {
  const { character, userName } = context;

  const weatherText = formatWeatherText(weather);
  const userSummary = summarizeParts(userRecord?.parts) || '（没有写具体单品）';
  const userNote = userRecord?.note ? `，${userName}的备注：${userRecord.note}` : '';

  const recentLines = recentCharOutfits
    .slice(0, RECENT_CHAR_OUTFIT_LIMIT)
    .map((row) => `- ${formatDateLabel(row.dateStr)}：${summarizeParts(row.parts)}`)
    .join('\n');

  const matchDirective = mayMatch
    ? `你可以在心血来潮时，悄悄和${userName}今天的穿搭呼应（同色系、同款单品，或者一上一下互相搭配），让对方发现的时候有点小惊喜。
但这只是偶尔发生的事：大多数日子你只是按自己的习惯穿，「呼应」写 否。
如果选择呼应，「一句话」也不要直接点破"我们穿得一样"，保持自然，可以带一点得意或害羞。`
    : `最近你们刚有过呼应的搭配，所以今天不要和${userName}呼应，按自己的习惯独立搭配，「呼应」必须写 否。`;

  return `你正在扮演角色「${character.name}」，决定自己今天穿什么。
${buildPersonaBlock(context)}

今天的情况：
- 日期：${formatDateLabel(dateStr)}
- 天气：${weatherText || '没有记录，按季节和生活常识来'}
- ${userName}今天的穿搭：${userSummary}${userNote}
${recentLines ? `\n你最近几天的穿搭（今天尽量不要重复）：\n${recentLines}\n` : ''}
${matchDirective}

请按你的人设和天气，决定你自己今天的穿搭。严格按以下格式输出，每行一项，字段之间用 ||| 分隔，一共 7 行，不要标题、不要编号、不要 Markdown、不要多余说明：

${PART_FORMAT_LINES}
呼应|||是 或 否
一句话|||...

要求：
- 全站零 Emoji。
- 每一项不超过 12 个字，写具体的单品，不要写"休闲装"这种笼统的说法。
- 「一句话」不超过 30 个字，是你穿成这样时，随口对${userName}说的话或心里的小想法，符合你的性格，不要复述穿搭清单。
- 穿搭要符合天气，也要符合你的性格和生活。`;
};

export const buildSuggestPrompt = ({
  context,
  dateStr,
  weather,
  filledParts,
  recentUserSummaries,
}) => {
  const { character, userName } = context;

  const weatherText = formatWeatherText(weather);

  const filledLines = OUTFIT_PARTS.filter(({ key }) => filledParts?.[key])
    .map(({ key, label }) => `- ${label}：${filledParts[key]}`)
    .join('\n');

  const recentLines = recentUserSummaries.map((summary) => `- ${summary}`).join('\n');

  return `你正在扮演角色「${character.name}」。${userName}请你帮ta搭配今天要穿的衣服。
${buildPersonaBlock(context)}

今天的情况：
- 日期：${formatDateLabel(dateStr)}
- 天气：${weatherText || '没有记录，按季节和生活常识来'}
${filledLines ? `- ${userName}已经想好的部位（请原样保留，并围绕它们搭配其余部位）：\n${filledLines}` : `- ${userName}还没有决定任何部位。`}
${recentLines ? `\n${userName}最近穿过的搭配（尽量别重复）：\n${recentLines}\n` : ''}
你并不清楚${userName}的衣柜里有什么，所以请推荐常见、容易找到的单品。

严格按以下格式输出，每行一项，字段之间用 ||| 分隔，一共 6 行，不要标题、不要编号、不要 Markdown、不要多余说明：

${PART_FORMAT_LINES}
一句话|||...

要求：
- 全站零 Emoji。
- 每一项不超过 12 个字，写具体的单品。
- 「一句话」不超过 30 个字，是你给出这套搭配时对${userName}说的话，符合你的性格，可以带一点你的偏好或小心思。
- 搭配要符合天气。`;
};

const requestOutfitText = async (prompt) =>
  withTimeout(
    generateResponse([
      { role: 'system', content: prompt },
      { role: 'user', content: '请按要求的格式输出。' },
    ]),
    REQUEST_TIMEOUT_MS,
  );

const mapError = (err) => {
  if (isConfigMissingError(err)) {
    return { status: 'no_api_config' };
  }

  return { status: 'error', error: err?.message || 'unknown_error' };
};

const inFlight = new Map();

const runCharOutfit = async (chatId, dateStr) => {
  const existing = await getOutfit(chatId, dateStr, 'char');

  if (existing) {
    return { status: 'already_exists', record: existing };
  }

  const userRecord = await getOutfit(chatId, dateStr, 'user');

  if (!userRecord) {
    return { status: 'no_user_outfit' };
  }

  const context = await loadContext(chatId);

  if (!context) {
    return { status: 'no_chat' };
  }

  const recentCharOutfits = await getRecentCharOutfits(chatId, dateStr);
  const mayMatch = canMatchToday(recentCharOutfits, dateStr);

  const prompt = buildCharOutfitPrompt({
    context,
    dateStr,
    weather: userRecord.weather,
    userRecord,
    recentCharOutfits,
    mayMatch,
  });

  let rawText;

  try {
    rawText = await requestOutfitText(prompt);
  } catch (err) {
    if (!isConfigMissingError(err)) {
      console.error('[outfitAiService] 角色穿搭请求失败：', err);
    }

    return mapError(err);
  }

  const parsed = parseOutfitResponse(rawText);

  if (!hasEnoughParts(parsed.parts)) {
    return { status: 'bad_response' };
  }

  const nowIso = new Date().toISOString();

  // 放进事务里再检查一次，防止极端情况下同一天写入两条角色记录。
  const record = await db.transaction('rw', db.outfitRecords, async () => {
    const rows = await db.outfitRecords
      .where('[chatId+dateStr]')
      .equals([chatId, dateStr])
      .toArray();

    const found = rows.find((row) => row.owner === 'char');

    if (found) return found;

    const created = {
      chatId,
      dateStr,
      owner: 'char',
      parts: parsed.parts,
      note: parsed.line,
      // 只有"今天允许呼应"并且角色自己选了呼应，才算情侣装。
      coordinated: mayMatch && parsed.match,
      source: 'ai',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const id = await db.outfitRecords.add(created);

    return { id, ...created };
  });

  return { status: 'success', record };
};

/**
 * 生成角色今天的穿搭。
 * - 用户还没保存自己的穿搭时不生成（返回 no_user_outfit）；
 * - 今天已经有了就直接返回，不重复生成；
 * - 同一天同一个聊天窗同时只会有一个请求在进行，重复调用拿到的是同一个结果。
 */
export const generateCharOutfit = ({ chatId, dateStr = getTodayDateStr() }) => {
  if (!chatId) {
    return Promise.resolve({ status: 'no_chat' });
  }

  const key = `${chatId}:${dateStr}`;

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = runCharOutfit(chatId, dateStr)
    .catch((err) => {
      console.error('[outfitAiService] 生成角色穿搭失败：', err);
      return { status: 'error', error: err?.message || 'unknown_error' };
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);

  return promise;
};

/**
 * 让角色给用户搭配一套。结果只返回给界面，不写入数据库；
 * 用户点"就穿这套"、再保存，才会成为今天的穿搭。
 */
export const suggestUserOutfit = async ({
  chatId,
  dateStr = getTodayDateStr(),
  parts,
  weather,
}) => {
  if (!chatId) return { status: 'no_chat' };

  try {
    const context = await loadContext(chatId);

    if (!context) return { status: 'no_chat' };

    const rows = await db.outfitRecords.where('chatId').equals(chatId).toArray();

    const recentUserSummaries = rows
      .filter((row) => row.owner === 'user' && row.dateStr < dateStr)
      .sort((a, b) => (a.dateStr < b.dateStr ? 1 : -1))
      .slice(0, RECENT_CHAR_OUTFIT_LIMIT)
      .map((row) => summarizeParts(row.parts))
      .filter(Boolean);

    const filledParts = {};

    OUTFIT_PARTS.forEach(({ key }) => {
      const text = cleanText(parts?.[key], MAX_PART_LENGTH);

      if (text) filledParts[key] = text;
    });

    const prompt = buildSuggestPrompt({
      context,
      dateStr,
      weather,
      filledParts,
      recentUserSummaries,
    });

    let rawText;

    try {
      rawText = await requestOutfitText(prompt);
    } catch (err) {
      if (!isConfigMissingError(err)) {
        console.error('[outfitAiService] 搭配建议请求失败：', err);
      }

      return mapError(err);
    }

    const parsed = parseOutfitResponse(rawText);

    if (!hasEnoughParts(parsed.parts)) {
      return { status: 'bad_response' };
    }

    // 用户已经填好的部位以用户为准，不管模型有没有照做。
    const finalParts = { ...parsed.parts, ...filledParts };

    return { status: 'success', parts: finalParts, note: parsed.line };
  } catch (err) {
    console.error('[outfitAiService] 搭配建议失败：', err);
    return { status: 'error', error: err?.message || 'unknown_error' };
  }
};

/**
 * 删除某一天的全部穿搭（用户的和角色的一起删）。
 * 用户删掉自己的穿搭后，角色那一份也应该一起消失，回到"还在换衣服"。
 */
export const deleteOutfitDayAll = async (chatId, dateStr) => {
  if (!chatId || !dateStr) return 0;

  const rows = await db.outfitRecords
    .where('[chatId+dateStr]')
    .equals([chatId, dateStr])
    .toArray();

  if (rows.length === 0) return 0;

  await db.outfitRecords.bulkDelete(rows.map((row) => row.id));

  return rows.length;
};