// src/apps/textgames/liarsDice/liarsDiceService.js
//
// 吹牛骰子的数据层：对局结束后，往每位“真角色”各自的聊天里补一条结果
// 消息。跟 uno/unoService.js、texas/texasService.js 的区别：这个游戏不存
// 战绩（用户定的），所以这里没有 db.textGameMatches 的读写，也没有保留
// 规则，只写 db.messages。复用同一个消息 type（text_game_result），聊天里
// 的小药丸和 aiService 对它的读法都不用改。
//
// 虚拟 NPC（用户选的角色不够时补位的）没有聊天，直接跳过。任何一位角色
// 的消息写失败都只打个警告，不影响别的角色，也不影响结算页拿到结果。

import db from '../../../db';
import { getChatIdForCharacter } from '../textGameSharedService';
import { isNpcId } from './liarsDiceNpcs';
import {
  GAME_ID_LIARS_DICE,
  GAME_TITLE_LIARS_DICE,
  USER_SEAT,
  buildCharacterMessage,
  buildMatchResult,
} from './liarsDiceMatchFormat';

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

const CHARACTER_SEATS = [1, 2, 3];

// table：引擎的最终 state；players：[{ id, name }]，下标 0 是用户，
// 1 到 3 是三位角色；endReason：'finished' | 'busted' | 'left'。
// 返回结算页要用的结果对象（总是能返回，哪怕消息一条都没写成）。
export const recordLiarsDiceMatch = async ({ table, players, stake, endReason, durationMs }) => {
  const endedAt = nowIso();
  const result = buildMatchResult({ table, players, stake, endReason, durationMs, endedAt });

  for (const seat of CHARACTER_SEATS) {
    const characterId = players[seat]?.id;
    if (!characterId || isNpcId(characterId)) continue;

    try {
      const chatId = await getChatIdForCharacter(characterId);
      if (!chatId) continue;

      const { contextNote, noticeText } = buildCharacterMessage({
        result,
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
          gameId: GAME_ID_LIARS_DICE,
          gameTitle: GAME_TITLE_LIARS_DICE,
          result: result.result,
          contextNote,
          noticeText,
        },
        isRead: true,
        timestamp: endedAt,
      });

      await db.chats.update(chatId, { updatedAt: endedAt });
      dispatchLocalMessageEvent(chatId);
    } catch (err) {
      console.warn('[LiarsDice] 结果回传聊天失败', characterId, err);
    }
  }

  return result;
};

export { GAME_ID_LIARS_DICE, GAME_TITLE_LIARS_DICE, USER_SEAT };