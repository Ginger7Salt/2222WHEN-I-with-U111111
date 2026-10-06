// src/apps/textgames/liarsDice/liarsDiceAi.js
//
// 角色（电脑玩家）的叫点/质疑策略，纯函数，不碰 DB/React。
//
// 思路：只用“自己的骰子 + 场上公开的骰子总数”估算上一个叫点成立的概率
// （未知的骰子每颗有 1/3 概率算数，叫 1 点时是 1/6），再比较两条路：
// - 质疑：叫点不成立我就赢，赢面 = 1 - P(当前叫点成立)；
// - 加码：我叫的点成立、或者没人敢质疑，局面才对我有利。
// 再混入一点随机和少量失误（skill < 1），避免每一步都像机器。
// 注意：这里绝不读别人的骰子，只读 state.seats[seatIndex].dice。

import { FACES, getMinQuantity, getTotalDice } from './liarsDiceEngine.js';

export const AI_DEFAULT_SKILL = 0.85;
// 假设下一位玩家有多大概率会质疑我刚叫的点。
const CHALLENGE_PRESSURE = 0.55;
// 开局叫点：成立概率不低于这个值才算“稳”。
const OPENING_CONFIDENCE = 0.7;

const choose = (n, k) => {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
};

// n 颗未知骰子里，至少 k 颗算数的概率（每颗算数概率 p）。
export const binomialTail = (n, p, k) => {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let sum = 0;
  for (let i = k; i <= n; i += 1) {
    sum += choose(n, i) * p ** i * (1 - p) ** (n - i);
  }
  return Math.min(1, sum);
};

const countOwn = (dice, face) =>
  dice.filter((d) => d === face || (face !== 1 && d === 1)).length;

// 从 seatIndex 的视角看，“数量 x 点数”这个叫点成立的概率。
export const bidTruthProbability = (state, seatIndex, quantity, face) => {
  const seat = state.seats[seatIndex];
  const own = countOwn(seat.dice, face);
  const unknown = getTotalDice(state) - seat.diceCount;
  const p = face === 1 ? 1 / 6 : 1 / 3;
  return binomialTail(unknown, p, quantity - own);
};

// 列出可以叫的候选叫点；spread 是在最低数量之上最多多看几个。
const listCandidates = (state, spread) => {
  const total = getTotalDice(state);
  const list = [];
  FACES.forEach((face) => {
    const minQ = getMinQuantity(state.currentBid, face);
    if (minQ === null || minQ > total) return;
    const maxQ = Math.min(total, minQ + spread);
    for (let q = minQ; q <= maxQ; q += 1) list.push({ quantity: q, face });
  });
  return list;
};

const pickRandom = (list, rng) => list[Math.floor(rng() * list.length)];

const pickOpening = (scored, rng, skill) => {
  // 偶尔“手滑”，随便叫个看起来还行的。
  if (rng() < (1 - skill) * 0.5) {
    const pool = scored.filter((c) => c.p >= 0.3);
    const picked = pickRandom(pool.length > 0 ? pool : scored, rng);
    return { action: 'bid', quantity: picked.quantity, face: picked.face };
  }

  let best = null;
  let bestScore = -Infinity;
  scored.forEach((c) => {
    // 够稳的里面挑数量最大的（给后面的人压力），都不稳就挑最稳的。
    const score = c.p >= OPENING_CONFIDENCE ? 1 + c.quantity * 0.1 + rng() * 0.15 : c.p + rng() * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });
  return { action: 'bid', quantity: best.quantity, face: best.face };
};

// 角色这一手要做什么。返回：
//   { action: 'bid', quantity, face }
//   { action: 'challenge' }
export const pickAiMove = (state, seatIndex, opts = {}) => {
  const { rng = Math.random, skill = AI_DEFAULT_SKILL } = opts;
  const bid = state.currentBid;

  const spread = bid ? 2 : getTotalDice(state);
  const scored = listCandidates(state, spread).map((c) => ({
    ...c,
    p: bidTruthProbability(state, seatIndex, c.quantity, c.face),
  }));

  if (!bid) return pickOpening(scored, rng, skill);

  // 没有合法加码了（已经叫到极限）：只剩质疑。
  if (scored.length === 0) return { action: 'challenge' };

  const pCurrent = bidTruthProbability(state, seatIndex, bid.quantity, bid.face);
  const best = scored.reduce((acc, c) =>
    c.p > acc.p || (c.p === acc.p && c.quantity < acc.quantity) ? c : acc
  );

  const winIfChallenge = 1 - pCurrent;
  const winIfRaise = best.p * CHALLENGE_PRESSURE + (1 - CHALLENGE_PRESSURE) * 0.5;
  const jitter = (rng() - 0.5) * (1 - skill) * 1.2;
  if (winIfChallenge + jitter > winIfRaise) return { action: 'challenge' };

  let chosen = best;
  if (rng() < (1 - skill) * 0.3) chosen = pickRandom(scored, rng);
  return { action: 'bid', quantity: chosen.quantity, face: chosen.face };
};