import React, { useEffect } from 'react';

import './poke.css';

// 戳一戳消息要多"新"才播放震动+抖动效果：只对聊天窗打开期间刚刚
// 发生的戳一戳生效，翻旧聊天记录不会重播——跟项目里 specialMessageEffects
// "最近消息才播特效"是同一套约定（见 MessageRow.jsx 里的 showSpecialEffect）。
const RECENT_POKE_WINDOW_MS = 8000;

const FULLSCREEN_SHAKE_CLASS = 'poke-fullscreen-shake';

const vibrate = (pattern) => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // 部分浏览器/环境调用会直接抛错（比如权限或非安全上下文），
    // 静默忽略即可，不影响戳一戳本身的展示。
  }
};

const triggerFullscreenShake = () => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  root.classList.remove(FULLSCREEN_SHAKE_CLASS);
  // 强制重排一次，确保短时间内连续戳两次时动画也能重新触发。
  void root.offsetWidth;
  root.classList.add(FULLSCREEN_SHAKE_CLASS);

  window.setTimeout(() => {
    root.classList.remove(FULLSCREEN_SHAKE_CLASS);
  }, 650);
};

const ChatPokeNotice = ({ message, character, activeUserName }) => {
  const direction = message?.metadata?.direction || 'user_to_char';
  const intensity = message?.metadata?.intensity || 'light';
  const reactionText = message?.metadata?.reactionText || '';

  const messageTimestampMs = new Date(message?.timestamp || 0).getTime();
  const isFresh = Number.isFinite(messageTimestampMs)
    && (Date.now() - messageTimestampMs) < RECENT_POKE_WINDOW_MS;

  useEffect(() => {
    if (!isFresh) return;

    if (intensity === 'full') {
      vibrate([25, 40, 25]);
      triggerFullscreenShake();
    } else {
      vibrate(15);
    }
    // 只依赖是否"新鲜"和强弱档位，不需要在每次父组件重渲染时重复判断。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFresh, intensity]);

  const characterName = character?.name || '对方';
  const userName = activeUserName || '你';

  const actorName = direction === 'char_to_user' ? characterName : userName;
  const targetName = direction === 'char_to_user' ? userName : characterName;

  return (
    <div className="my-2 flex justify-center">
      <div
        className={`poke-notice-pill rounded-full px-3 py-1 text-center text-[11px] ${
          isFresh ? 'poke-notice-pill--fresh' : ''
        } ${intensity === 'full' ? 'poke-notice-pill--full' : ''}`}
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          opacity: 0.75,
        }}
      >
        <span>{actorName} 戳了戳 {targetName}</span>
        {reactionText && (
          <span className="opacity-80">
            {'　·　'}
            {reactionText}
          </span>
        )}
      </div>
    </div>
  );
};

export default ChatPokeNotice;