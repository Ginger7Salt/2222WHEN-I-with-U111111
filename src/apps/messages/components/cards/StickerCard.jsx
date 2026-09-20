import React from 'react';

export const StickerCard = ({ metadata, isUser = false }) => {
  const url = metadata?.url || '';
  const name = metadata?.name || '表情包';

  return (
    <div className="my-1 select-none flex flex-col items-start group">
      <div
        className="relative overflow-hidden rounded-2xl p-1 transition-all duration-300 transform group-hover:scale-105 active:scale-95"
        style={{
          backgroundColor: 'transparent',
          // 用固定宽高（而不是 maxWidth/maxHeight）提前占好位置，
          // 避免图片异步加载完成后卡片尺寸从 0 突然撑开，
          // 导致聊天区域在图片加载的一瞬间发生跳动/回弹。
          width: '112px',
          height: '112px',
        }}
      >
        {url ? (
          <img
            src={url}
            alt={name}
            className="w-full h-full object-cover rounded-xl shadow-sm border"
            style={{ borderColor: 'var(--card-border, rgba(0,0,0,0.08))' }}
            loading="lazy"
            decoding="async" />
        ) : (
          <div
            className="w-full h-full rounded-xl flex items-center justify-center text-xs opacity-60 border border-dashed"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
          >
            [{name}]
          </div>
        )}
      </div>
      <span className="text-[9px] opacity-40 px-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {name}
      </span>
    </div>
  );
};

export default StickerCard;