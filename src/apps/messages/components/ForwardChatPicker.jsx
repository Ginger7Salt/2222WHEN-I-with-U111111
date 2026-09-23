import React, { useEffect, useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import db from '../../../db';

// 多选转发时弹出的目标聊天窗选择器。列出除当前聊天窗以外的所有
// 聊天（同角色的其他窗口、跨角色都会出现在这里），单选一个目标，
// 确认后由调用方（ChatRoom）负责真正写入消息。
// 这里只负责"选谁"，不负责转发本身的数据逻辑。
const ForwardChatPicker = ({ currentChatId, messageCount, onClose, onForward }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([db.chats.toArray(), db.characters.toArray()]).then(
      ([chatList, characterList]) => {
        if (cancelled) return;

        const sorted = chatList
          .filter((chat) => chat.id !== currentChatId)
          .sort(
            (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
          );

        setChats(sorted);
        setCharacters(characterList);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [currentChatId]);

  const handleConfirm = async () => {
    if (!selectedChatId || isSending) return;

    setIsSending(true);

    try {
      await onForward(selectedChatId);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in-up">
      <div
        className="fixed inset-0 backdrop-blur-md"
        style={{
          background:
            'var(--modal-backdrop, color-mix(in srgb, var(--bg-main) 72%, transparent))',
        }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-sm space-y-3 rounded-[2rem] p-5 text-xs shadow-2xl"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div
          className="flex items-center justify-between border-b pb-2"
          style={{ borderColor: 'var(--divider)' }}
        >
          <span className="text-sm font-bold">
            转发 {messageCount} 条消息到
          </span>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 opacity-60 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {chats.length === 0 ? (
          <p className="py-6 text-center text-[11px] opacity-50">
            暂时没有其他可以转发的聊天窗
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto no-scrollbar pr-0.5">
            {chats.map((chat) => {
              const character = characters.find(
                (item) => item.id === chat.characterId
              );
              const isSelected = selectedChatId === chat.id;
              const chatTitle = chat.title || character?.name || '未命名聊天';
              const showCharacterSubLabel =
                character?.name && chatTitle !== character.name;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className="flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all"
                  style={{
                    background: isSelected
                      ? 'var(--accent-color)'
                      : 'var(--control-soft-bg)',
                    borderColor: isSelected
                      ? 'var(--accent-color)'
                      : 'var(--card-border)',
                    color: isSelected
                      ? 'var(--accent-foreground)'
                      : 'var(--text-main)',
                  }}
                >
                  {character?.avatar ? (
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: 'var(--bg-main)' }}
                    >
                      {character?.name?.[0] || (
                        <MessageCircle className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {chatTitle}
                    </p>

                    {showCharacterSubLabel && (
                      <p className="truncate text-[10px] opacity-60">
                        {character.name}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          disabled={!selectedChatId || isSending}
          onClick={handleConfirm}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
          }}
        >
          <Send className="h-3.5 w-3.5" />
          <span>{isSending ? '发送中...' : '确认转发'}</span>
        </button>
      </div>
    </div>
  );
};

export default ForwardChatPicker;