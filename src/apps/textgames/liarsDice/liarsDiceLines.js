// src/apps/textgames/liarsDice/liarsDiceLines.js
//
// 角色在吹牛骰子对局里“什么时候说话、说什么”。
//
// 台词来源：优先读角色资料上的 character.liarsDiceLines（以后如果要按人
// 设让大模型生成并缓存，就存在这个字段，结构见下面 LINE_KINDS），读不到
// 或为空就退回这里的通用兜底句子，语气尽量中性，不绑定任何人设。虚拟
// NPC 没有这个字段，永远用兜底句子。
//
// 说话的时机分两类：
// - 必说（MANDATORY_KINDS）：自己赢了、自己出局——最值得看到反应的瞬间，
//   不受频率限制；
// - 选说：按 LINE_CHANCE 的概率说，而且每位角色一局最多说约
//   OPTIONAL_LINE_LIMIT 句（一局大约 17 轮，不限制的话会很吵）。

export const LINE_KINDS = {
  challenge: '质疑上一位叫点时',
  bigbid: '叫出一个很大的点数时',
  defended: '叫点被质疑、但开骰后叫点成立时',
  exposed: '叫点被质疑、开骰后发现叫点不成立（被识破）时',
  misfire: '质疑别人、结果判断错了丢骰子时',
  bust: '最后一颗骰子也没了、出局时',
  win: '自己是最后剩下的人、赢了时',
  lose: '别人赢了时',
};

export const MANDATORY_KINDS = ['win', 'bust'];
export const OPTIONAL_LINE_LIMIT = 5;

export const LINE_CHANCE = {
  challenge: 0.35,
  bigbid: 0.4,
  defended: 0.5,
  exposed: 0.5,
  misfire: 0.5,
  lose: 0.6,
};

const DEFAULT_LINES = {
  challenge: ['我不信，开。', '这个数我不信。', '开盅吧。'],
  bigbid: ['就这个数，信不信由你。', '我可是有底气的。', '敢跟吗？'],
  defended: ['看吧，我没骗你。', '早说了是真的。', '这回算你倒霉。'],
  exposed: ['被你看穿了……', '这也能被你抓到。', '下回没这么容易。'],
  misfire: ['看走眼了。', '啧，我以为你在虚张声势。', '算我冲动了。'],
  bust: ['我的骰子……没了。', '这一局我认输。', '你们继续吧。'],
  win: ['最后还是我赢了。', '承让。', '骰子很给面子。'],
  lose: ['差一点点……', '下一局不会输了。', '恭喜恭喜。'],
};

const validLines = (list) =>
  Array.isArray(list)
    ? list.filter((line) => typeof line === 'string' && line.trim())
    : [];

export const pickLine = (character, kind, rng = Math.random) => {
  const own = validLines(character?.liarsDiceLines?.[kind]);
  const pool = own.length > 0 ? own : DEFAULT_LINES[kind] || [];
  if (pool.length === 0) return '';
  return pool[Math.floor(rng() * pool.length)];
};