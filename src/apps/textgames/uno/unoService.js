// src/apps/textgames/uno/unoService.js
//
// UNO 的数据层：对局结果写进 textGameMatches、按保留规则清理旧局、往两位
// 角色各自的聊天里补一条结果消息。
//
// 为什么不直接用 textGameSharedService.recordTextGameMatch：那个函数一局
// 对应一个角色（一行 + 一条消息），而 UNO 一局有两位角色同桌，要“一局只
// 存一行、消息发给两个聊天”，所以这里单独写一份，复用同一张表和同一个
// 消息 type（text_game_result，聊天里的小药丸和 aiService 对它的读法都不用
// 改）。textGameMatches 不需要升 db 版本：UNO 多出来的字段（characterIds、
// standings、moments 等）都是不建索引的附加字段。
//
// UNO 的战绩是“整个 UNO 一起算”（用户定的），所以所有查询都只按 gameId
// 取，不按角色拆。

import db from '../../../db';
import { getChatIdForCharacter, listCharactersForPicker } from '../textGameSharedService';
import {
  GAME_ID_UNO,
  GAME_TITLE_UNO,
  STRIPPED_FIELDS,
  USER_SEAT,
  buildCharacterMessage,
  buildMatchRow,
  planRetention,
} from './unoMatchFormat';

export { listCharactersForPicker };

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const loadUnoRows = () => db.textGameMatches.where('gameId').equals(GAME_ID_UNO).toArray();

// 写完新的一局之后调用：清掉第 4、5 局的摘要，删掉超过 5 局的整行。
const applyRetention = async () => {
  const { toStrip, toDelete } = planRetention(await loadUnoRows());

  if (toDelete.length > 0) {
    await db.textGameMatches.bulkDelete(toDelete);
  }
  for (const id of toStrip) {
    await db.textGameMatches.update(id, STRIPPED_FIELDS);
  }
};

// players: [{ id, name }]，座位 0 是用户（id 随意，比如 'user'），1、2 是
// 两位角色（id 必须是 db.characters 的真实 id）。summary 是引擎的
// getMatchSummary(state)。返回写好的那一行（含 id）和结算页要用的数据。
export const recordUnoMatch = async ({ summary, players, durationMs }) => {
  if (!summary || summary.winnerIndex == null || players?.length !== 3) return null;

  const endedAt = nowIso();
  const row = buildMatchRow({ summary, players, durationMs, endedAt });

  const id = await db.textGameMatches.add(row);
  await applyRetention();

  // 往两位角色各自的聊天里发一条结果消息；没有聊天的角色跳过这一步，
  // 对局本身的记录不受影响。
  const characterSeats = [1, 2];
  for (const seat of characterSeats) {
    const characterId = players[seat].id;
    const chatId = await getChatIdForCharacter(characterId);
    if (!chatId) continue;

    const { contextNote, noticeText } = buildCharacterMessage({
      row,
      players,
      selfSeat: seat,
    });

    await db.messages.add({
      chatId,
      characterId,
      sender: 'user',
      type: 'text_game_result',
      content: '',
      metadata: {
        gameId: GAME_ID_UNO,
        gameTitle: GAME_TITLE_UNO,
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

// 最近的对局，新的在前，最多 5 局（表里本来就只留这么多）。
export const getRecentUnoMatches = async () => {
  const rows = await loadUnoRows();
  return rows.sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
};

// 战绩：用户视角，数的是表里还留着的最近几局。
export const getUnoStats = async () => {
  const rows = await getRecentUnoMatches();

  return rows.reduce(
    (stats, row) => {
      if (row.result === 'win') stats.wins += 1;
      else stats.losses += 1;
      return stats;
    },
    { wins: 0, losses: 0, total: rows.length }
  );
};

export { GAME_ID_UNO, GAME_TITLE_UNO, USER_SEAT };