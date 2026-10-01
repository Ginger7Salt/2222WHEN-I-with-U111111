// src/apps/messages/mood/MoodBubble.jsx
//
// 头像旁边的心情气泡展示。内容来自 character.moodBubble（角色自己通过
// [MOOD: ...] 标签写入，见 moodBubbleDirective.js），这里只负责展示和
// "内容变化时重新弹一下"的过渡，没有气泡内容时什么都不渲染。

import React, { useEffect, useRef, useState } from 'react';

import './mood.css';

const MoodBubble = ({ character }) => {
  const mood = character?.moodBubble?.trim();
  const [show, setShow] = useState(false);
  const lastMoodRef = useRef(null);

  useEffect(() => {
    if (!mood) {
      lastMoodRef.current = null;
      setShow(false);
      return undefined;
    }

    // 内容真的变化了（而不是同一个角色对象重新渲染）才重播一次弹出动画，
    // 避免 ChatRoom 任何无关的重渲染都让气泡跳一下。
    if (lastMoodRef.current === mood) {
      return undefined;
    }

    lastMoodRef.current = mood;
    setShow(false);

    const timer = setTimeout(() => setShow(true), 60);
    return () => clearTimeout(timer);
  }, [mood]);

  if (!mood) {
    return null;
  }

  return (
    <div className={`mood-bubble${show ? ' mood-bubble--show' : ''}`}>
      {mood}
    </div>
  );
};

export default MoodBubble;