// src/apps/textgames/uno/unoEngine.js
//
// UNO 的纯规则引擎，不碰 DB、不碰 React、不碰计时器。所有函数都不修改
// 传进来的 state，而是 structuredClone 一份再改，返回 { ok, state, events }
// 或 { ok: false, error }——界面层拿 events 去播动画/台词，拿 state 去渲染。
//
// 牌组是用户自己定的 108 张版本：黑 / 红 / 白 / 深蓝 四色，每色 25 张
// （0 一张，1-9 各两张，Skip / Reverse / Draw Two 各两张），外加 4 张 Wild
// 和 4 张 Wild Draw Four。牌面图片的映射不在这里，见后面 Slice 的
// unoCardImages.js。
//
// 简化规则（跟用户确认过的）：
// - 不做 +4 的质疑规则，Wild Draw Four 任何时候都能出。
// - 抽牌后如果抽到的牌能出，可以出也可以过；抽到的牌不能出则自动过。
// - 喊 UNO：出牌后手里只剩一张时，出牌方要在下一位玩家行动之前喊，
//   否则别人可以抓，被抓罚抽 2 张。
// - 随机数一律由调用方通过 opts.rng 传入（默认 Math.random），方便测试
//   时用固定种子复现；state 里不存函数，所以 structuredClone 是安全的。

export const COLORS = ['black', 'red', 'white', 'darkblue'];

export const COLOR_LABEL_ZH = {
  black: '黑',
  red: '红',
  white: '白',
  darkblue: '深蓝',
};

export const HAND_SIZE = 7;
export const TURN_TIME_LIMIT_MS = 15000;
export const MATCH_TIME_LIMIT_MS = 180000;
export const UNO_PENALTY_COUNT = 2;
const MAX_MOMENTS = 60;

const ACTION_VALUES = ['skip', 'reverse', 'draw2'];

export const isWild = (card) => card.value === 'wild' || card.value === 'wild4';

export const createDeck = () => {
  const deck = [];
  let serial = 0;
  const add = (color, value) => {
    deck.push({ id: `c${serial}`, color, value });
    serial += 1;
  };

  COLORS.forEach((color) => {
    add(color, '0');
    for (let n = 1; n <= 9; n += 1) {
      add(color, String(n));
      add(color, String(n));
    }
    ACTION_VALUES.forEach((value) => {
      add(color, value);
      add(color, value);
    });
  });

  for (let i = 0; i < 4; i += 1) add(null, 'wild');
  for (let i = 0; i < 4; i += 1) add(null, 'wild4');

  return deck;
};

export const shuffle = (list, rng = Math.random) => {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 计分用：数字牌按面值，功能牌 20，万能牌 50（标准 UNO 计分）。
export const cardPoints = (card) => {
  if (isWild(card)) return 50;
  if (ACTION_VALUES.includes(card.value)) return 20;
  return Number(card.value);
};

export const getTopCard = (state) =>
  state.discardPile[state.discardPile.length - 1];

export const nextIndex = (state, from, steps = 1) => {
  const n = state.players.length;
  return (((from + state.direction * steps) % n) + n) % n;
};

export const canPlayCard = (state, card) => {
  if (isWild(card)) return true;
  const top = getTopCard(state);
  return card.color === state.currentColor || card.value === top.value;
};

export const getPlayableCardIds = (state, playerIndex) => {
  const hand = state.players[playerIndex].hand;

  // 刚抽完牌的那一手：只能出刚抽到的那张（或者过）。
  if (state.drawnCardId) {
    const drawn = hand.find((c) => c.id === state.drawnCardId);
    return drawn && canPlayCard(state, drawn) ? [drawn.id] : [];
  }

  return hand.filter((c) => canPlayCard(state, c)).map((c) => c.id);
};

const addMoment = (state, moment) => {
  if (state.moments.length >= MAX_MOMENTS) return;
  state.moments.push({ turn: state.turnCount, ...moment });
};

// 牌堆抽空时，把弃牌堆（除最上面一张）洗回去。
const refillDrawPile = (state, rng) => {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile.pop();
  state.drawPile = shuffle(state.discardPile, rng);
  state.discardPile = [top];
};

const drawCards = (state, count, rng) => {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (state.drawPile.length === 0) refillDrawPile(state, rng);
    if (state.drawPile.length === 0) break;
    drawn.push(state.drawPile.pop());
  }
  return drawn;
};

const fail = (error) => ({ ok: false, error });

export const createGame = ({
  playerIds,
  rng = Math.random,
  handSize = HAND_SIZE,
}) => {
  const deck = shuffle(createDeck(), rng);
  const players = playerIds.map((id) => ({ id, hand: [] }));

  for (let i = 0; i < handSize; i += 1) {
    players.forEach((p) => p.hand.push(deck.pop()));
  }

  // 起始牌不能是 Wild Draw Four：塞回牌堆底，重翻一张。
  let start = deck.pop();
  while (start.value === 'wild4') {
    deck.unshift(start);
    start = deck.pop();
  }

  const state = {
    players,
    drawPile: deck,
    discardPile: [start],
    currentIndex: 0,
    direction: 1,
    currentColor: start.color,
    drawnCardId: null,
    unoVulnerable: null,
    status: 'playing',
    winnerIndex: null,
    endedByTime: false,
    turnCount: 1,
    // missingColors[i]：玩家 i 被观察到“没有”的颜色（他在该颜色为当前色时
    // 被迫抽牌）。角色策略用它来猜对手手里缺什么。
    missingColors: players.map(() => []),
    moments: [],
  };

  // 起始牌的效果：按“0 号玩家是第一个被影响的人”处理，简化实现。
  if (isWild(start)) {
    state.currentColor = COLORS[Math.floor(rng() * COLORS.length)];
  } else if (start.value === 'skip') {
    state.currentIndex = nextIndex(state, 0);
  } else if (start.value === 'reverse') {
    state.direction = -1;
  } else if (start.value === 'draw2') {
    players[0].hand.push(...drawCards(state, 2, rng));
    state.currentIndex = nextIndex(state, 0);
  }

  return state;
};

// 其他人行动 = 上一位出牌方的“喊 UNO 窗口”关闭。
const closeUnoWindowIfOtherActs = (state, actingIndex) => {
  if (state.unoVulnerable !== null && state.unoVulnerable !== actingIndex) {
    state.unoVulnerable = null;
  }
};

const advanceTurn = (state, from, steps = 1) => {
  state.currentIndex = nextIndex(state, from, steps);
  state.turnCount += 1;
  state.drawnCardId = null;
};

export const playCard = (state, playerIndex, cardId, opts = {}) => {
  const { chosenColor = null, callUno = false, rng = Math.random } = opts;

  if (state.status !== 'playing') return fail('game_over');
  if (playerIndex !== state.currentIndex) return fail('not_your_turn');

  const card = state.players[playerIndex].hand.find((c) => c.id === cardId);
  if (!card) return fail('no_such_card');
  if (state.drawnCardId && state.drawnCardId !== cardId) {
    return fail('must_play_drawn_card');
  }
  if (!canPlayCard(state, card)) return fail('illegal_card');
  if (isWild(card) && !COLORS.includes(chosenColor)) {
    return fail('color_required');
  }

  const next = structuredClone(state);
  const events = [];
  closeUnoWindowIfOtherActs(next, playerIndex);

  const player = next.players[playerIndex];
  player.hand = player.hand.filter((c) => c.id !== cardId);
  next.discardPile.push(card);
  next.currentColor = isWild(card) ? chosenColor : card.color;
  next.missingColors[playerIndex] = next.missingColors[playerIndex].filter(
    (c) => c !== next.currentColor
  );

  events.push({ type: 'play', player: playerIndex, card, color: next.currentColor });

  // 效果。reverse 先翻转方向再算下一位；其余效果的目标是出牌前的“下一位”。
  let steps = 1;
  const target = nextIndex(next, playerIndex);

  if (card.value === 'skip') {
    events.push({ type: 'skip', player: playerIndex, target });
    steps = 2;
  } else if (card.value === 'reverse') {
    next.direction *= -1;
    events.push({ type: 'reverse', player: playerIndex });
    // 两人局里反转等同于跳过；三人及以上只是换方向。
    if (next.players.length === 2) steps = 2;
  } else if (card.value === 'draw2' || card.value === 'wild4') {
    const count = card.value === 'draw2' ? 2 : 4;
    const drawn = drawCards(next, count, rng);
    next.players[target].hand.push(...drawn);
    events.push({
      type: 'penalty_draw',
      player: playerIndex,
      target,
      count: drawn.length,
      cause: card.value,
    });
    steps = 2;
  }

  if (card.value === 'wild4') {
    addMoment(next, { type: 'wild4', player: playerIndex, target });
  }

  // 出完最后一张：游戏结束（上面的罚抽效果已经结算）。
  if (player.hand.length === 0) {
    next.status = 'ended';
    next.winnerIndex = playerIndex;
    next.drawnCardId = null;
    next.unoVulnerable = null;
    events.push({ type: 'win', player: playerIndex });
    addMoment(next, { type: 'win', player: playerIndex });
    return { ok: true, state: next, events };
  }

  if (player.hand.length === 1) {
    if (callUno) {
      events.push({ type: 'uno_called', player: playerIndex });
      addMoment(next, { type: 'uno_called', player: playerIndex });
    } else {
      next.unoVulnerable = playerIndex;
      events.push({ type: 'one_card_left', player: playerIndex });
    }
  }

  advanceTurn(next, playerIndex, steps);
  return { ok: true, state: next, events };
};

export const drawCard = (state, playerIndex, opts = {}) => {
  const { rng = Math.random } = opts;

  if (state.status !== 'playing') return fail('game_over');
  if (playerIndex !== state.currentIndex) return fail('not_your_turn');
  if (state.drawnCardId) return fail('already_drawn');

  const next = structuredClone(state);
  const events = [];
  closeUnoWindowIfOtherActs(next, playerIndex);

  const player = next.players[playerIndex];

  // 手里没有当前颜色的牌（万能牌除外）：记下这位玩家缺这个颜色。
  const hasCurrentColor = player.hand.some((c) => c.color === next.currentColor);
  if (!hasCurrentColor && !next.missingColors[playerIndex].includes(next.currentColor)) {
    next.missingColors[playerIndex].push(next.currentColor);
  }

  const [drawn] = drawCards(next, 1, rng);
  if (!drawn) {
    // 牌堆和弃牌堆都空了（理论上几乎不会发生）：直接过。
    events.push({ type: 'pass', player: playerIndex });
    advanceTurn(next, playerIndex);
    return { ok: true, state: next, events, drawnCard: null, canPlayDrawn: false };
  }

  player.hand.push(drawn);
  events.push({ type: 'draw', player: playerIndex, count: 1 });

  const canPlayDrawn = canPlayCard(next, drawn);
  if (canPlayDrawn) {
    next.drawnCardId = drawn.id;
  } else {
    events.push({ type: 'pass', player: playerIndex });
    advanceTurn(next, playerIndex);
  }

  return { ok: true, state: next, events, drawnCard: drawn, canPlayDrawn };
};

// 抽牌后选择不出：只有刚抽完且那张牌能出的时候才需要显式调用。
export const passTurn = (state, playerIndex) => {
  if (state.status !== 'playing') return fail('game_over');
  if (playerIndex !== state.currentIndex) return fail('not_your_turn');
  if (!state.drawnCardId) return fail('draw_first');

  const next = structuredClone(state);
  advanceTurn(next, playerIndex);
  return { ok: true, state: next, events: [{ type: 'pass', player: playerIndex }] };
};

export const callUno = (state, playerIndex) => {
  if (state.unoVulnerable !== playerIndex) return fail('nothing_to_call');

  const next = structuredClone(state);
  next.unoVulnerable = null;
  addMoment(next, { type: 'uno_called', player: playerIndex });
  return {
    ok: true,
    state: next,
    events: [{ type: 'uno_called', player: playerIndex }],
  };
};

export const catchUno = (state, catcherIndex, opts = {}) => {
  const { rng = Math.random } = opts;
  const victim = state.unoVulnerable;

  if (state.status !== 'playing') return fail('game_over');
  if (victim === null) return fail('nothing_to_catch');
  if (victim === catcherIndex) return fail('cannot_catch_self');

  const next = structuredClone(state);
  const drawn = drawCards(next, UNO_PENALTY_COUNT, rng);
  next.players[victim].hand.push(...drawn);
  next.unoVulnerable = null;
  addMoment(next, {
    type: 'uno_caught',
    player: catcherIndex,
    target: victim,
    count: drawn.length,
  });

  return {
    ok: true,
    state: next,
    events: [
      { type: 'uno_caught', player: catcherIndex, target: victim, count: drawn.length },
    ],
  };
};

// 15 秒没动作：替这位玩家抽一张牌；抽到能出的也不替他出，直接过。
export const applyTimeout = (state, playerIndex, opts = {}) => {
  if (state.status !== 'playing') return fail('game_over');
  if (playerIndex !== state.currentIndex) return fail('not_your_turn');

  const events = [{ type: 'timeout', player: playerIndex }];
  let current = state;

  if (!current.drawnCardId) {
    const drawn = drawCard(current, playerIndex, opts);
    if (!drawn.ok) return drawn;
    events.push(...drawn.events);
    current = drawn.state;
  }

  if (current.status === 'playing' && current.currentIndex === playerIndex) {
    const passed = passTurn(current, playerIndex);
    if (!passed.ok) return passed;
    events.push(...passed.events);
    current = passed.state;
  }

  return { ok: true, state: current, events };
};

// 整局 3 分钟到了：手牌最少的人赢；一样多就比手牌点数（小的赢）；
// 还一样就随机定一个。已经结束的局不会再动。
export const endByTime = (state, opts = {}) => {
  const { rng = Math.random } = opts;
  if (state.status !== 'playing') return fail('game_over');

  const next = structuredClone(state);
  const rows = next.players.map((p, index) => ({
    index,
    remaining: p.hand.length,
    points: p.hand.reduce((sum, c) => sum + cardPoints(c), 0),
  }));
  const best = rows.reduce((acc, r) =>
    r.remaining < acc.remaining || (r.remaining === acc.remaining && r.points < acc.points) ? r : acc
  );
  const tied = rows.filter((r) => r.remaining === best.remaining && r.points === best.points);
  const winner = tied[Math.min(tied.length - 1, Math.floor(rng() * tied.length))].index;

  next.status = 'ended';
  next.endedByTime = true;
  next.winnerIndex = winner;
  next.drawnCardId = null;
  next.unoVulnerable = null;
  addMoment(next, { type: 'time_up', player: winner, remaining: next.players[winner].hand.length });
  return { ok: true, state: next, events: [{ type: 'time_up', player: winner }] };
};

// 对局结束后的名次：赢家第一，其余按剩余牌的点数从小到大。
// 时间到的局，其余玩家先比手牌张数、再比点数。
export const getStandings = (state) => {
  const rows = state.players.map((p, index) => ({
    index,
    id: p.id,
    remaining: p.hand.length,
    points: p.hand.reduce((sum, c) => sum + cardPoints(c), 0),
  }));

  rows.sort((a, b) => {
    if (a.index === state.winnerIndex) return -1;
    if (b.index === state.winnerIndex) return 1;
    if (state.endedByTime && a.remaining !== b.remaining) return a.remaining - b.remaining;
    return a.points - b.points;
  });

  return rows.map((row, rank) => ({ ...row, rank: rank + 1 }));
};

// 给 Slice B 的存档层用的对局摘要原料：名次 + 回合数 + 关键瞬间。
// 文案怎么写、存多久，都不在引擎里决定。
export const getMatchSummary = (state) => ({
  turns: state.turnCount,
  winnerIndex: state.winnerIndex,
  endedByTime: !!state.endedByTime,
  standings: getStandings(state),
  moments: state.moments.slice(),
});