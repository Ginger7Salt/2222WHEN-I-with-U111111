// src/apps/textgames/skull/SkullCard.jsx
//
// 骷髅牌的圆形骨牌渲染：牌背、蔷薇、骷髅三种面，图案是内联 SVG（不依赖
// 任何图片外链）。两个组件：
// - SkullCard：一枚骨牌。有两种用法：
//     立体翻转的牌（默认）：牌背永远在，翻开后才渲染正面，用在桌上的牌堆；
//     平放的牌（flat）：只显示正面，用在手牌托盘和弃牌选择里。
// - SkullPile：一摞牌，从下到上叠放，顶部那几张按 flipped 的数量翻开。
//   没翻开的牌只带牌背，不会把蔷薇还是骷髅的信息放进界面里；自己的牌堆
//   牌背角上多一个小圆点（绿是蔷薇、红是骷髅），只有自己看得见。

import React, { memo } from 'react';

export const KIND_ZH = { rose: '蔷薇', skull: '骷髅' };

const BackSigil = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="38" />
    <polygon points="50,12 88,50 50,88 12,50" />
    <circle cx="50" cy="50" r="9" />
  </svg>
);

const RoseIcon = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 18 C60 34 76 40 82 50 C76 60 60 66 50 82 C40 66 24 60 18 50 C24 40 40 34 50 18 Z" />
    <circle cx="50" cy="50" r="12" />
    <circle cx="50" cy="50" r="3.5" />
  </svg>
);

const SkullIcon = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="M25 45 C25 25 75 25 75 45 C75 58 68 62 65 72 L35 72 C32 62 25 58 25 45 Z" />
    <circle cx="38" cy="46" r="7" />
    <circle cx="62" cy="46" r="7" />
    <polygon points="50,56 46,62 54,62" />
    <line x1="42" y1="68" x2="42" y2="72" />
    <line x1="50" y1="68" x2="50" y2="72" />
    <line x1="58" y1="68" x2="58" y2="72" />
  </svg>
);

const Front = ({ kind }) => (
  <div className={`skull-face skull-face--${kind}`}>
    {kind === 'rose' ? <RoseIcon /> : <SkullIcon />}
  </div>
);

const SkullCard = memo(function SkullCard({
  kind = null, // 'rose' | 'skull'；立体牌没翻开时不要传
  faceUp = false, // 立体牌是否翻开
  flat = false, // 平放，只显示正面（kind 必填）
  mark = null, // 立体牌背面角上的小圆点：'rose' | 'skull'，只给自己的牌堆用
  selected = false,
  glow = false,
  hit = false,
  dimmed = false,
  className = '',
  style,
  onClick,
}) {
  const classes = [
    'skull-tile',
    flat ? 'skull-tile--flat' : '',
    faceUp ? 'skull-tile--flipped' : '',
    selected ? 'skull-tile--sel' : '',
    glow ? 'skull-tile--glow' : '',
    hit ? 'skull-tile--hit' : '',
    dimmed ? 'skull-tile--dim' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const label = flat || faceUp ? KIND_ZH[kind] || '骨牌' : '牌背';

  return (
    <div
      className={classes}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
    >
      {flat ? (
        <Front kind={kind} />
      ) : (
        <>
          <div className="skull-face skull-face--back">
            <BackSigil />
            {mark && <i className={`skull-mark skull-mark--${mark}`} />}
          </div>
          {faceUp && kind && <Front kind={kind} />}
        </>
      )}
    </div>
  );
});

// cards: 从下到上的牌（{ id, kind }）；flipped: 从最上面数起已翻开几张。
export const SkullPile = memo(function SkullPile({
  cards,
  flipped = 0,
  mine = false,
  glow = false,
  onClick,
  className = '',
}) {
  const n = cards.length;

  return (
    <div className={`skull-pile ${className}`} onClick={onClick}>
      {cards.map((card, i) => {
        const fromTop = n - 1 - i;
        const isFlipped = fromTop < flipped;
        const rot = ((i * 7) % 5) - 2;

        return (
          <SkullCard
            key={card.id}
            kind={isFlipped ? card.kind : null}
            faceUp={isFlipped}
            mark={mine && !isFlipped ? card.kind : null}
            glow={glow && fromTop === 0}
            hit={isFlipped && card.kind === 'skull'}
            style={{ top: `${22 - i * 5}px`, '--skull-rot': `${rot}deg` }}
          />
        );
      })}
      {n > 0 && <span className="skull-count">{n}</span>}
    </div>
  );
});

export default SkullCard;