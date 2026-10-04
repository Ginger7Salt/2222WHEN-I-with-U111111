// src/apps/textgames/texas/texasHandEval.js
//
// 德州扑克的牌/比牌纯函数，不碰 DB、不碰 React、不碰计时器。跟
// uno/unoEngine.js 一个风格：所有导出函数都不修改传入的数组。
//
// 牌面表示：{ rank, suit }，rank 是 2-14（11=J，12=Q，13=K，14=A），
// suit 是 's'|'h'|'d'|'c'。id 字符串（比如 "Ah"、"Td"）只用来给 UI 当
// key/debug，比牌逻辑不依赖它。
//
// 比牌用的是经典的"牌型类别 + 副牌"元组字典序比较法：evaluateBest()
// 对 5~7 张牌（手牌+公共牌）枚举所有 5 张组合，取分数最高的那一组，
// 分数是 [category, tiebreak...] 这样一个数组，数组本身按字典序比较
// 就能分出大小，不用另外写一堆 if/else 判断"同花 vs 顺子谁大"这种。

export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_LABEL_ZH = { s: '黑桃', h: '红心', d: '方块', c: '梅花' };
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };

export const RANK_LABEL = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
};

export const CATEGORY_LABEL_ZH = {
  0: '高牌',
  1: '一对',
  2: '两对',
  3: '三条',
  4: '顺子',
  5: '同花',
  6: '葫芦',
  7: '四条',
  8: '同花顺',
};

const cardId = (card) => `${RANK_LABEL[card.rank]}${card.suit}`;

export const createDeck = () => {
  const deck = [];
  SUITS.forEach((suit) => {
    for (let rank = 2; rank <= 14; rank += 1) {
      deck.push({ rank, suit, id: `${RANK_LABEL[rank]}${suit}` });
    }
  });
  return deck;
};

export const shuffleDeck = (deck, rng = Math.random) => {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 五张牌的下标组合（C(n,5)），n 一般是 5/6/7。
const combinations5 = (n) => {
  const result = [];
  const combo = [];
  const pick = (start) => {
    if (combo.length === 5) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < n; i += 1) {
      combo.push(i);
      pick(i + 1);
      combo.pop();
    }
  };
  pick(0);
  return result;
};

const COMBO_CACHE = {};
const getCombos = (n) => {
  if (!COMBO_CACHE[n]) COMBO_CACHE[n] = combinations5(n);
  return COMBO_CACHE[n];
};

// 恰好 5 张牌的评分。返回 { score: [category, ...tiebreak], category }。
// score 数组可以直接按字典序比较（先比第一项，相等再比下一项）。
export const evaluate5 = (cards) => {
  const ranksDesc = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suitsAll = cards.map((c) => c.suit);
  const isFlush = suitsAll.every((s) => s === suitsAll[0]);

  const uniqueRanks = Array.from(new Set(ranksDesc)).sort((a, b) => b - a);
  let straightHigh = null;
  // 常规顺子：连续 5 个不重复点数。
  for (let i = 0; i + 4 < uniqueRanks.length; i += 1) {
    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
      straightHigh = uniqueRanks[i];
      break;
    }
  }
  // 轮子（A-2-3-4-5），A 当 1 用，顺子大小按 5 算。
  if (straightHigh === null) {
    const wheel = [14, 5, 4, 3, 2];
    if (wheel.every((r) => uniqueRanks.includes(r))) straightHigh = 5;
  }

  const countByRank = new Map();
  ranksDesc.forEach((r) => countByRank.set(r, (countByRank.get(r) || 0) + 1));
  const groups = Array.from(countByRank.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => (b.count - a.count) || (b.rank - a.rank));

  const kickersAfter = (excludeRanks) =>
    ranksDesc.filter((r) => !excludeRanks.includes(r));

  if (isFlush && straightHigh !== null) {
    return { score: [HAND_CATEGORY.STRAIGHT_FLUSH, straightHigh], category: HAND_CATEGORY.STRAIGHT_FLUSH };
  }
  if (groups[0].count === 4) {
    const kicker = kickersAfter([groups[0].rank])[0];
    return { score: [HAND_CATEGORY.QUADS, groups[0].rank, kicker], category: HAND_CATEGORY.QUADS };
  }
  if (groups[0].count === 3 && groups[1] && groups[1].count >= 2) {
    return {
      score: [HAND_CATEGORY.FULL_HOUSE, groups[0].rank, groups[1].rank],
      category: HAND_CATEGORY.FULL_HOUSE,
    };
  }
  if (isFlush) {
    return { score: [HAND_CATEGORY.FLUSH, ...ranksDesc.slice(0, 5)], category: HAND_CATEGORY.FLUSH };
  }
  if (straightHigh !== null) {
    return { score: [HAND_CATEGORY.STRAIGHT, straightHigh], category: HAND_CATEGORY.STRAIGHT };
  }
  if (groups[0].count === 3) {
    const kickers = kickersAfter([groups[0].rank]).slice(0, 2);
    return { score: [HAND_CATEGORY.TRIPS, groups[0].rank, ...kickers], category: HAND_CATEGORY.TRIPS };
  }
  if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    const kicker = kickersAfter([highPair, lowPair])[0];
    return {
      score: [HAND_CATEGORY.TWO_PAIR, highPair, lowPair, kicker],
      category: HAND_CATEGORY.TWO_PAIR,
    };
  }
  if (groups[0].count === 2) {
    const kickers = kickersAfter([groups[0].rank]).slice(0, 3);
    return { score: [HAND_CATEGORY.PAIR, groups[0].rank, ...kickers], category: HAND_CATEGORY.PAIR };
  }
  return { score: [HAND_CATEGORY.HIGH_CARD, ...ranksDesc.slice(0, 5)], category: HAND_CATEGORY.HIGH_CARD };
};

const compareScoreArrays = (a, b) => {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
};

export const compareEval = (evalA, evalB) => compareScoreArrays(evalA.score, evalB.score);

// 牌型描述，比如"同花顺（K高）"、"葫芦，三条A带一对K"。给结算页/台词用。
export const describeEval = (ev) => {
  const [cat, ...tb] = ev.score;
  const label = CATEGORY_LABEL_ZH[cat];
  switch (cat) {
    case HAND_CATEGORY.STRAIGHT_FLUSH:
      return tb[0] === 14 ? '皇家同花顺' : `同花顺（${RANK_LABEL[tb[0]]} 高）`;
    case HAND_CATEGORY.QUADS:
      return `四条 ${RANK_LABEL[tb[0]]}`;
    case HAND_CATEGORY.FULL_HOUSE:
      return `葫芦，三条 ${RANK_LABEL[tb[0]]} 带一对 ${RANK_LABEL[tb[1]]}`;
    case HAND_CATEGORY.FLUSH:
      return `同花（${RANK_LABEL[tb[0]]} 高）`;
    case HAND_CATEGORY.STRAIGHT:
      return `顺子（${RANK_LABEL[tb[0]]} 高）`;
    case HAND_CATEGORY.TRIPS:
      return `三条 ${RANK_LABEL[tb[0]]}`;
    case HAND_CATEGORY.TWO_PAIR:
      return `两对，${RANK_LABEL[tb[0]]} 和 ${RANK_LABEL[tb[1]]}`;
    case HAND_CATEGORY.PAIR:
      return `一对 ${RANK_LABEL[tb[0]]}`;
    default:
      return `高牌 ${RANK_LABEL[tb[0]]}`;
  }
  return label;
};

// 5~7 张牌里选最好的 5 张。返回 { score, category, cards(选中的5张), label }。
export const evaluateBest = (cards) => {
  if (cards.length === 5) {
    const ev = evaluate5(cards);
    return { ...ev, cards, label: describeEval(ev) };
  }
  const combos = getCombos(cards.length);
  let best = null;
  combos.forEach((idxs) => {
    const hand = idxs.map((i) => cards[i]);
    const ev = evaluate5(hand);
    if (!best || compareScoreArrays(ev.score, best.score) > 0) {
      best = { ...ev, cards: hand };
    }
  });
  return { ...best, label: describeEval(best) };
};

export { cardId };