// src/apps/messages/interactions/divination/DivinationCardFace.jsx
//
// 卡面组件：牌面（文字 + 几何图案）、牌背（星形纹样）、以及设置面板里
// 用的迷你牌。颜色全部走 divination.css 里的主题变量，这里只决定结构。

import React from 'react';
import { getMotifPrimitives } from './divinationMotifs';
import { DECK_IDS, getCardById } from './divinationDecks';
import './divination.css';

const starPoints = (tips, outer, inner) => Array.from({ length: tips * 2 }, (_, index) => {
  const radius = index % 2 === 0 ? outer : inner;
  const angle = ((-90 + (180 / tips) * index) * Math.PI) / 180;
  return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(' ');

const getSeed = (card) => {
  if (typeof card?.number === 'number') return card.number;
  const digits = String(card?.id || '').replace(/\D/g, '');
  return Number(digits) || 0;
};

export const MotifSvg = ({ seed }) => (
  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    {getMotifPrimitives(seed).map(({ tag: Tag, attrs }, index) => (
      <Tag key={index} {...attrs} />
    ))}
  </svg>
);

// 牌背：塔罗八芒星，自创牌组六芒星
export const CardBackOrnament = ({ deckId }) => (
  <svg
    className="dv-back-ornament"
    viewBox="0 0 100 100"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="50" cy="50" r="42" />
    <circle cx="50" cy="50" r="34" strokeDasharray="2 4" />
    <polygon
      points={deckId === DECK_IDS.CUSTOM ? starPoints(6, 28, 13) : starPoints(8, 28, 12)}
    />
    <circle cx="50" cy="50" r="4" />
  </svg>
);

export const DivinationCardBack = ({ deckId }) => (
  <div className="dv-card dv-card--back">
    <CardBackOrnament deckId={deckId} />
  </div>
);

// 设置面板里牌组磁贴用的迷你牌：只有图案，没有文字
export const DivinationMiniCard = ({ seed, tone = 'tarot' }) => (
  <div className={`dv-card dv-card--${tone}`} aria-hidden="true">
    <div className="dv-card-motif">
      <MotifSvg seed={seed} />
    </div>
  </div>
);

export const DivinationCardFace = ({
  cardId,
  fallbackName,
  reversed = false,
  supportsReversed = false,
  index = 0,
}) => {
  const card = getCardById(cardId);

  if (!card) {
    return (
      <div className="dv-card dv-card--tarot dv-card--missing">
        <span className="dv-card-name">{fallbackName || '未知牌'}</span>
      </div>
    );
  }

  const isTarot = typeof card.number === 'number';
  const tone = isTarot ? 'tarot' : card.tone;
  const showReversed = supportsReversed && reversed;

  return (
    <div
      className={`dv-card dv-card--${tone}${showReversed ? ' dv-card--reversed' : ''}`}
    >
      <span className="dv-card-index">
        {isTarot ? String(card.number).padStart(2, '0') : String(index + 1).padStart(2, '0')}
      </span>

      <div className="dv-card-motif">
        <MotifSvg seed={getSeed(card)} />
      </div>

      <span className="dv-card-name">{card.name}</span>

      {supportsReversed && (
        <span className="dv-card-tag">{showReversed ? '逆位' : '正位'}</span>
      )}
    </div>
  );
};

export default DivinationCardFace;