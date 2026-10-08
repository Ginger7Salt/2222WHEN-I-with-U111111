// src/apps/textgames/skull/skullEngine.js
//
// 骷髅牌的纯规则引擎：发牌、放牌、叫数、加价/弃权、翻牌、弃牌、淘汰、
// 胜负判定。不碰 DB、不碰 React、不碰计时器，所有函数都不修改传入的
// state，而是返回新的 state。
//
// 返回约定跟 UNO 引擎一致：
//   成功 { ok: true, state, events }
//   失败 { ok: false, error }
// events 是这一步发生的事情列表，给控制器（useSkullMatch）做动画、台词
// 和音效用，引擎自己不关心它们怎么被使用。
//
// 座位：state.players 的下标就是座位号，顺时针递增。约定 0 是用户，
// 其余是角色/NPC，但引擎本身不依赖这一点。
//
// 规则（标准规则）：
// - 每人 4 张牌：3 朵蔷薇（rose）、1 个骷髅（skull）；
// - 每一轮先由起手玩家开始，每人依次在面前扣放 1 张（placing）；
// - 之后轮到谁，谁可以再扣放一张，或者开始叫数（adding）；
// - 叫数开始后，其他人依次只能加价或弃权（bidding）；弃权的人这一轮不能
//   再叫；叫到桌上牌的总数、或者其他人全部弃权，叫数结束；
// - 叫数最高的人是挑战者（flipping）：必须先把自己面前的牌从上往下全翻
//   开，之后才能去翻别人牌堆最上面的牌，直到翻开的蔷薇数达到叫数；
// - 翻到骷髅：挑战失败。翻到自己的骷髅，挑战者自己选一张牌永久弃掉
//   （discarding）；翻到别人的骷髅，由那个人从挑战者的全部牌里随机抽走
//   一张；
// - 成功翻够：挑战成功，得 1 枚胜利印记；集齐 2 枚获胜；
// - 牌用光的人淘汰，只剩一人时他获胜；
// - 一轮结束后停在 round_over，让界面有时间展示结果；控制器再调用
//   startNextRound 把所有桌上的牌收回手里（被弃的那张除外）开始下一轮。
//
// 与标准规则的一处简化：挑战者翻到自己的骷髅被淘汰时，标准规则由他自己
// 指定下一轮起手玩家，这里改成他的下家（顺时针第一个还活着的人）。

export const CARDS_PER_PLAYER = 4;
export const ROSES_PER_PLAYER = 3;
export const WINS_TO_WIN = 2;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
// 用户每手的思考时间，控制器用；引擎本身不计时。
export const TURN_TIME_LIMIT_MS = 20000;

export const PHASE = {
  PLACING: 'placing',
  ADDING: 'adding',
  BIDDING: 'bidding',
  FLIPPING: 'flipping',
  DISCARDING: 'discarding',
  ROUND_OVER: 'round_over',
  ENDED: 'ended',
};

export const ROSE = 'rose';
export const SKULL = 'skull';

// ---------- 小工具 ----------
const clone = (state) => JSON.parse(JSON.stringify(state));
const fail = (error) => ({ ok: false, error });
const pickRandom = (list, rng) => list[Math.floor(rng() * list.length)];

export const ownedCards = (player) => [...player.hand, ...player.stack];

// 还剩几张牌（已经判了、但还没物理移除的那张弃牌不算）。
export const cardsLeft = (state, index) => {
  const p = state.players[index];
  const pending =
    state.pendingLoss && state.pendingLoss.player === index ? 1 : 0;
  return ownedCards(p).length - pending;
};

export const aliveIndexes = (state) =>
  state.players.map((p, i) => i).filter((i) => !state.players[i].eliminated);

export const nextAlive = (state, from) => {
  const n = state.players.length;
  for (let k = 1; k <= n; k += 1) {
    const i = (from + k) % n;
    if (!state.players[i].eliminated) return i;
  }
  return from;
};

export const tableCount = (state) =>
  state.players.reduce((sum, p) => sum + p.stack.length, 0);

// 叫数阶段里，从 from 之后第一个还能说话的人（活着、没弃权、不是当前
// 最高叫数的人）。没有就返回 null。
const nextEligibleBidder = (state, from) => {
  const n = state.players.length;
  for (let k = 1; k <= n; k += 1) {
    const i = (from + k) % n;
    const p = state.players[i];
    if (p.eliminated) continue;
    if (state.passed.includes(i)) continue;
    if (state.bid && state.bid.player === i) continue;
    return i;
  }
  return null;
};

const makeHand = (seat) => [
  ...Array.from({ length: ROSES_PER_PLAYER }, (_, k) => ({
    id: `p${seat}-r${k + 1}`,
    kind: ROSE,
  })),
  { id: `p${seat}-s`, kind: SKULL },
];

// ---------- 开局 ----------
// playerIds: 座位顺序的玩家 id（用户、角色、NPC 都行，只用来区分）。
export const createGame = ({ playerIds, rng = Math.random, startIndex } = {}) => {
  const count = playerIds?.length || 0;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`骷髅牌需要 ${MIN_PLAYERS} 到 ${MAX_PLAYERS} 位玩家`);
  }

  const start = Number.isInteger(startIndex)
    ? startIndex
    : Math.floor(rng() * count);

  return {
    status: 'playing',
    phase: PHASE.PLACING,
    players: playerIds.map((id, seat) => ({
      id,
      hand: makeHand(seat),
      stack: [], // 从下到上，最后一张是最上面那张
      wins: 0,
      eliminated: false,
    })),
    currentIndex: start,
    starterIndex: start,
    round: 1,
    turnCount: 0,
    bid: null, // { player, count }
    passed: [],
    flipped: {}, // { 座位: 已从上往下翻开几张 }
    rosesFlipped: 0,
    pendingLoss: null, // { player, cardId, kind }，下一轮开始时才真正移除
    result: null, // 这一轮的结果，round_over / ended 时有值
    eliminatedOrder: [],
    winnerIndex: null,
    endedBy: null, // 'wins' | 'last_standing'
    moments: [],
  };
};

// ---------- 查询（给 UI 和 AI 用） ----------
export const getMinBid = (state) => {
  if (state.phase === PHASE.ADDING) return 1;
  if (state.phase === PHASE.BIDDING && state.bid) return state.bid.count + 1;
  return null;
};

export const getMaxBid = (state) => tableCount(state);

// 挑战者现在能翻谁：自己没翻完就只能翻自己，之后才是别人。
export const getFlipTargets = (state) => {
  if (state.phase !== PHASE.FLIPPING || !state.bid) return [];
  const challenger = state.bid.player;
  const own = state.players[challenger];
  if ((state.flipped[challenger] || 0) < own.stack.length) return [challenger];

  return state.players
    .map((p, i) => i)
    .filter(
      (i) =>
        i !== challenger &&
        !state.players[i].eliminated &&
        (state.flipped[i] || 0) < state.players[i].stack.length
    );
};

export const getLegalActions = (state, player) => {
  const none = {
    canPlace: [],
    canStartBid: false,
    canRaise: false,
    canPass: false,
    minBid: null,
    maxBid: null,
    flipTargets: [],
    discardChoices: [],
  };
  if (state.status !== 'playing' || state.currentIndex !== player) return none;

  const p = state.players[player];
  const max = getMaxBid(state);
  const min = getMinBid(state);

  switch (state.phase) {
    case PHASE.PLACING:
      return { ...none, canPlace: p.hand.map((c) => c.id) };
    case PHASE.ADDING:
      return {
        ...none,
        canPlace: p.hand.map((c) => c.id),
        canStartBid: max >= 1,
        minBid: 1,
        maxBid: max,
      };
    case PHASE.BIDDING:
      return {
        ...none,
        canRaise: min <= max,
        canPass: true,
        minBid: min,
        maxBid: max,
      };
    case PHASE.FLIPPING:
      return { ...none, flipTargets: getFlipTargets(state) };
    case PHASE.DISCARDING:
      return { ...none, discardChoices: ownedCards(p).map((c) => c.id) };
    default:
      return none;
  }
};

// ---------- 内部：结算 ----------
const pushMoment = (next, moment) => {
  next.moments.push({ round: next.round, ...moment });
};

const endGame = (next, events, winnerIndex, endedBy) => {
  next.status = 'ended';
  next.phase = PHASE.ENDED;
  next.winnerIndex = winnerIndex;
  next.endedBy = endedBy;
  pushMoment(next, { type: 'win', player: winnerIndex, endedBy });
  events.push({ type: 'game_end', winner: winnerIndex, endedBy });
};

const beginFlipping = (next, events) => {
  next.phase = PHASE.FLIPPING;
  next.currentIndex = next.bid.player;
  next.flipped = {};
  next.rosesFlipped = 0;
  events.push({
    type: 'challenge',
    player: next.bid.player,
    count: next.bid.count,
  });
};

const resolveSuccess = (next, events) => {
  const challenger = next.bid.player;
  next.players[challenger].wins += 1;
  next.result = {
    success: true,
    challenger,
    bid: next.bid.count,
    skullOwner: null,
  };
  pushMoment(next, {
    type: 'success',
    player: challenger,
    bid: next.bid.count,
  });
  events.push({ type: 'success', player: challenger, bid: next.bid.count });

  if (next.players[challenger].wins >= WINS_TO_WIN) {
    endGame(next, events, challenger, 'wins');
  } else {
    next.phase = PHASE.ROUND_OVER;
  }
};

// 判定要弃的那张牌，处理淘汰和“只剩一人”。
const applyLoss = (next, events, player, card) => {
  next.pendingLoss = { player, cardId: card.id, kind: card.kind };
  events.push({ type: 'loss', player, kind: card.kind });

  if (cardsLeft(next, player) === 0) {
    next.players[player].eliminated = true;
    next.eliminatedOrder.push(player);
    pushMoment(next, { type: 'eliminated', player });
    events.push({ type: 'eliminated', player });
  }

  const alive = aliveIndexes(next);
  if (alive.length === 1) {
    endGame(next, events, alive[0], 'last_standing');
  } else {
    next.phase = PHASE.ROUND_OVER;
  }
};

const resolveFailure = (next, events, skullOwner, rng) => {
  const challenger = next.bid.player;
  const own = skullOwner === challenger;
  next.result = {
    success: false,
    challenger,
    bid: next.bid.count,
    skullOwner,
  };
  pushMoment(next, {
    type: 'fail',
    player: challenger,
    owner: skullOwner,
    bid: next.bid.count,
    own,
  });
  events.push({ type: 'skull', player: challenger, owner: skullOwner, own });

  if (own) {
    // 自己的骷髅：自己选弃哪张。
    next.phase = PHASE.DISCARDING;
    next.currentIndex = challenger;
    return;
  }

  // 别人的骷髅：由那个人随机抽走挑战者的一张牌。
  const card = pickRandom(ownedCards(next.players[challenger]), rng);
  next.result.lostKind = card.kind;
  applyLoss(next, events, challenger, card);
};

// ---------- 动作 ----------
const guardTurn = (state, player, phases) => {
  if (state.status !== 'playing') return 'game_over';
  if (!phases.includes(state.phase)) return 'wrong_phase';
  if (state.currentIndex !== player) return 'not_your_turn';
  return null;
};

export const placeCard = (state, player, cardId) => {
  const err = guardTurn(state, player, [PHASE.PLACING, PHASE.ADDING]);
  if (err) return fail(err);

  const idx = state.players[player].hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return fail('card_not_in_hand');

  const next = clone(state);
  const p = next.players[player];
  const [card] = p.hand.splice(idx, 1);
  p.stack.push(card);
  next.turnCount += 1;

  const events = [{ type: 'place', player }];
  const following = nextAlive(next, player);

  if (next.phase === PHASE.PLACING) {
    const everyonePlaced = aliveIndexes(next).every(
      (i) => next.players[i].stack.length >= 1
    );
    if (everyonePlaced) next.phase = PHASE.ADDING;
  }
  next.currentIndex = following;

  return { ok: true, state: next, events };
};

export const startBid = (state, player, count) => {
  const err = guardTurn(state, player, [PHASE.ADDING]);
  if (err) return fail(err);

  const total = tableCount(state);
  if (!Number.isInteger(count) || count < 1 || count > total) {
    return fail('bad_bid');
  }

  const next = clone(state);
  next.turnCount += 1;
  next.bid = { player, count };
  next.passed = [];
  const events = [{ type: 'bid', player, count, raise: false }];

  if (count === total) {
    beginFlipping(next, events);
  } else {
    next.phase = PHASE.BIDDING;
    next.currentIndex = nextEligibleBidder(next, player);
  }
  return { ok: true, state: next, events };
};

export const raiseBid = (state, player, count) => {
  const err = guardTurn(state, player, [PHASE.BIDDING]);
  if (err) return fail(err);

  const total = tableCount(state);
  if (!Number.isInteger(count) || count <= state.bid.count || count > total) {
    return fail('bad_bid');
  }

  const next = clone(state);
  next.turnCount += 1;
  next.bid = { player, count };
  const events = [{ type: 'bid', player, count, raise: true }];

  if (count === total) {
    beginFlipping(next, events);
  } else {
    next.currentIndex = nextEligibleBidder(next, player);
  }
  return { ok: true, state: next, events };
};

export const passBid = (state, player) => {
  const err = guardTurn(state, player, [PHASE.BIDDING]);
  if (err) return fail(err);

  const next = clone(state);
  next.turnCount += 1;
  next.passed.push(player);
  const events = [{ type: 'pass', player }];

  const following = nextEligibleBidder(next, player);
  if (following == null) {
    beginFlipping(next, events);
  } else {
    next.currentIndex = following;
  }
  return { ok: true, state: next, events };
};

// 翻 target 牌堆最上面还没翻开的那张。
export const flipCard = (state, player, target, opts = {}) => {
  const { rng = Math.random } = opts;
  const err = guardTurn(state, player, [PHASE.FLIPPING]);
  if (err) return fail(err);
  if (!getFlipTargets(state).includes(target)) return fail('bad_target');

  const next = clone(state);
  next.turnCount += 1;

  const targetPlayer = next.players[target];
  const already = next.flipped[target] || 0;
  const card = targetPlayer.stack[targetPlayer.stack.length - 1 - already];
  next.flipped[target] = already + 1;

  const events = [{ type: 'flip', player, target, kind: card.kind }];

  if (card.kind === SKULL) {
    resolveFailure(next, events, target, rng);
    return { ok: true, state: next, events };
  }

  next.rosesFlipped += 1;
  events[0].rosesFlipped = next.rosesFlipped;
  if (next.rosesFlipped >= next.bid.count) {
    resolveSuccess(next, events);
  }
  return { ok: true, state: next, events };
};

// 翻到自己的骷髅后，自己选一张牌（手牌或桌上的都行）永久弃掉。
export const chooseDiscard = (state, player, cardId) => {
  const err = guardTurn(state, player, [PHASE.DISCARDING]);
  if (err) return fail(err);

  const card = ownedCards(state.players[player]).find((c) => c.id === cardId);
  if (!card) return fail('card_not_owned');

  const next = clone(state);
  next.turnCount += 1;
  next.result.lostKind = card.kind;
  const events = [];
  applyLoss(next, events, player, card);
  return { ok: true, state: next, events };
};

// 一轮结束后，收回所有桌上的牌（弃掉的那张除外），开始下一轮。
export const startNextRound = (state) => {
  if (state.status !== 'playing' || state.phase !== PHASE.ROUND_OVER) {
    return fail('wrong_phase');
  }

  const next = clone(state);
  const result = next.result;

  if (next.pendingLoss) {
    const { player, cardId } = next.pendingLoss;
    const p = next.players[player];
    p.hand = p.hand.filter((c) => c.id !== cardId);
    p.stack = p.stack.filter((c) => c.id !== cardId);
  }

  next.players.forEach((p) => {
    p.hand = [...p.hand, ...p.stack];
    p.stack = [];
  });

  let starter;
  if (!next.players[result.challenger].eliminated) {
    starter = result.challenger;
  } else if (
    result.skullOwner != null &&
    result.skullOwner !== result.challenger &&
    !next.players[result.skullOwner].eliminated
  ) {
    starter = result.skullOwner;
  } else {
    starter = nextAlive(next, result.challenger);
  }

  next.round += 1;
  next.phase = PHASE.PLACING;
  next.currentIndex = starter;
  next.starterIndex = starter;
  next.bid = null;
  next.passed = [];
  next.flipped = {};
  next.rosesFlipped = 0;
  next.pendingLoss = null;
  next.lastResult = result;
  next.result = null;

  return {
    ok: true,
    state: next,
    events: [{ type: 'round_start', round: next.round, starter }],
  };
};

// ---------- 超时 ----------
// 用户 20 秒没操作时的自动处理，保证对局不会卡住。选最保守的动作。
export const applyTimeout = (state, player, rng = Math.random) => {
  if (state.status !== 'playing' || state.currentIndex !== player) {
    return fail('not_your_turn');
  }

  const legal = getLegalActions(state, player);
  let result;

  switch (state.phase) {
    case PHASE.PLACING:
      result = placeCard(state, player, pickRandom(legal.canPlace, rng));
      break;
    case PHASE.ADDING:
      result = legal.canPlace.length > 0
        ? placeCard(state, player, pickRandom(legal.canPlace, rng))
        : startBid(state, player, 1);
      break;
    case PHASE.BIDDING:
      result = passBid(state, player);
      break;
    case PHASE.FLIPPING:
      result = flipCard(state, player, pickRandom(legal.flipTargets, rng), { rng });
      break;
    case PHASE.DISCARDING:
      result = chooseDiscard(state, player, pickRandom(legal.discardChoices, rng));
      break;
    default:
      return fail('wrong_phase');
  }

  if (!result.ok) return result;
  return {
    ...result,
    events: [{ type: 'timeout', player }, ...result.events],
  };
};

// ---------- 结算页 / 存档用 ----------
// 名次：赢家第一；其余活着的按印记、剩牌数排；淘汰的按“越晚淘汰越靠前”。
export const getStandings = (state) => {
  if (state.status !== 'ended') return [];

  const rows = state.players.map((p, index) => ({
    index,
    wins: p.wins,
    cards: cardsLeft(state, index),
    eliminated: p.eliminated,
    eliminatedAt: state.eliminatedOrder.indexOf(index),
  }));

  const sorted = rows.slice().sort((a, b) => {
    if (a.index === state.winnerIndex) return -1;
    if (b.index === state.winnerIndex) return 1;
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (a.eliminated && b.eliminated) return b.eliminatedAt - a.eliminatedAt;
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.cards !== b.cards) return b.cards - a.cards;
    return a.index - b.index;
  });

  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
};

export const getMatchSummary = (state) => ({
  winnerIndex: state.winnerIndex,
  endedBy: state.endedBy,
  rounds: state.round,
  standings: getStandings(state),
  moments: state.moments,
});