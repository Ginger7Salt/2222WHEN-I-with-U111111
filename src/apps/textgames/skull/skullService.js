// src/apps/textgames/skull/skullService.js
//
// 骷髅牌的数据层：对局结果写进 textGameMatches、按保留规则清理旧局、往每
// 一位真人角色的聊天里各补一条结果消息。
//
// 为什么不直接用 textGameSharedService.recordTextGameMatch：那个函数一局
// 对应一个角色（一行 + 一条消息），而骷髅牌一局有 1 到 3 位真人角色加 NPC
// 同桌，要“一局只存一行、消息发给每个真人角色的聊天”，所以这里单独写一
// 份，照 unoService.js 的做法，复用同一张表和同一个消息 type
// （text_game_result，聊天里的小药丸和 aiService 对它的读法都不用改）。
// textGameMatches 不需要升 db 版本：骷髅牌多出来的字段（characterIds、
// standings、moments 等）都是不建索引的附加字段。
//
// 骷髅牌的战绩是“整个骷髅牌一起算”，所以所有查询都只按 gameId 取，不按
// 角色拆。NPC 没有聊天，不收消息，也不进 characterIds。

import db from '../../../db';
import { getChatIdForCharacter, listCharactersForPicker } from '../textGameSharedService';
import {
  GAME_ID_SKULL,
  GAME_TITLE_SKULL,
  STRIPPED_FIELDS,
  USER_SEAT,
  buildCharacterMessage,
  buildMatchRow,
  planRetention,
} from './skullMatchFormat';

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

const loadSkullRows = () => db.textGameMatches.where('gameId').equals(GAME_ID_SKULL).toArray();

// 写完新的一局之后调用：清掉第 4、5 局的摘要，删掉超过 5 局的整行。
const applyRetention = async () => {
  const { toStrip, toDelete } = planRetention(await loadSkullRows());

  if (toDelete.length > 0) {
    await db.textGameMatches.bulkDelete(toDelete);
  }
  for (const id of toStrip) {
    await db.textGameMatches.update(id, STRIPPED_FIELDS);
  }
};

// players: [{ id, name, isNpc }]，座位 0 是用户，其余是真人角色或 NPC；
// 真人角色的 id 必须是 db.characters 的真实 id，至少要有一位。summary 是
// 引擎的 getMatchSummary(state)。返回写好的那一行（含 id）和时间。
export const recordSkullMatch = async ({ summary, players, durationMs }) => {
  if (!summary || summary.winnerIndex == null || !players || players.length < 2) return null;

  const characterSeats = players
    .map((p, i) => i)
    .filter((i) => i !== USER_SEAT && !players[i].isNpc);
  if (characterSeats.length === 0) return null;

  const endedAt = nowIso();
  const row = buildMatchRow({ summary, players, durationMs, endedAt });

  const id = await db.textGameMatches.add(row);
  await applyRetention();

  // 往每位真人角色各自的聊天里发一条结果消息；没有聊天的角色跳过这一步，
  // 对局本身的记录不受影响。
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
        gameId: GAME_ID_SKULL,
        gameTitle: GAME_TITLE_SKULL,
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
export const getRecentSkullMatches = async () => {
  const rows = await loadSkullRows();
  return rows.sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
};

// 战绩：用户视角，数的是表里还留着的最近几局。
export const getSkullStats = async () => {
  const rows = await getRecentSkullMatches();

  return rows.reduce(
    (stats, row) => {
      if (row.result === 'win') stats.wins += 1;
      else stats.losses += 1;
      return stats;
    },
    { wins: 0, losses: 0, total: rows.length }
  );
};

export { GAME_ID_SKULL, GAME_TITLE_SKULL, USER_SEAT };