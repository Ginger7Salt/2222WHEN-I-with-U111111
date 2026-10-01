// src/apps/messages/work/WorkMiniAvatar.jsx
//
// work 聊天窗的头像展示：有图就显示图（chats.avatarOverride 优先，没有
// 就用全局共享的 characters.avatar），没有图就强制显示颜文字
// （chat.statusKaomoji，没有例外，没有生成过时用默认兜底颜文字）。
//
// 用一个独立小组件而不是散落在 WorkChatHeader / WorkEmptyStage 里各写
// 一份，避免这条"有图显示图，没图显示颜文字"的判断逻辑在两处地方分叉。

import React from 'react';
import { DEFAULT_WORK_KAOMOJI } from './workKaomojiDirective';

const SIZE_PRESETS = {
  sm: { box: 28, fontSize: 9 },
  lg: { box: 56, fontSize: 13 },
};

export const WorkMiniAvatar = ({ chat, character, size = 'sm' }) => {
  const avatarUrl = chat?.avatarOverride || character?.avatar || '';
  const kaomoji = chat?.statusKaomoji || DEFAULT_WORK_KAOMOJI;
  const { box, fontSize } = SIZE_PRESETS[size] || SIZE_PRESETS.sm;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={character?.name || '助理'}
        className="shrink-0 rounded-[28%] object-cover"
        style={{ width: box, height: box }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className="shrink-0 rounded-[28%] flex items-center justify-center font-medium select-none leading-none whitespace-nowrap overflow-hidden px-0.5"
      style={{
        width: box,
        height: box,
        fontSize,
        background: 'linear-gradient(150deg, var(--work-accent, #d98a55) 0%, color-mix(in srgb, var(--work-accent, #d98a55) 75%, #fff) 100%)',
        color: '#fff',
      }}
      title={character?.name || '助理'}
    >
      {kaomoji}
    </div>
  );
};

export default WorkMiniAvatar;