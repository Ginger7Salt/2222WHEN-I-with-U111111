// src/apps/textgames/skull/skullMatchFormat.js
//
// 骷髅牌对局记录的“纯函数”部分：把引擎吐出的 getMatchSummary() 变成要存
// 的一行记录、变成给每位真人角色看的文案、算出存档保留规则该删哪几条，
// 还有“自动补 NPC 凑满 4 人桌”。不碰 DB、不碰 React，所以 DB 那一层
// （skullService.js）可以保持得很薄，这里的逻辑可以脱离浏览器完整测试
// （见 skullMatchFormat.selftest.mjs）。
//
// 座位约定：players 的下标 0 永远是用户，1 到 3 是角色或 NPC。
// 每个 player 是 { id, name, isNpc? }：真人角色的 id 是 db.characters 的
// 真实 id；NPC 的 id 是下面 NPC_ROSTER 里的占位 id（npc-1 之类），不会
// 出现在 characterIds 里，也不会收到聊天消息。

export const GAME_ID_SKULL = 'skull';
export const GAME_TITLE_SKULL = '骷髅牌';

// 存档保留规则（照 UNO）：
// - 最近 3 局保留完整摘要（名次、关键瞬间）；
// - 第 4、5 局只留结果，摘要清掉；
// - 超过 5 局的整行丢弃。
export const MAX_FULL_SUMMARY_MATCHES = 3;
export const MAX_KEPT_MATCHES = 5;

export const USER_SEAT = 0;
export const TABLE_SIZE = 4;

// ---------- 凑满一桌 ----------
export const NPC_ROSTER = [
  { id: 'npc-1', name: '维维安', isNpc: true },
  { id: 'npc-2', name: '马尔科', isNpc: true },
  { id: 'npc-3', name: '维斯佩尔', isNpc: true },
];

// characters: 用户选的 1 到 3 位真人角色（db.characters 的行）。返回座位
// 顺序的 players：[用户, ...真人角色, ...补位的 NPC]，总共 TABLE_SIZE 个。
// buildMatchRow / buildCharacterMessage 只读 id、name、isNpc，多带的字段
// 不会被存进对局记录。
export const buildTablePlayers = (characters) => {
  // 真人角色把整行资料（头像、skullLines 台词缓存等）一起带上，对局界面
  // 直接用这份座位数据，不用再回头查角色。
  const real = (characters || []).slice(0, TABLE_SIZE - 1).map((c) => ({
    ...c,
    id: c.id,
    name: c.name || '角色',
    isNpc: false,
  }));
  const npcCount = TABLE_SIZE - 1 - real.length;
  return [
    { id: 'user', name: '用户', isNpc: false },
    ...real,
    ...NPC_ROSTER.slice(0, npcCount),
  ];
};

export const formatDuration = (durationMs) => {
  const totalSec = Math.max(0, Math.round((durationMs || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`;
};

// names：每个座位在这段文字里叫什么。结算页里用户叫“你”，给角色看的文案
// 里用户叫“用户”、角色自己叫“你”、其他人叫名字。
export const describeMoment = (moment, names) => {
  const who = (i) => names[i] ?? '某位玩家';
  const round = `第 ${moment.round} 轮`;

  switch (moment.type) {
    case 'success':
      return `${round}，${who(moment.player)}叫了 ${moment.bid} 朵蔷薇并全部翻开，拿到一枚胜利印记`;
    case 'fail':
      return moment.own
        ? `${round}，${who(moment.player)}叫了 ${moment.bid} 朵，却翻到了自己的骷髅，失去一张牌`
        : `${round}，${who(moment.player)}叫了 ${moment.bid} 朵，翻到了${who(moment.owner)}的骷髅，被抽走一张牌`;
    case 'eliminated':
      return `${round}，${who(moment.player)}的牌用光了，被淘汰`;
    case 'win':
      return moment.endedBy === 'wins'
        ? `${who(moment.player)}集齐两枚胜利印记，赢下这一局`
        : `${who(moment.player)}是最后留在桌上的人，赢下这一局`;
    default:
      return null;
  }
};

export const describeMoments = (moments, names) =>
  (moments || []).map((m) => describeMoment(m, names)).filter(Boolean);

// players 与 state.players 同序；summary 来自引擎的 getMatchSummary(state)。
// 返回要写进 textGameMatches 的那一行（不含 id）。
export const buildMatchRow = ({ summary, players, durationMs, endedAt }) => {
  const standings = summary.standings.map((s) => ({
    index: s.index,
    id: players[s.index].id,
    name: players[s.index].name,
    npc: !!players[s.index].isNpc,
    rank: s.rank,
    wins: s.wins,
    cards: s.cards,
  }));

  const userStanding = standings.find((s) => s.index === USER_SEAT);
  const characterSeats = players
    .map((p, i) => i)
    .filter((i) => i !== USER_SEAT && !players[i].isNpc);

  return {
    gameId: GAME_ID_SKULL,
    // characterId 是表里已有的索引字段，必须有值：放第一位真人角色，只为
    // 让这一行能正常落库；骷髅牌的查询一律按 gameId 取，不依赖它。
    characterId: players[characterSeats[0]].id,
    characterIds: characterSeats.map((i) => players[i].id),
    chatId: null,
    result: summary.winnerIndex === USER_SEAT ? 'win' : 'loss',
    winnerId: players[summary.winnerIndex].id,
    userRank: userStanding.rank,
    rounds: summary.rounds,
    durationSec: Math.round((durationMs || 0) / 1000),
    standings,
    moments: summary.moments,
    endedBy: summary.endedBy,
    summaryStripped: false,
    endedAt,
  };
};

// 保留规则：rows 是 gameId='skull' 的所有行（顺序随意）。返回要“清摘要”的
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

// 给某一位真人角色看的结果文案。selfSeat 是这位角色的座位。
// 返回 { contextNote, noticeText }：
// - contextNote 会被 aiService 拼进“你和用户刚在文字游戏大厅玩了一局「骷髅牌」。”
//   后面，让角色在下次聊天里知道这局发生了什么；
// - noticeText 是聊天记录里那条小药丸，前面已经有“跟TA玩了「骷髅牌」，”。
export const buildCharacterMessage = ({ row, players, selfSeat }) => {
  // 给角色看的称呼：自己=你，用户=用户，其他人=名字。
  const names = players.map((p, i) => {
    if (i === selfSeat) return '你';
    if (i === USER_SEAT) return '用户';
    return p.name;
  });

  const mates = players
    .map((p, i) => i)
    .filter((i) => i !== USER_SEAT && i !== selfSeat)
    .map((i) => players[i].name);

  const standings = row.standings || [];
  const rankLine = standings
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((s) => `第${s.rank}名${names[s.index]}（${s.wins} 枚印记，剩${s.cards}张牌）`)
    .join('，');
  const self = standings.find((s) => s.index === selfSeat);
  const winnerSeat = players.findIndex((p) => p.id === row.winnerId);

  const parts = [
    `这是一局四人骷髅牌（每人 4 张牌：3 朵蔷薇、1 个骷髅，靠叫数和虚张声势比谁敢翻），同桌的其他玩家是${mates.join('、')}。`,
    `${names[winnerSeat]}赢了这一局，用时 ${formatDuration(row.durationSec * 1000)}，共${row.rounds}轮。`,
  ];
  if (rankLine) parts.push(`名次：${rankLine}。`);
  if (self) parts.push(`你自己排第${self.rank}。`);

  const lines = describeMoments(row.moments, names);
  if (lines.length > 0) parts.push(`这一局的几个瞬间：${lines.join('；')}。`);

  const tableText = `四人局（同桌还有${mates.join('、')}）`;
  let noticeText;
  if (winnerSeat === USER_SEAT) {
    noticeText = `${tableText}，你拿了第一`;
  } else if (winnerSeat === selfSeat) {
    noticeText = `${tableText}，TA拿了第一，你排第${row.userRank}`;
  } else {
    noticeText = `${tableText}，${players[winnerSeat].name}拿了第一，你排第${row.userRank}`;
  }

  return { contextNote: parts.join(''), noticeText };
};

// 结算页里“这一局的几个瞬间”：用户视角，用户叫“你”。
export const buildSummaryLinesForUser = ({ row, players }) => {
  const names = players.map((p, i) => (i === USER_SEAT ? '你' : p.name));
  return describeMoments(row.moments, names);
};