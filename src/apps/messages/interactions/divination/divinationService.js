// src/apps/messages/interactions/divination/divinationService.js
//
// 占卜小卡片走独立流程，不复用 interactionService.js 里通用的
// "先 pending 再 resolve"两步走：
// 用户在设置面板里选好牌组、牌阵、写好问题之后，牌在这里当场抽好，
// 直接以"已完成"状态插入一条互动消息，随后异步让角色结合牌面解读。

import db from '../../../../db';
import { INTERACTION_TYPES } from '../interactionRules';
import {
  DIVINATION_DECKS,
  getDeckCards,
} from './divinationDecks';
import { drawCardsForSpread, getSpread } from './divinationSpreads';
import { generateDivinationReading } from './divinationAiService';

export const MAX_DIVINATION_QUESTION_LENGTH = 200;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const describeDrawnCard = (card, supportsReversed) => {
  const orientation = supportsReversed
    ? (card.reversed ? '逆位' : '正位')
    : '';

  return `${card.positionLabel}：${card.name}${orientation}`;
};

/*
 * 消息的 content 会被聊天上下文和记忆系统当作普通文本读到，所以这里
 * 写成一句完整的、带上问题和牌面的摘要，不用额外改动记忆管线。
 */
const buildMessageContent = ({ question, deck, spread, cards }) => {
  const cardText = cards
    .map((card) => describeDrawnCard(card, deck.supportsReversed))
    .join('；');

  return `占卜了一个问题：「${question}」（${deck.label}，${spread.label}），抽到：${cardText}`;
};

export const createDivinationMessage = async ({
  chatId,
  characterId,
  question,
  deckId,
  spreadId,
}) => {
  const cleanQuestion = String(question || '')
    .trim()
    .slice(0, MAX_DIVINATION_QUESTION_LENGTH);

  const deck = DIVINATION_DECKS[deckId];

  if (!chatId || !characterId || !cleanQuestion || !deck) {
    return null;
  }

  const spread = getSpread(spreadId);

  const cards = drawCardsForSpread({
    cards: getDeckCards(deck.id),
    spreadId: spread.id,
    supportsReversed: deck.supportsReversed,
  });

  if (cards.length === 0) return null;

  const timestamp = new Date().toISOString();

  const result = {
    question: cleanQuestion,
    deckId: deck.id,
    spreadId: spread.id,
    cards,
  };

  const metadata = {
    interactionType: INTERACTION_TYPES.DIVINATION,
    status: 'resolved',
    result,
    createdAt: timestamp,
    resolvedAt: timestamp,
  };

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'interaction',
    content: buildMessageContent({
      question: cleanQuestion,
      deck,
      spread,
      cards,
    }),
    metadata,
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
  });

  dispatchLocalMessageEvent(chatId);

  // 解读是异步的：牌面已经先落库并显示出来，角色的解读稍后作为
  // 下一条普通文字消息出现；生成失败也只是安静地没有这条消息。
  void generateDivinationReading({
    chatId,
    divinationMetadata: metadata,
  });

  return { messageId, result };
};