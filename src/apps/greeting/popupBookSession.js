// src/apps/greeting/popupBookSession.js
//
// 角色在聊天里写了 [BOOK_WANT] 之后，回复写入完成、aiService.js 动态 import 本文件
// 并调用 runPopupBookSession，单独再调用一次模型做整本书（第二次调用）。
// 完整的做书提示词（人设、世界书、模型名单、排版规则）只在这一次里出现。
//
// 失败一律静默（只留 console.warn），不影响已经保存的正常回复；主动送的书
// 如果生成失败，popupBookService 会直接删掉那一行，不在书架上留一本用户没要过的"失败书"。

import Dexie from 'dexie';
import db from '../../db';
import { requestPopupBook } from './popupBookService';
import { canSendProactiveBook } from './popupBookDirective';
import { BOOK_PROACTIVE_DEFAULT_KIND, BOOK_SOURCE } from './popupBookConstants';

const HISTORY_LIMIT = 8;
const HISTORY_LINE_MAX = 120;

const getRecentHistoryText = async (chatId, character) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(HISTORY_LIMIT)
    .toArray();

  return rows
    .reverse()
    .filter((row) => row.type === 'text' && row.content)
    .map((row) => {
      const who = row.sender === 'user' ? '用户' : character?.name || '你';
      return `${who}：${String(row.content).replace(/\s+/g, ' ').slice(0, HISTORY_LINE_MAX)}`;
    })
    .join('\n');
};

export const runPopupBookSession = async ({ chatId, character, triggerReply, kind }) => {
  try {
    if (!chatId || !character) return { sent: false };
    if (!(await canSendProactiveBook(character.id))) return { sent: false, reason: 'cooldown' };

    const history = await getRecentHistoryText(chatId, character);

    await requestPopupBook({
      characterId: character.id,
      kind: kind || BOOK_PROACTIVE_DEFAULT_KIND,
      source: BOOK_SOURCE.PROACTIVE,
      instant: true,
      context: {
        history,
        trigger: String(triggerReply || '').slice(0, 200),
      },
    });

    return { sent: true };
  } catch (error) {
    console.warn('[PopupBookSession] 主动送立体书这一轮失败，已跳过：', error);
    return { sent: false };
  }
};