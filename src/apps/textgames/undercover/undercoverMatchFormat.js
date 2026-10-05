// src/apps/textgames/undercover/undercoverMatchFormat.js
//
// "谁是卧底"对局记录的纯函数部分：把结束时的 players 数组变成要存进
// textGameMatches 的那一行、变成给每位参赛真实角色看的文案。不碰
// DB/React——跟 unoMatchFormat.js 分层方式一致。
//
// 跟 UNO 一样是"多角色同桌"，复用同一张 textGameMatches 表、同一种
// "一局一行，回写每位参赛真实角色各自聊天"的做法（设计已确认）：
// NPC 不写回（没有聊天），只有真实角色各自收到一条。
//
// 保留规则比 UNO 简单：不分"完整摘要/只留结果"两档，固定只保留最近
// 10 局、超出的整行删除——跟 textGameSharedService 的默认保留数一致，
// 这里没有 UNO 那种"关键瞬间"级别的大量细节需要分档裁剪。

export const GAME_ID_UNDERCOVER = 'undercover';
export const GAME_TITLE_UNDERCOVER = '谁是卧底';

export const MAX_KEPT_MATCHES = 10;

// players：结束时的座位数组（含 role/word/alive/isNpc/isUser）。
// civilianWord/undercoverWord 从 players 里找更省事：任意一个 civilian
// 身份的 word 就是平民词，undercover 身份的 word 就是卧底词。
export const extractWordPair = (players) => {
  const civilian = players.find((p) => p.role === 'civilian');
  const undercover = players.find((p) => p.role === 'undercover');
  return {
    civilian: civilian?.word || '',
    undercover: undercover?.word || '',
  };
};

// 返回要写进 textGameMatches 的那一行（不含 id）。characterId 是表里
//已有的索引字段，放第一位真实角色的 id，只为了让这一行能正常落库；
// 查询一律按 gameId 取，不依赖它（跟 UNO 的 buildMatchRow 同一个理由）。
export const buildUndercoverMatchRow = ({ players, result, rounds, durationMs, endedAt }) => {
  const wordPair = extractWordPair(players);
  const realCharacterIds = players.filter((p) => !p.isNpc && !p.isUser).map((p) => p.id);
  const undercoverSeat = players.find((p) => p.role === 'undercover');

  return {
    gameId: GAME_ID_UNDERCOVER,
    characterId: realCharacterIds[0] || null,
    characterIds: realCharacterIds,
    chatId: null,
    result,
    rounds,
    durationSec: Math.round((durationMs || 0) / 1000),
    wordPair,
    undercoverWasUser: !!undercoverSeat?.isUser,
    undercoverWasNpc: !!undercoverSeat?.isNpc,
    seats: players.map((p) => ({
      seatIndex: p.seatIndex,
      name: p.name,
      role: p.role,
      isNpc: !!p.isNpc,
      isUser: !!p.isUser,
      alive: p.alive,
    })),
    endedAt,
  };
};

// 给某一位真实角色看的结果文案（selfSeatIndex 是这位角色的座位号）。
// 跟 UNO 的 buildCharacterMessage 一样做"第一人称视角命名"：自己=你，
// 用户=用户，其他人=名字（NPC 也用它本局临时取的名字，角色当时是跟
// TA同桌发言过的，用名字称呼很自然）。游戏已经结束，身份可以揭晓。
export const buildUndercoverCharacterMessage = ({ row, players, selfSeatIndex }) => {
  const nameFor = (seat) => {
    if (seat.seatIndex === selfSeatIndex) return '你';
    if (seat.isUser) return '用户';
    return seat.name;
  };

  const others = players.filter((p) => p.seatIndex !== selfSeatIndex).map((p) => nameFor(p));
  const self = players.find((p) => p.seatIndex === selfSeatIndex);
  const undercoverSeat = players.find((p) => p.role === 'undercover');
  const isCivilianWin = row.result === 'civilian_win';

  const selfRoleLine =
    self?.role === 'undercover'
      ? `你这一局是卧底，拿到的词是"${self.word}"。`
      : `你这一局是平民，拿到的词是"${self.word}"。`;

  const outcomeLine = isCivilianWin
    ? `最后卧底被投出局了，平民赢了这一局。`
    : `场上只剩两个人时卧底还没被揪出来，卧底赢了这一局。`;

  const undercoverRevealLine = undercoverSeat
    ? `卧底其实是${nameFor(undercoverSeat)}，拿到的词是"${row.wordPair.undercover}"，平民词是"${row.wordPair.civilian}"。`
    : '';

  const contextNote = [
    `这是一局 5 人谁是卧底，同桌还有${others.join('、')}。`,
    selfRoleLine,
    outcomeLine,
    undercoverRevealLine,
    `一共进行了 ${row.rounds} 轮。`,
  ]
    .filter(Boolean)
    .join('');

  const noticeText = isCivilianWin
    ? `5人局谁是卧底，${self?.role === 'undercover' ? '你是卧底，但被识破了' : '平民阵营赢了'}`
    : `5人局谁是卧底，${self?.role === 'undercover' ? '你是卧底，瞒到了最后' : '卧底赢了，没找出来'}`;

  return { contextNote, noticeText };
};