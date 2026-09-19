// src/apps/hub/widgets/MusicCardWidget.jsx
//
// 纯装饰性的"音乐卡片"小组件，仿 iOS 正在播放卡片的样子，但不接
// 真实的音乐播放——标题、艺人、封面图、时间文案都是用户自己填的
// 静态展示，播放控制按钮和进度条也只是好看，点了不会真的播放什么。
//
// 正常浏览模式下点这张卡片会弹出编辑框改内容（onOpenEdit），跟数据
// 类小组件"点了跳转去对应 app"是不同的行为。

import React from 'react';
import { Rewind, Play, FastForward, Cast, Music2 } from 'lucide-react';
import GlassCard from '../../../components/GlassCard';

export const MusicCardWidget = ({ config, onOpenEdit }) => {
  const {
    coverImage = '',
    title = '',
    artist = '',
    elapsedLabel = '0:01',
    remainingLabel = '-2:56',
  } = config || {};

  return (
    <GlassCard
      blur={false}
      onClick={onOpenEdit}
      className="group flex h-full cursor-pointer flex-col justify-between gap-1.5 p-3 text-left"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          {coverImage ? (
            <img
              src={coverImage}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <Music2
              className="h-4 w-4 opacity-40"
              style={{ color: 'var(--text-main)' }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-bold"
            style={{ color: 'var(--text-main)' }}
          >
            {title || '点击填写歌曲标题'}
          </p>
          <p className="truncate text-[9px] opacity-55">{artist}</p>
        </div>

        <Cast
          className="h-3.5 w-3.5 shrink-0 opacity-40"
          style={{ color: 'var(--text-main)' }}
        />
      </div>

      <div className="flex items-center justify-center gap-4 opacity-70">
        <Rewind className="h-3 w-3" style={{ color: 'var(--text-main)' }} />
        <Play
          className="h-3.5 w-3.5"
          style={{ color: 'var(--text-main)' }}
          fill="currentColor"
        />
        <FastForward
          className="h-3 w-3"
          style={{ color: 'var(--text-main)' }}
        />
      </div>

      <div className="space-y-1">
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <div
            className="h-full w-1/12 rounded-full"
            style={{ backgroundColor: 'var(--text-main)', opacity: 0.6 }}
          />
        </div>
        <div className="flex items-center justify-between text-[8px] opacity-45">
          <span>{elapsedLabel}</span>
          <span>{remainingLabel}</span>
        </div>
      </div>
    </GlassCard>
  );
};

export default MusicCardWidget;