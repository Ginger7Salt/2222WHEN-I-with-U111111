// src/apps/textgames/texas/texasService.js
//
// 德州扑克的数据层：会话结束后把这一桌写进 textGameMatches、按保留规则
// 清理旧局、往两位角色各自的聊天里补一条结果消息。跟 uno/unoService.js
// 几乎同源——三人同桌，一局（这里是"一个会话"）对应一行 + 两条消息，
// 不是 textGameSharedService.recordTextGameMatch 那种"一局一个角色"的
// 简单形状，所以单独写一份，复用同一张表和同一个消息 type
// （text_game_result）。

import db from '../../../db';
import { getChatIdForCharacter, listCharactersForPicker } from '../textGameSharedService';
import {
  GAME_ID_TEXAS,
  GAME_TITLE_TEXAS,
  USER_SEAT,
  buildCharacterMessage,
  buildMatchRow,
} from './texasMatchFormat';

export { listCharactersForPicker };

const MAX_KEPT_MATCHES = 10;

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

const loadTexasRows = () => db.textGameMatches.where('gameId').equals(GAME_ID_TEXAS).toArray();

const applyRetention = async () => {
  const rows = await loadTexasRows();
  const sorted = rows.sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
  const idsToDelete = sorted.slice(MAX_KEPT_MATCHES).map((r) => r.id);
  if (idsToDelete.length > 0) await db.textGameMatches.bulkDelete(idsToDelete);
};

// table: texasEngine 的最终 state；players: [{id,name}]，下标 0 是用户，
// 1、2 是两位角色（id 必须是 db.characters 的真实 id）。
export const recordTexasMatch = async ({ table, players, buyIn, handsPlayed, endReason, durationMs }) => {
  if (!table || players?.length !== 3) return null;

  const endedAt = nowIso();
  const row = buildMatchRow({ table, players, buyIn, handsPlayed, endReason, durationMs, endedAt });

  const id = await db.textGameMatches.add(row);
  await applyRetention();

  const characterSeats = [1, 2];
  for (const seat of characterSeats) {
    const characterId = players[seat].id;
    const chatId = await getChatIdForCharacter(characterId);
    if (!chatId) continue;

    const { contextNote, noticeText } = buildCharacterMessage({ row, players, selfSeat: seat });

    await db.messages.add({
      chatId,
      characterId,
      sender: 'user',
      type: 'text_game_result',
      content: '',
      metadata: {
        gameId: GAME_ID_TEXAS,
        gameTitle: GAME_TITLE_TEXAS,
        result: row.result,
        contextNote,
        noticeText,
      },
      isRead: true,
      timestamp: endedAt,
    });

    await db.chats.update(chatId, { updatedAt: endedAt });
    dispatchLocalMessageEvent(chatId);
  }

  return { id, row: { ...row, id }, endedAt };
};

export const getRecentTexasMatches = async () => {
  const rows = await loadTexasRows();
  return rows.sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
};

export const getTexasStats = async () => {
  const rows = await getRecentTexasMatches();
  return rows.reduce(
    (stats, row) => {
      if (row.result === 'win') stats.wins += 1;
      else if (row.result === 'loss') stats.losses += 1;
      else stats.draws += 1;
      return stats;
    },
    { wins: 0, losses: 0, draws: 0, total: rows.length }
  );
};

export { GAME_ID_TEXAS, GAME_TITLE_TEXAS, USER_SEAT };