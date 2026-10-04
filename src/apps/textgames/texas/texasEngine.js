// src/apps/textgames/texas/texasEngine.js
//
// 德州扑克（三人桌，简化版）的纯规则引擎。跟 uno/unoEngine.js 一个风格：
// 不碰 DB、不碰 React、不碰计时器；所有函数都不修改传入的 state，而是
// structuredClone 一份再改，返回 { ok, state, events } 或 { ok:false, error }。
//
// 座位约定：座位 0 永远是用户，1、2 是两位角色（三人桌）；某一局如果
// 只剩两位还有筹码（第三位已经被淘汰出局），自动退化成单挑规则，不用
// 单独写一套"两人局引擎"。
//
// 规则范围（跟用户确认过的）：
// - 完整四条街：preflop -> flop -> turn -> river -> 摊牌。
// - 固定盲注：大盲/小盲在买入时算好，整个坐下的这一轮不再变。
// - 标准 no-limit 下注：check/call/bet/raise/all-in，带正确的 side pot。
// - 简化点（刻意，不是漏洞）：任何加注（包括不够"最小加注"额度的
//   all-in）一律重新打开其他未全下玩家的行动权——真实规则里"不够最小
//   加注的 all-in 不重新开放行动"，这里不做这层区分，换来规则代码简单
//   很多，对一个休闲向的个人项目来说副作用可以忽略（最多是某人偶尔多了
//   一次本可以不用做的过牌/跟注机会）。
//
// 筹码来源不归这个文件管——买入多少、会话结束后怎么结算回全局筹码池，
// 是 texasChipsService.js / useTexasMatch.js 的事，这里只管一桌三人从
// 坐下到摊牌的牌桌逻辑。

import { createDeck, shuffleDeck, evaluateBest, compareEval, describeEval } from './texasHandEval';

export const SEAT_COUNT = 3;
export const STREETS = ['preflop', 'flop', 'turn', 'river'];
const MAX_MOMENTS = 40;

const clone = (state) => structuredClone(state);

const fail = (error) => ({ ok: false, error });

const addMoment = (state, moment) => {
  state.moments.push({ handNumber: state.handNumber, ...moment });
  if (state.moments.length > MAX_MOMENTS) state.moments.shift();
};

// ---------- 建桌 ----------
// seatConfigs: [{ id, name }, ...] 长度 3，下标 0 是用户。
export const createTable = ({ seatConfigs, smallBlind, bigBlind, startingStack, rng = Math.random }) => ({
  seats: seatConfigs.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    stack: startingStack,
    holeCards: [],
    folded: false,
    allIn: false,
    out: false,
    totalContributed: 0,
    streetContributed: 0,
  })),
  buttonIndex: Math.floor(rng() * SEAT_COUNT),
  smallBlind,
  bigBlind,
  street: 'idle',
  board: [],
  deck: [],
  currentBet: 0,
  minRaiseAmount: bigBlind,
  toAct: [],
  order: [],
  handNumber: 0,
  winnersInfo: null,
  moments: [],
});

const nonOutIndices = (state) => state.seats.map((s, i) => i).filter((i) => !state.seats[i].out);

// 从按钮位开始顺时针的"在场座位"顺序（跳过已出局的座位）。preflop 第一
// 个行动的人是 order[0]（按钮位自己——三人桌/单挑都是这条规则）；
// 翻牌后第一个行动的人是 order[1]。
const rotationFromButton = (state) => {
  const active = nonOutIndices(state);
  const btn = active.includes(state.buttonIndex)
    ? state.buttonIndex
    : active[0]; // 防御：按钮位恰好出局，理论上 startHand 会先挪走
  const startPos = active.indexOf(btn);
  return active.map((_, i) => active[(startPos + i) % active.length]);
};

export const canStartHand = (state) => nonOutIndices(state).length >= 2;

// ---------- 开局：发牌、posting 盲注 ----------
export const startHand = (state, opts = {}) => {
  const { rng = Math.random } = opts;
  if (!canStartHand(state)) return fail('not_enough_players');

  const next = clone(state);
  next.handNumber += 1;
  next.winnersInfo = null;
  next.board = [];

  // 按钮位挪到下一个还有筹码的座位（第一局用建桌时随机定的那个）。
  if (next.handNumber > 1) {
    let candidate = (next.buttonIndex + 1) % SEAT_COUNT;
    while (next.seats[candidate].out) candidate = (candidate + 1) % SEAT_COUNT;
    next.buttonIndex = candidate;
  } else if (next.seats[next.buttonIndex].out) {
    next.buttonIndex = nonOutIndices(next)[0];
  }

  next.seats.forEach((seat) => {
    seat.holeCards = [];
    seat.folded = seat.out;
    seat.allIn = false;
    seat.totalContributed = 0;
    seat.streetContributed = 0;
  });

  const order = rotationFromButton(next);
  next.order = order;

  const deck = shuffleDeck(createDeck(), rng);

  // 发手牌：从小盲开始，每人先发一张，再每人发第二张（传统发牌顺序，
  // 对结果没有影响，只是看起来更"真"）。
  for (let round = 0; round < 2; round += 1) {
    order.forEach((seatIdx) => {
      next.seats[seatIdx].holeCards.push(deck.pop());
    });
  }
  next.deck = deck;

  const postBlind = (seatIdx, amount) => {
    const seat = next.seats[seatIdx];
    const paid = Math.min(amount, seat.stack);
    seat.stack -= paid;
    seat.streetContributed += paid;
    seat.totalContributed += paid;
    if (seat.stack === 0) seat.allIn = true;
    return paid;
  };

  let sbIdx;
  let bbIdx;
  if (order.length === 3) {
    sbIdx = order[1];
    bbIdx = order[2];
  } else {
    // 单挑：按钮位本人就是小盲。
    sbIdx = order[0];
    bbIdx = order[1];
  }
  postBlind(sbIdx, next.smallBlind);
  const bbPaid = postBlind(bbIdx, next.bigBlind);

  next.street = 'preflop';
  next.currentBet = bbPaid;
  next.minRaiseAmount = next.bigBlind;
  next.toAct = order.filter((i) => !next.seats[i].allIn);

  addMoment(next, { type: 'hand_start', button: next.buttonIndex, sb: sbIdx, bb: bbIdx });

  return { ok: true, state: next, events: [{ type: 'hand_start' }] };
};

// ---------- 合法动作查询（给 UI 用） ----------
export const getLegalActions = (state, seatIndex) => {
  const seat = state.seats[seatIndex];
  if (!seat || seat.folded || seat.allIn || state.toAct[0] !== seatIndex) {
    return { canAct: false };
  }
  const callAmount = Math.min(state.currentBet - seat.streetContributed, seat.stack);
  const canCheck = callAmount === 0;
  const maxTotal = seat.streetContributed + seat.stack; // 全下能到的总额
  const minRaiseTo = state.currentBet + state.minRaiseAmount;
  const canRaise = seat.stack > callAmount; // 跟注之外还有余量才能加注/全下
  return {
    canAct: true,
    canCheck,
    canCall: !canCheck,
    callAmount,
    canFold: true,
    canRaise,
    minRaiseTo: Math.min(minRaiseTo, maxTotal),
    maxRaiseTo: maxTotal,
    stack: seat.stack,
    streetContributed: seat.streetContributed,
  };
};

// 行动后重新计算这条街还要等谁行动。raiseHappened=true 时，除行动者外
// 的其它"在场且没全下"的座位全部重新排进队列（见文件头的简化说明）。
const requeueToAct = (state, actingIndex, raiseHappened) => {
  const order = state.order;
  if (raiseHappened) {
    const startPos = order.indexOf(actingIndex);
    const rotated = order.slice(startPos + 1).concat(order.slice(0, startPos + 1));
    state.toAct = rotated.filter(
      (i) => i !== actingIndex && !state.seats[i].folded && !state.seats[i].allIn && !state.seats[i].out
    );
  } else {
    state.toAct = state.toAct.filter((i) => i !== actingIndex);
  }
};

const liveNonFolded = (state) => state.seats.map((s, i) => i).filter((i) => !state.seats[i].folded && !state.seats[i].out);

export const fold = (state, seatIndex) => {
  const legal = getLegalActions(state, seatIndex);
  if (!legal.canAct) return fail('cannot_act');

  const next = clone(state);
  next.seats[seatIndex].folded = true;
  requeueToAct(next, seatIndex, false);
  addMoment(next, { type: 'fold', seat: seatIndex });

  const events = [{ type: 'fold', seat: seatIndex }];
  const remaining = liveNonFolded(next);
  if (remaining.length === 1) {
    const ended = awardUncontested(next, remaining[0]);
    return { ok: true, state: ended.state, events: [...events, ...ended.events] };
  }
  return { ok: true, state: next, events };
};

export const checkOrCall = (state, seatIndex) => {
  const legal = getLegalActions(state, seatIndex);
  if (!legal.canAct) return fail('cannot_act');

  const next = clone(state);
  const seat = next.seats[seatIndex];
  const amount = legal.callAmount;
  seat.stack -= amount;
  seat.streetContributed += amount;
  seat.totalContributed += amount;
  if (seat.stack === 0 && amount > 0) seat.allIn = true;
  requeueToAct(next, seatIndex, false);

  const eventType = amount === 0 ? 'check' : 'call';
  addMoment(next, { type: eventType, seat: seatIndex, amount });
  return { ok: true, state: next, events: [{ type: eventType, seat: seatIndex, amount }] };
};

// toTotal：这个座位本街"总共"要凑到多少筹码（标准"加注到 X"的语义），
// 不是"再加多少"。toTotal 达到 streetContributed+stack 时视为 all-in。
export const betOrRaise = (state, seatIndex, toTotal) => {
  const legal = getLegalActions(state, seatIndex);
  if (!legal.canAct || !legal.canRaise) return fail('cannot_raise');

  const seat = state.seats[seatIndex];
  const maxTotal = seat.streetContributed + seat.stack;
  const clampedTotal = Math.min(Math.max(toTotal, legal.callAmount + seat.streetContributed + 1), maxTotal);
  // 必须至少达到最小加注额，除非是全下。
  if (clampedTotal < legal.minRaiseTo && clampedTotal < maxTotal) return fail('below_min_raise');

  const next = clone(state);
  const nextSeat = next.seats[seatIndex];
  const addAmount = clampedTotal - nextSeat.streetContributed;
  nextSeat.stack -= addAmount;
  nextSeat.streetContributed = clampedTotal;
  nextSeat.totalContributed += addAmount;
  const isAllIn = nextSeat.stack === 0;
  if (isAllIn) nextSeat.allIn = true;

  const raiseIncrement = clampedTotal - next.currentBet;
  next.minRaiseAmount = Math.max(next.minRaiseAmount, raiseIncrement, next.bigBlind);
  next.currentBet = clampedTotal;

  requeueToAct(next, seatIndex, true);
  addMoment(next, { type: isAllIn ? 'allin' : 'raise', seat: seatIndex, amount: clampedTotal });

  return {
    ok: true,
    state: next,
    events: [{ type: isAllIn ? 'allin' : 'raise', seat: seatIndex, amount: clampedTotal }],
  };
};

export const goAllIn = (state, seatIndex) => {
  const seat = state.seats[seatIndex];
  if (!seat) return fail('no_such_seat');
  const maxTotal = seat.streetContributed + seat.stack;
  if (maxTotal <= state.currentBet) {
    // 筹码不够跟注都不够：这其实是"全下跟注"，走 checkOrCall 的路径。
    return checkOrCall(state, seatIndex);
  }
  return betOrRaise(state, seatIndex, maxTotal);
};

const awardUncontested = (state, winnerIndex) => {
  const next = clone(state);
  const potTotal = next.seats.reduce((sum, s) => sum + s.totalContributed, 0);
  next.seats[winnerIndex].stack += potTotal;
  next.street = 'handOver';
  next.toAct = [];
  next.winnersInfo = {
    uncontested: true,
    pots: [{ amount: potTotal, winners: [winnerIndex] }],
  };
  markBusted(next);
  addMoment(next, { type: 'win_uncontested', seat: winnerIndex, amount: potTotal });
  return { state: next, events: [{ type: 'hand_over', uncontested: true, winner: winnerIndex }] };
};

const markBusted = (state) => {
  state.seats.forEach((seat, i) => {
    if (!seat.out && seat.stack === 0) {
      seat.out = true;
      addMoment(state, { type: 'bust', seat: i });
    }
  });
};

// ---------- 这条街的下注是否已经结束 ----------
export const isBettingRoundOver = (state) => state.street !== 'idle' && state.street !== 'handOver' && state.toAct.length === 0;

// 还有决策权的在场玩家（没弃牌、没全下、没出局）数量 <= 1 时，后面几条
// 街不用再下注，直接摊到底——这正是"有人全下、其余人决定跟不跟"之后
// 常见的情形。
const decidersRemaining = (state) =>
  state.seats.filter((s, i) => !s.folded && !s.out && !s.allIn).length;

// ---------- 发下一条街 / 摊牌 ----------
export const advanceStreet = (state, opts = {}) => {
  const { rng = Math.random } = opts;
  if (!isBettingRoundOver(state)) return fail('betting_not_over');

  const next = clone(state);
  const streetIdx = STREETS.indexOf(next.street);

  if (streetIdx === STREETS.length - 1) {
    return runShowdown(next);
  }

  const dealCount = next.street === 'preflop' ? 3 : 1;
  const dealt = [];
  for (let i = 0; i < dealCount; i += 1) dealt.push(next.deck.pop());
  next.board.push(...dealt);
  next.street = STREETS[streetIdx + 1];

  next.seats.forEach((seat) => {
    seat.streetContributed = 0;
  });
  next.currentBet = 0;
  next.minRaiseAmount = next.bigBlind;

  if (decidersRemaining(next) <= 1) {
    next.toAct = [];
  } else {
    const order = next.order; // 按钮不变，顺序复用 startHand 算好的那份
    const btnPos = order.indexOf(next.buttonIndex);
    const postflopOrder = order.slice(btnPos + 1).concat(order.slice(0, btnPos + 1));
    next.toAct = postflopOrder.filter(
      (i) => !next.seats[i].folded && !next.seats[i].allIn && !next.seats[i].out
    );
  }

  addMoment(next, { type: 'street', street: next.street, board: dealt.map((c) => c.id) });
  return { ok: true, state: next, events: [{ type: 'street', street: next.street }] };
};

// 发完河牌、或所有人提前全下后，一路把剩下的公共牌直接补满再摊牌用的
// 小工具——跟 advanceStreet 共用逻辑，只是循环调用直到 river。
export const dealRemainingBoard = (state, opts = {}) => {
  let current = state;
  while (current.street !== 'river' && current.street !== 'handOver') {
    const r = advanceStreet(current, opts);
    if (!r.ok) return r;
    current = r.state;
    if (current.street === 'handOver') return { ok: true, state: current, events: [] };
  }
  return { ok: true, state: current, events: [] };
};

// ---------- 摊牌与边池分配 ----------
const buildPots = (state) => {
  const contributors = state.seats
    .map((s, i) => ({ seat: i, contributed: s.totalContributed, folded: s.folded }))
    .filter((c) => c.contributed > 0);

  const levels = Array.from(new Set(contributors.map((c) => c.contributed))).sort((a, b) => a - b);

  const pots = [];
  let prevLevel = 0;
  levels.forEach((level) => {
    const layerPayers = contributors.filter((c) => c.contributed >= level);
    const layerAmount = (level - prevLevel) * layerPayers.length;
    const eligible = layerPayers.filter((c) => !c.folded).map((c) => c.seat);
    if (layerAmount > 0 && eligible.length > 0) {
      pots.push({ amount: layerAmount, eligible });
    } else if (layerAmount > 0 && eligible.length === 0) {
      // 这一层的出资人全部弃牌了（理论上少见）：这部分筹码归进最近一个
      // 仍有合格赢家的池子，避免筹码凭空消失。
      if (pots.length > 0) pots[pots.length - 1].amount += layerAmount;
    }
    prevLevel = level;
  });
  return pots;
};

export const runShowdown = (state) => {
  const next = clone(state);
  const pots = buildPots(next);
  const order = next.order;
  const rotationAfterButton = (() => {
    const btnPos = order.indexOf(next.buttonIndex);
    return order.slice(btnPos + 1).concat(order.slice(0, btnPos + 1));
  })();

  const evalCache = {};
  const getEval = (seatIdx) => {
    if (!evalCache[seatIdx]) {
      const seat = next.seats[seatIdx];
      evalCache[seatIdx] = evaluateBest([...seat.holeCards, ...next.board]);
    }
    return evalCache[seatIdx];
  };

  const potResults = pots.map((pot) => {
    let bestEval = null;
    let winners = [];
    pot.eligible.forEach((seatIdx) => {
      const ev = getEval(seatIdx);
      if (!bestEval || compareEval(ev, bestEval) > 0) {
        bestEval = ev;
        winners = [seatIdx];
      } else if (compareEval(ev, bestEval) === 0) {
        winners.push(seatIdx);
      }
    });

    const orderedWinners = rotationAfterButton.filter((i) => winners.includes(i));
    const share = Math.floor(pot.amount / orderedWinners.length);
    let remainder = pot.amount - share * orderedWinners.length;
    orderedWinners.forEach((seatIdx) => {
      let payout = share;
      if (remainder > 0) {
        payout += 1;
        remainder -= 1;
      }
      next.seats[seatIdx].stack += payout;
    });

    return {
      amount: pot.amount,
      winners: orderedWinners,
      handLabel: bestEval ? describeEval({ score: bestEval.score }) : null,
    };
  });

  next.street = 'handOver';
  next.toAct = [];
  next.winnersInfo = { uncontested: false, pots: potResults };

  const revealSeats = liveNonFolded(next);
  revealSeats.forEach((seatIdx) => {
    addMoment(next, {
      type: 'showdown_hand',
      seat: seatIdx,
      label: getEval(seatIdx).label,
    });
  });
  potResults.forEach((pot) => {
    addMoment(next, { type: 'pot_won', seats: pot.winners, amount: pot.amount, label: pot.handLabel });
  });

  markBusted(next);

  return { ok: true, state: next, events: [{ type: 'hand_over', uncontested: false }] };
};

// ---------- 会话层面的小工具 ----------
export const sessionHasEnded = (state) => nonOutIndices(state).length < 2;

export const getPotTotal = (state) => state.seats.reduce((sum, s) => sum + s.totalContributed, 0);