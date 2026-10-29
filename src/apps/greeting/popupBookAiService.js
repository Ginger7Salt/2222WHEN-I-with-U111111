// src/apps/greeting/popupBookAiService.js
//
// 让角色"亲手做一本立体书"：构造提示词、调用一次 generateResponse、把返回内容
// 解析并校验成可以直接存库和渲染的结构。
//
// 和贺卡一样是独立的一次性生成调用，返回格式用 <tag>…</tag> 分段而不是 JSON。
// 所有来自模型的内容都当作不可信数据：
//   - 文字去 HTML / emoji、限长；
//   - 枚举值（模型类型、款式、月亮形状）走白名单；
//   - 颜色只接受十六进制，点缀色饱和度被压到上限以内；
//   - 数量参数夹在范围里；
//   - 某个跨页的模型不合法时，只让那一页降级成纯文字页，整本书不失败。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import {
  ACCENT_MAX_SATURATION,
  BOOK_COVER_MOTIFS,
  BOOK_LIMITS,
  BOOK_MODELS,
  CONTEXT_MESSAGE_CHARS,
  CONTEXT_MESSAGE_COUNT,
  DEFAULT_BOOK_PALETTE,
  DEFAULT_SPREAD_COUNT,
  HOUSE_LIMITS,
  HOUSE_MOONS,
  MODEL_SPECS,
  getBookKind,
} from './popupBookConstants';

/* ------------------------------ 校验小工具 ------------------------------ */

const EMOJI_RE = /[\p{Extended_Pictographic}️‍]/gu;

const cleanText = (value, maxChars) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(EMOJI_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);

const pickEnum = (value, allowed, fallback) => {
  const key = String(value || '').trim().toLowerCase();
  return allowed.includes(key) ? key : fallback;
};

const clampInt = (value, [min, max], fallback) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHex = (value) => {
  const text = String(value || '').trim();
  if (!HEX_RE.test(text)) return null;
  if (text.length === 4) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
  }
  return text.toLowerCase();
};

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgbToHex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// 把点缀色的饱和度压到上限以内：向它自己的灰度值靠拢。
const limitSaturation = (hex, maxS) => {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  if (s <= maxS) return hex;
  const k = maxS / s;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return rgbToHex([gray + (r - gray) * k, gray + (g - gray) * k, gray + (b - gray) * k]);
};

// 太浅的点缀色在米白纸上看不见：亮度过高就压暗一点。
const ensureAccentVisible = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  if (gray <= 170) return hex;
  const k = 170 / gray;
  return rgbToHex([r * k, g * k, b * k]);
};

export const normalizeAccent = (value) => {
  const hex = normalizeHex(value);
  if (!hex) return DEFAULT_BOOK_PALETTE.accent;
  return ensureAccentVisible(limitSaturation(hex, ACCENT_MAX_SATURATION));
};

/* ------------------------------- 解析回复 ------------------------------- */

const grabTag = (text, tag) => {
  const match = String(text || '').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
};

const grabAll = (text, tag) => {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  let match = re.exec(String(text || ''));
  while (match) {
    out.push(match[1].trim());
    match = re.exec(String(text || ''));
  }
  return out;
};

// <params> 里每行一个 key=value。
const parseParamLines = (raw) => {
  const out = {};
  String(raw || '')
    .split(/\n+/)
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      if (!/^[a-z_]{1,20}$/.test(key)) return;
      out[key] = line.slice(idx + 1).trim();
    });
  return out;
};

// 把模型 + 原始参数整理成一定安全的结构；模型不认识就返回 null（调用方降级成纯文字页）。
export const normalizeModel = (modelName, rawParams) => {
  const model = pickEnum(modelName, BOOK_MODELS, null);
  if (!model) return null;
  const raw = rawParams && typeof rawParams === 'object' ? rawParams : {};

  if (model === 'house') {
    return {
      model,
      params: {
        windows: clampInt(raw.windows, HOUSE_LIMITS.windows, 2),
        stars: clampInt(raw.stars, HOUSE_LIMITS.stars, 4),
        moon: pickEnum(raw.moon, HOUSE_MOONS, 'crescent'),
        label: cleanText(raw.label, HOUSE_LIMITS.label),
      },
    };
  }
  return null;
};

const parseSpread = (raw) => {
  const items = [];

  const kick = cleanText(grabTag(raw, 'kick'), BOOK_LIMITS.kick);
  if (kick) items.push({ t: 'kick', s: kick });

  const heading = cleanText(grabTag(raw, 'heading'), BOOK_LIMITS.heading);
  if (heading) items.push({ t: 'h', s: heading });

  grabAll(raw, 'p')
    .map((line) => cleanText(line, BOOK_LIMITS.paragraph))
    .filter(Boolean)
    .slice(0, BOOK_LIMITS.paragraphs)
    .forEach((s) => items.push({ t: 'p', s }));

  if (!items.some((item) => item.t === 'p')) return null; // 一页没有正文就不要

  const modelName = grabTag(raw, 'model');
  const normalized = normalizeModel(modelName, parseParamLines(grabTag(raw, 'params')));
  const caption = cleanText(grabTag(raw, 'caption'), BOOK_LIMITS.caption);

  return {
    left: { items },
    right: normalized
      ? { model: normalized.model, params: normalized.params, caption }
      : { model: null, params: {}, caption },
  };
};

// 解析模型回复。返回 null 表示"这份回复不能用"（调用方可以重试）。
export const parsePopupBookReply = (raw) => {
  const text = String(raw || '');

  const title = cleanText(grabTag(text, 'title'), BOOK_LIMITS.title);
  const sign = cleanText(grabTag(text, 'sign'), BOOK_LIMITS.sign);
  if (!title || !sign) return null;

  const spreads = grabAll(text, 'spread')
    .map(parseSpread)
    .filter(Boolean)
    .slice(0, BOOK_LIMITS.spreads);
  if (!spreads.length) return null;

  return {
    cover: { title, motif: pickEnum(grabTag(text, 'motif'), BOOK_COVER_MOTIFS, 'mist') },
    palette: { ...DEFAULT_BOOK_PALETTE, accent: normalizeAccent(grabTag(text, 'accent')) },
    sign,
    spreads,
  };
};

/* ------------------------------ 聊天上下文 ------------------------------ */

// 多取一些再筛：最近的消息里可能夹着报错、自动回复、空消息，筛完要还能凑够 CONTEXT_MESSAGE_COUNT 条。
const CONTEXT_FETCH_WINDOW = CONTEXT_MESSAGE_COUNT * 3;
const CONTEXT_SENDERS = ['user', 'character', 'ai', 'assistant'];

// 一条消息"当前版本"的正文。重新生成过的消息，正文在 versions[currentVersionIndex] 里，
// 顶层 content 可能还是旧版本。取法和记忆系统（memorySignals）保持一致。
const getCurrentContent = (row) => {
  const versions = Array.isArray(row.versions) ? row.versions : [];
  const index = Number(row.currentVersionIndex);
  const current = versions.length > 0 && Number.isInteger(index) ? versions[index] : null;

  if (current) {
    if (typeof current === 'string') return current;
    return current.metadata?.translationText || current.content || current.text || current.message || '';
  }
  return row.metadata?.translationText || row.content || '';
};

// 按真实时间排序。timestamp 在库里是 ISO 字符串，不能直接相减；读不出时间的退回到 id（写入顺序）。
const compareByTime = (a, b) => {
  const ta = new Date(a.row.timestamp).getTime();
  const tb = new Date(b.row.timestamp).getTime();
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return (a.row.id || 0) - (b.row.id || 0);
};

// memory / explain 用：取这个角色最近的聊天，每条截断。cheer 不调用。
// 只从库里读最近的一小段（按 id 倒序、限条数），不再把这个角色的全部消息读进内存。
export const loadBookContext = async (characterId) => {
  try {
    const rows = await db.messages
      .where('characterId')
      .equals(characterId)
      .reverse()
      .limit(CONTEXT_FETCH_WINDOW)
      .toArray();

    return rows
      .filter((row) => row && row.type !== 'error' && !row.metadata?.autoReply && CONTEXT_SENDERS.includes(row.sender))
      .map((row) => ({ row, text: cleanText(getCurrentContent(row), CONTEXT_MESSAGE_CHARS) }))
      .filter((item) => item.text)
      .sort(compareByTime)
      .slice(-CONTEXT_MESSAGE_COUNT)
      .map(({ row, text }) => `${row.sender === 'user' ? '用户' : '你'}：${text}`)
      .join('\n');
  } catch (error) {
    console.warn('读取聊天上下文失败（立体书会继续，只是少一段背景）：', error);
    return '';
  }
};

/* ------------------------------ 构造提示词 ------------------------------ */

const stringify = (value) => {
  if (value === null || value === undefined || value === '') return '未设置';
  if (typeof value === 'string') return value.trim() || '未设置';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getCharacterContext = (character) =>
  `【你的角色设定】
- 姓名：${stringify(character?.name)}
- 称呼 / Handle：${stringify(character?.handle)}
- 角色简介 / Bio：${stringify(character?.bio)}
- 补充设定 / Extra Notes：${stringify(character?.extraNotes)}
- 状态列表 / Status List：${stringify(character?.statusList)}
- 你对用户的了解（用户人设）：${stringify(character?.userPersona)}`;

const getEnabledWorldBooksText = async () => {
  try {
    const books = await db.worldBooks.where('isEnabled').equals(1).toArray();
    if (!books.length) return '';
    return `【已启用的世界书设定】
${books.map((book, index) => `- ${book.title || `世界书 ${index + 1}`}：${book.content || ''}`).join('\n')}`;
  } catch (error) {
    console.warn('读取世界书失败（立体书会继续，只是少一段背景）：', error);
    return '';
  }
};

const modelSpecText = () =>
  BOOK_MODELS.map(
    (name) => `- ${name}（${MODEL_SPECS[name].label}）：${MODEL_SPECS[name].desc}
  参数（每行一个 key=value，写在 <params> 里）：
${MODEL_SPECS[name].params.map((line) => `    ${line}`).join('\n')}`,
  ).join('\n');

export const buildPopupBookSystemPrompt = async ({
  character,
  kind,
  userNote = '',
  context = '',
  moment = null,
  spreadCount = DEFAULT_SPREAD_COUNT,
}) => {
  const kindInfo = getBookKind(kind);
  const worldBooksText = await getEnabledWorldBooksText();
  const note = cleanText(userNote, BOOK_LIMITS.userNote);
  const contextText = context
    ? `
【你们最近的聊天（只作背景，不要照搬原话，也不要提"聊天记录"）】
${context}
`
    : '';

  // 主动送的书：说明由来。trigger 是角色刚才在聊天里的那句回复，history 是最近几句。
  const momentTrigger = moment ? cleanText(moment.trigger, 200) : '';
  const momentHistory = moment
    ? String(moment.history || '')
        .split('\n')
        .map((line) => cleanText(line, CONTEXT_MESSAGE_CHARS))
        .filter(Boolean)
        .join('\n')
    : '';
  const momentText = moment
    ? `
【这本书的由来】
这不是用户要你做的，是你刚才聊天时自己想亲手做一本送给TA。${momentTrigger ? `\n你刚才说的是：「${momentTrigger}」` : ''}${
        momentHistory ? `\n当时最近的几句话（只作背景，不要照搬原话）：\n${momentHistory}` : ''
      }
`
    : '';

  return `你现在正扮演「${character?.name || '未命名角色'}」。

${getCharacterContext(character)}

${worldBooksText}

【任务】
你要亲手为用户做一本立体书：一本摊开放在桌上的双页书，每个跨页左边是一页文字，右边是一个从纸面上立起来的小模型。
类型：${kindInfo.label}。${kindInfo.hint}。
${note ? `用户留了一句话：「${note}」。` : moment ? '由你自己决定写什么。' : '用户没有留话，由你自己决定写什么。'}
${momentText}${contextText}
【写作要求】
- 用你自己的口吻写，具体、克制，像一个真实的人会写的话。不要客服式安慰，不要鸡汤，不要堆砌形容词。
- 一共 ${spreadCount} 个跨页。每个跨页的文字页有：小标签 kick（不超过 ${BOOK_LIMITS.kick} 字，可省略）、标题 heading（不超过 ${BOOK_LIMITS.heading} 字）、1 到 ${BOOK_LIMITS.paragraphs} 段正文 p（每段不超过 ${BOOK_LIMITS.paragraph} 字）。
- 不得使用 Emoji，不得使用 Markdown。
- 署名写你自己的名字。

【封面】
封面颜色会自动跟随用户的主题，所以你只能选款式、写标题：
- motif 可选：mist（雾面）、ink（墨，深色）、blank（留白，一个细圆环）、line（细线）
- 标题不超过 ${BOOK_LIMITS.title} 个字，要像一本书的名字，不要写成一整句话。

【内页配色】
内页是灰阶的纸，你只能再选一个低饱和的点缀色 accent（#rrggbb 十六进制），比如 #7b7494 这种带一点灰的颜色。太鲜艳的颜色会被自动调淡。

【可用的立体模型】每个跨页右边选一个，并填写参数：
${modelSpecText()}
caption 是模型下方的一行小字（不超过 ${BOOK_LIMITS.caption} 字，可省略）。

【输出格式（严格遵守，不要输出格式以外的任何文字）】
<book>
<title>书名</title>
<motif>mist</motif>
<accent>#7b7494</accent>
<sign>署名</sign>
<spread>
<kick>CHAPTER 1</kick>
<heading>标题</heading>
<p>第一段</p>
<p>第二段</p>
<model>house</model>
<params>
windows=2
stars=5
moon=crescent
label=小字
</params>
<caption>一行小字</caption>
</spread>
（按需重复 <spread> 共 ${spreadCount} 个）
</book>`;
};

/* ------------------------------- 对外入口 ------------------------------- */

// 生成一本立体书的内容。失败会抛出 Error，message 可以直接展示给用户。
export const generatePopupBookContent = async ({
  character,
  kind,
  userNote = '',
  context = '',
  moment = null,
  spreadCount = DEFAULT_SPREAD_COUNT,
}) => {
  const systemPrompt = await buildPopupBookSystemPrompt({ character, kind, userNote, context, moment, spreadCount });
  const userPrompt = '请现在就做这本立体书，严格按指定格式输出。';

  // 最多尝试两次：第一次格式不对时再要一次。网络/配置类错误由 generateResponse 直接抛出。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    const parsed = parsePopupBookReply(raw);
    if (parsed) return parsed;
  }

  throw new Error('这次没有做成一本完整的立体书，可以再试一次。');
};