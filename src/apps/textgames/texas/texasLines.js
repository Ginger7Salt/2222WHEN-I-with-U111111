// src/apps/textgames/texas/texasLines.js
//
// 角色在德州扑克桌上"什么时候说话、说什么"——跟 uno/unoLines.js 同一个
// 设计：台词来源优先读 character.texasLines（texasLinesService.js 按
// 人设生成并缓存），读不到就退回这里的通用兜底句子。
//
// 跟用户确认过的频率："只在关键节点"：自己加注/自己全下/这手牌赢了/
// 这手牌输了，四种场合，不是每一步 check/call 都要说话。全下和赢牌是
// 最抓眼球的瞬间，必说；加注和输牌按概率说，并且整桌一局（直到有人被
// 淘汰或用户离场）里每位角色最多说这么几句，不会一直刷屏。

export const LINE_KINDS = {
  raise: '自己加注时',
  allin: '自己全下时',
  win: '这手牌自己赢了（摊牌赢或者对方弃牌认输）',
  lose: '这手牌自己输了',
};

export const MANDATORY_KINDS = ['allin', 'win'];

export const LINE_CHANCE = {
  raise: 0.5,
  lose: 0.6,
};

// 跟 UNO 一样，选说的台词按座位累计一个上限，避免角色一直在刷屏。
export const OPTIONAL_LINE_LIMIT = 6;

const DEFAULT_LINES = {
  raise: ['加注。', '这把我想再往前推一点。', '不跟是你的事，我加了。'],
  allin: ['全下。', '筹码都推出去了，看你敢不敢跟。', '这把我梭哈了。'],
  win: ['这把算我的。', '赢了，承让。', '运气在我这边。'],
  lose: ['这把算你的。', '没拿住，下一把再说。', '牌不好，认了。'],
};

const validLines = (list) =>
  Array.isArray(list) ? list.filter((line) => typeof line === 'string' && line.trim()) : [];

export const pickTexasLine = (character, kind, rng = Math.random) => {
  const own = validLines(character?.texasLines?.[kind]);
  const pool = own.length > 0 ? own : DEFAULT_LINES[kind] || [];
  if (pool.length === 0) return '';
  return pool[Math.floor(rng() * pool.length)];
};