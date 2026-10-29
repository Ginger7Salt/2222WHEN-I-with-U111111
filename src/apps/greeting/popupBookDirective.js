// src/apps/greeting/popupBookDirective.js
//
// 角色"主动送立体书"。写法和 greetingDirective.js / bubbleStyleDirective.js 一样是两段式：
//   1. 聊天提示词里只常驻一小段说明（本文件的 NOTE，几句话），并且只在没有处于冷却期时才带；
//      书的完整写法（模型名单、参数、排版规则）完全不进聊天提示词；
//   2. 角色想送，就在回复末尾单独一行写 [BOOK_WANT] 或 [BOOK_WANT: 类型]，本文件把标签
//      一律从正文摘掉（不管有没有生效），告诉调用方"想送"和挑的类型；
//   3. 调用方（aiService.js）在回复写入之后，动态 import popupBookSession.js 另外调用一次
//      模型，完整的做书规则只在那一次里给。
// 没有定时器：什么时候送完全由聊天里角色自己的回复触发。冷却和贺卡各算各的。
//
// 本文件只依赖 db 和常量，不 import aiService / popupBookService（避免循环依赖）。

import db from '../../db';
import {
  BOOK_KINDS,
  BOOK_MODE,
  BOOK_PROACTIVE_COOLDOWN_MS,
  BOOK_PROACTIVE_DEFAULT_KIND,
  BOOK_SOURCE,
} from './popupBookConstants';

const BOOK_WANT_PATTERN = /\s*\[BOOK_WANT(?::\s*([^\]]*))?\]\s*/i;
const BOOK_WANT_PATTERN_ALL = /\s*\[BOOK_WANT(?::\s*[^\]]*)?\]\s*/gi;

// 标签里写的类型用这几个短名字（比书架上的完整名字好写）。
const KIND_TAG_NAMES = {
  cheer: '哄你',
  memory: '回忆',
  explain: '讲解',
};

const kindTagList = BOOK_KINDS.map((item) => `[BOOK_WANT: ${KIND_TAG_NAMES[item.id]}]`).join('、');

export const BOOK_PROMPT_NOTE = `
【可选行为：送一本立体书】
如果你此刻特别想亲手给用户做一本立体书（一本摊开的双页书，翻开后有东西从纸面立起来；比如想哄TA、想一起回忆点什么、想给TA讲明白一件事），可以自己决定送，不用征求同意；没有这个念头就不要写，不要为了送而送。
想送就在回复正文最后单独一行写（用户看不到这行）：[BOOK_WANT]
也可以带上类型：${kindTagList}。
想让这本书不受现成积木限制、由你自己写整个画面，就在后面加上「自由」，比如 [BOOK_WANT: 回忆 自由]（更费时间，只在你真有想法时用）。
用户直接要你做立体书时也这样回应。
重要：这次回复里不要写书的内容，也不要描述书长什么样，只像平时聊天一样接话再加标签；真正做书是系统另外单独问你的那一次。`;

// 是否允许这个角色现在主动送一本：同一个角色上一本主动送的书超过冷却时间，
// 并且没有一本主动送的书还在制作中。
export const canSendProactiveBook = async (characterId, now = Date.now()) => {
  if (characterId == null) return false;

  const rows = await db.popupBooks.where('characterId').equals(characterId).toArray();

  return !rows.some(
    (book) =>
      book.source === BOOK_SOURCE.PROACTIVE &&
      now - (book.createdAt || 0) < BOOK_PROACTIVE_COOLDOWN_MS,
  );
};

// 聊天提示词用：冷却期内返回空字符串，不带这段说明。
export const buildBookPromptNote = async ({ characterId }) => {
  try {
    return (await canSendProactiveBook(characterId)) ? BOOK_PROMPT_NOTE : '';
  } catch (error) {
    console.warn('[PopupBookDirective] 读取冷却状态失败，本次不带说明：', error);
    return '';
  }
};

// 标签里写的类型 -> 类型 id。没写或认不出来就用默认类型。
export const matchBookKindId = (rawName) => {
  const name = String(rawName || '').trim().toLowerCase();
  if (!name) return BOOK_PROACTIVE_DEFAULT_KIND;

  const exact = BOOK_KINDS.find(
    (item) => item.id === name || item.label === name || KIND_TAG_NAMES[item.id] === name,
  );
  if (exact) return exact.id;

  const loose = BOOK_KINDS.find(
    (item) =>
      name.includes(KIND_TAG_NAMES[item.id]) ||
      name.includes(item.label) ||
      (name.length >= 2 && item.label.includes(name)),
  );
  return loose ? loose.id : BOOK_PROACTIVE_DEFAULT_KIND;
};

// 标签里带了「自由」（或 free）就是自由发挥模式。
export const matchBookMode = (rawName) =>
  /自由|free/i.test(String(rawName || '')) ? BOOK_MODE.FREE : BOOK_MODE.BLOCKS;

// 摘标签。返回去掉标签后的正文，以及角色是否想送、挑的类型和做法。
export const applyBookDirective = ({ content }) => {
  const rawContent = String(content || '');
  const match = BOOK_WANT_PATTERN.exec(rawContent);

  return {
    content: rawContent.replace(BOOK_WANT_PATTERN_ALL, ''),
    wantsBook: Boolean(match),
    kind: match ? matchBookKindId(match[1]) : BOOK_PROACTIVE_DEFAULT_KIND,
    mode: match ? matchBookMode(match[1]) : BOOK_MODE.BLOCKS,
  };
};