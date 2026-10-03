import React, { useRef } from 'react';

import MoodSpotlightOverlay from './MoodSpotlightOverlay';
import './moodNotice.css';

// 心情更新后留在聊天记录里的痕迹：跟 ChatDiyUpdateNotice 是同一个视觉
// 语言——居中的一条小药丸，纯公告，不可点击跳转。
//
// message.metadata.effect 里存着角色当时选的出场效果（FADE / SPOTLIGHT /
// BOUNCE，见 moodBubbleDirective.js）。Slice 2：三种效果都已经做完——
// FADE 是淡入+轻微上浮，BOUNCE 是提示条自己放大振动回弹，SPOTLIGHT 是
// 提示条加一圈柔光同时配合 MoodSpotlightOverlay.jsx 的全屏聚光灯遮罩。
// 只在这条消息刚插入的几秒内播一次，判断方式跟
// specialMessageEffects.js 的 RECENT_MESSAGE_EFFECT_WINDOW_MS 是同一个
// "按时间戳算新鲜度、翻旧聊天记录不重播"的约定——这里单独开一个常量
// 只是因为这条消息类型自己的效果逻辑跟那边的关键词特效规则表完全不
// 共用，没必要绑在一起改。
const RECENT_MOOD_EFFECT_WINDOW_MS = 8000;

const MoodUpdateNotice = ({ message }) => {
  const text = message?.content || '心情更新了。';
  const effect = message?.metadata?.effect || 'FADE';
  const pillRef = useRef(null);

  const messageTimestampMs = new Date(
    message?.timestamp || message?.createdAt || 0
  ).getTime();

  const isFresh = Number.isFinite(messageTimestampMs)
    && (Date.now() - messageTimestampMs) < RECENT_MOOD_EFFECT_WINDOW_MS;

  const showFade = isFresh && effect === 'FADE';
  const showBounce = isFresh && effect === 'BOUNCE';
  const showSpotlight = isFresh && effect === 'SPOTLIGHT';

  const pillClassName = [
    'rounded-full px-3 py-1 text-center text-[11px]',
    showFade ? 'mood-notice--fade' : '',
    showBounce ? 'mood-notice--bounce' : '',
    showSpotlight ? 'mood-notice--spotlight-glow' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="my-2 flex justify-center">
      <div
        ref={pillRef}
        className={pillClassName}
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          opacity: 0.75,
        }}
      >
        <span>{text}</span>
      </div>
      {showSpotlight && <MoodSpotlightOverlay targetRef={pillRef} />}
    </div>
  );
};

export default MoodUpdateNotice;