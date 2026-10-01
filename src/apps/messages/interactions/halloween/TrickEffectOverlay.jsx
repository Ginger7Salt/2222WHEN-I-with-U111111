// src/apps/messages/interactions/halloween/TrickEffectOverlay.jsx
//
// 挂在 ChatRoom 根节点下的覆盖层：监听 ChatTrickNotice 派发的
// halloween-trick-effect 事件，播一次全屏居中的幽灵+"Happy Halloween!"
// 动画。整个聊天室只需要挂一份。

import React, { useEffect, useRef, useState } from 'react';

import { TRICK_EFFECT_EVENT } from './ChatTrickNotice';
import './halloween.css';

const TrickEffectOverlay = () => {
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleTrickEffect = () => {
      setPlaying(false);

      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setPlaying(true), 20);
    };

    window.addEventListener(TRICK_EFFECT_EVENT, handleTrickEffect);

    return () => {
      window.removeEventListener(TRICK_EFFECT_EVENT, handleTrickEffect);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`hwe-trick-stage${playing ? ' hwe-trick-stage--go' : ''}`}>
      <div className="hwe-trick-halo" />
      <svg className="hwe-trick-ghost" viewBox="0 0 60 70">
        <use href="#hwe-ghost" />
      </svg>
      <div className="hwe-trick-text">Happy Halloween!</div>
    </div>
  );
};

export default TrickEffectOverlay;