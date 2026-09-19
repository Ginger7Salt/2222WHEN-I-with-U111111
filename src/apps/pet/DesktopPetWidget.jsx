import React, { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  Heart,
  PawPrint,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import db from '../../db';
import { subscribeAiEvents } from '../../services/aiService';
import {
  EMOTION_LABELS,
  MOOD_KEYS,
  getCharacterState,
} from '../memory/memoryCharacterState';

import {
  CANNED_REACTIONS,
  PET_WIDGET_CONFIG_KEY,
  PET_WIDGET_POSITION_KEY,
  getPetChatContext,
  pickCannedReply,
  sendPetLightMessage,
} from './petWidgetService';

const WIDGET_SIZE = 56;
const MAX_FEED_MESSAGES = 6;
const CANNED_BUBBLE_DURATION = 4200;

const DEFAULT_POSITION = { x: null, y: null };

const getDefaultPosition = () => ({
  x: Math.max(16, window.innerWidth - 72),
  y: Math.max(16, window.innerHeight - 180),
});

const clampPosition = (position) => {
  const margin = 12;

  return {
    x: Math.min(
      Math.max(margin, position.x),
      Math.max(margin, window.innerWidth - WIDGET_SIZE - margin)
    ),
    y: Math.min(
      Math.max(margin, position.y),
      Math.max(margin, window.innerHeight - WIDGET_SIZE - margin)
    ),
  };
};

const getMessagePreview = (message) => {
  const content = String(message?.content || '').trim();
  if (!content) return '（发送了一条消息）';
  return content.length > 60 ? `${content.slice(0, 60)}……` : content;
};

export const DesktopPetWidget = () => {
  const [config, setConfig] = useState(null);
  const [chatContext, setChatContext] = useState(null);

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);

  const [moodState, setMoodState] = useState(null);
  const [isMoodLoading, setIsMoodLoading] = useState(false);

  const [recentMessages, setRecentMessages] = useState([]);
  const [isReplying, setIsReplying] = useState(false);

  const [inputText, setInputText] = useState('');
  const [cannedBubble, setCannedBubble] = useState('');

  const positionRef = useRef(position);
  const cannedBubbleTimerRef = useRef(null);

  const dragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  /*
   * 监听 pet_widget_config：设置页改了开关或绑定的消息框之后，不需要
   * 刷新页面，桌宠会跟着更新/消失。
   */
  useEffect(() => {
    const subscription = liveQuery(
      () => db.settings.get(PET_WIDGET_CONFIG_KEY)
    ).subscribe({
      next: (record) => {
        const value = record?.value || {};

        setConfig({
          enabled: value.enabled === true,
          chatId: value.chatId ?? null,
          customAvatar: typeof value.customAvatar === 'string'
            ? value.customAvatar
            : null,
        });
      },
      error: (error) => {
        console.warn('[PetWidget] 读取配置失败:', error);
        setConfig({ enabled: false, chatId: null, customAvatar: null });
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  /*
   * 绑定的消息框可能被用户删掉了，这里每次 config.chatId 变化时都重新
   * 确认一遍，确认不了就当作"未绑定"，桌宠不显示。
   */
  useEffect(() => {
    let cancelled = false;

    if (!config?.enabled || !config?.chatId) {
      setChatContext(null);
      return undefined;
    }

    const loadContext = async () => {
      const context = await getPetChatContext(config.chatId);
      if (!cancelled) {
        setChatContext(context);
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [config?.enabled, config?.chatId]);

  const isVisible = Boolean(config?.enabled && chatContext);

  useEffect(() => {
    if (!isVisible) {
      setIsOpen(false);
    }
  }, [isVisible]);

  useEffect(() => {
    let cancelled = false;

    const loadPosition = async () => {
      try {
        const saved = await db.settings.get(PET_WIDGET_POSITION_KEY);
        if (cancelled) return;

        const savedPosition = saved?.value;

        if (
          savedPosition &&
          Number.isFinite(savedPosition.x) &&
          Number.isFinite(savedPosition.y)
        ) {
          setPosition(clampPosition(savedPosition));
        } else {
          setPosition(getDefaultPosition());
        }
      } catch (error) {
        console.warn('[PetWidget] 读取位置失败:', error);
        setPosition(getDefaultPosition());
      }
    };

    void loadPosition();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampPosition(current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chatId = chatContext?.chat?.id ?? null;
  const character = chatContext?.character ?? null;

  const refreshMood = async () => {
    if (!chatId) return;

    setIsMoodLoading(true);

    try {
      const state = await getCharacterState({
        chatId,
        characterId: character?.id ?? null,
      });
      setMoodState(state);
    } catch (error) {
      console.warn('[PetWidget] 读取心情失败:', error);
    } finally {
      setIsMoodLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && chatId) {
      void refreshMood();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chatId]);

  /*
   * 面板里的迷你聊天流：直接订阅这个消息框自己的 db.messages，跟完整
   * 聊天页面共用同一份数据，桌宠这边发的话、完整聊天页面里发的话，
   * 都会实时同步显示。
   */
  useEffect(() => {
    if (!isOpen || !chatId) {
      return undefined;
    }

    const subscription = liveQuery(() => (
      db.messages
        .where('chatId')
        .equals(chatId)
        .sortBy('timestamp')
    )).subscribe({
      next: (messages) => {
        setRecentMessages((messages || []).slice(-MAX_FEED_MESSAGES));
      },
      error: (error) => {
        console.warn('[PetWidget] 读取消息失败:', error);
        setRecentMessages([]);
      },
    });

    return () => subscription.unsubscribe();
  }, [isOpen, chatId]);

  useEffect(() => {
    if (!chatId) return undefined;

    const unsubscribe = subscribeAiEvents((event) => {
      if (event.chatId !== chatId) return;

      if (event.type === 'AI_TYPING_START') {
        setIsReplying(true);
      }

      if (event.type === 'AI_TYPING_END') {
        setIsReplying(false);
        void refreshMood();
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => () => {
    if (cannedBubbleTimerRef.current) {
      window.clearTimeout(cannedBubbleTimerRef.current);
    }
  }, []);

  if (!isVisible) return null;

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      drag.moved = true;
      setIsDragging(true);
    }

    if (!drag.moved) return;

    const nextPosition = clampPosition({
      x: drag.originX + deltaX,
      y: drag.originY + deltaY,
    });

    positionRef.current = nextPosition;
    setPosition(nextPosition);
  };

  const handlePointerUp = async (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const didMove = drag.moved;
    const nextPosition = clampPosition(positionRef.current);

    dragRef.current.pointerId = null;
    dragRef.current.moved = false;

    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!didMove) {
      setIsOpen((current) => !current);
      return;
    }

    positionRef.current = nextPosition;
    setPosition(nextPosition);

    try {
      await db.settings.put({
        key: PET_WIDGET_POSITION_KEY,
        value: nextPosition,
      });
    } catch (error) {
      console.warn('[PetWidget] 保存位置失败:', error);
    }
  };

  const handlePointerCancel = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;

    dragRef.current.pointerId = null;
    dragRef.current.moved = false;

    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCannedReaction = (reactionId) => {
    const reply = pickCannedReply(reactionId);

    setCannedBubble(reply);

    if (cannedBubbleTimerRef.current) {
      window.clearTimeout(cannedBubbleTimerRef.current);
    }

    cannedBubbleTimerRef.current = window.setTimeout(() => {
      setCannedBubble('');
    }, CANNED_BUBBLE_DURATION);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const trimmed = inputText.trim();
    if (!trimmed || !chatId) return;

    setInputText('');
    setCannedBubble('');

    try {
      await sendPetLightMessage({
        chatId,
        characterId: character?.id ?? null,
        text: trimmed,
      });
    } catch (error) {
      console.warn('[PetWidget] 发送消息失败:', error);
    }
  };

  const dominantLabel = moodState?.dominantEmotion
    ? (EMOTION_LABELS[moodState.dominantEmotion] || EMOTION_LABELS.calm)
    : '';

  const dominantIntensity = Math.round((moodState?.intensity || 0) * 100);

  const popupWidth = Math.min(316, window.innerWidth - 24);
  const popupMaxHeight = Math.min(520, window.innerHeight - 24);

  const popupLeft = Math.min(
    Math.max(12, position.x - popupWidth + WIDGET_SIZE),
    Math.max(12, window.innerWidth - popupWidth - 12)
  );

  const popupTop = Math.min(
    Math.max(12, position.y - popupMaxHeight - 12),
    Math.max(12, window.innerHeight - popupMaxHeight - 12)
  );

  return (
    <>
      {isOpen && (
        <section
          className="fixed z-[60] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            left: popupLeft,
            top: popupTop,
            width: popupWidth,
            maxHeight: popupMaxHeight,
            color: 'var(--text-main)',
            background: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
          }}
          aria-label="桌宠面板"
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: 'var(--divider)' }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                style={{
                  borderColor: 'var(--card-border)',
                  backgroundColor: 'var(--control-soft-bg)',
                }}
              >
                {config?.customAvatar ? (
                  <img
                    src={config.customAvatar}
                    alt={character?.name || '桌宠'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <PawPrint className="h-5 w-5 opacity-60" strokeWidth={1.6} />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {character?.name || '桌宠'}
                </p>
                <p
                  className="truncate text-[10px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {chatContext?.chat?.title || '未命名聊天'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="shrink-0 rounded-full p-1.5"
              style={{ color: 'var(--text-sub)' }}
              aria-label="关闭桌宠面板"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <section>
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  此刻的心情
                </p>

                <Heart className="h-3.5 w-3.5 opacity-50" strokeWidth={1.6} />
              </div>

              {moodState && (
                <p className="mt-1.5 text-xs">
                  {dominantLabel
                    ? `整体偏向"${dominantLabel}"，强度 ${dominantIntensity} / 100`
                    : '心情很平稳，没有特别突出的状态。'}
                </p>
              )}

              {isMoodLoading && !moodState && (
                <p
                  className="mt-1.5 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  正在读取心情……
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {MOOD_KEYS.map((key) => {
                  const value = moodState?.mood?.[key] ?? 0;
                  const isDominant = key === moodState?.dominantEmotion;

                  return (
                    <div key={key} className="min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className="truncate text-[10px]"
                          style={{
                            color: isDominant
                              ? 'var(--text-main)'
                              : 'var(--text-muted)',
                            fontWeight: isDominant ? 600 : 400,
                          }}
                        >
                          {EMOTION_LABELS[key] || key}
                        </span>
                      </div>

                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--control-soft-bg)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(value * 100)}%`,
                            backgroundColor: 'var(--accent-color)',
                            opacity: isDominant ? 1 : 0.55,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className="border-t pt-3"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex flex-wrap gap-2">
                {CANNED_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.id}
                    type="button"
                    onClick={() => handleCannedReaction(reaction.id)}
                    className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors"
                    style={{
                      borderColor: 'var(--card-border)',
                      backgroundColor: 'var(--control-soft-bg)',
                      color: 'var(--text-main)',
                    }}
                  >
                    {reaction.label}
                  </button>
                ))}
              </div>

              {cannedBubble && (
                <div
                  className="mt-2 rounded-xl border px-3 py-2 text-xs"
                  style={{
                    borderColor: 'var(--accent-color)',
                    backgroundColor: 'var(--control-soft-bg)',
                  }}
                >
                  {cannedBubble}
                </div>
              )}
            </section>

            <section
              className="border-t pt-3"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  说句话
                </p>

                {isReplying && (
                  <span
                    className="flex items-center gap-1 text-[10px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Sparkles className="h-3 w-3 animate-pulse" strokeWidth={1.6} />
                    对方正在回复……
                  </span>
                )}
              </div>

              {recentMessages.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {recentMessages.map((message) => (
                    <p
                      key={message.id}
                      className="truncate text-[11px]"
                      style={{
                        color: message.sender === 'user'
                          ? 'var(--text-muted)'
                          : 'var(--text-main)',
                      }}
                    >
                      <span className="opacity-60">
                        {message.sender === 'user'
                          ? '你：'
                          : `${character?.name || '对方'}：`}
                      </span>
                      {getMessagePreview(message)}
                    </p>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="跟它说点什么"
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{
                    color: 'var(--text-main)',
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                  }}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex shrink-0 items-center justify-center rounded-xl px-3 disabled:opacity-40"
                  style={{
                    color: 'var(--accent-foreground)',
                    backgroundColor: 'var(--accent-color)',
                  }}
                  aria-label="发送"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </form>

              <p
                className="mt-2 text-[10px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                这里发的话会进入"{chatContext?.chat?.title || '未命名聊天'}"这个消息框，跟完整聊天页面共用同一份记录和记忆。
              </p>
            </section>
          </div>
        </section>
      )}

      <div
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
          touchAction: 'none',
        }}
      >
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border shadow-xl transition-transform ${
            isDragging ? 'scale-95' : 'active:scale-90'
          }`}
          style={{
            color: 'var(--accent-foreground)',
            backgroundColor: 'var(--accent-color)',
            borderColor: 'var(--card-border)',
            boxShadow:
              '0 12px 30px color-mix(in srgb, var(--accent-color) 30%, transparent)',
          }}
          aria-label="打开桌宠面板"
          title={character?.name || '桌宠'}
        >
          {config?.customAvatar ? (
            <img
              src={config.customAvatar}
              alt={character?.name || '桌宠'}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <PawPrint className="h-6 w-6" strokeWidth={1.6} />
          )}

          {isReplying && (
            <span
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--accent-color)',
              }}
            />
          )}
        </button>
      </div>
    </>
  );
};

export default DesktopPetWidget;