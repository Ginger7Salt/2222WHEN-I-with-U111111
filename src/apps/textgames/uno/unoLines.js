// src/apps/textgames/uno/unoLines.js
//
// 角色在 UNO 对局里“什么时候说话、说什么”。
//
// 台词来源：优先读角色资料上的 character.unoLines（Slice D 会按角色性格
// 生成并缓存到这个字段，结构见下面 LINE_KINDS），读不到或为空就退回这里
// 的通用兜底句子，语气尽量中性，不绑定任何人设。
//
// 说话的时机分两类：
// - 必说（MANDATORY_KINDS）：喊 UNO、被抓、抓别人、赢了——这些是玩家最期待
//   看到角色反应的瞬间，不受频率限制；
// - 选说：出 +4、被罚抽、跳过别人、输了——按 LINE_CHANCE 的概率说，而且
//   每位角色一局最多说约 5 句（见 useUnoMatch.js 的 OPTIONAL_LINE_LIMIT）。

export const LINE_KINDS = {
  uno: '只剩最后一张牌时喊 UNO',
  caught: '忘了喊 UNO 被抓到时',
  catch: '抓到别人忘了喊 UNO 时',
  wild4: '对别人打出 +4 时',
  hit: '被罚抽牌（+2 / +4）时',
  skip: '跳过别人时',
  win: '自己赢了',
  lose: '别人赢了',
};

export const MANDATORY_KINDS = ['uno', 'caught', 'catch', 'win'];

export const LINE_CHANCE = {
  wild4: 0.8,
  hit: 0.4,
  skip: 0.3,
  lose: 0.6,
};

const DEFAULT_LINES = {
  uno: ['UNO！', '只剩一张啦。', 'UNO，你们小心点。', '最后一张了哦，UNO。'],
  caught: ['啊，我忘了喊……', '被抓到了，真不甘心。', '这也被你发现了？'],
  catch: ['你刚才没喊 UNO 哦，罚抽两张。', '抓到你啦，UNO 呢？', '嘿嘿，忘喊了吧。'],
  wild4: ['这张给你，不客气。', '+4，接好了。', '抱歉，这回要委屈你一下。'],
  hit: ['……下次再说。', '你给我等着。', '这笔我记下了。'],
  skip: ['这回合先让给我。', '跳过～'],
  win: ['我赢啦！', '最后一张，收工。', '承让。'],
  lose: ['差一点点……', '下一局我不会输了。', '恭喜恭喜。'],
};

const validLines = (list) =>
  Array.isArray(list)
    ? list.filter((line) => typeof line === 'string' && line.trim())
    : [];

export const pickLine = (character, kind, rng = Math.random) => {
  const own = validLines(character?.unoLines?.[kind]);
  const pool = own.length > 0 ? own : DEFAULT_LINES[kind] || [];
  if (pool.length === 0) return '';
  return pool[Math.floor(rng() * pool.length)];
};