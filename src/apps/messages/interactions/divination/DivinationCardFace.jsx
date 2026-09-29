// src/apps/messages/interactions/divination/DivinationCardFace.jsx
//
// 单张牌的卡面：顶部序号 + 中间几何图案 + 底部牌名（塔罗另带正逆位标记）。
// 纯文字加几何图案，没有任何图片资源。逆位时只把图案倒转，牌名保持正向，
// 这样文字始终可读。

import React from 'react';
import { getCardById } from './divinationDecks';
import { getMotifPrimitives } from './divinationMotifs';
import './divination.css';

const ROMAN_STEPS = [
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
];

const toRoman = (value) => {
  if (!value) return '0';

  let rest = value;
  let output = '';

  ROMAN_STEPS.forEach(([symbol, amount]) => {
    while (rest >= amount) {
      output += symbol;
      rest -= amount;
    }
  });

  return output;
};

// 塔罗用自己的序号做种子；自创牌用 id 末尾的两位数字。
const getCardSeed = (card) => {
  if (typeof card.number === 'number') return card.number;
  return parseInt(String(card.id).split('_')[1], 10) || 0;
};

const getCardIndexLabel = (card) => {
  if (typeof card.number === 'number') return toRoman(card.number);
  return String(getCardSeed(card)).padStart(2, '0');
};

const getCardClassName = (card, reversed, reveal) => {
  const classes = ['divination-card'];

  if (typeof card.number === 'number') {
    classes.push('divination-card--tarot');
  } else if (card.tone === 'weighty') {
    classes.push('divination-card--weighty');
  } else {
    classes.push('divination-card--gentle');
  }

  if (reversed) classes.push('divination-card--reversed');
  if (reveal) classes.push('divination-card--reveal');

  return classes.join(' ');
};

export const DivinationCardFace = ({
  cardId,
  fallbackName = '',
  reversed = false,
  supportsReversed = false,
  reveal = false,
  index = 0,
}) => {
  const card = getCardById(cardId);

  if (!card) {
    return (
      <div className="divination-card divination-card--missing">
        <span className="divination-card-name">{fallbackName || '未知牌'}</span>
      </div>
    );
  }

  const primitives = getMotifPrimitives(getCardSeed(card));

  return (
    <div
      className={getCardClassName(card, reversed, reveal)}
      style={{ '--divination-index': index }}
    >
      <span className="divination-card-index">{getCardIndexLabel(card)}</span>

      <span className="divination-card-motif" aria-hidden="true">
        <svg viewBox="0 0 100 100" focusable="false">
          {primitives.map((primitive, primitiveIndex) => (
            React.createElement(primitive.tag, {
              key: primitiveIndex,
              ...primitive.attrs,
            })
          ))}
        </svg>
      </span>

      <span className="divination-card-name">{card.name}</span>

      {supportsReversed && (
        <span className="divination-card-tag">{reversed ? '逆位' : '正位'}</span>
      )}
    </div>
  );
};

export default DivinationCardFace;