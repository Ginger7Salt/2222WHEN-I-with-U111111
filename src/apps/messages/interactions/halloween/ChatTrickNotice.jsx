// src/apps/messages/interactions/halloween/ChatTrickNotice.jsx
//
// "恶作剧" 消息（type === 'trick'）的渲染：一条居中的小提示条，样式
// 照抄 ChatPokeNotice.jsx。消息"新鲜"时（刚刚在这个聊天窗打开期间发生，
// 不是翻旧记录翻到的）额外派发一个 window 事件，交给 TrickEffectOverlay
// 去播放覆盖整个聊天室的幽灵+文字动画——用 window CustomEvent 而不是
// props，是因为这条消息和需要播动画的覆盖层不在同一层级（消息在消息流
// 里，动画要盖住整个聊天室），这正是项目里"两个组件之间没有直接 props
// 通路时用 window CustomEvent"的既定做法（跟 onboarding-intro 重新打开
// 用的是同一个套路）。
import React, { useEffect } from 'react';

export const TRICK_EFFECT_EVENT = 'halloween-trick-effect';

const RECENT_TRICK_WINDOW_MS = 8000;

const ChatTrickNotice = ({ message, character, activeUserName }) => {
  const direction = message?.metadata?.direction || 'user_to_char';

  const messageTimestampMs = new Date(message?.timestamp || 0).getTime();
  const isFresh = Number.isFinite(messageTimestampMs)
    && (Date.now() - messageTimestampMs) < RECENT_TRICK_WINDOW_MS;

  useEffect(() => {
    if (!isFresh || typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(TRICK_EFFECT_EVENT));
    // 只依赖"是否新鲜"，不需要在每次父组件重渲染时重复派发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFresh]);

  const characterName = character?.name || '对方';
  const userName = activeUserName || '你';

  const actorName = direction === 'char_to_user' ? characterName : userName;
  const targetName = direction === 'char_to_user' ? userName : characterName;

  return (
    <div className="my-2 flex justify-center">
      <div className="hwe-trick-notice">
        {actorName} 对 {targetName} 恶作剧了一下
      </div>
    </div>
  );
};

export default ChatTrickNotice;