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
const POSTCARD_TILTS = [-1.2, 1.4, -1.5, 1.2, -1.0];
const STAMP_TILTS = [-3.5, 2.8, -2.2, 3.2, -2.5];

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-hidden">
      {/* 遮罩背景：纯净微暗遮罩，不加模糊滤镜 */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{
          background: 'rgba(0, 0, 0, 0.45)',
        }}
        onClick={() => !isSending && onClose()}
      />

      {/* 1. 背景罗盘刻度轮盘：去除模糊光晕，保持纯净线条与慢速旋转 */}
      <div className="compass-stage" aria-hidden="true">
        <svg className="compass-dial-svg" viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="235" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.25" />
          <circle cx="250" cy="250" r="225" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 6" strokeOpacity="0.35" />
          <circle cx="250" cy="250" r="195" stroke="currentColor" strokeWidth="1" strokeOpacity="0.28" />

          {/* 罗盘方位标记 (N, E, S, W) */}
          <text x="250" y="24" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none" fillOpacity="0.75">N · 000°</text>
          <text x="480" y="254" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none" fillOpacity="0.75">E · 090°</text>
          <text x="250" y="488" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none" fillOpacity="0.75">S · 180°</text>
          <text x="22" y="254" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none" fillOpacity="0.75">W · 270°</text>

          {/* 极坐标十字射线 */}
          <line x1="250" y1="18" x2="250" y2="482" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.2" />
          <line x1="18" y1="250" x2="482" y2="250" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.2" />

          {/* 45度斜向虚线 */}
          <line x1="85" y1="85" x2="415" y2="415" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 4" strokeOpacity="0.18" />
          <line x1="85" y1="415" x2="415" y2="85" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 4" strokeOpacity="0.18" />

          {/* 内圈同心圆与小刻度 */}
          <circle cx="250" cy="250" r="150" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 4" strokeOpacity="0.22" />
          <circle cx="250" cy="250" r="110" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.2" />
        </svg>
      </div>

      {/* 2. 前景：居中拼贴信卡 */}
      <div
        className="collage-card relative z-20 flex w-full max-w-[380px] flex-col gap-4 overflow-hidden rounded-[24px]"
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-main, #111111)',
          maxHeight: '90vh',
        }}
      >
        {/* 顶部：邮戳与标题栏 */}
        <div className="card-header flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="postmark-seal">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" />
              </svg>
              <span className="postmark-date">{postmarkLabel}</span>
            </div>
            <div className="flex flex-col text-left">
              <h3 className="text-[13px] font-bold tracking-tight">
                寻迹信标 · 寄往 {targets.length} 方位
              </h3>
              <p className="text-[10px] opacity-60">向定锚目标并发投递信笺</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="btn-close"
            title="收起"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3. 邮票贴纸受众区 */}
        <div className="stamps-strip no-scrollbar flex gap-2.5 overflow-x-auto py-1">
          {targets.map(({ chat, character }, index) => (
            <div
              key={chat.id}
              className="stamp-pill flex shrink-0 flex-col items-center gap-1"
              style={{ transform: `rotate(${STAMP_TILTS[index % STAMP_TILTS.length]}deg)` }}
            >
              {character?.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="stamp-avatar h-7 w-7 rounded object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="stamp-avatar flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold"
                  style={{ background: 'var(--bg-main, #f4f4f5)' }}
                >
                  {character?.name?.[0] || <MessageCircle className="h-3.5 w-3.5 opacity-50" />}
                </div>
              )}
              <span className="stamp-name max-w-[72px] truncate text-[9px] font-medium opacity-85">
                {chat.title || character?.name || '未命名'}
              </span>
            </div>
          ))}
        </div>

        {/* 4. 拼贴信纸草稿区 */}
        <div className="postcard-stack no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-0.5 py-1">
          {drafts.map((draft, index) => (
            <div
              key={index}
              className="postcard-sheet relative"
              style={{ transform: `rotate(${POSTCARD_TILTS[index % POSTCARD_TILTS.length]}deg)` }}
            >
              <div className="sheet-meta flex items-center justify-between pb-1">
                <span className="sheet-index">No. {String(index + 1).padStart(2, '0')} · Postcard</span>

                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDraft(index)}
                    className="sheet-delete-btn p-1 transition-colors hover:text-red-500"
                    title="撕除这一张"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(index, event.target.value)}
                placeholder={index === 0 ? '在信纸上落笔寄给大家的话...' : '再写一张明信片...'}
                rows={2}
                maxLength={500}
                className="sheet-textarea w-full resize-none bg-transparent text-xs leading-relaxed outline-none"
              />
            </div>
          ))}

          {drafts.length < MAX_MESSAGES && (
            <button
              type="button"
              onClick={handleAddDraft}
              className="btn-add-sheet flex w-full items-center justify-center gap-1.5 py-2.5 text-[11px] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>附写下一张便签</span>
            </button>
          )}
        </div>

        {/* 5. 底部发送按钮 */}
        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          className="btn-seal-send relative flex w-full items-center justify-center gap-2 text-xs font-semibold disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" style={{ transform: 'rotate(45deg)' }} />
          <span>{isSending ? '印发启程中...' : '印发启程 · 寄出信笺'}</span>
        </button>
      </div>

      {showSendEffect && (
        <BroadcastFlyEffect onDone={handleFlyEffectDone} />
      )}

      <style>{`
        /* 背景纯净罗盘舞台 (无模糊层) */
        .compass-stage {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 580px;
          height: 580px;
          pointer-events: none;
          z-index: 15;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
        }

        .compass-dial-svg {
          width: 100%;
          height: 100%;
          animation: slowRotate 160s linear infinite;
        }

        /* 居中拼贴信卡主体 */
        .collage-card {
          padding: 22px 20px 20px;
          border: 1px solid var(--card-border, rgba(0, 0, 0, 0.08));
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 20px 45px -10px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.8) inset;
          animation: cardPopIn 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* 顶栏分割与邮戳 */
        .card-header {
          border-bottom: 1px solid var(--card-border, rgba(0, 0, 0, 0.08));
        }

        .postmark-seal {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px dashed currentColor;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transform: rotate(-10deg);
          flex-shrink: 0;
          background: rgba(0, 0, 0, 0.02);
        }

        .postmark-date {
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-top: 1px;
          opacity: 0.85;
        }

        .btn-close {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid var(--card-border, rgba(0, 0, 0, 0.12));
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.6;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .btn-close:hover:not(:disabled) {
          opacity: 1;
          border-color: currentColor;
          transform: rotate(90deg);
        }

        /* 邮票贴纸 */
        .stamp-pill {
          background: var(--card-bg, #ffffff);
          border: 1px solid var(--card-border, #e4e4e7);
          border-radius: 8px;
          padding: 6px 8px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .stamp-pill:hover {
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
          z-index: 2;
        }

        /* 拼贴信纸草稿区 */
        .postcard-stack {
          max-height: 250px;
        }

        .postcard-sheet {
          background: var(--control-soft-bg, #fafaf9);
          border: 1px solid var(--card-border, rgba(0, 0, 0, 0.08));
          border-radius: 14px;
          padding: 10px 12px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          transition: transform 0.25s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .postcard-sheet:hover,
        .postcard-sheet:focus-within {
          border-color: rgba(0, 0, 0, 0.22);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .sheet-index {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 10px;
          letter-spacing: 0.06em;
          opacity: 0.55;
        }

        .sheet-delete-btn {
          color: #a1a1aa;
          cursor: pointer;
        }

        .sheet-textarea::placeholder {
          opacity: 0.45;
        }

        /* 添加信笺按钮 */
        .btn-add-sheet {
          background: transparent;
          border: 1px dashed var(--card-border, rgba(0, 0, 0, 0.16));
          border-radius: 12px;
          color: var(--text-main, #333333);
          opacity: 0.7;
          cursor: pointer;
        }

        .btn-add-sheet:hover {
          opacity: 1;
          border-color: currentColor;
          background: rgba(0, 0, 0, 0.02);
        }

        /* 底部印发启程按钮 */
        .btn-seal-send {
          height: 42px;
          border-radius: 9999px;
          background: var(--text-main, #111111);
          color: var(--card-bg, #ffffff);
          letter-spacing: 0.04em;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }

        .btn-seal-send:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
          filter: brightness(1.05);
        }

        .btn-seal-send:active:not(:disabled) {
          transform: scale(0.98);
        }

        @keyframes slowRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes cardPopIn {
          0% {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default BroadcastComposer;
