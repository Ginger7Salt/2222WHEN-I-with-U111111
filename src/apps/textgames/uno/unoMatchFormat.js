// src/apps/textgames/uno/unoMatchFormat.js
//
// UNO 对局记录的“纯函数”部分：把引擎吐出的 getMatchSummary() 变成要存的
// 一行记录、变成给两位角色看的文案、算出存档保留规则该删哪几条。不碰 DB、
// 不碰 React，所以 DB 那一层（unoService.js）可以保持得很薄，这里的逻辑
// 可以脱离浏览器完整测试（见 unoMatchFormat.selftest.mjs）。
//
// 座位约定：state.players 的下标 0 永远是用户，1 和 2 是两位角色。

export const GAME_ID_UNO = 'uno';
export const GAME_TITLE_UNO = 'UNO';

// 存档保留规则（用户 2026-10 定的）：
// - 最近 3 局保留完整摘要（名次、关键瞬间）；
// - 第 4、5 局只留结果（谁赢了、名次、回合数、用时），摘要清掉；
// - 超过 5 局的整行丢弃。
export const MAX_FULL_SUMMARY_MATCHES = 3;
export const MAX_KEPT_MATCHES = 5;

export const USER_SEAT = 0;

export const formatDuration = (durationMs) => {
  const totalSec = Math.max(0, Math.round((durationMs || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`;
};

// perspective：每个座位在这段文字里叫什么。界面看结算页时用户叫“你”，
// 给角色看的文案里用户叫“用户”、角色自己叫“你”、另一位角色叫名字。
export const describeMoment = (moment, names) => {
  const who = (i) => names[i] ?? '某位玩家';
  const turn = `第 ${moment.turn} 回合`;

  switch (moment.type) {
    case 'wild4':
      return `${turn}，${who(moment.player)}对${who(moment.target)}打出了 +4`;
    case 'uno_called':
      return `${turn}，${who(moment.player)}只剩一张牌并喊了 UNO`;
    case 'uno_caught':
      return `${turn}，${who(moment.player)}抓到${who(moment.target)}忘了喊 UNO，罚抽 ${moment.count} 张`;
    case 'win':
      return `${turn}，${who(moment.player)}出完了最后一张牌`;
    case 'time_up':
      return `3 分钟时间到，${who(moment.player)}手里的牌最少（剩 ${moment.remaining} 张），赢了`;
    default:
      return null;
  }
};

export const describeMoments = (moments, names) =>
  (moments || []).map((m) => describeMoment(m, names)).filter(Boolean);

// players: [{ id, name }, ...] 与 state.players 同序；summary 来自引擎的
// getMatchSummary(state)。返回要写进 textGameMatches 的那一行（不含 id）。
export const buildMatchRow = ({ summary, players, durationMs, endedAt }) => {
  const standings = summary.standings.map((s) => ({
    index: s.index,
    id: players[s.index].id,
    name: players[s.index].name,
    rank: s.rank,
    remaining: s.remaining,
    points: s.points,
  }));

  const userStanding = standings.find((s) => s.index === USER_SEAT);
  const characterSeats = players.map((p, i) => i).filter((i) => i !== USER_SEAT);

  return {
    gameId: GAME_ID_UNO,
    // characterId 是表里已有的索引字段，这里放第一位角色，只为让这一行
    // 能正常落库；UNO 的查询一律按 gameId 取，不依赖它。
    characterId: players[characterSeats[0]].id,
    characterIds: characterSeats.map((i) => players[i].id),
    chatId: null,
    result: summary.winnerIndex === USER_SEAT ? 'win' : 'loss',
    winnerId: players[summary.winnerIndex].id,
    userRank: userStanding.rank,
    turns: summary.turns,
    durationSec: Math.round((durationMs || 0) / 1000),
    standings,
    moments: summary.moments,
    endedByTime: !!summary.endedByTime,
    summaryStripped: false,
    endedAt,
  };
};

// 保留规则：rows 是 gameId='uno' 的所有行（顺序随意）。返回要“清摘要”的
// id 列表和要“整行删除”的 id 列表，不做任何写入。
export const planRetention = (rows) => {
  const sorted = rows
    .slice()
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : a.endedAt > b.endedAt ? -1 : b.id - a.id));

  const toDelete = [];
  const toStrip = [];

  sorted.forEach((row, index) => {
    if (index >= MAX_KEPT_MATCHES) {
      toDelete.push(row.id);
    } else if (index >= MAX_FULL_SUMMARY_MATCHES && !row.summaryStripped) {
      toStrip.push(row.id);
    }
  });

  return { toStrip, toDelete };
};

// 被清掉摘要的行只留结果，丢掉名次明细和关键瞬间。
export const STRIPPED_FIELDS = { moments: null, standings: null, summaryStripped: true };

// 给某一位角色看的结果文案。selfSeat 是这位角色的座位（1 或 2）。
// 返回 { contextNote, noticeText }：
// - contextNote 会被 aiService 拼进“你和用户刚在文字游戏大厅玩了一局「UNO」。”
//   后面，让角色在下次聊天里知道这局发生了什么；
// - noticeText 是聊天记录里那条小药丸，前面已经有“跟TA玩了「UNO」，”。
export const buildCharacterMessage = ({ row, players, selfSeat }) => {
  const otherSeat = players.map((p, i) => i).find((i) => i !== USER_SEAT && i !== selfSeat);
  const other = players[otherSeat].name;

  // 给角色看的称呼：自己=你，用户=用户，另一位角色=名字。
  const names = players.map((p, i) => {
    if (i === selfSeat) return '你';
    if (i === USER_SEAT) return '用户';
    return p.name;
  });

  const standings = row.standings || [];
  const rankLine = standings
    .map((s) => `第${s.rank}名${names[s.index]}（剩${s.remaining}张）`)
    .join('，');
  const self = standings.find((s) => s.index === selfSeat);
  const winnerSeat = players.findIndex((p) => p.id === row.winnerId);

  const parts = [
    `这是一局三人 UNO，同桌的另一位玩家是${other}。`,
    row.endedByTime
      ? `3 分钟时间到了，按手牌最少判定，${names[winnerSeat]}赢了这一局，共${row.turns}回合。`
      : `${names[winnerSeat]}赢了这一局，用时 ${formatDuration(row.durationSec * 1000)}，共${row.turns}回合。`,
  ];
  if (rankLine) parts.push(`名次：${rankLine}。`);
  if (self) parts.push(`你自己排第${self.rank}。`);

  const lines = describeMoments(row.moments, names);
  if (lines.length > 0) parts.push(`这一局的几个瞬间：${lines.join('；')}。`);

  const winnerForNotice =
    winnerSeat === USER_SEAT ? null : winnerSeat === selfSeat ? 'TA' : other;
  const noticeText =
    winnerSeat === USER_SEAT
      ? `三人局（同桌还有${other}），你拿了第一`
      : `三人局（同桌还有${other}），${winnerForNotice}拿了第一，你排第${row.userRank}`;

  return { contextNote: parts.join(''), noticeText };
};

// 结算页里“这一局的几个瞬间”：用户视角，用户叫“你”。
export const buildSummaryLinesForUser = ({ row, players }) => {
  const names = players.map((p, i) => (i === USER_SEAT ? '你' : p.name));
  return describeMoments(row.moments, names);
};