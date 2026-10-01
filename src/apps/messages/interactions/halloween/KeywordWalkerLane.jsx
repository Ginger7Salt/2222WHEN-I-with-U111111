// src/apps/messages/interactions/halloween/KeywordWalkerLane.jsx
//
// 挂在输入条正上方的一条透明小舞台：每次 spawnWalkers() 被调用，就生成
// 一排幽灵/南瓜图标从左走到右，约 5 秒后自动清空。用命令式 ref 而不是
// état/props 驱动，是因为触发时机（打出关键词那一刻）和"要不要播"是
// 一次性事件，不需要常驻 state 跟着每次渲染走。

import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import './halloween.css';

const WALK_SEQUENCE = ['ghost', 'pumpkin', 'ghost', 'ghost', 'pumpkin', 'ghost', 'pumpkin'];
const WALK_DURATION_MS = 5200;
const STAGGER_MS = 450;

const KeywordWalkerLane = forwardRef((props, ref) => {
  const laneRef = useRef(null);

  useImperativeHandle(ref, () => ({
    spawnWalkers: () => {
      const lane = laneRef.current;
      if (!lane) return;

      WALK_SEQUENCE.forEach((kind, index) => {
        const el = document.createElement('div');
        el.className = `hwe-walker${kind === 'pumpkin' ? ' hwe-walker--pumpkin' : ''}`;
        el.style.animationDelay = `${index * (STAGGER_MS / 1000)}s`;

        const viewBox = kind === 'ghost' ? '0 0 60 70' : '0 0 64 60';
        el.innerHTML = `<svg viewBox="${viewBox}" style="animation-delay:${index * 0.11}s"><use href="#hwe-${kind}"></use></svg>`;

        lane.appendChild(el);

        window.setTimeout(() => {
          el.remove();
        }, WALK_DURATION_MS + index * STAGGER_MS + 200);
      });
    },
  }));

  return <div className="hwe-walk-lane" ref={laneRef} />;
});

KeywordWalkerLane.displayName = 'KeywordWalkerLane';

export default KeywordWalkerLane;