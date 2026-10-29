// src/apps/greeting/greetingGift.js
//
// 贺卡 / 立体书"送到了"之后，在聊天室里留一条小卡片消息（type: 'greeting_gift'）。
// 做法和像素衣橱的礼物消息一致（见 pixelDollService.js 的 insertGiftChatMessage）：
// 它是 db.messages 里的一条真实消息，所以聊天列表的未读角标、消息预览、翻聊天记录都照常工作，
// 角色下一次回复时也能在聊天上下文里看到"我刚送了一份礼物"（aiService.js 里有对应的描述）。
//
// 什么时候写：
//   - 角色主动送（instant）：生成一完成就写；
//   - 用户点名做：到了 revealAt、状态变成 ready 的那一刻写（由 reconcile 触发，
//     所以点名的卡/书要等收藏夹页面打开、推进了状态才会出现在聊天室里）。
// 每个条目只写一次：条目上有 chatNoticeAt 标记，写之前先查、先标记，再写消息。
//
// 本文件只依赖 db，不 import 任何 service，避免循环依赖。

import db from '../../db';

export const GIFT_MESSAGE_TYPE = 'greeting_gift';
export const GIFT_KIND = { CARD: 'card', BOOK: 'book' };

const TABLES = {
  [GIFT_KIND.CARD]: () => db.greetingCards,
  [GIFT_KIND.BOOK]: () => db.popupBooks,
};

// 选哪个聊天：主动送的优先用触发它的那个聊天（context.chatId），否则用这个角色最近用过的聊天。
const resolveChat = async (item) => {
  const preferredId = item?.context?.chatId;
  if (preferredId != null) {
    const chat = await db.chats.get(preferredId);
    if (chat) return chat;
  }

  const chats = await db.chats.where('characterId').equals(item.characterId).toArray();
  if (!chats.length) return null;
  return chats.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
};

const describeGift = ({ kind, item }) => {
  const noun = kind === GIFT_KIND.BOOK ? '一本立体书' : '一张贺卡';
  const title = item?.cover?.title ? `「${item.cover.title}」` : '';
  return item?.source === 'proactive' ? `送了你${noun}${title}` : `做好了你点名要的${noun}${title}`;
};

// 同一个条目同时被两个入口触发（比如生成完成和状态推进几乎同时）时，后来的直接跳过，
// 否则"先查再标记"之间有空隙，会写出两条一样的消息。
const inflight = new Set();

// 写一条小卡片消息。永远不抛出；没有对应的聊天、或者已经写过，就什么都不做。
export const postGiftMessage = async ({ kind, itemId }) => {
  const lockKey = `${kind}:${itemId}`;
  if (inflight.has(lockKey)) return false;
  inflight.add(lockKey);

  try {
    const table = TABLES[kind]?.();
    if (!table) return false;

    const item = await table.get(itemId);
    if (!item || item.chatNoticeAt) return false;

    const chat = await resolveChat(item);
    if (!chat) return false;

    // 先标记再写消息：两个入口几乎同时触发时，只有先标记的那个会往下走。
    await table.update(itemId, { chatNoticeAt: Date.now() });

    const stamp = new Date().toISOString();
    await db.messages.add({
      chatId: chat.id,
      characterId: item.characterId,
      sender: 'character',
      type: GIFT_MESSAGE_TYPE,
      content: describeGift({ kind, item }),
      metadata: {
        kind,
        itemId,
        title: item.cover?.title || '',
        source: item.source || 'requested',
        mode: item.mode || '',
        opened: false,
      },
      isRead: false,
      timestamp: stamp,
    });
    await db.chats.update(chat.id, { updatedAt: stamp });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId: chat.id } }));
    }
    return true;
  } catch (error) {
    console.warn('往聊天室放礼物小卡片失败（不影响收藏夹里的卡/书）：', error);
    return false;
  } finally {
    inflight.delete(lockKey);
  }
};