// src/apps/textgames/ticTacToe/ticTacToeService.js
//
// 井字棋的数据层：角色列表/所属聊天查找、战绩记录的读写、结束后往
// 绑定的聊天里补一条真实消息。跟 ShellApp 同一个思路——角色在"文字
// 游戏大厅"这种顶层app里是靠 db.chats.where('characterId') 现查出
// 对应的聊天，不是从某个具体 ChatRoom 里带进来的 chatId。

import db from '../../../db';

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

export const GAME_ID_TIC_TAC_TOE = 'tic-tac-toe';
const MAX_KEPT_MATCHES = 10;

export const listCharactersForPicker = async () => {
  const characters = await db.characters.toArray();
  return characters.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

// 找这个角色对应的那个聊天——跟 ShellApp.crash() 里的查法完全一样。
// 没有聊天的角色（理论上不该出现，但防御一下）返回 null，调用方应该
// 仍然允许对局本身进行，只是跳过"回传结果"那一步。
export const getChatIdForCharacter = async (characterId) => {
  if (!characterId) return null;
  const chat = await db.chats.where('characterId').equals(characterId).first();
  return chat?.id ?? null;
};

// 最近的对局记录，按时间倒序，最多 MAX_KEPT_MATCHES 条（表里本来就只
// 会留这么多，这里的 limit 只是双重保险）。
export const getRecentMatches = async (gameId, characterId) => {
  if (!characterId) return [];

  const rows = await db.textGameMatches
    .where('[gameId+characterId]')
    .equals([gameId, characterId])
    .toArray();

  return rows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(0, MAX_KEPT_MATCHES);
};

// 战绩统计直接从最近的记录行聚合算出来，不额外维护一张计数表——跟
// shellService.getRemainingQuota 同一个"别让汇总表跟实际记录不同步"
// 的理由。注意这统计的是"最近10局"，不是这个角色这款游戏的历史全部
// 战绩（旧局物理删除后already不在表里了）。
export const getMatchStats = async (gameId, characterId) => {
  const matches = await getRecentMatches(gameId, characterId);

  return matches.reduce(
    (stats, match) => {
      if (match.result === 'win') stats.wins += 1;
      else if (match.result === 'loss') stats.losses += 1;
      else if (match.result === 'draw') stats.draws += 1;
      return stats;
    },
    { wins: 0, losses: 0, draws: 0, total: matches.length }
  );
};

// result 是"用户视角"的结果：'win' | 'loss' | 'draw'。
// 落一行新记录，顺带把这个 [gameId+characterId] 下超出 MAX_KEPT_MATCHES
// 的旧行删掉，再往对应聊天补一条 text_game_result 消息让角色能在下次
// 回复里感知到这局结果（没有聊天的话就只记战绩，跳过这一步）。
export const recordTicTacToeMatch = async ({
  characterId,
  gameTitle,
  result,
  board,
  userSymbol,
  computerSymbol,
}) => {
  if (!characterId || !result) return null;

  const endedAt = nowIso();
  const chatId = await getChatIdForCharacter(characterId);

  await db.textGameMatches.add({
    gameId: GAME_ID_TIC_TAC_TOE,
    characterId,
    chatId: chatId || null,
    result,
    board,
    endedAt,
  });

  const staleRows = await db.textGameMatches
    .where('[gameId+characterId]')
    .equals([GAME_ID_TIC_TAC_TOE, characterId])
    .toArray();

  const idsToDelete = staleRows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(MAX_KEPT_MATCHES)
    .map((row) => row.id);
  if (idsToDelete.length > 0) {
    await db.textGameMatches.bulkDelete(idsToDelete);
  }

  if (chatId) {
    await db.messages.add({
      chatId,
      characterId,
      sender: 'user',
      type: 'text_game_result',
      content: '',
      metadata: {
        gameId: GAME_ID_TIC_TAC_TOE,
        gameTitle: gameTitle || '井字棋',
        result,
        userSymbol,
        computerSymbol,
      },
      isRead: true,
      timestamp: endedAt,
    });

    await db.chats.update(chatId, { updatedAt: endedAt });

    dispatchLocalMessageEvent(chatId);
  }

  return { chatId, endedAt };
};