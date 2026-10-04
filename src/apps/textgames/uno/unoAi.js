// src/apps/textgames/uno/unoAi.js
//
// 角色（电脑玩家）的出牌策略，纯函数，不碰 DB/React。“聪明”体现在：
// 1. 记得谁缺什么颜色（state.missingColors），专门打对方缺的颜色，让他抽牌；
// 2. 下家快出完时（手牌 <= 2）优先用 +2 / +4 / Skip / Reverse 攻击；
// 3. 平时把 Wild / +4 留着，不到手牌少或被逼时不乱用；
// 4. 选颜色时倾向自己手里最多的颜色，其次是下家缺的颜色；
// 5. 只剩两张时优先打出让最后一张“必定能出”的那一手。
// 再混入一点点随机和少量失误（skill < 1），避免每一步都像机器。

import {
  COLORS,
  cardPoints,
  getPlayableCardIds,
  isWild,
  nextIndex,
} from './unoEngine.js';

export const AI_DEFAULT_SKILL = 0.9;
// 出到只剩一张时，角色忘记喊 UNO 的概率。
export const FORGET_UNO_CHANCE = 0.2;
// 用户忘记喊 UNO 时，角色发现并抓包的概率。
export const CATCH_UNO_CHANCE = 0.8;

export const shouldCallUno = (rng = Math.random) => rng() >= FORGET_UNO_CHANCE;
export const shouldCatchUno = (rng = Math.random) => rng() < CATCH_UNO_CHANCE;

// 评分权重集中放在这里，方便用模拟对局调参（见 unoEngine.selftest.mjs）。
// 当前这组是 2026-10 用“1 个策略 AI 对 2 个随机出牌、6000 局”调出来的：
// 胜率约 43%（随机基线 33%）。调参时发现两件事最有用：
// 1. 万能牌/+4 一直留到手牌只剩两张或下家快赢了才用（wildSave、wildUrgentHand）；
// 2. “先打高分牌”的偏好对胜率没帮助（points = 0），它只影响输了之后的扣分。
// 平时多用 Skip / +2 反而更差，所以 draw2Calm / skipCalm 保持温和。
export const AI_WEIGHTS = {
  points: 0,
  wildUrgentHand: 2,
  wildUrgent: 2,
  wildSave: -8,
  wild4Threat: 8,
  wild4Calm: 0,
  wildBestColor: 0.6,
  sameColorLeft: 0.8,
  missingBonus: 3,
  draw2Threat: 6,
  draw2Calm: 1.5,
  skipThreat: 5,
  skipCalm: 0.8,
  reverseGood: 3,
  reverseBad: -1.5,
  reverseThreat: 3,
  lastCardSafe: 5,
};
const W = AI_WEIGHTS;

const countColors = (hand) => {
  const counts = Object.fromEntries(COLORS.map((c) => [c, 0]));
  hand.forEach((card) => {
    if (card.color) counts[card.color] += 1;
  });
  return counts;
};

const pickRandom = (list, rng) => list[Math.floor(rng() * list.length)];

// 万能牌之后选哪个颜色：自己剩余手牌里最多的优先，其次是下家缺的颜色。
export const chooseWildColor = (state, playerIndex, remainingHand, rng) => {
  const counts = countColors(remainingHand);
  const nextMissing = state.missingColors[nextIndex(state, playerIndex)] || [];

  const scored = COLORS.map((color) => ({
    color,
    score: counts[color] * 2 + (nextMissing.includes(color) ? 2 : 0),
  }));
  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === best).map((s) => s.color);
  return pickRandom(top, rng);
};

const scoreCard = (state, playerIndex, card, rng) => {
  const hand = state.players[playerIndex].hand;
  const remaining = hand.filter((c) => c.id !== card.id);
  const nextI = nextIndex(state, playerIndex);
  const nextHand = state.players[nextI].hand.length;
  const nextMissing = state.missingColors[nextI] || [];
  const threatened = nextHand <= 2;

  let score = 0;

  // 先打掉分值高的牌，输的时候少扣分。
  score += cardPoints(card) * W.points;

  if (isWild(card)) {
    // 万能牌平时留着；手牌已经很少，或者下家快赢了，就放开用。
    const urgent = threatened || hand.length <= W.wildUrgentHand;
    score += urgent ? W.wildUrgent : W.wildSave;
    if (card.value === 'wild4') score += threatened ? W.wild4Threat : W.wild4Calm;
    // 打出万能牌后能自己选色：看剩余手牌里最多的颜色有多少。
    const best = Math.max(...Object.values(countColors(remaining)), 0);
    score += best * W.wildBestColor;
  } else {
    // 打出这张牌后当前色变成 card.color：手里这个颜色越多，后面越顺。
    const sameColorLeft = remaining.filter((c) => c.color === card.color).length;
    score += sameColorLeft * W.sameColorLeft;

    // 下家缺这个颜色，他大概率要抽牌。
    if (nextMissing.includes(card.color)) score += W.missingBonus;
  }

  // 攻击牌。
  if (card.value === 'draw2') score += threatened ? W.draw2Threat : W.draw2Calm;
  if (card.value === 'skip') score += threatened ? W.skipThreat : W.skipCalm;
  if (card.value === 'reverse') {
    const n = state.players.length;
    if (n === 2) {
      score += threatened ? W.skipThreat : W.skipCalm;
    } else {
      // 三人及以上：反转后“下家”变成原来的上家，谁手牌更多就把牌权给谁。
      const prevI = nextIndex({ ...state, direction: -state.direction }, playerIndex);
      const prevHand = state.players[prevI].hand.length;
      score += prevHand > nextHand ? W.reverseGood : W.reverseBad;
      if (threatened && prevHand > 2) score += W.reverseThreat;
    }
  }

  // 只剩两张：打完这张后剩下那张最好必定能出。
  if (hand.length === 2) {
    const last = remaining[0];
    if (last && (isWild(last) || (!isWild(card) && last.color === card.color) ||
        (!isWild(card) && last.value === card.value))) {
      score += W.lastCardSafe;
    }
  }

  return score + rng() * 0.5;
};

// 角色这一手要做什么。返回：
//   { action: 'draw' }
//   { action: 'pass' }                         抽到了能出的牌但选择不出
//   { action: 'play', cardId, chosenColor }    chosenColor 只对万能牌有意义
export const pickAiMove = (state, playerIndex, opts = {}) => {
  const { rng = Math.random, skill = AI_DEFAULT_SKILL } = opts;
  const hand = state.players[playerIndex].hand;
  const nextHand = state.players[nextIndex(state, playerIndex)].hand.length;

  const playableIds = getPlayableCardIds(state, playerIndex);
  if (playableIds.length === 0) {
    return { action: state.drawnCardId ? 'pass' : 'draw' };
  }

  const playable = hand.filter((c) => playableIds.includes(c.id));

  // 刚抽到的万能牌，局势不紧张就留着，选择过。
  if (state.drawnCardId && playable.length === 1) {
    const only = playable[0];
    if (isWild(only) && hand.length > 4 && nextHand > 3) return { action: 'pass' };
  }

  let chosen;
  if (rng() < (1 - skill) * 0.5) {
    chosen = pickRandom(playable, rng); // 偶尔“手滑”，像真人。
  } else {
    let bestScore = -Infinity;
    playable.forEach((card) => {
      const score = scoreCard(state, playerIndex, card, rng);
      if (score > bestScore) {
        bestScore = score;
        chosen = card;
      }
    });
  }

  const remaining = hand.filter((c) => c.id !== chosen.id);
  return {
    action: 'play',
    cardId: chosen.id,
    chosenColor: isWild(chosen)
      ? chooseWildColor(state, playerIndex, remaining, rng)
      : null,
  };
};