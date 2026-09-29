// src/apps/rp/RpRoom.jsx
//
// 长RP子应用切片A：会话空壳。
//
// 2026-09 美化重做：照抄 ChatRoom.jsx 的外壳思路——整个房间是
// `fixed inset-0` 铺满全屏、脱离hub那层padding容器，不是嵌在页面
// 流里的一个普通区块。头部和输入栏都是"浮"在背景上的透明元素，不是
// 贴边的实心长条；中间内容区域是唯一可以滚动的部分。
//
// 依然零消息收发逻辑、零AI调用——这些是切片B的范围，这里只是把最终
// 会长成什么样的骨架先搭对。

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ScrollText } from 'lucide-react';

import db from '../../db';
import { getRpSessionById } from './rpService';

const RpRoom = ({ sessionId, onBack, onChatRoomStateChange }) => {
  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onChatRoomStateChange?.(true);
    return () => onChatRoomStateChange?.(false);
  }, [onChatRoomStateChange]);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    setLoading(true);
    const s = await getRpSessionById(sessionId);
    setSession(s);

    if (s?.characterId) {
      const c = await db.characters.get(s.characterId);
      setCharacter(c);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center text-xs opacity-50" style={{ background: 'var(--bg-main)' }}>
        加载中...
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 text-xs opacity-60"
        style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
      >
        <p>这个会话不存在，可能已被删除。</p>
        <button type="button" onClick={onBack} className="underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div
      className="rp-room-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      {/* 氛围背景：用主题自带的装饰色做一层柔和渐变，不是纯色平板——
          就算这一局还没设场景图，房间本身也有一点"故事感"的底色，
          而不是一片死白/死黑。 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(circle at 20% 0%, var(--bg-blob-1) 0%, transparent 55%),
            radial-gradient(circle at 85% 15%, var(--bg-blob-2) 0%, transparent 50%),
            var(--bg-main)
          `,
          opacity: 0.5,
        }}
      />

      {/* 浮动顶栏：透明，不是贴边实心长条，只有返回箭头 + 角色小药丸 */}
      <header className="z-20 flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div
          className="flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3.5 shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)' }}
        >
          {character?.avatar ? (
            <img src={character.avatar} alt={character.name} className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              {character?.name?.[0] || '?'}
            </div>
          )}
          <span className="text-[11px] font-semibold">{session.title}</span>
        </div>

        {/* 右侧占位，让中间的角色药丸保持视觉居中 */}
        <div className="h-8 w-8" />
      </header>

      {/* 唯一可滚动的区域 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-8 text-center">
        <ScrollText className="h-8 w-8 opacity-30" />
        <p
          className="text-[13px] italic leading-relaxed opacity-55"
          style={{ fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif' }}
        >
          故事还没有开始。
          <br />
          消息管道、渲染器和预设系统会在接下来的切片里陆续接入这里。
        </p>
      </div>

      {/* 浮动底栏：跟顶栏一样是透明浮动的圆角输入条，不是贴边的实心一整条 */}
      <div className="z-20 shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-2">
        <div
          className="flex items-center rounded-full px-4 py-2.5 shadow-lg backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 88%, transparent)' }}
        >
          <input
            type="text"
            disabled
            placeholder="即将上线..."
            className="w-full bg-transparent text-xs opacity-50 outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default RpRoom;