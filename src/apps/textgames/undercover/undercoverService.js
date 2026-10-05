// src/apps/textgames/undercover/undercoverService.js
//
// "谁是卧底"的数据层。
//
// Slice A/B：取最近几局用过的词对（开局前避免连续撞同一对词）。
// Slice C（这一版新增）：对局结束后写一局结算记录 + 回写每位参赛真实
// 角色各自的聊天——跟 unoService.js 的 recordUnoMatch 同样的落库/回写
// 方式（每位参赛真实角色各自的聊天都写一份，设计已确认，不是只写
// 绑定的那一个；NPC 没有聊天，跳过）。
//
// 复用 textGameMatches 表（gameId='undercover'），不需要升 db 版本——
// UNO 当初也是这样接进同一张表的（见 db/index.js v76 的注释）。

import db from '../../../db';
import { getChatIdForCharacter, listCharactersForPicker } from '../textGameSharedService';
import {
  GAME_ID_UNDERCOVER,
  GAME_TITLE_UNDERCOVER,
  MAX_KEPT_MATCHES,
  buildUndercoverCharacterMessage,
  buildUndercoverMatchRow,
} from './undercoverMatchFormat';

export { listCharactersForPicker, GAME_ID_UNDERCOVER, GAME_TITLE_UNDERCOVER };

const RECENT_PAIRS_LOOKBACK = 5;

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const loadUndercoverRows = () =>
  db.textGameMatches.where('gameId').equals(GAME_ID_UNDERCOVER).toArray();

// 最近几局用过的词对，按时间倒序，最多取 RECENT_PAIRS_LOOKBACK 个——
// 给 pickRandomWordPair/generateAiWordPair 用来避免连续撞同一对词。
export const getRecentWordPairs = async () => {
  const rows = await loadUndercoverRows();
  return rows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(0, RECENT_PAIRS_LOOKBACK)
    .map((row) => row.wordPair)
    .filter(Boolean);
};

// 写完新的一局之后调用：只保留最近 MAX_KEPT_MATCHES 局，超出的整行删除
// （不分"完整/只留结果"两档，见 undercoverMatchFormat.js 顶部注释）。
const applyRetention = async () => {
  const rows = await loadUndercoverRows();
  const idsToDelete = rows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(MAX_KEPT_MATCHES)
    .map((row) => row.id);

  if (idsToDelete.length > 0) {
    await db.textGameMatches.bulkDelete(idsToDelete);
  }
};

// players：结束时的座位数组（含 role/word/alive/isNpc/isUser/seatIndex）。
// result：UNDERCOVER_RESULT 的 'civilian_win' | 'undercover_win'。
// 返回写好的那一行（含 id）。
export const recordUndercoverMatch = async ({ players, result, rounds, durationMs }) => {
  if (!players || players.length === 0 || !result) return null;

  const endedAt = nowIso();
  const row = buildUndercoverMatchRow({ players, result, rounds, durationMs, endedAt });

  const id = await db.textGameMatches.add(row);
  await applyRetention();

  // 往每一位参赛真实角色（非 NPC、非用户）各自的聊天里发一条结果消息。
  const realSeats = players.filter((p) => !p.isNpc && !p.isUser);
  for (const seat of realSeats) {
    const chatId = await getChatIdForCharacter(seat.id);
    if (!chatId) continue;

    const { contextNote, noticeText } = buildUndercoverCharacterMessage({
      row,
      players,
      selfSeatIndex: seat.seatIndex,
    });

    await db.messages.add({
      chatId,
      characterId: seat.id,
      sender: 'user',
      type: 'text_game_result',
      content: '',
      metadata: {
        gameId: GAME_ID_UNDERCOVER,
        gameTitle: GAME_TITLE_UNDERCOVER,
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