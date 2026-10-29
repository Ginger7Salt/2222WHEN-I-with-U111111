// src/apps/greeting/greetingService.js
//
// 贺卡的数据层：存取、"制作中 -> 已送到"的状态推进、请求角色生成。
//
// 存储：db.greetingCards（db.version(106)，只有下面这些索引字段，其余全是
// 无索引的附加字段，见 src/db/index.js 里 v106 的注释）。
//
// 状态流转：
//   requestGreetingCard  -> status 'making'（立刻写入一行，书架上出现"制作中"）
//   后台生成完成          -> 写入 cover / inside / generatedAt，status 仍是 'making'
//   reconcileGreetingCards -> 到了 revealAt 且已经生成好，才改成 'ready'（"送到了"）
//   生成失败              -> status 'failed'，error 里是可以直接展示的原因
// 生成完成后不立刻送到，是为了让"TA 在做"有时间感（见 MAKE_DELAY_RANGE_MS）。
//
// 两条来源：
//   - 用户点名做（source requested）：走上面的"制作中 -> 延迟 -> 送到"，reconcile
//     只在贺卡页面挂载期间由页面自己的定时器驱动。
//   - 角色在聊天里主动送（source proactive，instant:true）：没有定时器。生成一完成就
//     直接改成 ready 并弹提示，失败则静默删除这一行。触发入口见 greetingDirective.js。

import db from '../../db';
import { generateGreetingContent } from './greetingAiService';
import { announceGreetingReady } from './greetingNotify';
import { GIFT_KIND, postGiftMessage } from './greetingGift';
import {
  GREETING_MODE,
  GREETING_SOURCE,
  GREETING_STATUS,
  MAKE_DELAY_RANGE_MS,
  MAKING_STALE_MS,
} from './greetingConstants';

/* ------------------------------ 变更订阅 ------------------------------ */

const listeners = new Set();

const notify = () => {
  listeners.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.error('greetingService listener error:', error);
    }
  });
};

// 页面订阅"贺卡列表有变化"，返回取消订阅函数。
export const subscribeGreetingCards = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/* -------------------------------- 读取 -------------------------------- */

// 按创建时间倒序，最新的在前。
export const listGreetingCards = async () => {
  const cards = await db.greetingCards.orderBy('createdAt').reverse().toArray();
  return cards;
};

export const getGreetingCard = async (id) => db.greetingCards.get(id);

/* -------------------------------- 写入 -------------------------------- */

export const markGreetingCardRead = async (id) => {
  await db.greetingCards.update(id, { isRead: 1, readAt: Date.now() });
  notify();
};

export const deleteGreetingCard = async (id) => {
  await db.greetingCards.delete(id);
  notify();
};

const randomRevealDelay = () => {
  const [min, max] = MAKE_DELAY_RANGE_MS;
  return Math.round(min + Math.random() * (max - min));
};

// 真正去调用角色生成，并把结果写回这一行。永远不抛出——失败会写成 failed。
const runGeneration = async (cardId) => {
  try {
    const card = await db.greetingCards.get(cardId);
    if (!card) return;

    const character = await db.characters.get(card.characterId);
    if (!character) {
      await db.greetingCards.update(cardId, {
        status: GREETING_STATUS.FAILED,
        error: '这张贺卡对应的角色已经不在角色库里了。',
      });
      return;
    }

    const content = await generateGreetingContent({
      character,
      occasion: card.occasion,
      userNote: card.userNote,
      mode: card.mode,
      context: card.context || null,
    });

    // 生成期间用户可能已经把这张卡删了，这时候不要把它"复活"。
    const stillThere = await db.greetingCards.get(cardId);
    if (!stillThere) return;

    await db.greetingCards.update(cardId, {
      mode: content.mode,
      cover: content.cover,
      inside: content.inside,
      generatedAt: Date.now(),
      error: '',
    });

    // 主动送的卡不走"制作中"的展示延迟：生成完就是送到了。
    if (card.instant) {
      await db.greetingCards.update(cardId, {
        status: GREETING_STATUS.READY,
        revealAt: Date.now(),
      });
      announceGreetingReady(character);
      await postGiftMessage({ kind: GIFT_KIND.CARD, itemId: cardId });
    }
  } catch (error) {
    console.warn('贺卡生成失败：', error);
    const stillThere = await db.greetingCards.get(cardId).catch(() => null);
    if (stillThere && stillThere.instant) {
      // 用户没要过的卡，失败了就悄悄删掉，不在书架上留"失败"的残骸。
      await db.greetingCards.delete(cardId);
    } else if (stillThere) {
      await db.greetingCards.update(cardId, {
        status: GREETING_STATUS.FAILED,
        error: String(error?.message || '贺卡没有做成。'),
      });
    }
  } finally {
    notify();
  }
};

// 请求角色做一张贺卡。立刻返回新卡的 id（书架上马上出现"制作中"），
// 生成在后台继续。
export const requestGreetingCard = async ({
  characterId,
  occasion = 'any',
  userNote = '',
  mode = GREETING_MODE.BLOCKS,
  source = GREETING_SOURCE.REQUESTED,
  instant = false,
  context = null,
}) => {
  const character = await db.characters.get(characterId);
  if (!character) {
    throw new Error('请先选一个角色。');
  }

  const now = Date.now();
  const id = await db.greetingCards.add({
    characterId,
    source,
    mode: mode === GREETING_MODE.FREE ? GREETING_MODE.FREE : GREETING_MODE.BLOCKS,
    occasion,
    userNote: String(userNote || '').trim().slice(0, 120),
    status: GREETING_STATUS.MAKING,
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

// 失败的卡重新做一次：沿用原来的场合和模式，展示延迟缩短一些。
export const retryGreetingCard = async (id) => {
  const card = await db.greetingCards.get(id);
  if (!card) return;

  const now = Date.now();
  await db.greetingCards.update(id, {
    status: GREETING_STATUS.MAKING,
    error: '',
    generatedAt: null,
    createdAt: now,
    revealAt: now + 15000,
  });
  notify();
  runGeneration(id);
};

// 推进状态：返回"刚刚变成 ready"的卡，给页面弹提示用。
//   - 已经生成好、并且到了 revealAt 的 making 卡 -> ready
//   - 一直没有生成结果、又过了很久的 making 卡（比如生成到一半 app 被关了）-> failed
export const reconcileGreetingCards = async (now = Date.now()) => {
  const makingCards = await db.greetingCards
    .where('status')
    .equals(GREETING_STATUS.MAKING)
    .toArray();

  const becameReady = [];
  let changed = false;

  for (const card of makingCards) {
    if (card.generatedAt && card.revealAt <= now) {
      await db.greetingCards.update(card.id, { status: GREETING_STATUS.READY });
      await postGiftMessage({ kind: GIFT_KIND.CARD, itemId: card.id });
      becameReady.push({ ...card, status: GREETING_STATUS.READY });
      changed = true;
    } else if (!card.generatedAt && now - card.createdAt > MAKING_STALE_MS) {
      await db.greetingCards.update(card.id, {
        status: GREETING_STATUS.FAILED,
        error: '制作中断了（可能是中途离开了页面），可以重试。',
      });
      changed = true;
    }
  }

  if (changed) notify();
  return becameReady;
};