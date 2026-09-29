// src/apps/rp/RpRoom.jsx
//
// 长RP子应用切片A：会话空壳。
// 2026-09 视觉重做：用户反馈不喜欢"一整条顶栏 + 一整条底栏"的传统聊天室
// 布局，改成——中间消息区是唯一会滚动的区域（absolute inset-0
// overflow-y-auto），返回按钮和输入框都是悬浮在这个区域之上的毛玻璃
// 胶囊/圆形控件（absolute定位，不随内容滚动），标题本身挪进了可滚动区域
// 顶部的"章节头"里，跟着内容一起滚走，而不是钉死在屏幕最上方。
//
// 仍然是零消息收发逻辑、零AI调用（切片B的范围）。

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
      <div className="flex h-full items-center justify-center py-20 text-xs opacity-50">
        加载中...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-xs opacity-60">
        <p>这个会话不存在，可能已被删除。</p>
        <button type="button" onClick={onBack} className="underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      {/* 悬浮返回按钮：毛玻璃圆形，钉在左上角，不随内容滚动 */}
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)',
          boxShadow: 'var(--card-shadow)',
          color: 'var(--text-main)',
        }}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* 唯一会滚动的区域，上下留出空间给悬浮的返回按钮/输入框，避免遮挡 */}
      <div className="absolute inset-0 overflow-y-auto pb-28 pt-4">
        {/* 章节头：标题和角色信息放在这里，会跟着内容一起滚走，
            不是钉死在屏幕顶端的一整条bar */}
        <div
          className="relative mx-4 mt-10 overflow-hidden rounded-[2rem] px-5 pb-6 pt-8 text-center"
          style={{
            background: `linear-gradient(160deg, var(--bg-blob-1) 0%, var(--bg-surface) 75%)`,
          }}
        >
          {character?.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="mx-auto h-16 w-16 rounded-full object-cover shadow-sm"
              style={{ boxShadow: 'var(--card-shadow)' }}
            />
          ) : (
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-base font-bold"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              {character?.name?.[0] || '?'}
            </div>
          )}

          <h2
            className="mt-3 text-lg font-bold"
            style={{ fontFamily: 'Georgia, "Noto Serif SC", serif' }}
          >
            {session.title}
          </h2>
          <p className="mt-0.5 text-[11px] opacity-60">
            {character?.name || '（角色已被删除）'}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center opacity-50">
          <ScrollText className="h-8 w-8 opacity-40" />
          <p className="text-xs leading-relaxed">
            消息收发、渲染器和预设系统
            <br />
            在接下来的切片里陆续接入
          </p>
        </div>
      </div>

      {/* 悬浮输入条：毛玻璃胶囊，左右留白不贴边，钉在底部不随内容滚动 */}
      <div className="absolute inset-x-4 bottom-4 z-20">
        <input
          type="text"
          disabled
          placeholder="即将上线..."
          className="w-full rounded-full px-4 py-3 text-xs opacity-60 outline-none backdrop-blur-md"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)',
            boxShadow: 'var(--card-shadow)',
          }}
        />
      </div>
    </div>
  );
};

export default RpRoom;