// src/apps/rp/RpRoom.jsx
//
// 长RP子应用切片A：会话空壳。
// 头部 + 角色信息条 + 禁用的输入框 + 占位提示，零消息收发逻辑、零AI调用
// ——照抄 BubbleRoom.jsx 切片A当初的做法（先把壳搭起来，切片B再接真正
// 的消息管道/渲染器/预设组装）。

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
        <button
          type="button"
          onClick={onBack}
          className="underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-3 shrink-0"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button type="button" onClick={onBack} className="opacity-70 hover:opacity-100">
          <ArrowLeft className="w-4 h-4" />
        </button>

        {character?.avatar ? (
          <img
            src={character.avatar}
            alt={character.name}
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            {character?.name?.[0] || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{session.title}</h2>
          <p className="text-[10px] opacity-50 truncate">
            {character?.name || '（角色已被删除）'}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center opacity-50">
        <ScrollText className="w-8 h-8 opacity-40" />
        <p className="text-xs leading-relaxed">
          会话壳已经搭好，消息收发、渲染器和预设系统
          <br />
          在接下来的切片里陆续接入。
        </p>
      </div>

      <div
        className="shrink-0 border-t p-3"
        style={{ borderColor: 'var(--divider)' }}
      >
        <input
          type="text"
          disabled
          placeholder="即将上线..."
          className="w-full rounded-full border px-4 py-2 text-xs opacity-50 outline-none"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
          }}
        />
      </div>
    </div>
  );
};

export default RpRoom;