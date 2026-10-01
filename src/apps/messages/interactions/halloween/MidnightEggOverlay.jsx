// src/apps/messages/interactions/halloween/MidnightEggOverlay.jsx
//
// 深夜彩蛋的展示层：挂在输入条上方，play() 被调用时随机选一个版本播
// 放——蝙蝠扑棱飞过，或者小幽灵从输入条上方浮起、轻晃后散去，一半一半
// 概率，不会每次都撞到同一个。

import React, { forwardRef, useImperativeHandle, useState, useRef } from 'react';

import './halloween.css';

const PLAY_DURATION_MS = { bat: 4300, ghost: 4100 };

const MidnightEggOverlay = forwardRef((props, ref) => {
  const [variant, setVariant] = useState(null);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      const nextVariant = Math.random() < 0.5 ? 'bat' : 'ghost';

      setPlaying(false);
      window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        setVariant(nextVariant);
        setPlaying(true);

        window.setTimeout(() => {
          setPlaying(false);
        }, PLAY_DURATION_MS[nextVariant]);
      }, 20);
    },
  }));

  return (
    <div className="hwe-midnight-lane">
      {variant === 'bat' && (
        <svg
          className={`hwe-midnight-bat${playing ? ' hwe-midnight-bat--go' : ''}`}
          viewBox="0 0 64 36"
        >
          <use href="#hwe-bat" />
        </svg>
      )}

      {variant === 'ghost' && (
        <svg
          className={`hwe-midnight-ghost${playing ? ' hwe-midnight-ghost--go' : ''}`}
          viewBox="0 0 60 70"
        >
          <use href="#hwe-ghost" />
        </svg>
      )}
    </div>
  );
});

MidnightEggOverlay.displayName = 'MidnightEggOverlay';

export default MidnightEggOverlay;