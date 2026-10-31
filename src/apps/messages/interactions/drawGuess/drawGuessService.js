// src/apps/messages/interactions/drawGuess/drawGuessService.js
//
// 你画我猜走独立流程，不复用 interactionService.js 里通用的
// "先 pending 再 resolve"两步走：
// 用户在画布里画完、点发送之后，画和题目当场以"猜测中"状态插入一条
// 互动消息，随后异步让角色看画、猜答案。角色的回复稍后作为下一条
// 普通文字消息出现，卡片上同步显示猜测结果。

import db from '../../../../db';
import { INTERACTION_TYPES } from '../interactionRules';
import { generateDrawGuess } from './drawGuessAiService';
import {
  DRAW_GUESS_STATUS,
  buildDrawGuessContent,
} from './drawGuessRules';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

export const createDrawGuessMessage = async ({
  chatId,
  characterId,
  word,
  categoryId,
  categoryLabel,
  imageDataUrl,
}) => {
  const cleanWord = String(word || '').trim();

  if (
    !chatId
    || !characterId
    || !cleanWord
    || typeof imageDataUrl !== 'string'
    || !imageDataUrl.startsWith('data:image/')
  ) {
    return null;
  }

  const timestamp = new Date().toISOString();

  const metadata = {
    interactionType: INTERACTION_TYPES.DRAW_GUESS,
    status: DRAW_GUESS_STATUS.GUESSING,
    result: {
      word: cleanWord,
      categoryId: categoryId || '',
      categoryLabel: categoryLabel || '',
      image: imageDataUrl,
      guess: null,
      isCorrect: null,
    },
    createdAt: timestamp,
    guessStartedAt: timestamp,
    resolvedAt: null,
  };

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'interaction',
    // 猜出来之前 content 里不写题目，见 drawGuessRules.buildDrawGuessContent。
    content: buildDrawGuessContent(metadata),
    metadata,
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
  });

  dispatchLocalMessageEvent(chatId);

  // 猜测是异步的：画先落库并显示出来，角色的回复稍后出现；
  // 生成失败也只是卡片上出现"重新猜"，不影响画本身。
  void generateDrawGuess({ chatId, messageId });

  return messageId;
};

// 猜测失败或长时间没有结果时，用户点"重新让TA猜"。
export const retryDrawGuess = async (messageId) => {
  if (!messageId) return null;

  const message = await db.messages.get(messageId);
  if (!message?.chatId) return null;

  return generateDrawGuess({ chatId: message.chatId, messageId });
};

// 同义说法（比如"单车"对"自行车"）自动判不出来，用户可以手动改判。
export const setDrawGuessVerdict = async (messageId, isCorrect) => {
  if (!messageId) return false;

  const message = await db.messages.get(messageId);

  if (
    !message?.metadata
    || message.metadata.interactionType !== INTERACTION_TYPES.DRAW_GUESS
    || message.metadata.status !== DRAW_GUESS_STATUS.RESOLVED
  ) {
    return false;
  }

  const metadata = {
    ...message.metadata,
    result: {
      ...message.metadata.result,
      isCorrect: Boolean(isCorrect),
    },
  };

  await db.messages.update(messageId, {
    content: buildDrawGuessContent(metadata),
    metadata,
  });

  dispatchLocalMessageEvent(message.chatId);

  return true;
};
