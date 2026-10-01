// src/apps/messages/interactions/halloween/halloweenKeywords.js
//
// 关键词触发特效用的关键词表：用户在输入框里打出这些词的任意一个时，
// 触发一排幽灵/南瓜从输入框上方走过（见 KeywordWalkerLane.jsx）。
// 纯客户端字符串匹配，零 API 成本。

const HALLOWEEN_KEYWORDS = [
  'trick or treat',
  '糖果',
  '南瓜',
  'pumpkin',
  '不给糖就捣蛋',
  '万圣节',
];

export const containsHalloweenKeyword = (text = '') => {
  const normalized = String(text).toLowerCase();
  return HALLOWEEN_KEYWORDS.some(
    (keyword) => normalized.includes(keyword.toLowerCase())
  );
};