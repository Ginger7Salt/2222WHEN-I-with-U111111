// src/apps/textgames/skull/skullLines.js
//
// 角色在骷髅牌对局里“什么时候说话、说什么”。
//
// 台词来源：优先读角色资料上的 character.skullLines（第一次和某个角色玩
// 之前，由 skullLinesService 按角色性格生成并缓存到这个字段，结构见下面
// LINE_KINDS），读不到或为空就退回这里的通用兜底句子，语气尽量中性，不绑
// 定任何人设。NPC 没有这个字段，永远用兜底句子。
//
// 说话的时机分两类：
// - 必说（MANDATORY_KINDS）：开始叫数、翻到骷髅、赢了——这些是玩家最期待
//   看到角色反应的瞬间，不受频率限制；
// - 选说：扣牌、加价、弃权、翻到蔷薇、输了——按 LINE_CHANCE 的概率说，而
//   且每位角色一局最多说 OPTIONAL_LINE_LIMIT 句（见 useSkullMatch.js）。

export const LINE_KINDS = {
  place: '把一张牌扣在自己面前时',
  bid: '第一个开口叫数、宣布要翻牌时',
  raise: '看到别人叫数后加价时',
  pass: '觉得太冒险、选择弃权时',
  rose: '自己翻牌，翻到蔷薇时',
  skull: '自己翻牌，翻到骷髅、挑战失败时',
  win: '自己赢了这一局',
  lose: '别人赢了这一局',
};

export const MANDATORY_KINDS = ['bid', 'skull', 'win'];

export const LINE_CHANCE = {
  place: 0.12,
  raise: 0.5,
  pass: 0.35,
  rose: 0.4,
  lose: 0.6,
};

const DEFAULT_LINES = {
  place: ['先放这张。', '就这样吧。', '你们猜猜看。'],
  bid: ['我来叫数。', '这回我敢翻。', '谁不服，就来加价。'],
  raise: ['我再加一个。', '这个数还不够。', '加价，敢跟吗？'],
  pass: ['这回我不跟了。', '太险了，弃权。', '算了，你们玩。'],
  rose: ['蔷薇，继续。', '这张安全。', '运气不错。'],
  skull: ['……翻到骷髅了。', '怎么会这样。', '这下糟了。'],
  win: ['我赢啦。', '承让。', '印记到手，收工。'],
  lose: ['这局输了……', '下一局我不会输了。', '恭喜恭喜。'],
};

const validLines = (list) =>
  Array.isArray(list)
    ? list.filter((line) => typeof line === 'string' && line.trim())
    : [];

export const pickLine = (character, kind, rng = Math.random) => {
  const own = validLines(character?.skullLines?.[kind]);
  const pool = own.length > 0 ? own : DEFAULT_LINES[kind] || [];
  if (pool.length === 0) return '';
  return pool[Math.floor(rng() * pool.length)];
};