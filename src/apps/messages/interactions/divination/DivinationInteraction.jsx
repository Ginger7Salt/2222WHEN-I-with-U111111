// src/apps/messages/interactions/divination/DivinationInteraction.jsx
//
// 聊天里的占卜消息：显示问题、牌组与牌阵、抽到的牌。牌面在
// divinationService.js 里已经当场抽好，消息一插入就是"已完成"状态，
// 这里只负责展示；角色的解读会作为后一条普通文字消息出现。
//
// 新鲜消息（刚抽出来）会播放一次：牌叠在一起 -> 依次发出 -> 依次翻开。
// 旧消息直接显示翻开后的样子。轻触一张牌可以展开关键词与牌义。

import React, { useEffect, useRef, useState } from 'react';
import {
  DivinationCardBack,
  DivinationCardFace,
} from './DivinationCardFace';
import { DIVINATION_DECKS, getCardById } from './divinationDecks';
import { getSpread } from './divinationSpreads';
import './divination.css';

// 沿用项目里"新消息才播放一次性动画"的约定：每次渲染都重新算是否新鲜，
// 不用 ref 防重放。
const RECENT_DIVINATION_WINDOW_MS = 8000;
const DEAL_START_MS = 450;
const DEAL_STEP_MS = 110;
const FLIP_START_MS = 1400;
const FLIP_STEP_MS = 650;

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
  const metadata = message?.metadata || {};
  const result = metadata.result || {};
  const cards = Array.isArray(result.cards) ? result.cards : [];
  const total = cards.length;

  const createdAtMs = new Date(metadata.createdAt || message?.timestamp).getTime();
  const isFresh = Number.isFinite(createdAtMs)
    && Date.now() - createdAtMs < RECENT_DIVINATION_WINDOW_MS;

  // 只在挂载时决定是否播放；播放期间 isFresh 可能翻成 false，不能依赖它
  const shouldPlayRef = useRef(isFresh);
  const [progress, setProgress] = useState(() => (
    isFresh ? { dealt: 0, flipped: 0 } : { dealt: total, flipped: total }
  ));
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [shownIndex, setShownIndex] = useState(null);

  useEffect(() => {
    if (!shouldPlayRef.current || total === 0) return undefined;

    const timers = [];
    for (let i = 0; i < total; i += 1) {
      timers.push(setTimeout(
        () => setProgress((prev) => ({ ...prev, dealt: Math.max(prev.dealt, i + 1) })),
        DEAL_START_MS + DEAL_STEP_MS * i
      ));
      timers.push(setTimeout(
        () => setProgress((prev) => ({ ...prev, flipped: Math.max(prev.flipped, i + 1) })),
        FLIP_START_MS + FLIP_STEP_MS * i
      ));
    }

    return () => timers.forEach(clearTimeout);
  }, [total]);

  // 收起时先让内容保留到动画结束，避免文字瞬间消失
  useEffect(() => {
    if (selectedIndex !== null) {
      setShownIndex(selectedIndex);
      return undefined;
    }
    const timer = setTimeout(() => setShownIndex(null), 280);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  if (total === 0) return null;

  const deck = DIVINATION_DECKS[result.deckId];
  const spread = getSpread(result.spreadId);
  const supportsReversed = Boolean(deck?.supportsReversed);
  const isSingle = total === 1;
  const isPlaying = shouldPlayRef.current;

  const detailCard = shownIndex === null ? null : cards[shownIndex];
  const detail = detailCard ? getCardDetail(detailCard, supportsReversed) : null;
  const allUp = progress.flipped >= total;

  return (
    <article className="chat-interaction chat-interaction--divination chat-interaction--resolved divination-scope">
      <div className="interaction-heading">
        <span className="interaction-kicker">DIVINATION</span>
        <span className="interaction-title">
          {deck?.label || '占卜'} · {spread.label}
        </span>
      </div>

      {result.question && (
        <p className="dv-question">{result.question}</p>
      )}

      <div
        className={`dv-table ${isSingle ? 'dv-table--single' : 'dv-table--triple'}${
          isPlaying ? ' is-playing' : ''
        }`}
      >
        {cards.map((drawn, index) => {
          const isDealt = index < progress.dealt;
          const isUp = index < progress.flipped;
          const isSelected = selectedIndex === index;

          return (
            <button
              key={`${drawn.cardId}-${drawn.positionKey}`}
              type="button"
              className={`dv-slot${isDealt ? ' is-dealt' : ''}${isUp ? ' is-up' : ''}${
                isSelected ? ' is-selected' : ''
              }`}
              style={{ '--i': index, '--mid': (total - 1) / 2 }}
              disabled={!isUp}
              aria-pressed={isSelected}
              aria-label={`${drawn.positionLabel}：${drawn.name}${
                supportsReversed ? (drawn.reversed ? '逆位' : '正位') : ''
              }`}
              onClick={() => setSelectedIndex(isSelected ? null : index)}
            >
              <span className="dv-slot-label">{drawn.positionLabel}</span>
              <span className="dv-lift">
                <span className="dv-flipper">
                  <span className="dv-face dv-face--front">
                    <DivinationCardFace
                      cardId={drawn.cardId}
                      fallbackName={drawn.name}
                      reversed={drawn.reversed}
                      supportsReversed={supportsReversed}
                      index={index}
                    />
                  </span>
                  <span className="dv-face dv-face--back">
                    <DivinationCardBack deckId={result.deckId} />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={`dv-detail-wrap${selectedIndex !== null ? ' is-open' : ''}`}>
        <div className="dv-detail-clip">
          {detail && (
            <div className="dv-detail">
              <strong>{detail.title}</strong>
              <div className="dv-detail-chips">
                {detail.keywords.map((keyword) => (
                  <span key={keyword} className="dv-chip">{keyword}</span>
                ))}
              </div>
              <span>{detail.meaning}</span>
            </div>
          )}
        </div>
      </div>

      <div className="interaction-footer">
        <span>
          {allUp
            ? '轻触牌面可以看牌义，Ta 会结合牌面回答你。'
            : '牌正在翻开……'}
        </span>
      </div>
    </article>
  );
};

export default DivinationInteraction;