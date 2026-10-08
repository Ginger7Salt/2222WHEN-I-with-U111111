// src/apps/textgames/skull/skullLinesParse.js
//
// 把大模型返回的文本整理成 character.skullLines 的结构。纯函数，不碰数据库
// 和网络，方便单独测试。服务层见 skullLinesService.js。

import { LINE_KINDS } from './skullLines';

export const LINE_KIND_KEYS = Object.keys(LINE_KINDS);
export const MIN_LINES_PER_KIND = 2;
export const MAX_LINES_PER_KIND = 4;
export const MAX_LINE_LENGTH = 24;
// 至少有这么多种场合合格才值得缓存，其余场合继续用通用兜底句子。
export const MIN_VALID_KINDS = 5;

// 零宽连接符（\u200d）和变体选择符（\ufe0f）也一起去掉，免得 emoji 去掉后留下残渣。
const EMOJI_RE = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;

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

// 模型有时会在 JSON 前后多说两句，截出最外层的 { ... }。
const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
};

// 返回 { lines, validKinds }；lines 里只有合格的场合。解析失败返回 null。
export const parseSkullLines = (rawText) => {
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

// 缓存是否完整：八种场合都有至少 2 句。
export const hasCompleteSkullLines = (character) => {
  const own = character?.skullLines;
  if (!own || typeof own !== 'object') return false;
  return LINE_KIND_KEYS.every(
    (kind) =>
      Array.isArray(own[kind]) &&
      own[kind].filter((l) => typeof l === 'string' && l.trim()).length >= MIN_LINES_PER_KIND
  );
};

export const buildSkullLinesPrompt = (character) => {
  const kindList = LINE_KIND_KEYS.map((kind) => `- ${kind}：${LINE_KINDS[kind]}`).join('\n');
  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你正在和用户以及其他几位玩家一起玩骷髅牌（四个人一桌，每人手里有三朵蔷薇和
一个骷髅，轮流把牌扣在面前；然后有人开始叫数，宣布自己能翻开几朵蔷薇，别人
可以加价或弃权；叫得最高的人要翻牌，翻到骷髅就失败并损失一张牌，成功两次的
人获胜）。请按下面八种场合，各给出 3 到 4 句第一人称、脱口而出的台词，必须
符合以上人设的语气和说话习惯，同一场合的几句语气可以有变化。

八种场合：
${kindList}

严格要求：
- 只输出合法 JSON 对象，键就是上面八个英文名，值是字符串数组，
  形如 {"place": ["...", "..."], "bid": ["...", "..."], ...}；
- 每一句 3 到 18 个字，口语化，一句话说完；
- 台词不要暴露自己手里到底扣的是蔷薇还是骷髅，要保持虚张声势的感觉；
- 不使用 Emoji；
- 不要输出 Markdown、代码块围栏、解释或任何多余内容，只输出这个 JSON 对象本身。`;
};