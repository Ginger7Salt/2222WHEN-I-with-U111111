import React, { useState } from 'react';
import { MessageCircle, Plus, Send, Trash2, X } from 'lucide-react';

import db from '../../../db';
import { triggerAiResponse } from '../../../services/aiService';
import {
  recordAlmanacEvent,
  ALMANAC_EVENT_TYPES,
} from '../../almanac/services/almanacService';
import { triggerGlobalToast } from '../../../components/NotificationToast';
import BroadcastFlyEffect from './effects/BroadcastFlyEffect';

// "群发"撰写弹窗：从会话列表的多选模式打开，targets 是已经选好的
// 最多 5 个 { chat, character } 组合。这里现写一条或几条新消息，一次性
// 分别写进每一个目标聊天窗，然后各自触发一次 AI 回复——跟平时在某个
// 聊天窗里发消息、AI 自动回复是同一套逻辑（triggerAiResponse 自己会
// 从数据库读 chat/character，不依赖某个聊天窗是否正打开着）。
//
// 这里不复用"转发"那条路径：转发是把已有消息原样搬到别的聊天窗、
// 不触发 AI；这里是现写新内容、发完就要对方（AI）回应。

const MAX_MESSAGES = 5;

const BroadcastComposer = ({ targets, onClose, onSent }) => {
  const [drafts, setDrafts] = useState(['']);
  const [isSending, setIsSending] = useState(false);
  const [flyEffectCount, setFlyEffectCount] = useState(0);

  const handleDraftChange = (index, value) => {
    setDrafts((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const handleAddDraft = () => {
    setDrafts((previous) => (
      previous.length >= MAX_MESSAGES ? previous : [...previous, '']
    ));
  };

  const handleRemoveDraft = (index) => {
    setDrafts((previous) => (
      previous.length <= 1 ? previous : previous.filter((_, i) => i !== index)
    ));
  };

  const trimmedDrafts = drafts.map((text) => text.trim()).filter(Boolean);
  const canSend = trimmedDrafts.length > 0 && !isSending && targets.length > 0;

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);

    try {
      for (const { chat, character } of targets) {
        const userAvatar = chat?.userAvatar || character?.userAvatar || '';
        const userName = chat?.userName || character?.userName || '你';

        for (const content of trimmedDrafts) {
          const newMsg = {
            chatId: chat.id,
            characterId: chat.characterId,
            sender: 'user',
            type: 'text',
            content,
            metadata: {},
            userAvatar,
            userName,
            isRead: true,
            timestamp: new Date().toISOString(),
          };

          const msgId = await db.messages.add(newMsg);
          newMsg.id = msgId;

          void recordAlmanacEvent({
            chatId: chat.id,
            characterId: chat.characterId,
            eventType: ALMANAC_EVENT_TYPES.USER_MESSAGE,
            timestamp: newMsg.timestamp,
            metadata: {
              source: 'broadcast-composer',
              messageType: 'text',
            },
          });
        }

        await db.chats.update(chat.id, {
          updatedAt: new Date().toISOString(),
        });

        // 每个目标各自独立触发一次 AI 回复，互不等待。
        void triggerAiResponse(chat.id);
      }

      // 先放"纸飞机飞出去"的全屏动效，动效结束后才真正关闭弹窗、
      // 回到会话列表，让人能看清"发出去了"这个反馈。
      setFlyEffectCount(targets.length);
    } catch (err) {
      console.error('[BroadcastComposer] 群发失败：', err);
      setIsSending(false);
      triggerGlobalToast({
        title: '群发失败',
        content: '有几条没发出去，稍后再试试吧',
        iconType: 'bell',
        duration: 2600,
      });
    }
  };

  const handleFlyEffectDone = () => {
    const count = targets.length;

    triggerGlobalToast({
      title: '已群发',
      content: `已发送给 ${count} 位`,
      iconType: 'chat',
      duration: 2400,
    });

    onSent?.();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4 animate-fade-in-up">
      <div
        className="fixed inset-0 backdrop-blur-md"
        style={{
          background:
            'var(--modal-backdrop, color-mix(in srgb, var(--bg-main) 72%, transparent))',
        }}
        onClick={() => !isSending && onClose()}
      />

      <div
        className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-t-[2rem] p-5 text-xs shadow-2xl sm:rounded-[2rem]"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          maxHeight: '82vh',
        }}
      >
        <div
          className="flex items-center justify-between border-b pb-2"
          style={{ borderColor: 'var(--divider)' }}
        >
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <Send className="h-3.5 w-3.5" />
            群发给 {targets.length} 位
          </span>

          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-full p-1 opacity-60 hover:opacity-100 disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 收件人一览：只读，回到列表去改勾选 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {targets.map(({ chat, character }) => (
            <div
              key={chat.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              {character?.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="h-5 w-5 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: 'var(--bg-main)' }}
                >
                  {character?.name?.[0] || <MessageCircle className="h-3 w-3 opacity-50" />}
                </div>
              )}
              <span className="whitespace-nowrap text-[10px] font-medium">
                {chat.title || character?.name || '未命名聊天'}
              </span>
            </div>
          ))}
        </div>

        {/* 撰写区：可以写好几条，按顺序依次发出去 */}
        <div className="max-h-64 space-y-2 overflow-y-auto no-scrollbar pr-0.5">
          {drafts.map((draft, index) => (
            <div key={index} className="flex items-start gap-1.5">
              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(index, event.target.value)}
                placeholder={index === 0 ? '想说点什么...' : '再加一条...'}
                rows={2}
                maxLength={500}
                className="flex-1 resize-none rounded-2xl border px-3 py-2 text-xs outline-none"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)',
                }}
              />

              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveDraft(index)}
                  className="mt-1 shrink-0 rounded-full p-1.5 opacity-50 hover:opacity-90"
                  title="删掉这一条"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {drafts.length < MAX_MESSAGES && (
            <button
              type="button"
              onClick={handleAddDraft}
              className="flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed py-1.5 text-[11px] opacity-60 transition-opacity hover:opacity-90"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <Plus className="h-3 w-3" />
              <span>再加一条</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
          }}
        >
          <Send className="h-3.5 w-3.5" />
          <span>{isSending ? '发送中...' : '群发'}</span>
        </button>
      </div>

      {flyEffectCount > 0 && (
        <BroadcastFlyEffect count={flyEffectCount} onDone={handleFlyEffectDone} />
      )}
    </div>
  );
};

export default BroadcastComposer;