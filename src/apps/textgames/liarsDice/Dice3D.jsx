// src/apps/textgames/liarsDice/Dice3D.jsx
//
// 吹牛骰子界面里用到的 3D 骰子相关组件：
// - Die3D：一颗 CSS 立方体骰子（value 决定哪一面朝前）；
// - HandDice：你的五颗骰子，骰盅揭开时每颗跳一下并翻滚落定；
// - AltarDie：叫点区的大骰子，叫点变化时翻滚到新点数；
// - CupSymbols：全屏演出里用到的骰盅图形（SVG symbol），演出组件各自引入。
// 样式见 liarsDiceFx.css。

import React, { forwardRef, useEffect, useRef } from 'react';

import { FACES, PIPS, createTimeline, oriStr, tumbleTo } from './diceFx';

const FaceSvg = ({ value }) => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    {PIPS[value].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} className={value === 1 ? 'tld-pw' : 'tld-pp'} />
    ))}
  </svg>
);

export const Die3D = forwardRef(function Die3D({ value, size = 50, gold = false, className = '' }, ref) {
  return (
    <div
      ref={ref}
      className={`tld-d3 ${gold ? 'tld-gold' : ''} ${className}`}
      style={{ '--s': `${size}px` }}
      data-value={value}
    >
      <div className="tld-cube" style={{ transform: oriStr(value) }}>
        {FACES.map(([name, v]) => (
          <div key={name} className={`tld-face tld-f-${name}`}>
            <FaceSvg value={v} />
          </div>
        ))}
      </div>
    </div>
  );
});

// lifted 变成 true（骰盅揭开）时，五颗骰子依次跳一下并翻滚落定。
export const HandDice = ({ dice, lifted }) => {
  const refs = useRef([]);

  useEffect(() => {
    if (!lifted) return undefined;
    const tl = createTimeline();
    refs.current.forEach((el, i) => {
      if (!el) return;
      tl.play(
        el,
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)', offset: 0.45 }, { transform: 'translateY(0)' }],
        { duration: 420, delay: 140 + i * 60, fill: 'none', easing: 'ease-out' }
      );
      tumbleTo(tl, el, Number(el.dataset.value), 700, 1);
    });
    return () => tl.cancel();
  }, [lifted]);

  return (
    <div className="tld-hand-row">
      {dice.map((v, i) => (
        <Die3D
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={v}
          size={50}
        />
      ))}
    </div>
  );
};

// 叫点变化时（同一个组件实例里 value 变了）翻滚到新点数；刚出现时不翻。
export const AltarDie = ({ value, size = 66 }) => {
  const ref = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return undefined;
    }
    const tl = createTimeline();
    tumbleTo(tl, ref.current, value, 820, 2);
    return () => tl.cancel();
  }, [value]);

  return <Die3D ref={ref} value={value} size={size} />;
};

// 摇骰全屏演出用的骰盅图形：口朝上的碗。
export const CupSymbols = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <linearGradient id="tld-gGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6e6b6" />
        <stop offset=".5" stopColor="#c5a059" />
        <stop offset="1" stopColor="#8a6a2c" />
      </linearGradient>
      <linearGradient id="tld-gIvory" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#e6dec9" />
        <stop offset=".35" stopColor="#fffdf7" />
        <stop offset="1" stopColor="#dfd5bf" />
      </linearGradient>
      <linearGradient id="tld-gInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b2118" />
        <stop offset="1" stopColor="#0f0b08" />
      </linearGradient>
    </defs>
    <symbol id="tld-sym-bowl" viewBox="0 0 300 170">
      <path d="M12 44 Q14 160 150 164 Q286 160 288 44 Z" fill="url(#tld-gIvory)" stroke="#9e7d3b" strokeWidth="2.5" />
      <path d="M30 92 Q150 126 270 92" fill="none" stroke="url(#tld-gGold)" strokeWidth="5" />
      <path d="M48 126 Q150 154 252 126" fill="none" stroke="url(#tld-gGold)" strokeWidth="3.5" />
      <ellipse cx="150" cy="44" rx="138" ry="24" fill="url(#tld-gInner)" stroke="url(#tld-gGold)" strokeWidth="5" />
      <ellipse cx="150" cy="40" rx="118" ry="15" fill="none" stroke="rgba(255,235,180,.28)" strokeWidth="2" />
      <path d="M136 150 V118 Q150 96 164 118 V150 Z" fill="none" stroke="#9e7d3b" strokeWidth="3" />
      <line x1="150" y1="102" x2="150" y2="150" stroke="#9e7d3b" strokeWidth="2" />
      <path d="M42 62 Q40 112 68 142" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="6" strokeLinecap="round" />
    </symbol>
  </svg>
);