// src/apps/textgames/undercover/undercoverEngine.js
//
// "谁是卧底"纯函数引擎：发身份/发词、座位数据结构、淘汰判定、胜负判定。
// 不碰 DB/React/AI 调用——跟 unoEngine.js/unoMatchFormat.js 的分层方式
// 一致，方便脱离浏览器单独测试，也让 undercoverService.js/
// UndercoverGame.jsx 都只管自己那一层的事。
//
// 固定 5 人局（设计确认）：1 卧底 + 4 平民。用户一定是其中一个座位，
// 真实角色不够 5 个时用临时 NPC 补位——NPC 在这个引擎里跟真实角色
// 座位完全同构（都有 seat.id/seat.name/seat.isNpc），引擎本身不关心
// 这个区别，只有外层的"结果回写哪个聊天"逻辑需要用 isNpc 跳过 NPC。

export const UNDERCOVER_SEAT_COUNT = 5;
export const UNDERCOVER_UNDERCOVER_COUNT = 1;

export const UNDERCOVER_PHASES = {
  DEALING: 'dealing',       // 刚发完身份，用户还没看完自己的词
  DESCRIBING: 'describing', // 轮流发言
  VOTING: 'voting',         // 投票
  ELIMINATED: 'eliminated', // 这一轮刚出局，展示过渡
  ENDED: 'ended',           // 游戏结束（平民胜/卧底胜）
};

export const UNDERCOVER_RESULT = {
  CIVILIAN_WIN: 'civilian_win',
  UNDERCOVER_WIN: 'undercover_win',
};

// seats: [{ id, name, avatar, bio, isNpc, isUser }]，长度固定 5，顺序
// 即座位顺序（也是发言顺序）。返回带上身份/词/存活状态的完整座位数组，
// 不改动传入的 seats 数组本身。
export const dealRoles = (seats, wordPair, rng = Math.random) => {
  if (!seats || seats.length !== UNDERCOVER_SEAT_COUNT) {
    throw new Error('谁是卧底固定 5 人局，座位数不对。');
  }

  const undercoverIndex = Math.floor(rng() * seats.length);

  return seats.map((seat, index) => ({
    ...seat,
    role: index === undercoverIndex ? 'undercover' : 'civilian',
    word: index === undercoverIndex ? wordPair.undercover : wordPair.civilian,
    alive: true,
  }));
};

export const getAliveSeats = (players) => players.filter((p) => p.alive);

export const getAliveCivilianCount = (players) =>
  getAliveSeats(players).filter((p) => p.role === 'civilian').length;

export const getAliveUndercoverCount = (players) =>
  getAliveSeats(players).filter((p) => p.role === 'undercover').length;

// 胜负判定：卧底被投出 -> 平民胜；存活只剩 2 人且卧底还在 -> 卧底胜；
// 否则游戏继续，返回 null。
export const checkGameEnd = (players) => {
  const aliveUndercover = getAliveUndercoverCount(players);
  if (aliveUndercover === 0) return UNDERCOVER_RESULT.CIVILIAN_WIN;

  const aliveTotal = getAliveSeats(players).length;
  if (aliveTotal <= 2 && aliveUndercover > 0) return UNDERCOVER_RESULT.UNDERCOVER_WIN;

  return null;
};

// 发言顺序：按座位顺序，只排还存活的。每一轮都从头排一次（不记上一轮
// 谁先说，简单起见——"谁先发言"这个细节用户没有特别要求）。
export const getSpeakingOrder = (players) =>
  getAliveSeats(players).map((p) => p.seatIndex);

// 统票：votes 是 { voterSeatIndex: targetSeatIndex }。平票时随机抽一个
// 最高票的出局（没有"重投"机制，设计确认里没提，保持简单）。返回
// { eliminatedSeatIndex, tally }。
export const tallyVotes = (votes, players, rng = Math.random) => {
  const aliveSeats = getAliveSeats(players).map((p) => p.seatIndex);
  const tally = {};
  aliveSeats.forEach((i) => {
    tally[i] = 0;
  });

  Object.values(votes || {}).forEach((targetIndex) => {
    if (tally[targetIndex] != null) tally[targetIndex] += 1;
  });

  const maxVotes = Math.max(...Object.values(tally));
  const topSeats = aliveSeats.filter((i) => tally[i] === maxVotes);
  const eliminatedSeatIndex = topSeats[Math.floor(rng() * topSeats.length)];

  return { eliminatedSeatIndex, tally };
};

export const eliminateSeat = (players, seatIndex) =>
  players.map((p) => (p.seatIndex === seatIndex ? { ...p, alive: false } : p));

// 给座位数组补上 seatIndex 字段（0..4），方便后面都用下标而不是数组
// position 直接操作。
export const withSeatIndexes = (seats) => seats.map((seat, index) => ({ ...seat, seatIndex: index }));