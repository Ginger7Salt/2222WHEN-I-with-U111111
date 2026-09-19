// src/components/PebbleLoader.jsx

import React from 'react';
import './pebble-loader.css';

// 从大到小堆叠的 5 颗石头，宽高比、轻微旋转都留了一点随机感，
// 不是完全对称的机械堆叠，更像手边随手垒起来的禅意小石塔。
const PEBBLES = [
  { width: 5.6, height: 2.1, tilt: -3 },
  { width: 4.6, height: 1.9, tilt: 4 },
  { width: 3.7, height: 1.7, tilt: -5 },
  { width: 2.8, height: 1.5, tilt: 3 },
  { width: 1.9, height: 1.6, tilt: -2 }
];

export const PebbleLoader = () => {
  return (
    <section
      className="pebble-loader"
      role="img"
      aria-label="Small stones settle into a quiet cairn"
    >
      <div className="pebble-loader__halo" aria-hidden="true" />

      <div className="pebble-loader__masthead" aria-hidden="true">
        <span>QUIET ARRANGEMENT</span>
        <span>NO. 05</span>
      </div>

      <div className="pebble-loader__stage">
        <div className="pebble-loader__shadow" aria-hidden="true" />

        <div className="pebble-loader__stack" aria-hidden="true">
          {PEBBLES.map((pebble, index) => (
            <span
              key={index}
              className="pebble-loader__stone"
              style={{
                width: `${pebble.width}rem`,
                height: `${pebble.height}rem`,
                '--tilt': `${pebble.tilt}deg`,
                animationDelay: `${0.55 + index * 0.34}s`
              }}
            />
          ))}
        </div>

        <div className="pebble-loader__glow" aria-hidden="true" />
      </div>

      <p className="pebble-loader__note" aria-hidden="true">
        Small stones settle into balance.
      </p>
    </section>
  );
};

export default PebbleLoader;