// src/components/RoseLoader.jsx

import React from 'react';
import './rose-loader.css';

// 六片花瓣按圆周排开，每片都带一点角度+延迟，看起来像逐瓣绽放，
// 而不是所有花瓣同时弹出来。
const PETALS = [
  { angle: -60, delay: 1.3 },
  { angle: -25, delay: 1.42 },
  { angle: 10, delay: 1.54 },
  { angle: 45, delay: 1.66 },
  { angle: 80, delay: 1.78 },
  { angle: 130, delay: 1.9 },
];

// 稀疏的几颗星星，位置写死但看起来随意，营造"很小的星球"那种夜色感。
const STARS = [
  { top: '6%', left: '18%', delay: 0.2 },
  { top: '12%', left: '78%', delay: 0.9 },
  { top: '28%', left: '8%', delay: 1.6 },
  { top: '4%', left: '52%', delay: 0.5 },
  { top: '22%', left: '92%', delay: 1.2 },
];

export const RoseLoader = () => {
  return (
    <section
      className="rose-loader"
      role="img"
      aria-label="A small rose blooms beneath a glass dome on a tiny planet"
    >
      <div className="rose-loader__halo" aria-hidden="true" />

      <div className="rose-loader__masthead" aria-hidden="true">
        <span>ROSE UNDER GLASS</span>
        <span>NO. 06</span>
      </div>

      <div className="rose-loader__stage">
        {STARS.map((star, index) => (
          <span
            key={index}
            className="rose-loader__star"
            style={{
              top: star.top,
              left: star.left,
              animationDelay: `${star.delay}s`,
            }}
            aria-hidden="true"
          />
        ))}

        <div className="rose-loader__planet" aria-hidden="true" />

        <div className="rose-loader__stem-anchor" aria-hidden="true">
          <div className="rose-loader__bloom">
            {PETALS.map((petal, index) => (
              <span
                key={index}
                className="rose-loader__petal"
                style={{
                  '--angle': `${petal.angle}deg`,
                  animationDelay: `${petal.delay}s`,
                }}
              />
            ))}
            <span className="rose-loader__bud" />
          </div>

          <span
            className="rose-loader__leaf rose-loader__leaf--left"
            style={{ '--leaf-tilt': '-35deg' }}
          />
          <span
            className="rose-loader__leaf rose-loader__leaf--right"
            style={{ '--leaf-tilt': '35deg' }}
          />

          <div className="rose-loader__stem" />
        </div>

        <div className="rose-loader__dome" aria-hidden="true" />
        <div className="rose-loader__glow" aria-hidden="true" />
      </div>

      <p className="rose-loader__note" aria-hidden="true">
        It is the time you have wasted for your rose that makes your rose so
        important.
      </p>
    </section>
  );
};

export default RoseLoader;