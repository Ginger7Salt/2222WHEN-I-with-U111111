// src/apps/textgames/liarsDice/liarsDiceMatchFormat.js
//
// 吹牛骰子这一局结果的“纯函数”部分：把引擎的最终 state 变成一份结果
// 对象、变成给三位同桌角色看的文案。不碰 DB、不碰 React——跟
// uno/unoMatchFormat.js、texas/texasMatchFormat.js 同一个分法，DB 那一层
// （liarsDiceService.js）保持很薄。
//
// 跟 UNO/德州不一样的地方：这个游戏不存战绩表（用户定的），结果只用来
// 1）结算页展示，2）往聊天里回传一条 text_game_result 消息。所以这里的
// 结果对象不会被写进 textGameMatches。
//
// 座位约定跟引擎一致：0 是用户，1、2、3 是三位角色（真角色或虚拟 NPC）。
//
// endReason 有三种：
// - 'finished'：打到只剩一个人还有骰子，正常结束（赢家可能是任何人）；
// - 'busted'：用户的骰子用光了，用户离桌（不再继续模拟剩下三个人的局）；
// - 'left'：用户在两轮之间主动离桌，放弃这一局。

import { SEAT_COUNT, getStandings } from './liarsDiceEngine.js';

export const GAME_ID_LIARS_DICE = 'liars-dice';
export const GAME_TITLE_LIARS_DICE = '吹牛骰子';
export const USER_SEAT = 0;

const MAX_MOMENT_LINES = 6;
// 叫到这个数量以上的质疑算“大叫点”，值得在摘要里提一句。
const BIG_BID_QUANTITY = 8;

export const formatDuration = (durationMs) => {
  const totalSec = Math.max(0, Math.round((durationMs || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`;
};

// names：每个座位在这段文字里叫什么。结算页里用户叫“你”，给角色看的
// 文案里用户叫“用户”、角色自己叫“你”、另一位角色叫名字。
export const describeMoment = (moment, names) => {
  const who = (seat) => names[seat] ?? '某位玩家';
  const round = `第${moment.round}轮`;

  switch (moment.type) {
    case 'challenge': {
      const loser = moment.bidderRight ? moment.challenger : moment.bidder;
      return `${round}，${who(moment.bidder)}叫了${moment.quantity}个${moment.face}点，${who(
        moment.challenger
      )}质疑，开骰实际有${moment.count}个，${who(loser)}失去一颗骰子`;
    }
    case 'bust':
      return `${round}，${who(moment.seat)}的骰子用光了，出局`;
    case 'win':
      return `${round}，${who(moment.seat)}成为最后剩下的人`;
    default:
      return null;
  }
};

// 摘要只留值得一提的：出局、结局、大叫点、刚好踩线的质疑。
const isNotable = (moment) =>
  moment.type === 'bust' ||
  moment.type === 'win' ||
  (moment.type === 'challenge' &&
    (moment.quantity >= BIG_BID_QUANTITY || moment.count === moment.quantity));

export const describeMoments = (moments, names) =>
  (moments || [])
    .filter(isNotable)
    .map((m) => describeMoment(m, names))
    .filter(Boolean)
    .slice(-MAX_MOMENT_LINES);

// table：引擎的最终 state；players：[{ id, name }]，下标 0 是用户。
export const buildMatchResult = ({ table, players, stake, endReason, durationMs, endedAt }) => {
  const finished = endReason === 'finished';
  const userWon = finished && table.winnerIndex === USER_SEAT;
  const pot = stake * SEAT_COUNT;
  const payout = userWon ? pot : 0;

  const standings = finished
    ? getStandings(table).map((s) => ({
        index: s.index,
        id: players[s.index].id,
        name: players[s.index].name,
        rank: s.rank,
        diceCount: s.diceCount,
      }))
    : null;
  const userStanding = standings ? standings.find((s) => s.index === USER_SEAT) : null;

  return {
    gameId: GAME_ID_LIARS_DICE,
    endReason,
    result: userWon ? 'win' : 'loss',
    stake,
    pot,
    payout,
    netChange: payout - stake,
    rounds: table.roundNumber,
    durationSec: Math.round((durationMs || 0) / 1000),
    userRank: userStanding ? userStanding.rank : null,
    winnerIndex: finished ? table.winnerIndex : null,
    winnerId: finished ? players[table.winnerIndex].id : null,
    standings,
    seats: table.seats.map((s, i) => ({
      index: i,
      id: players[i].id,
      name: players[i].name,
      diceCount: s.diceCount,
      out: s.out,
    })),
    moments: table.moments.slice(),
    endedAt,
  };
};

// 给某一位角色看的结果文案。selfSeat 是这位角色的座位（1、2 或 3）。
// 返回 { contextNote, noticeText }：
// - contextNote 会被 aiService 拼进“你和用户刚在文字游戏大厅玩了一局
//   「吹牛骰子」。”后面，让角色下次聊天时知道这局发生了什么；
// - noticeText 是聊天记录里那条小药丸，前面已经有“跟TA玩了「吹牛骰子」，”。
export const buildCharacterMessage = ({ result, players, selfSeat }) => {
  const otherSeats = [1, 2, 3].filter((i) => i !== selfSeat);
  const otherNames = otherSeats.map((i) => players[i].name).join('和');

  // 给角色看的称呼：自己=你，用户=用户，另外两位角色=名字。
  const names = players.map((p, i) => {
    if (i === selfSeat) return '你';
    if (i === USER_SEAT) return '用户';
    return p.name;
  });

  const selfSeatInfo = result.seats.find((s) => s.index === selfSeat);
  const finished = result.endReason === 'finished';

  let endLine;
  if (finished) {
    endLine = `打到最后只有${names[result.winnerIndex]}还剩骰子，${names[result.winnerIndex]}赢了，共打了${
      result.rounds
    }轮，用时 ${formatDuration(result.durationSec * 1000)}`;
  } else if (result.endReason === 'busted') {
    const alive = result.seats
      .filter((s) => !s.out)
      .map((s) => `${names[s.index]}${s.diceCount}颗`)
      .join('、');
    endLine = `用户的骰子在第${result.rounds}轮用光了，出局离桌，那时桌上还剩：${alive}`;
  } else {
    endLine = `用户打了${result.rounds}轮之后中途离桌，放弃了这一局`;
  }

  let chipLine;
  if (finished && result.result === 'win') {
    chipLine = `用户赢走了全部 ${result.pot} 个筹码的底池，净赚 ${result.netChange} 个`;
  } else if (finished) {
    chipLine = `用户下注的 ${result.stake} 个筹码输掉了，底池被${names[result.winnerIndex]}拿走`;
  } else {
    chipLine = `用户下注的 ${result.stake} 个筹码没能拿回来`;
  }

  let selfLine;
  if (finished) {
    const selfStanding = result.standings.find((s) => s.index === selfSeat);
    selfLine = `你自己排第${selfStanding.rank}`;
  } else if (selfSeatInfo.out) {
    selfLine = '你自己的骰子也已经用光了';
  } else {
    selfLine = `你自己手里还剩 ${selfSeatInfo.diceCount} 颗骰子`;
  }

  const parts = [
    `这是用户和三位角色一起玩的一桌四人吹牛骰子（大话骰，1 点百搭，每人起始 5 颗骰子，质疑输的人丢一颗），同桌的另外两位是${otherNames}。`,
    `${endLine}。${chipLine}。${selfLine}。`,
  ];

  const lines = describeMoments(result.moments, names);
  if (lines.length > 0) parts.push(`这一局的几个瞬间：${lines.join('；')}。`);

  let noticeBody;
  if (finished) {
    if (result.winnerIndex === USER_SEAT) noticeBody = '你拿了第一';
    else if (result.winnerIndex === selfSeat) noticeBody = 'TA拿了第一';
    else noticeBody = `${players[result.winnerIndex].name}拿了第一`;
  } else if (result.endReason === 'busted') {
    noticeBody = '你的骰子先用光了';
  } else {
    noticeBody = '你中途离桌了';
  }
  const noticeText = `四人局（同桌还有${otherNames}），${noticeBody}`;

  return { contextNote: parts.join(''), noticeText };
};

// 结算页里“这一局的几个瞬间”：用户视角，用户叫“你”。
export const buildSummaryLinesForUser = ({ result, players }) => {
  const names = players.map((p, i) => (i === USER_SEAT ? '你' : p.name));
  return describeMoments(result.moments, names);
};