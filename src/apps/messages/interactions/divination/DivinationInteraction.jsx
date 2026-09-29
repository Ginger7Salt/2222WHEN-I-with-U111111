// src/apps/messages/interactions/divination/DivinationInteraction.jsx
//
// 聊天里的占卜消息：显示问题、牌组与牌阵、抽到的牌。牌面在
// divinationService.js 里已经当场抽好，消息一插入就是"已完成"状态，
// 这里只负责展示；角色的解读会作为后一条普通文字消息出现。
// 轻触一张牌可以展开它的关键词与牌义。

import React, { useState } from 'react';
import DivinationCardFace from './DivinationCardFace';
import { DIVINATION_DECKS, getCardById } from './divinationDecks';
import { getSpread } from './divinationSpreads';
import './divination.css';

// 沿用项目里"新消息才播放一次性动画"的约定：每次渲染都重新算是否新鲜，
// 不用 ref 防重放。
const RECENT_DIVINATION_WINDOW_MS = 8000;

const getCardDetail = (drawn, supportsReversed) => {
  const card = getCardById(drawn.cardId);
  if (!card) return null;

  const orientation = supportsReversed
    ? (drawn.reversed ? '逆位' : '正位')
    : '';

  if ('upright' in card) {
    return {
      title: `${drawn.positionLabel} · ${card.name}${orientation}`,
      keywords: drawn.reversed ? card.reversedKeywords : card.keywords,
      meaning: drawn.reversed ? card.reversed : card.upright,
    };
  }

  return {
    title: `${drawn.positionLabel} · ${card.name}`,
    keywords: card.keywords,
    meaning: card.meaning,
  };
};

export const DivinationInteraction = ({ message }) => {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const metadata = message?.metadata || {};
  const result = metadata.result || {};
  const cards = Array.isArray(result.cards) ? result.cards : [];

  if (cards.length === 0) return null;

  const deck = DIVINATION_DECKS[result.deckId];
  const spread = getSpread(result.spreadId);
  const supportsReversed = Boolean(deck?.supportsReversed);

  const createdAtMs = new Date(metadata.createdAt || message.timestamp).getTime();
  const isFresh = Number.isFinite(createdAtMs)
    && Date.now() - createdAtMs < RECENT_DIVINATION_WINDOW_MS;

  const selectedCard = selectedIndex === null ? null : cards[selectedIndex];
  const detail = selectedCard ? getCardDetail(selectedCard, supportsReversed) : null;

  return (
    <article className="chat-interaction chat-interaction--divination chat-interaction--resolved">
      <div className="interaction-heading">
        <span className="interaction-kicker">DIVINATION</span>
        <span className="interaction-title">
          {deck?.label || '占卜'} · {spread.label}
        </span>
      </div>

      {result.question && (
        <p className="divination-question">{result.question}</p>
      )}

      <div
        className={`divination-cards ${
          cards.length === 1 ? 'divination-cards--single' : 'divination-cards--triple'
        }`}
      >
        {cards.map((drawn, index) => (
          <button
            key={`${drawn.cardId}-${drawn.positionKey}`}
            type="button"
            className="divination-slot"
            aria-pressed={selectedIndex === index}
            aria-label={`${drawn.positionLabel}：${drawn.name}${
              supportsReversed ? (drawn.reversed ? '逆位' : '正位') : ''
            }`}
            onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
          >
            <span className="divination-slot-label">{drawn.positionLabel}</span>
            <DivinationCardFace
              cardId={drawn.cardId}
              fallbackName={drawn.name}
              reversed={drawn.reversed}
              supportsReversed={supportsReversed}
              reveal={isFresh}
              index={index}
            />
          </button>
        ))}
      </div>

      {detail && (
        <div className="divination-detail">
          <strong>{detail.title}</strong>
          <span className="divination-detail-keywords">
            {detail.keywords.join('、')}
          </span>
          <span>{detail.meaning}</span>
        </div>
      )}

      <div className="interaction-footer">
        <span>轻触牌面可以看牌义，Ta 会结合牌面回答你。</span>
      </div>
    </article>
  );
};

export default DivinationInteraction;