// src/apps/textgames/liarsDice/liarsDiceEngine.js
//
// 吹牛骰子（Perudo / 大话骰）的纯规则引擎，四人桌。跟 uno/unoEngine.js、
// texas/texasEngine.js 同一个风格：不碰 DB、不碰 React、不碰计时器；所有
// 函数都不修改传入的 state，而是 structuredClone 一份再改，返回
// { ok, state, events } 或 { ok: false, error }。
//
// 座位约定：座位 0 永远是用户，1、2、3 是三位角色（真角色或虚拟 NPC）。
//
// 规则（跟用户确认过的）：
// - 每人起始 5 颗骰子，每一轮所有人各自重摇、骰子扣在碗里只有自己看得到。
// - 轮流叫点：“数量 x 点数”，下一位要么加码叫点，要么质疑上一位。
// - 1 点百搭：叫的点数不是 1 时，实际数骰子要把 1 点也算进去；叫的点数
//   就是 1 时，只数 1 点自己。
// - 质疑后全场开骰：叫点成立（实际数量 >= 叫的数量）则质疑者失去一颗骰子，
//   否则叫点者失去一颗骰子。
// - 骰子归零的人出局；输家（出局的话换成他的下家）开下一轮的头一个叫点。
// - 打到只剩一个人还有骰子，整场结束，那个人赢。
// - 没做的进阶规则：独食（Palafico，只剩一颗骰子时 1 点不百搭）和“精确
//   猜中”（Calza）。
//
// 加码的比较规则（标准 Perudo）：
// - 开局第一个叫点不能叫 1 点；
// - 非 1 叫到非 1：数量更多，或者数量相同但点数更大；
// - 非 1 转叫 1：数量至少是原数量的一半（向上取整）；
// - 1 转叫非 1：数量至少是原数量的 2 倍加 1；
// - 1 叫到 1：数量更多。

export const SEAT_COUNT = 4;
export const START_DICE = 5;
export const FACES = [1, 2, 3, 4, 5, 6];
export const TURN_TIME_LIMIT_MS = 20000;
const MAX_MOMENTS = 40;

const clone = (state) => structuredClone(state);
const fail = (error) => ({ ok: false, error });

export const rollDice = (count, rng = Math.random) =>
  Array.from({ length: count }, () => Math.floor(rng() * 6) + 1).sort((a, b) => a - b);

const addMoment = (state, moment) => {
  state.moments.push({ round: state.roundNumber, ...moment });
  if (state.moments.length > MAX_MOMENTS) state.moments.shift();
};

export const getAliveSeats = (state) =>
  state.seats.map((s, i) => i).filter((i) => !state.seats[i].out);

export const getTotalDice = (state) =>
  state.seats.reduce((sum, s) => sum + (s.out ? 0 : s.diceCount), 0);

const nextAliveFrom = (state, from) => {
  const n = state.seats.length;
  for (let step = 1; step <= n; step += 1) {
    const idx = (from + step) % n;
    if (!state.seats[idx].out) return idx;
  }
  return from;
};

// 数“叫点成立”所需的骰子：叫的不是 1 就把 1 点也算上。
export const countMatching = (state, face) =>
  state.seats.reduce(
    (sum, seat) => sum + seat.dice.filter((d) => d === face || (face !== 1 && d === 1)).length,
    0
  );

// ---------- 建桌 / 开新一轮 ----------
// seatConfigs: [{ id, name }, ...]，下标 0 是用户。
export const createTable = ({ seatConfigs, startingDice = START_DICE, rng = Math.random }) => ({
  seats: seatConfigs.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    dice: [],
    diceCount: startingDice,
    out: false,
  })),
  // 两轮之间 currentIndex 就是“下一轮谁先叫”；第一轮随机。
  currentIndex: Math.floor(rng() * seatConfigs.length),
  // 'idle'（还没开始）| 'bidding'（叫点中）| 'reveal'（刚开完骰，等下一轮）| 'ended'
  status: 'idle',
  roundNumber: 0,
  currentBid: null,
  lastReveal: null,
  winnerIndex: null,
  eliminationOrder: [],
  moments: [],
});

export const startRound = (state, opts = {}) => {
  const { rng = Math.random } = opts;
  if (state.status === 'ended') return fail('game_over');
  if (state.status === 'bidding') return fail('round_in_progress');

  const next = clone(state);
  next.roundNumber += 1;
  next.currentBid = null;
  next.lastReveal = null;
  next.seats.forEach((seat) => {
    seat.dice = seat.out ? [] : rollDice(seat.diceCount, rng);
  });
  if (next.seats[next.currentIndex].out) {
    next.currentIndex = nextAliveFrom(next, next.currentIndex);
  }
  next.status = 'bidding';

  return {
    ok: true,
    state: next,
    events: [{ type: 'round_start', round: next.roundNumber, starter: next.currentIndex }],
  };
};

// ---------- 叫点规则 ----------
// 在 prevBid 的基础上，叫 face 这个点数最少要叫多少个。返回 null 表示
// 这个点数现在不能叫（只有“开局不能叫 1 点”这一种情况）。
export const getMinQuantity = (prevBid, face) => {
  if (!prevBid) return face === 1 ? null : 1;

  const { quantity: q, face: f } = prevBid;
  if (face === 1) {
    return f === 1 ? q + 1 : Math.ceil(q / 2);
  }
  if (f === 1) return q * 2 + 1;
  return face > f ? q : q + 1;
};

export const isBidLegal = (state, quantity, face) => {
  if (!Number.isInteger(quantity) || !Number.isInteger(face)) return false;
  if (face < 1 || face > 6 || quantity < 1) return false;
  if (quantity > getTotalDice(state)) return false;
  const min = getMinQuantity(state.currentBid, face);
  return min !== null && quantity >= min;
};

// 给界面用：六个点数各自当前能叫的数量范围。available=false 的点数灰掉。
export const getBidOptions = (state) => {
  const total = getTotalDice(state);
  return FACES.map((face) => {
    const min = getMinQuantity(state.currentBid, face);
    return {
      face,
      minQuantity: min,
      maxQuantity: total,
      available: min !== null && min <= total,
    };
  });
};

// 超时自动叫点用：找一个最小的合法加码，优先非 1 点（1 点折算后数量看
// 起来更小，但那不是“顺手加一点”的直觉）。找不到就返回 null。
export const findMinimalBid = (state) => {
  const total = getTotalDice(state);
  for (let q = 1; q <= total; q += 1) {
    for (const face of [2, 3, 4, 5, 6]) {
      if (isBidLegal(state, q, face)) return { quantity: q, face };
    }
  }
  for (let q = 1; q <= total; q += 1) {
    if (isBidLegal(state, q, 1)) return { quantity: q, face: 1 };
  }
  return null;
};

// ---------- 动作 ----------
export const placeBid = (state, seatIndex, quantity, face) => {
  if (state.status !== 'bidding') return fail('not_bidding');
  if (seatIndex !== state.currentIndex) return fail('not_your_turn');
  if (!isBidLegal(state, quantity, face)) return fail('illegal_bid');

  const next = clone(state);
  next.currentBid = { seat: seatIndex, quantity, face };
  next.currentIndex = nextAliveFrom(next, seatIndex);

  return {
    ok: true,
    state: next,
    events: [{ type: 'bid', seat: seatIndex, quantity, face }],
  };
};

export const challenge = (state, seatIndex) => {
  if (state.status !== 'bidding') return fail('not_bidding');
  if (seatIndex !== state.currentIndex) return fail('not_your_turn');
  if (!state.currentBid) return fail('no_bid_to_challenge');

  const next = clone(state);
  const bid = next.currentBid;
  const count = countMatching(next, bid.face);
  const bidderRight = count >= bid.quantity;
  const loserIndex = bidderRight ? seatIndex : bid.seat;
  const loser = next.seats[loserIndex];

  loser.diceCount -= 1;
  const eliminated = loser.diceCount <= 0;
  if (eliminated) {
    loser.out = true;
    next.eliminationOrder.push(loserIndex);
  }

  next.lastReveal = {
    round: next.roundNumber,
    challenger: seatIndex,
    bidder: bid.seat,
    bid: { quantity: bid.quantity, face: bid.face },
    count,
    bidderRight,
    loser: loserIndex,
    eliminated,
    remaining: loser.diceCount,
    // 开骰那一刻每个人手里的骰子，界面摊牌展示用。
    allDice: next.seats.map((s) => s.dice.slice()),
  };
  next.currentBid = null;

  addMoment(next, {
    type: 'challenge',
    challenger: seatIndex,
    bidder: bid.seat,
    quantity: bid.quantity,
    face: bid.face,
    count,
    bidderRight,
    loser: loserIndex,
  });

  const events = [
    { type: 'challenge', seat: seatIndex, target: bid.seat },
    {
      type: 'reveal',
      challenger: seatIndex,
      bidder: bid.seat,
      count,
      bidderRight,
      loser: loserIndex,
    },
    { type: 'lose_die', seat: loserIndex, remaining: loser.diceCount },
  ];

  if (eliminated) {
    addMoment(next, { type: 'bust', seat: loserIndex });
    events.push({ type: 'bust', seat: loserIndex });
  }

  const alive = getAliveSeats(next);
  if (alive.length === 1) {
    next.status = 'ended';
    next.winnerIndex = alive[0];
    next.currentIndex = alive[0];
    addMoment(next, { type: 'win', seat: alive[0] });
    events.push({ type: 'win', seat: alive[0] });
  } else {
    next.status = 'reveal';
    next.currentIndex = eliminated ? nextAliveFrom(next, loserIndex) : loserIndex;
  }

  return { ok: true, state: next, events };
};

// 20 秒没动作：有合法加码就替他叫最小的一个，实在没得叫（已经叫到骰子
// 总数了）才替他质疑。
export const applyTimeout = (state, seatIndex) => {
  if (state.status !== 'bidding') return fail('not_bidding');
  if (seatIndex !== state.currentIndex) return fail('not_your_turn');

  const minimal = findMinimalBid(state);
  const result = minimal
    ? placeBid(state, seatIndex, minimal.quantity, minimal.face)
    : challenge(state, seatIndex);
  if (!result.ok) return result;

  return {
    ok: true,
    state: result.state,
    events: [{ type: 'timeout', seat: seatIndex }, ...result.events],
  };
};

// ---------- 结算 ----------
// 名次：赢家第一，然后按出局顺序倒着排（最后出局的第二）。
export const getStandings = (state) => {
  const order = [];
  if (state.winnerIndex !== null) order.push(state.winnerIndex);
  state.eliminationOrder
    .slice()
    .reverse()
    .forEach((i) => {
      if (!order.includes(i)) order.push(i);
    });
  state.seats.forEach((s, i) => {
    if (!order.includes(i)) order.push(i);
  });

  return order.map((index, rank) => ({
    index,
    id: state.seats[index].id,
    name: state.seats[index].name,
    rank: rank + 1,
    diceCount: state.seats[index].diceCount,
  }));
};

export const getMatchSummary = (state) => ({
  rounds: state.roundNumber,
  winnerIndex: state.winnerIndex,
  standings: getStandings(state),
  moments: state.moments.slice(),
});