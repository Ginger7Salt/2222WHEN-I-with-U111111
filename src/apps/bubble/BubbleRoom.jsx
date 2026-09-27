// src/apps/bubble/BubbleRoom.jsx
//
// 泡泡模式（Bubble Mode）切片A：房间空壳。
// 只负责把房间信息（标题、成员头像/姓名）显示出来，还没有消息收发——
// 那是切片B的范围：广播消息 + 每个角色独立隔离上下文、顺序逐个生成回复，
// 复用 MessageList/MessageRow 渲染。这里先放一个占位输入框，禁用状态，
// 提示这部分下一轮再做。

import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import db from '../../db';
import { getBubbleRoomById } from './bubbleService';

const BubbleRoom = ({ roomId, onBack, onChatRoomStateChange }) => {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);

      const roomDoc = await getBubbleRoomById(roomId);
      if (!isMounted) return;

      setRoom(roomDoc);

      const memberIds = roomDoc?.selectedCharacterIds || [];
      const memberDocs = memberIds.length > 0
        ? await db.characters.where('id').anyOf(memberIds).toArray()
        : [];

      if (!isMounted) return;
      setMembers(memberDocs);
      setIsLoading(false);
    };

    void load();

    onChatRoomStateChange?.(true);

    return () => {
      isMounted = false;
      onChatRoomStateChange?.(false);
    };
  }, [roomId, onChatRoomStateChange]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div
        className="flex items-center gap-2 px-1 pb-3 border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-full opacity-70 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--text-main)' }}
          >
            {room?.title || (isLoading ? '加载中...' : '未命名房间')}
          </h2>

          {!isLoading && (
            <p className="text-[10px] opacity-50 truncate">
              {members.length > 0
                ? members.map((m) => m.name).join(' · ')
                : '暂无成员'}
            </p>
          )}
        </div>

        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m) => (
            <div
              key={m.id}
              className="w-7 h-7 rounded-full border-2 overflow-hidden flex items-center justify-center text-[10px] font-semibold"
              style={{ borderColor: 'var(--card-bg)', backgroundColor: 'var(--control-soft-bg)' }}
              title={m.name}
            >
              {m.avatar ? (
                <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <span>{(m.name || '?').slice(0, 1)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center opacity-50 text-xs space-y-1">
          <p>消息收发还在开发中，下一轮见。</p>
          <p>这一轮先把房间和成员定下来。</p>
        </div>
      </div>

      <div
        className="px-3 py-2 border-t"
        style={{ borderColor: 'var(--divider)' }}
      >
        <input
          type="text"
          disabled
          placeholder="消息功能下一轮开发..."
          className="w-full p-2.5 rounded-full text-xs border outline-none opacity-50 cursor-not-allowed"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
        />
      </div>
    </div>
  );
};

export default BubbleRoom;