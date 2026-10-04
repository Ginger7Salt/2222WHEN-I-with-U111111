// src/apps/textgames/texas/texasAi.js
//
// 角色（电脑玩家）的德州扑克策略，纯函数，不碰 DB/React，也不调用大
// 模型——跟井字棋的 minimax、UNO 的加权评分一个思路：算法决策，省掉
// 每一手都要等一次 AI 接口往返的延迟和花费，角色台词（texasLines.js）
// 才是真正调用大模型生成文本的地方，两件事分开。
//
// 强度评估分两段：
// - preflop：抄的是扑克圈常用的 Chen Formula（高牌分 + 对子翻倍 + 同花
//   加分 - 牌差罚分），算出 0~20 的分数再归一化到 0~1；
// - postflop：用 texasHandEval 算当前能摊出的最大牌型类别（高牌到同花顺
//   共 9 档），归一化到 0~1，再叠加"听牌"加成（同花听/顺子听）。
//
// 决策：强度 vs 跟注赔率（pot odds）比大小，强度明显超过赔率就加注，
// 差不多就跟注，明显不够就弃牌；混入随机噪声和一点"抓诈唬/偶尔多跟一次"
// 的变化，避免每一步都像算好的机器人。skill 越低噪声越大、越容易犯错。

import { evaluateBest } from './texasHandEval';
import { getLegalActions, getPotTotal } from './texasEngine';

export const AI_DEFAULT_SKILL = 0.85;

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const highCardChen = (rank) => {
  if (rank >= 14) return 10;
  if (rank === 13) return 8;
  if (rank === 12) return 7;
  if (rank === 11) return 6;
  return rank / 2;
};

// Chen Formula，0~20 分；归一化版本导出给界面/调试用。
export const chenScore = (hole) => {
  const [a, b] = hole.slice().sort((x, y) => y.rank - x.rank);
  if (a.rank === b.rank) {
    return Math.max(highCardChen(a.rank) * 2, 5);
  }
  let score = highCardChen(a.rank);
  if (a.suit === b.suit) score += 2;
  const gap = a.rank - b.rank - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  if (gap <= 1 && a.rank <= 12) score += 1; // 两张都不超过Q、挨得近：更容易做顺子
  return Math.max(score, 0);
};

export const preflopStrength = (hole) => clamp01(chenScore(hole) / 20);

// 听牌加成：差一张就能同花/顺子，给一点"还没成牌但有潜力"的加分。
const drawBonus = (cards) => {
  let bonus = 0;
  const bySuit = {};
  cards.forEach((c) => {
    bySuit[c.suit] = (bySuit[c.suit] || 0) + 1;
  });
  if (Object.values(bySuit).some((n) => n === 4)) bonus += 0.15;

  const ranks = Array.from(new Set(cards.map((c) => c.rank))).sort((a, b) => a - b);
  let openEnded = false;
  let gutshot = false;
  for (let i = 0; i < ranks.length; i += 1) {
    const windowRanks = ranks.filter((r) => r >= ranks[i] && r <= ranks[i] + 4);
    if (windowRanks.length === 4) {
      const span = windowRanks[windowRanks.length - 1] - windowRanks[0];
      if (span === 3) openEnded = true;
      else gutshot = true;
    }
  }
  if (openEnded) bonus += 0.12;
  else if (gutshot) bonus += 0.05;

  return bonus;
};

export const postflopStrength = (hole, board) => {
  const cards = [...hole, ...board];
  const best = evaluateBest(cards);
  const madeScore = best.category / 8;
  return clamp01(madeScore * 0.85 + drawBonus(cards));
};

export const estimateStrength = (state, seatIndex, rng = Math.random) => {
  const seat = state.seats[seatIndex];
  const base =
    state.street === 'preflop'
      ? preflopStrength(seat.holeCards)
      : postflopStrength(seat.holeCards, state.board);
  const noise = (rng() - 0.5) * 0.1;
  return clamp01(base + noise);
};

const pickBetSize = (state, seatIndex, legal, strength, rng) => {
  const potBefore = getPotTotal(state) + legal.callAmount;
  const potFactor = 0.55 + rng() * 0.45; // 半池到接近满池
  const raw = state.currentBet + Math.max(state.minRaiseAmount, Math.round(potBefore * potFactor));
  const stackToPot = state.seats[seatIndex].stack / Math.max(potBefore, 1);

  // 牌很强、或者剩的筹码相对底池已经不多了：直接推全下，省得翻来覆去。
  if (strength > 0.9 || stackToPot <= 1.5) {
    return legal.maxRaiseTo;
  }
  return Math.min(Math.max(raw, legal.minRaiseTo), legal.maxRaiseTo);
};

// 返回 { action: 'fold'|'check'|'call'|'raise'|'allin', toTotal? }
export const pickAiAction = (state, seatIndex, opts = {}) => {
  const { rng = Math.random, skill = AI_DEFAULT_SKILL } = opts;
  const legal = getLegalActions(state, seatIndex);
  if (!legal.canAct) return { action: 'check' };

  const strength = estimateStrength(state, seatIndex, rng);
  // skill 越低，判断越糙：额外叠一层跟 skill 挂钩的噪声。
  const judged = clamp01(strength + (rng() - 0.5) * 0.14 * (1.1 - skill));

  const potBefore = getPotTotal(state);
  const potOdds = legal.callAmount > 0 ? legal.callAmount / (potBefore + legal.callAmount) : 0;
  const impliedCushion = 0.08; // 底牌还没定型、后面还有牌可以翻身，给点缓冲

  if (legal.canCheck) {
    const wantsToBet = judged > 0.62 && legal.canRaise && rng() < skill;
    // 偶尔用弱牌诈唬一下，不然角色永远"有牌才下注"，一眼看穿。
    const bluff = !wantsToBet && judged < 0.3 && legal.canRaise && rng() < (1 - skill) * 0.12;
    if (wantsToBet || bluff) {
      return { action: 'raise', toTotal: pickBetSize(state, seatIndex, legal, judged, rng) };
    }
    return { action: 'check' };
  }

  const effective = judged + impliedCushion;
  if (effective < potOdds) {
    // 差得不多的时候，偶尔还是"跟着赌一把"，像真人一样舍不得弃牌。
    const stubborn = potOdds - effective < 0.1 && rng() < (1 - skill) * 0.25;
    if (!stubborn) return { action: 'fold' };
  }

  if (effective > potOdds + 0.25 && legal.canRaise && rng() < skill * 0.6) {
    return { action: 'raise', toTotal: pickBetSize(state, seatIndex, legal, judged, rng) };
  }

  return { action: 'call' };
};