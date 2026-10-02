// src/components/HalloweenRitualLoader.jsx
//
// 万圣节限定加载页（石碑日食版）。同样是"全屏限定版"：固定黑红配色，
// position:fixed 铺满整个视口，__spacer 在正常排版流里占位以保持品牌名/
// 引言/状态文字的垂直位置不变。

import React from 'react';
import './halloween-ritual-loader.css';

export const HalloweenRitualLoader = () => {
  return (
    <>
      <div className="halloween-ritual-loader__spacer" aria-hidden="true" />

      <div
        className="halloween-ritual-loader"
        role="img"
        aria-label="一座黑曜石石碑正悬浮，全屏经历一场缓慢的日食"
        aria-hidden="true"
      >
        <div className="halloween-ritual-loader__grain" />
        <div className="halloween-ritual-loader__glow" />
        <div className="halloween-ritual-loader__watermark">RITUAL</div>

        <div className="halloween-ritual-loader__frame">
          <span className="halloween-ritual-loader__corner halloween-ritual-loader__corner--tl">
            VOL. XIII
            <br />
            <span className="halloween-ritual-loader__corner-accent">OCTOBER</span>
          </span>
          <span className="halloween-ritual-loader__corner halloween-ritual-loader__corner--tr">
            ARCHIVE NO. 00-93
            <br />
            SEALED
          </span>
          <span className="halloween-ritual-loader__corner halloween-ritual-loader__corner--bl">
            RITE IN PROGRESS
            <br />
            DO NOT LOOK AWAY
          </span>
          <span className="halloween-ritual-loader__corner halloween-ritual-loader__corner--br">
            DATA STREAM
            <br />
            [ ENCRYPTED ]
          </span>
        </div>

        <div className="halloween-ritual-loader__stage">
          <div className="halloween-ritual-loader__ring halloween-ritual-loader__ring--outer">
            <svg viewBox="0 0 380 380">
              <path
                id="halloweenRitualRingPath"
                d="M 190, 190 m -180, 0 a 180,180 0 1,1 360,0 a 180,180 0 1,1 -360,0"
                fill="none"
              />
              <text>
                <textPath href="#halloweenRitualRingPath" startOffset="0%">
                  THE VEIL THINS ✦ THE ABYSS GAZES BACK ✦ KEEP STILL ✦
                </textPath>
              </text>
            </svg>
          </div>

          <div className="halloween-ritual-loader__ring halloween-ritual-loader__ring--inner">
            <svg viewBox="0 0 310 310">
              <circle cx="155" cy="155" r="150" />
            </svg>
          </div>

          <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--1" />
          <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--2" />
          <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--3" />
          <span className="halloween-ritual-loader__shard halloween-ritual-loader__shard--4" />

          <div className="halloween-ritual-loader__monolith">
            <div className="halloween-ritual-loader__eclipse">
              <span className="halloween-ritual-loader__eclipse-sun" />
              <span className="halloween-ritual-loader__eclipse-moon" />
            </div>
            <span className="halloween-ritual-loader__scanner" />
          </div>
        </div>
      </div>
    </>
  );
};

export default HalloweenRitualLoader;