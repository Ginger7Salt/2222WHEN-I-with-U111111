// src/apps/greeting/popupBookService.js
//
// 立体书的数据层：存取、"制作中 -> 已送到"的状态推进、请求角色生成。
// 结构完全对照 greetingService.js。
//
// 存储：db.popupBooks（db.version(107)，只有索引字段，其余都是无索引的附加字段）。
//
// 状态流转：
//   requestPopupBook   -> status 'making'（立刻写入一行，书架上出现"制作中"）
//   后台生成完成        -> 写入 cover / palette / sign / spreads / generatedAt，status 仍是 'making'
//   reconcilePopupBooks -> 到了 revealAt 且已经生成好，才改成 'ready'
//   生成失败            -> status 'failed'，error 里是可以直接展示的原因

import db from '../../db';
import { generatePopupBookContent, loadBookContext } from './popupBookAiService';
import { GIFT_KIND, postGiftMessage } from './greetingGift';
import {
  BOOK_KIND,
  BOOK_MAKE_DELAY_RANGE_MS,
  BOOK_MODE,
  BOOK_MAKING_STALE_MS,
  BOOK_SOURCE,
  BOOK_STATUS,
  DEFAULT_SPREAD_COUNT,
  getBookKind,
  normalizeBookMode,
} from './popupBookConstants';

/* ------------------------------ 变更订阅 ------------------------------ */

const listeners = new Set();

const notify = () => {
  listeners.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.error('popupBookService listener error:', error);
    }
  });
};

export const subscribePopupBooks = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/* ------------------------------ 送到提示 ------------------------------ */

// 直接派发 NotificationToast 监听的事件（理由见 greetingNotify.js：避免循环依赖）。
export const announcePopupBookReady = (character) => {
  if (typeof window === 'undefined') return;
  const name = character?.name || 'TA';

  window.dispatchEvent(
    new CustomEvent('WHEN_I_WITH_U_TOAST', {
      detail: {
        title: `${name} 送来一本立体书`,
        content: '去收藏夹翻开看看',
        iconType: 'bell',
        duration: 4000,
      },
    }),
  );

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(`${name} 送来一本立体书`, {
      body: '去收藏夹翻开看看',
      icon: character?.avatar || '/favicon.ico',
      tag: 'popup-book-ready',
    });
  } catch (error) {
    console.warn('立体书通知未能显示：', error);
  }
};

/* -------------------------------- 读取 -------------------------------- */

export const listPopupBooks = async () => db.popupBooks.orderBy('createdAt').reverse().toArray();

export const getPopupBook = async (id) => db.popupBooks.get(id);

/* -------------------------------- 写入 -------------------------------- */

export const markPopupBookRead = async (id) => {
  await db.popupBooks.update(id, { isRead: 1, readAt: Date.now() });
  notify();
};

export const deletePopupBook = async (id) => {
  await db.popupBooks.delete(id);
  notify();
};

const randomRevealDelay = () => {
  const [min, max] = BOOK_MAKE_DELAY_RANGE_MS;
  return Math.round(min + Math.random() * (max - min));
};

// 真正去调用角色生成，并把结果写回这一行。永远不抛出——失败会写成 failed。
const runGeneration = async (bookId) => {
  try {
    const book = await db.popupBooks.get(bookId);
    if (!book) return;

    const character = await db.characters.get(book.characterId);
    if (!character) {
      await db.popupBooks.update(bookId, {
        status: BOOK_STATUS.FAILED,
        error: '这本书对应的角色已经不在角色库里了。',
      });
      return;
    }

    // cheer 不带聊天上下文；memory / explain 取最近 30 条（每条已截断）。
    const context = getBookKind(book.kind).useChat ? await loadBookContext(book.characterId) : '';

    // 角色主动送的书：带上"为什么想送"（刚才那句回复 + 最近几句聊天）。
    // 已经读了完整聊天上下文的类型不再重复带那几句。
    const stored = book.context && typeof book.context === 'object' ? book.context : null;
    const moment =
      book.source === BOOK_SOURCE.PROACTIVE && stored
        ? {
            trigger: stored.trigger || '',
            history: context ? '' : stored.history || '',
          }
        : null;

    const isFree = normalizeBookMode(book.mode) === BOOK_MODE.FREE;

    let content;
    if (isFree) {
      // 自由发挥：整本书是角色写的 three.js 代码。重模块动态加载，积木库模式不付这个代价。
      const { generateFreeBookContent } = await import('./popupBookFreeAiService');
      content = await generateFreeBookContent({
        character,
        kind: book.kind,
        userNote: book.userNote,
        context,
        moment,
      });
    } else {
      content = await generatePopupBookContent({
        character,
        kind: book.kind,
        userNote: book.userNote,
        context,
        moment,
        spreadCount: DEFAULT_SPREAD_COUNT,
      });
    }

    // 生成期间用户可能已经把这本书删了，这时候不要把它"复活"。
    const stillThere = await db.popupBooks.get(bookId);
    if (!stillThere) return;

    await db.popupBooks.update(bookId, {
      cover: content.cover,
      palette: content.palette,
      sign: content.sign,
      spreads: content.spreads,
      freeCode: isFree ? content.freeCode : null,
      generatedAt: Date.now(),
      error: '',
    });

    if (book.instant) {
      await db.popupBooks.update(bookId, { status: BOOK_STATUS.READY, revealAt: Date.now() });
      announcePopupBookReady(character);
      await postGiftMessage({ kind: GIFT_KIND.BOOK, itemId: bookId });
    }
  } catch (error) {
    console.warn('立体书生成失败：', error);
    const stillThere = await db.popupBooks.get(bookId).catch(() => null);
    if (stillThere && stillThere.instant) {
      await db.popupBooks.delete(bookId);
    } else if (stillThere) {
      await db.popupBooks.update(bookId, {
        status: BOOK_STATUS.FAILED,
        error: String(error?.message || '立体书没有做成。'),
      });
    }
  } finally {
    notify();
  }
};

// 请求角色做一本立体书。立刻返回新书的 id，生成在后台继续。
export const requestPopupBook = async ({
  characterId,
  kind = BOOK_KIND.CHEER,
  userNote = '',
  source = BOOK_SOURCE.REQUESTED,
  instant = false,
  context = null,
  mode = BOOK_MODE.BLOCKS,
}) => {
  const character = await db.characters.get(characterId);
  if (!character) {
    throw new Error('请先选一个角色。');
  }

  const now = Date.now();
  const id = await db.popupBooks.add({
    characterId,
    source,
    kind: getBookKind(kind).id,
    userNote: String(userNote || '').trim().slice(0, 120),
    mode: normalizeBookMode(mode),
    status: BOOK_STATUS.MAKING,
    createdAt: now,
    revealAt: instant ? now : now + randomRevealDelay(),
    isRead: 0,
    instant: Boolean(instant),
    context: context || null,
  });

  notify();
  runGeneration(id);
  return id;
};

// 失败的书重新做一次：沿用原来的类型，展示延迟缩短一些。
export const retryPopupBook = async (id) => {
  const book = await db.popupBooks.get(id);
  if (!book) return;

  const now = Date.now();
  await db.popupBooks.update(id, {
    status: BOOK_STATUS.MAKING,
    error: '',
    generatedAt: null,
    createdAt: now,
    revealAt: now + 15000,
  });
  notify();
  runGeneration(id);
};

// 推进状态：返回"刚刚变成 ready"的书，给页面弹提示用。
export const reconcilePopupBooks = async (now = Date.now()) => {
  const makingBooks = await db.popupBooks.where('status').equals(BOOK_STATUS.MAKING).toArray();

  const becameReady = [];
  let changed = false;

  for (const book of makingBooks) {
    if (book.generatedAt && book.revealAt <= now) {
      await db.popupBooks.update(book.id, { status: BOOK_STATUS.READY });
      await postGiftMessage({ kind: GIFT_KIND.BOOK, itemId: book.id });
      becameReady.push({ ...book, status: BOOK_STATUS.READY });
      changed = true;
    } else if (!book.generatedAt && now - book.createdAt > BOOK_MAKING_STALE_MS) {
      await db.popupBooks.update(book.id, {
        status: BOOK_STATUS.FAILED,
        error: '制作中断了（可能是中途离开了页面），可以重试。',
      });
      changed = true;
    }
  }

  if (changed) notify();
  return becameReady;
};