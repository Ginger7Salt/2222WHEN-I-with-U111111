// src/apps/textgames/texas/texasLinesParse.js
//
// 把大模型返回的文本整理成 character.texasLines 的结构。纯函数，不碰
// 数据库和网络——照抄 uno/unoLinesParse.js 的结构，只是场合换成德州的
// 四种（见 texasLines.js 的 LINE_KINDS）。

import { LINE_KINDS } from './texasLines';

export const LINE_KIND_KEYS = Object.keys(LINE_KINDS);
export const MIN_LINES_PER_KIND = 2;
export const MAX_LINES_PER_KIND = 4;
export const MAX_LINE_LENGTH = 24;
// 四种场合里至少要这么多种合格才值得缓存，其余场合继续用通用兜底句子。
export const MIN_VALID_KINDS = 3;

const EMOJI_RE = /[\p{Extended_Pictographic}‍️]/gu;

export const stripEmoji = (text) =>
  String(text == null ? '' : text)
    .replace(EMOJI_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripFences = (raw) =>
  String(raw || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
};

// 返回 { lines, validKinds }；lines 里只有合格的场合。解析失败返回 null。
export const parseTexasLines = (rawText) => {
  const body = extractJsonObject(stripFences(rawText));
  if (!body) return null;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const lines = {};
  LINE_KIND_KEYS.forEach((kind) => {
    const list = Array.isArray(parsed[kind]) ? parsed[kind] : [];
    const seen = new Set();
    const cleaned = [];
    list.forEach((item) => {
      const text = stripEmoji(item);
      if (!text || text.length > MAX_LINE_LENGTH || seen.has(text)) return;
      seen.add(text);
      cleaned.push(text);
    });
    if (cleaned.length >= MIN_LINES_PER_KIND) {
      lines[kind] = cleaned.slice(0, MAX_LINES_PER_KIND);
    }
  });

  const validKinds = Object.keys(lines).length;
  if (validKinds < MIN_VALID_KINDS) return null;
  return { lines, validKinds };
};

export const hasCompleteTexasLines = (character) => {
  const own = character?.texasLines;
  if (!own || typeof own !== 'object') return false;
  return LINE_KIND_KEYS.every(
    (kind) =>
      Array.isArray(own[kind]) &&
      own[kind].filter((l) => typeof l === 'string' && l.trim()).length >= MIN_LINES_PER_KIND
  );
};

export const buildTexasLinesPrompt = (character) => {
  const kindList = LINE_KIND_KEYS.map((kind) => `- ${kind}：${LINE_KINDS[kind]}`).join('\n');
  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你正在和用户以及另一位角色一起玩三人桌德州扑克（Texas Hold'em）。请按下面
四种场合，各给出 3 到 4 句第一人称、脱口而出的台词，必须符合以上人设的
语气和说话习惯，同一场合的几句语气可以有变化。

四种场合：
${kindList}

严格要求：
- 只输出合法 JSON 对象，键就是上面四个英文名，值是字符串数组，
  形如 {"raise": ["...", "..."], "allin": ["...", "..."], ...}；
- 每一句 3 到 18 个字，口语化，一句话说完；
- 不使用 Emoji；
- 不要输出 Markdown、代码块围栏、解释或任何多余内容，只输出这个 JSON 对象本身。`;
};