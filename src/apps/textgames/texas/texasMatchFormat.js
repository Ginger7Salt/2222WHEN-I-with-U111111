// src/apps/textgames/texas/texasMatchFormat.js
//
// 德州扑克这一桌记录的"纯函数"部分：把引擎的 moments 日志变成要存的
// 一行记录、变成给两位角色看的文案。不碰 DB、不碰 React——跟
// uno/unoMatchFormat.js 同一个分法，DB 那一层（texasService.js）保持薄。
//
// 跟 UNO 不一样的地方：UNO 一局就是"打到有人出完牌"那一下子；德州这里
// 是"坐下到离桌/被淘汰"算一整个会话（session），中间可能打了好几手牌，
// 一个会话只存一行、只发一条消息给两位角色，不是每一手牌都存一行。
//
// 座位约定跟 texasEngine.js 一致：0 永远是用户，1、2 是两位角色。

export const GAME_ID_TEXAS = 'texas-holdem';
export const GAME_TITLE_TEXAS = '德州扑克';

export const USER_SEAT = 0;

// 跟 UNO 同样的保留规则：最近 10 局（recordTextGameMatch 已经按
// [gameId+characterId] 处理这件事了，这里不用重复做）。

export const formatDuration = (durationMs) => {
  const totalSec = Math.max(0, Math.round((durationMs || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`;
};

const NOTABLE_TYPES = ['allin', 'bust', 'pot_won', 'win_uncontested'];
const MAX_MOMENT_LINES = 6;

export const describeMoment = (moment, names) => {
  const who = (seat) => names[seat] ?? '某位玩家';
  const whoList = (seats) => (seats || []).map(who).join('和');

  switch (moment.type) {
    case 'allin':
      return `第${moment.handNumber}手，${who(moment.seat)}全下`;
    case 'bust':
      return `第${moment.handNumber}手，${who(moment.seat)}筹码打光，离桌了`;
    case 'win_uncontested':
      return `第${moment.handNumber}手，${who(moment.seat)}让其他人弃牌，直接赢下 ${moment.amount}`;
    case 'pot_won':
      return `第${moment.handNumber}手，${whoList(moment.seats)}赢下一个 ${moment.amount} 的底池${
        moment.label ? `（${moment.label}）` : ''
      }`;
    default:
      return null;
  }
};

export const describeMoments = (moments, names) =>
  (moments || [])
    .filter((m) => NOTABLE_TYPES.includes(m.type))
    .map((m) => describeMoment(m, names))
    .filter(Boolean)
    .slice(-MAX_MOMENT_LINES);

// table: texasEngine 的最终 state；players: [{id,name}] 同下标约定；
// 返回要写进 textGameMatches 的那一行（不含 id）。
export const buildMatchRow = ({ table, players, buyIn, handsPlayed, endReason, durationMs, endedAt }) => {
  const finalStack = table.seats[USER_SEAT].stack;
  const netChange = finalStack - buyIn;
  const result = netChange > 0 ? 'win' : netChange < 0 ? 'loss' : 'draw';

  const seatsSummary = table.seats.map((s, i) => ({
    index: i,
    id: players[i].id,
    name: players[i].name,
    finalStack: s.stack,
    out: s.out,
  }));

  return {
    gameId: GAME_ID_TEXAS,
    characterId: players[1].id,
    characterIds: [players[1].id, players[2].id],
    chatId: null,
    result,
    buyIn,
    finalStack,
    netChange,
    handsPlayed,
    endReason, // 'busted' | 'left' | 'wonAll'
    durationSec: Math.round((durationMs || 0) / 1000),
    seats: seatsSummary,
    moments: table.moments.slice(),
    endedAt,
  };
};

// 给某一位角色看的结果文案。selfSeat 是这位角色的座位（1 或 2）。
export const buildCharacterMessage = ({ row, players, selfSeat }) => {
  const otherSeat = [1, 2].find((i) => i !== selfSeat);
  const other = players[otherSeat].name;

  const names = players.map((p, i) => {
    if (i === selfSeat) return '你';
    if (i === USER_SEAT) return '用户';
    return p.name;
  });

  const selfSummary = row.seats.find((s) => s.index === selfSeat);
  const userSummary = row.seats.find((s) => s.index === USER_SEAT);

  const endLine = {
    busted: `打到用户筹码输光离桌，一共打了${row.handsPlayed}手`,
    wonAll: `打到桌上只剩一个人还有筹码，一共打了${row.handsPlayed}手`,
    left: `用户中途主动离场结算，一共打了${row.handsPlayed}手`,
  }[row.endReason] || `这桌打完了，一共打了${row.handsPlayed}手`;

  const netLine =
    userSummary.finalStack > row.buyIn
      ? `用户这桌赢了 ${userSummary.finalStack - row.buyIn} 个筹码`
      : userSummary.finalStack < row.buyIn
      ? `用户这桌输了 ${row.buyIn - userSummary.finalStack} 个筹码`
      : '用户这桌不赔不赚';

  const selfLine = selfSummary.out
    ? '你自己在这桌上筹码打光，提前离桌了'
    : `你自己这桌手上还剩 ${selfSummary.finalStack} 个筹码`;

  const parts = [
    `这是一桌三人德州扑克，同桌的另一位是${other}。`,
    `${endLine}。${netLine}，${selfLine}。`,
  ];

  const lines = describeMoments(row.moments, names);
  if (lines.length > 0) parts.push(`这桌的几个瞬间：${lines.join('；')}。`);

  const noticeResultWord = userSummary.finalStack > row.buyIn ? '赢了' : userSummary.finalStack < row.buyIn ? '输了' : '打平';
  const noticeText = `三人桌德州扑克（同桌还有${other}），用户这桌${noticeResultWord}`;

  return { contextNote: parts.join(''), noticeText };
};

// 结算页里"这桌的几个瞬间"：用户视角，用户叫"你"。
export const buildSummaryLinesForUser = ({ row, players }) => {
  const names = players.map((p, i) => (i === USER_SEAT ? '你' : p.name));
  return describeMoments(row.moments, names);
};