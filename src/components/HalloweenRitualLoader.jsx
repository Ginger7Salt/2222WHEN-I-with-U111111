// src/components/HalloweenRitualLoader.jsx

import React from 'react';
import './halloween-ritual-loader.css';

export const HalloweenRitualLoader = () => {
  return (
    <section
      className="halloween-ritual-loader"
      role="img"
      aria-label="一座黑曜石石碑正悬浮，经历一场缓慢的日食"
    >
      <div className="halloween-ritual-loader__halo" aria-hidden="true" />

      <div className="halloween-ritual-loader__masthead" aria-hidden="true">
        <span>SEALED SECTOR</span>
        <span>NO. 13</span>
      </div>

      <div className="halloween-ritual-loader__stage">
        <div
          className="halloween-ritual-loader__ring halloween-ritual-loader__ring--outer"
          aria-hidden="true"
        >
          <svg viewBox="0 0 220 220">
            <path
              id="halloweenRitualRingPath"
              d="M 110, 110 m -98, 0 a 98,98 0 1,1 196,0 a 98,98 0 1,1 -196,0"
              fill="none"
            />
            <text>
              <textPath href="#halloweenRitualRingPath" startOffset="0%">
                THE VEIL THINS ✦ THE ABYSS GAZES BACK ✦ KEEP STILL ✦
              </textPath>
            </text>
          </svg>
        </div>

        <div
          className="halloween-ritual-loader__ring halloween-ritual-loader__ring--inner"
          aria-hidden="true"
        >
          <svg viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="76" />
          </svg>
        </div>

        <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--1" aria-hidden="true" />
        <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--2" aria-hidden="true" />
        <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--3" aria-hidden="true" />
        <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--4" aria-hidden="true" />

        <div className="halloween-ritual-loader__monolith" aria-hidden="true">
          <div className="halloween-ritual-loader__eclipse">
            <span className="halloween-ritual-loader__eclipse-sun" />
            <span className="halloween-ritual-loader__eclipse-moon" />
          </div>
          <span className="halloween-ritual-loader__scanner" />
        </div>
      </div>

      <p className="halloween-ritual-loader__note" aria-hidden="true">
        Something old is waking up, slowly.
      </p>
    </section>
  );
};

export default HalloweenRitualLoader;