// src/components/HalloweenDiceLoader.jsx

import React from 'react';
import './halloween-dice-loader.css';

const stars = [
  { x: '-104px', y: '-56px', size: '4px', delay: '0s', type: 'dot' },
  { x: '-68px', y: '76px', size: '3px', delay: '0.02s', type: 'cross' },
  { x: '102px', y: '-47px', size: '5px', delay: '0.04s', type: 'dot' },
  { x: '82px', y: '68px', size: '3px', delay: '0.06s', type: 'cross' },
  { x: '-128px', y: '16px', size: '3px', delay: '0.08s', type: 'dot' },
  { x: '132px', y: '12px', size: '3px', delay: '0.1s', type: 'dot' },
  { x: '-24px', y: '-102px', size: '3px', delay: '0.03s', type: 'dot' },
  { x: '25px', y: '104px', size: '4px', delay: '0.05s', type: 'dot' }
];

// 六个面均为手绘线条 SVG 图标，不使用任何 emoji 字符。
const DiceFaceIcon = ({ shape }) => {
  switch (shape) {
    case 'skull':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5C7.5 2.5 4.5 5.8 4.5 10c0 2.4 1 3.9 2 4.9v3a1 1 0 001 1h1v2h2v-2h3v2h2v-2h1a1 1 0 001-1v-3c1-1 2-2.5 2-4.9 0-4.2-3-7.5-7.5-7.5z" />
          <circle cx="9.2" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="14.8" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <path d="M10.5 14h3" />
        </svg>
      );
    case 'eclipse':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.5 3a9 9 0 100 18 7.2 7.2 0 010-18z" />
        </svg>
      );
    case 'bat':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 7.2c-1.1-2-3.8-3-6.4-2 .9 1 1.4 1.9 1.4 2.9-2 0-3.8 1-4.8 2.8 1.9-.1 3.3.4 4.3 1.4-1.9.3-3.2 1.6-3.8 3.4 2-.9 3.8-.9 5.2.1.5 1.5 1.8 2.6 3.1 3.4 1.3-.8 2.6-1.9 3.1-3.4 1.4-1 3.2-1 5.2-.1-.6-1.8-1.9-3.1-3.8-3.4 1-1 2.4-1.5 4.3-1.4-1-1.8-2.8-2.8-4.8-2.8 0-1 .5-1.9 1.4-2.9-2.6-1-5.3 0-6.4 2z" />
        </svg>
      );
    case 'marker':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="6" y1="9" x2="18" y2="9" />
        </svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.3 2.2c.9 2.8-1.8 3.9-1.8 6.6a2.7 2.7 0 005.4 0c0-.9-.4-1.8-.9-2.7 1.9 1.1 3.5 3.6 3.5 6.3a6.5 6.5 0 11-13 0c0-4.6 3.7-6.4 6.8-10.2z" />
        </svg>
      );
    case 'coffin':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.2 2.5h5.6l2.7 5.8v11.2a1 1 0 01-1 1H7.5a1 1 0 01-1-1V8.3l2.7-5.8z" />
          <line x1="7.6" y1="8.3" x2="16.4" y2="8.3" />
        </svg>
      );
  }
};

const diceFaces = [
  { className: 'halloween-dice-loader__face--front', shape: 'skull', label: 'Hollow smile' },
  { className: 'halloween-dice-loader__face--back', shape: 'eclipse', label: 'Blood eclipse' },
  { className: 'halloween-dice-loader__face--right', shape: 'bat', label: 'Night wing' },
  { className: 'halloween-dice-loader__face--left', shape: 'marker', label: 'Grave marker' },
  { className: 'halloween-dice-loader__face--top', shape: 'flame', label: 'Will-o-wisp' },
  { className: 'halloween-dice-loader__face--bottom', shape: 'coffin', label: 'Restless coffin' }
];

export const HalloweenDiceLoader = () => {
  return (
    <section
      className="halloween-dice-loader"
      role="img"
      aria-label="一枚万圣节诅咒骰子正在翻滚"
    >
      <div className="halloween-dice-loader__halo" aria-hidden="true" />

      <div className="halloween-dice-loader__masthead" aria-hidden="true">
        <span>CURSED INVENTORY</span>
        <span>NO. 07</span>
      </div>

      <div className="halloween-dice-loader__stage">
        <div className="halloween-dice-loader__shadow" aria-hidden="true" />

        <div className="halloween-dice-loader__stars" aria-hidden="true">
          <span className="halloween-dice-loader__impact-ring" />

          {stars.map((star, index) => (
            <span
              key={`${star.x}-${star.y}-${index}`}
              className={`halloween-dice-loader__star ${
                star.type === 'cross' ? 'halloween-dice-loader__star--cross' : ''
              }`}
              style={{
                '--star-x': star.x,
                '--star-y': star.y,
                '--star-size': star.size,
                '--star-delay': star.delay
              }}
            />
          ))}
        </div>

        <div className="halloween-dice-loader__thrower" aria-hidden="true">
          <div className="halloween-dice-loader__cube">
            {diceFaces.map((face) => (
              <div
                key={face.className}
                className={`halloween-dice-loader__face ${face.className}`}
                title={face.label}
              >
                <span className="halloween-dice-loader__symbol">
                  <DiceFaceIcon shape={face.shape} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="halloween-dice-loader__note" aria-hidden="true">
        Six faces, one verdict for All Hallows.
      </p>
    </section>
  );
};

export default HalloweenDiceLoader;