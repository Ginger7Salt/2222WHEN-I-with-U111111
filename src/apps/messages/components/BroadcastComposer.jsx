import React, { useMemo, useState } from 'react';
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
//
// 视觉上走"明信片"这套意象，跟发送时那个纸飞机+星光的仪式感呼应：
// 收件人是一张张贴上去的邮票贴纸，每条草稿是一张可以写字的明信片，
// 发送按钮是"寄出"。还是从底部弹出的那种弹层，只是做得更饱满、
// 更有质感，不是一张单薄的表单卡。

const MAX_MESSAGES = 5;

// 明信片轻微的随机倾斜角度，让好几张叠在一起时不是死板的一条直线，
// 用 index 取模、固定一组角度，不用每次渲染都随机（避免文字输入时
// 因为重渲染导致卡片抖动）。
const POSTCARD_TILTS = [-1.4, 1.1, -0.8, 1.6, -1.1];
const STAMP_TILTS = [-4, 3, -3, 4, -2];

const BroadcastComposer = ({ targets, onClose, onSent }) => {
  const [drafts, setDrafts] = useState(['']);
  const [isSending, setIsSending] = useState(false);
  const [showSendEffect, setShowSendEffect] = useState(false);

  const postmarkLabel = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${month}.${day}`;
  }, []);

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
      setShowSendEffect(true);
    } catch (err) {
      console.error('[BroadcastComposer] 寄出失败：', err);
      setIsSending(false);
      triggerGlobalToast({
        title: '寄出失败',
        content: '有几封没寄出去，稍后再试试吧',
        iconType: 'bell',
        duration: 2600,
      });
    }
  };

  const handleFlyEffectDone = () => {
    const count = targets.length;

    triggerGlobalToast({
      title: '已寄出',
      content: `已送到 ${count} 位的信箱`,
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
        className="relative z-10 flex w-full max-w-sm flex-col gap-3 overflow-hidden rounded-t-[2.25rem] p-5 pt-3 text-xs shadow-2xl sm:rounded-[2.25rem]"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          maxHeight: '86vh',
        }}
      >
        {/* 暖调纸感叠层：只叠一层柔光渐变+细颗粒，靠混合模式在深色/
            浅色主题下都只是轻轻"提个暖调"，不会盖掉原来的卡片配色。 */}
        <div className="broadcast-paper-tint pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative flex justify-center">
          <span className="broadcast-grip" />
        </div>

        <div
          className="relative flex items-center justify-between border-b pb-2.5"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <span className="flex items-center gap-2">
            <span className="broadcast-postmark">
              <Send className="h-3 w-3" />
              <span className="broadcast-postmark-date">{postmarkLabel}</span>
            </span>
            <span className="text-sm font-bold">寄往 {targets.length} 位</span>
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

        {/* 收件人一览：贴纸化的小邮票，只读，回到列表去改勾选 */}
        <div className="relative flex gap-2 overflow-x-auto no-scrollbar py-1">
          {targets.map(({ chat, character }, index) => (
            <div
              key={chat.id}
              className="broadcast-stamp flex shrink-0 flex-col items-center gap-1 px-2 py-1.5"
              style={{ '--stamp-tilt': `${STAMP_TILTS[index % STAMP_TILTS.length]}deg` }}
            >
              {character?.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="h-7 w-7 rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold"
                  style={{ background: 'var(--bg-main)' }}
                >
                  {character?.name?.[0] || <MessageCircle className="h-3.5 w-3.5 opacity-50" />}
                </div>
              )}
              <span className="whitespace-nowrap text-[9px] font-medium opacity-80">
                {chat.title || character?.name || '未命名聊天'}
              </span>
            </div>
          ))}
        </div>

        {/* 撰写区：每条草稿是一张可以写字的明信片，可以写好几张，
            按顺序依次寄出去 */}
        <div className="relative max-h-64 space-y-2.5 overflow-y-auto no-scrollbar px-0.5 py-1">
          {drafts.map((draft, index) => (
            <div
              key={index}
              className="broadcast-postcard relative"
              style={{ '--postcard-tilt': `${POSTCARD_TILTS[index % POSTCARD_TILTS.length]}deg` }}
            >
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="broadcast-postcard-index">No. {String(index + 1).padStart(2, '0')}</span>

                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDraft(index)}
                    className="rounded-full p-1 opacity-45 hover:opacity-90"
                    title="撕掉这一张"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(index, event.target.value)}
                placeholder={index === 0 ? '写点什么寄给大家...' : '再写一张明信片...'}
                rows={2}
                maxLength={500}
                className="broadcast-postcard-input w-full resize-none bg-transparent px-3 pb-2.5 pt-1 text-xs outline-none"
                style={{ color: 'var(--text-main)' }}
              />
            </div>
          ))}

          {drafts.length < MAX_MESSAGES && (
            <button
              type="button"
              onClick={handleAddDraft}
              className="broadcast-postcard-add flex w-full items-center justify-center gap-1 py-2.5 text-[11px] opacity-60 transition-opacity hover:opacity-90"
            >
              <Plus className="h-3 w-3" />
              <span>再写一张明信片</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          className="broadcast-send-btn relative flex w-full items-center justify-center gap-2 py-3 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          <span className="broadcast-send-stamp">
            <Send className="h-3 w-3" />
          </span>
          <span>{isSending ? '寄送中...' : '寄出'}</span>
        </button>
      </div>

      {showSendEffect && (
        <BroadcastFlyEffect onDone={handleFlyEffectDone} />
      )}

      <style>{`
        .broadcast-paper-tint {
          background:
            radial-gradient(120% 90% at 20% 0%, rgba(255, 232, 189, 0.16) 0%, transparent 60%),
            radial-gradient(90% 70% at 100% 100%, rgba(255, 214, 160, 0.12) 0%, transparent 65%);
          mix-blend-mode: soft-light;
        }

        .broadcast-grip {
          width: 2.25rem;
          height: 0.28rem;
          border-radius: 9999px;
          background: var(--card-border);
          opacity: 0.6;
        }

        .broadcast-postmark {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 1.9rem;
          height: 1.9rem;
          border-radius: 9999px;
          border: 1.5px dashed var(--accent-color);
          color: var(--accent-color);
          transform: rotate(-14deg);
          flex-shrink: 0;
        }

        .broadcast-postmark svg {
          transform: rotate(45deg);
        }

        .broadcast-postmark-date {
          margin-top: 1px;
          font-size: 6px;
          letter-spacing: 0.02em;
          font-weight: 700;
        }

        .broadcast-stamp {
          border-radius: 0.6rem;
          border: 1.5px dashed var(--card-border);
          background: var(--control-soft-bg);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
          transform: rotate(var(--stamp-tilt, 0deg));
          transition: transform 0.2s ease;
        }

        .broadcast-postcard {
          border-radius: 1rem;
          border: 1.5px dashed var(--card-border);
          background: var(--control-soft-bg);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
          transform: rotate(var(--postcard-tilt, 0deg));
        }

        .broadcast-postcard-index {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 10px;
          letter-spacing: 0.05em;
          opacity: 0.45;
        }

        .broadcast-postcard-add {
          border-radius: 1rem;
          border: 1.5px dashed var(--card-border);
        }

        .broadcast-send-btn {
          border-radius: 9999px;
          background: var(--accent-color);
          color: var(--accent-foreground);
        }

        .broadcast-send-btn::before {
          content: '';
          position: absolute;
          left: 12%;
          right: 12%;
          top: -0.5rem;
          height: 0;
          border-top: 1.5px dashed color-mix(in srgb, var(--accent-color) 55%, transparent);
        }

        .broadcast-send-stamp {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.35rem;
          height: 1.35rem;
          border-radius: 9999px;
          border: 1.5px dashed color-mix(in srgb, var(--accent-foreground) 70%, transparent);
        }

        .broadcast-send-stamp svg {
          transform: rotate(45deg);
        }
      `}</style>
    </div>
  );
};

export default BroadcastComposer;