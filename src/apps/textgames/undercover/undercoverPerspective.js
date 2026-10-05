// src/apps/textgames/undercover/undercoverPerspective.js
//
// 给 AI 生成发言/投票用的"第一人称视角命名"：自己叫"你"，用户叫"用户"，
// 其他角色/NPC 叫自己的名字——跟 unoMatchFormat.js 的 buildCharacterMessage
// 同一个命名约定，只是这里是"任意座位视角"都要算一次（5 个座位里每一个
// 轮到自己发言/投票时都要从自己的视角看别人），不只是给角色看结算文案。
//
// 纯函数，不碰 DB/React，方便跟 undercoverEngine.js 一样单独测试。

export const labelForSeatFromPerspective = (seat, selfSeatIndex) => {
  if (seat.seatIndex === selfSeatIndex) return '你';
  if (seat.isUser) return '用户';
  return seat.name;
};

// speechLog 是 [{ seatIndex, text }]（发言顺序即数组顺序，跨轮次累积）。
// 转换成某个视角（selfSeatIndex）看到的 { label, text } 数组，用于拼进
// AI 提示词里的"目前已经有人发言"那一段。
export const toPerspectiveSpeechLog = (speechLog, players, selfSeatIndex) =>
  (speechLog || []).map((entry) => {
    const seat = players.find((p) => p.seatIndex === entry.seatIndex);
    return {
      label: seat ? labelForSeatFromPerspective(seat, selfSeatIndex) : '某位玩家',
      text: entry.text,
    };
  });

// 投票候选名单（某个视角下，排除自己——不能投给自己，设计已确认），
// 既给 AI 投票提示词当候选列表，也给 UI 当"投票给谁"的按钮数据源。
export const getVoteCandidates = (players, selfSeatIndex) =>
  players
    .filter((p) => p.alive && p.seatIndex !== selfSeatIndex)
    .map((p) => ({
      seatIndex: p.seatIndex,
      label: labelForSeatFromPerspective(p, selfSeatIndex),
    }));