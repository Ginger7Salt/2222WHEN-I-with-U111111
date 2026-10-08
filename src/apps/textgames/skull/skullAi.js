// src/apps/textgames/skull/skullAi.js
//
// 角色和 NPC（电脑玩家）的出牌策略，纯函数，不碰 DB/React。
//
// 策略的核心是一个很朴素的概率估计：
// 1. 自己牌堆里的牌自己是知道的。挑战者必须先把自己的牌堆从上往下翻完，
//    所以自己的牌堆里只要有骷髅，能叫的数就只有骷髅上面那几朵蔷薇；
// 2. 别人的牌堆看不到。假设每位对手都还留着自己的骷髅，那么它在 TA 牌堆
//    里的概率约等于 牌堆张数 / TA 剩余的牌数；
// 3. 叫一个数 k 的成功概率 = 自己能翻开的蔷薇之外，还差几张就从“每张牌
//    出骷髅概率最低”的对手牌堆里翻，把每一位被翻到的风险连乘起来；
// 4. 概率超过阈值就叫/加价，否则放牌或者弃权。再混入一点点随机和少量失误，
//    避免每一步都像机器。
//
// 参数集中放在 AI_PARAMS，方便用模拟对局调参（见 skullAi.selftest.mjs）。

import {
  PHASE,
  SKULL,
  cardsLeft,
  chooseDiscard,
  flipCard,
  getLegalActions,
  passBid,
  placeCard,
  raiseBid,
  startBid,
} from './skullEngine.js';

export const AI_DEFAULT_SKILL = 0.9;

// 这组参数是 2026-10 用模拟对局调出来的：
// - 最初的保守版（门槛 0.55、够格也只有一半概率去叫）对 3 个随机玩家
//   胜率只有约 23%，比随机基线 25% 还低——对手乱叫乱翻时，一直弃权等于
//   白白放过机会；
// - 把门槛降到 0.3、够格就叫、少放骷髅之后，对随机玩家约 55%，
//   对旧的保守版约 60%，一个新版对 3 个旧版以及几组中间参数的混战里
//   也都占优。再往下压（门槛 0.22）还会更强，但太莽撞、不像真人，没采用。
export const AI_PARAMS = {
  // 第一轮放牌时，把骷髅放出去的概率。
  skullPlaceChance: 0.1,
  // 之后继续追加放牌时，放骷髅的概率（前提是骷髅还不在桌上）。
  skullAddChance: 0.05,
  // 成功概率达到这个值才愿意叫数。
  bidThreshold: 0.3,
  // 偶尔放宽阈值去试一把，让对手摸不清路数。
  bluffChance: 0.08,
  bluffSlack: 0.15,
  // 在“放牌或开叫”时，已经够格叫数的情况下真的去叫的倾向。
  bidEagerness: 1,
  eagerStack2: 0,
  eagerLowHand: 0,
  // 加价时跳到最高可叫数的概率（否则只加 1）。
  jumpChance: 0.3,
  // 翻到自己的骷髅后，弃蔷薇的概率（否则弃骷髅）。
  discardRoseChance: 0.65,
};
const P = AI_PARAMS;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pickRandom = (list, rng) => list[Math.floor(rng() * list.length)];

// 自己牌堆从上往下，连续的蔷薇数（遇到骷髅停）。
const ownSafeCount = (stack) => {
  let n = 0;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].kind === SKULL) break;
    n += 1;
  }
  return n;
};

// 叫 k 朵的成功概率估计。
export const successProb = (state, idx, k) => {
  const own = state.players[idx].stack;
  const safe = ownSafeCount(own);
  if (k <= safe) return 1;
  if (own.some((c) => c.kind === SKULL)) return 0; // 必须先翻完自己，会踩到

  let need = k - own.length;
  const others = state.players
    .map((p, i) => i)
    .filter((i) => i !== idx && !state.players[i].eliminated && state.players[i].stack.length > 0)
    .map((i) => {
      const len = state.players[i].stack.length;
      const owned = Math.max(1, cardsLeft(state, i));
      const ps = Math.min(1, len / owned); // 骷髅在 TA 牌堆里的概率
      return { len, perCard: ps / len };
    })
    .sort((a, b) => a.perCard - b.perCard || b.len - a.len);

  let prob = 1;
  for (const o of others) {
    if (need <= 0) break;
    const take = Math.min(need, o.len);
    prob *= Math.max(0, 1 - o.perCard * take);
    need -= take;
  }
  return need > 0 ? 0 : prob;
};

// 满足概率阈值的最大叫数，没有就返回 0。
const bestBid = (state, idx, threshold, minBid, maxBid) => {
  for (let k = maxBid; k >= minBid; k -= 1) {
    if (successProb(state, idx, k) >= threshold) return k;
  }
  return 0;
};

const choosePlaceCard = (state, idx, rng, skullChance) => {
  const p = state.players[idx];
  const roses = p.hand.filter((c) => c.kind !== SKULL);
  const skull = p.hand.find((c) => c.kind === SKULL);
  const skullOnTable = p.stack.some((c) => c.kind === SKULL);

  if (skull && !skullOnTable && rng() < skullChance) return skull.id;
  if (roses.length > 0) return pickRandom(roses, rng).id;
  return pickRandom(p.hand, rng).id;
};

// 翻别人牌堆时，每张牌是骷髅的概率（已经翻开的蔷薇会让剩下的更危险）。
const flipRisk = (state, i) => {
  const len = state.players[i].stack.length;
  const flipped = state.flipped[i] || 0;
  const owned = Math.max(1, cardsLeft(state, i));
  const ps = Math.min(1, len / owned);
  const denom = 1 - (ps * flipped) / len;
  return denom <= 0 ? 1 : ps / len / denom;
};

// 角色这一手要做什么。返回：
//   { action: 'place', cardId }
//   { action: 'bid', count }        开始叫数
//   { action: 'raise', count }      加价
//   { action: 'pass' }              弃权
//   { action: 'flip', target }      翻 target 牌堆最上面那张
//   { action: 'discard', cardId }   翻到自己的骷髅后弃哪张
export const pickAiMove = (state, idx, opts = {}) => {
  const { rng = Math.random, skill = AI_DEFAULT_SKILL, boldness = 0 } = opts;
  const legal = getLegalActions(state, idx);
  const me = state.players[idx];
  const threshold = clamp(P.bidThreshold - boldness * 0.2, 0.2, 0.9);
  const sloppy = rng() < (1 - skill) * 0.5; // 偶尔“手滑”

  switch (state.phase) {
    case PHASE.PLACING:
      return {
        action: 'place',
        cardId: choosePlaceCard(state, idx, rng, P.skullPlaceChance),
      };

    case PHASE.ADDING: {
      const { minBid, maxBid } = legal;

      // 手里没牌了，只能叫数：尽量叫个靠谱的，实在没有就叫 1。
      if (legal.canPlace.length === 0) {
        const k = bestBid(state, idx, threshold, minBid, maxBid) || minBid;
        return { action: 'bid', count: k };
      }

      const bluff = rng() < P.bluffChance;
      const bestK = bestBid(state, idx, bluff ? threshold - P.bluffSlack : threshold, minBid, maxBid);
      const eager =
        P.bidEagerness +
        (me.stack.length >= 2 ? P.eagerStack2 : 0) +
        (me.hand.length <= 1 ? P.eagerLowHand : 0);

      if (bestK >= 1 && !sloppy && rng() < eager) {
        return { action: 'bid', count: bestK };
      }
      return {
        action: 'place',
        cardId: choosePlaceCard(state, idx, rng, P.skullAddChance),
      };
    }

    case PHASE.BIDDING: {
      const current = state.bid.count;
      if (!legal.canRaise || sloppy) return { action: 'pass' };

      const bluff = rng() < P.bluffChance;
      const bestK = bestBid(
        state,
        idx,
        bluff ? threshold - P.bluffSlack : threshold,
        current + 1,
        legal.maxBid
      );
      if (bestK >= current + 1) {
        const count = bestK > current + 1 && rng() < P.jumpChance ? bestK : current + 1;
        return { action: 'raise', count };
      }
      return { action: 'pass' };
    }

    case PHASE.FLIPPING: {
      const targets = legal.flipTargets;
      if (targets.includes(idx)) return { action: 'flip', target: idx };
      if (sloppy) return { action: 'flip', target: pickRandom(targets, rng) };

      let best = [];
      let bestRisk = Infinity;
      targets.forEach((t) => {
        const risk = flipRisk(state, t);
        if (risk < bestRisk - 1e-9) {
          bestRisk = risk;
          best = [t];
        } else if (Math.abs(risk - bestRisk) <= 1e-9) {
          best.push(t);
        }
      });
      return { action: 'flip', target: pickRandom(best, rng) };
    }

    case PHASE.DISCARDING: {
      const cards = [...me.hand, ...me.stack];
      const roses = cards.filter((c) => c.kind !== SKULL);
      const skull = cards.find((c) => c.kind === SKULL);
      if (skull && (roses.length === 0 || rng() >= P.discardRoseChance)) {
        return { action: 'discard', cardId: skull.id };
      }
      return { action: 'discard', cardId: pickRandom(roses, rng).id };
    }

    default:
      return { action: 'pass' };
  }
};

// 把 pickAiMove 的结果交给引擎执行，返回引擎的 { ok, state, events }。
export const applyAiMove = (state, idx, move, rng = Math.random) => {
  switch (move.action) {
    case 'place':
      return placeCard(state, idx, move.cardId);
    case 'bid':
      return startBid(state, idx, move.count);
    case 'raise':
      return raiseBid(state, idx, move.count);
    case 'pass':
      return passBid(state, idx);
    case 'flip':
      return flipCard(state, idx, move.target, { rng });
    case 'discard':
      return chooseDiscard(state, idx, move.cardId);
    default:
      return { ok: false, error: 'bad_move' };
  }
};