// src/apps/textgames/uno/UnoCard.jsx
//
// 一张牌的渲染。优先用 unoCardImages.js 里填的图床外链（懒加载、异步解码，
// 同一个 URL 浏览器只存一份）；没填或加载失败就退回 CSS 画的牌面，所以
// 抠图没做完也能玩。牌面文字/图标的小工具也从这里导出，详情面板复用。

import React, { memo, useState } from 'react';

import { getCardImageUrl } from './unoCardImages';

export const COLOR_ZH = { black: '黑', red: '红', white: '白', darkblue: '深蓝' };

const VALUE_ZH = {
  skip: '禁止',
  reverse: '反转',
  draw2: '+2',
  wild4: '+4',
  wild: '变色',
};

const EFFECT_ZH = {
  skip: '下一位玩家这一轮不能出牌。',
  reverse: '出牌方向反过来。',
  draw2: '下一位玩家抽 2 张，并且跳过这一轮。',
  wild4: '指定下一轮颜色，下一位玩家抽 4 张并跳过。',
  wild: '指定下一轮的颜色，任何时候都能出。',
};

export const cardName = (card) =>
  card.color
    ? `${COLOR_ZH[card.color]} ${VALUE_ZH[card.value] || card.value}`
    : `万能牌 ${VALUE_ZH[card.value]}`;

export const cardEffect = (card) => EFFECT_ZH[card.value] || '数字牌，没有特殊效果。';

export const isSpecialCard = (card) =>
  ['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(card.value);

const SkipIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="3" />
    <path d="M6 18L18 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const ReverseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 8h13m0 0l-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0l3.5-3.5M7 16l3.5 3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SleepyFace = () => (
  <svg className="uno-card-face" viewBox="0 0 38 22" aria-hidden="true">
    <path d="M5 9q4 4 8 0M25 9q4 4 8 0" fill="none" stroke="#2a1020" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M16 16q3 2.5 6 0" fill="none" stroke="#2a1020" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="4" cy="15" r="2.6" fill="#ff9fbd" opacity=".8" />
    <circle cx="34" cy="15" r="2.6" fill="#ff9fbd" opacity=".8" />
  </svg>
);

const mainLabel = (card) => {
  if (card.value === 'skip') return <SkipIcon />;
  if (card.value === 'reverse') return <ReverseIcon />;
  if (card.value === 'draw2') return '+2';
  if (card.value === 'wild4') return '+4';
  if (card.value === 'wild') return 'WILD';
  return card.value;
};

const cornerLabel = (card) => {
  if (card.value === 'skip') return 'S';
  if (card.value === 'reverse') return 'R';
  if (card.value === 'draw2') return '+2';
  return card.value;
};

const UnoCard = memo(function UnoCard({
  card,
  back = false,
  className = '',
  style,
  selected = false,
  dimmed = false,
  onClick,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageFailed ? null : getCardImageUrl(card, back);

  const colorKey = back ? 'back' : card.color || 'wild';
  const classes = [
    'uno-card',
    back ? 'uno-card--back' : '',
    imageUrl ? 'uno-card--image' : '',
    selected ? 'uno-card--selected' : '',
    dimmed ? 'uno-card--dimmed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      data-c={colorKey}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={back ? '牌背' : cardName(card)}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <div className="uno-card-oval" />
          {back ? (
            <SleepyFace />
          ) : (
            <>
              {card.color && (
                <>
                  <span className="uno-card-corner uno-card-corner--tl">{cornerLabel(card)}</span>
                  <span className="uno-card-corner uno-card-corner--br">{cornerLabel(card)}</span>
                </>
              )}
              <div className="uno-card-mid">{mainLabel(card)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
});

export default UnoCard;