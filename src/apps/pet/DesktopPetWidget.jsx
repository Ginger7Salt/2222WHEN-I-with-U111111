import React, { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
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
  generateAiReactionReply,
  getPetChatContext,
  getPetLastSeenMessageId,
  pickCannedReply,
  sendPetLightMessage,
  setPetLastSeenMessageId,
} from './petWidgetService';

const WIDGET_SIZE = 56;
const HANDLE_WIDTH = 22;
const EDGE_ZONE = 28;
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

/*
 * 贴边隐藏：不额外存一个"是否贴边"的状态，纯粹根据当前 x 坐标离左右
 * 屏幕边缘够不够近来判断。这样贴边/展开完全跟着拖拽位置走，逻辑简单，
 * 也不用改 pet_widget_position 原来存的数据结构。
 */
const getDockSide = (x) => {
  if (x === null || x === undefined) return null;
  if (x <= EDGE_ZONE) return 'left';
  if (x >= window.innerWidth - WIDGET_SIZE - EDGE_ZONE) return 'right';
  return null;
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
  const [isReactionLoading, setIsReactionLoading] = useState(false);

  const [proactiveMessage, setProactiveMessage] = useState('');
  const [hasUnseenProactive, setHasUnseenProactive] = useState(false);

  const positionRef = useRef(position);
  const cannedBubbleTimerRef = useRef(null);
  const lastSeenMessageIdRef = useRef(null);
  const surfacedMessageIdRef = useRef(null);

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
          aiReactionsEnabled: value.aiReactionsEnabled === true,
        });
      },
      error: (error) => {
        console.warn('[PetWidget] 读取配置失败:', error);
        setConfig({
          enabled: false,
          chatId: null,
          customAvatar: null,
          aiReactionsEnabled: false,
        });
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
   * 绑定了新的消息框（或者第一次加载）时，先把"已读到哪条"的基线定下
   * 来——不然一绑定就会把这个消息框里所有历史上的角色消息都当成"刚
   * 冒出来的新话"，弹一堆气泡。基线取这个消息框此刻最新的一条消息 id，
   * 之后只有比它更新的角色消息才会被当成"桌宠自己说的话"。
   */
  useEffect(() => {
    let cancelled = false;
    lastSeenMessageIdRef.current = null;
    surfacedMessageIdRef.current = null;
    setProactiveMessage('');
    setHasUnseenProactive(false);

    if (!chatId) return undefined;

    const loadBaseline = async () => {
      const stored = await getPetLastSeenMessageId(chatId);

      if (stored !== null) {
        if (!cancelled) lastSeenMessageIdRef.current = stored;
        return;
      }

      const latest = await db.messages
        .where('chatId')
        .equals(chatId)
        .last();

      const baselineId = latest?.id ?? 0;

      if (!cancelled) {
        lastSeenMessageIdRef.current = baselineId;
      }

      void setPetLastSeenMessageId(chatId, baselineId);
    };

    void loadBaseline();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  /*
   * 面板里的迷你聊天流：直接订阅这个消息框自己的 db.messages，跟完整
   * 聊天页面共用同一份数据，桌宠这边发的话、完整聊天页面里发的话，
   * 都会实时同步显示。
   *
   * 这里不再只在面板打开时订阅——面板关着的时候也要能"发现"这个消息
   * 框里冒出了一条新的角色消息（比如项目里已有的"跨聊天关心"功能在
   * 用户去别的消息框聊天时，往这里补的一句话），这样桌宠才能在没人点
   * 开它的时候自己"说句话"。
   */
  useEffect(() => {
    if (!chatId) {
      return undefined;
    }

    const subscription = liveQuery(() => (
      db.messages
        .where('chatId')
        .equals(chatId)
        .sortBy('timestamp')
    )).subscribe({
      next: (messages) => {
        const list = messages || [];
        setRecentMessages(list.slice(-MAX_FEED_MESSAGES));

        const latest = list[list.length - 1];

        if (
          !isOpen &&
          latest &&
          latest.sender === 'character' &&
          typeof latest.id === 'number' &&
          latest.id > (lastSeenMessageIdRef.current ?? 0) &&
          surfacedMessageIdRef.current !== latest.id
        ) {
          surfacedMessageIdRef.current = latest.id;
          setProactiveMessage(getMessagePreview(latest));
          setHasUnseenProactive(true);
        }
      },
      error: (error) => {
        console.warn('[PetWidget] 读取消息失败:', error);
        setRecentMessages([]);
      },
    });

    return () => subscription.unsubscribe();
  }, [chatId, isOpen]);

  /*
   * 面板一打开，就认为用户已经看到了这个消息框目前为止的所有消息——
   * 清掉待展示的"桌宠主动说的话"气泡，并把已读标记推进到最新一条。
   */
  useEffect(() => {
    if (!isOpen || !chatId) return;

    setProactiveMessage('');
    setHasUnseenProactive(false);

    const latestId = recentMessages[recentMessages.length - 1]?.id;

    if (typeof latestId === 'number' && latestId > (lastSeenMessageIdRef.current ?? 0)) {
      lastSeenMessageIdRef.current = latestId;
      void setPetLastSeenMessageId(chatId, latestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const showBubble = (text) => {
    setCannedBubble(text);

    if (cannedBubbleTimerRef.current) {
      window.clearTimeout(cannedBubbleTimerRef.current);
    }

    cannedBubbleTimerRef.current = window.setTimeout(() => {
      setCannedBubble('');
    }, CANNED_BUBBLE_DURATION);
  };

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

  const persistPosition = async (nextPosition) => {
    try {
      await db.settings.put({
        key: PET_WIDGET_POSITION_KEY,
        value: nextPosition,
      });
    } catch (error) {
      console.warn('[PetWidget] 保存位置失败:', error);
    }
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
      const restingDockSide = getDockSide(positionRef.current.x);

      if (restingDockSide) {
        /*
         * 贴边状态下点一下，先把它从边上"拉出来"，不直接开面板——
         * 这样贴边的小把手不会一碰就弹出一整个面板，符合"先露出来
         * 再互动"的直觉。
         */
        const undockedX = restingDockSide === 'left'
          ? EDGE_ZONE + 40
          : window.innerWidth - WIDGET_SIZE - EDGE_ZONE - 40;

        const undockedPosition = clampPosition({
          x: undockedX,
          y: positionRef.current.y,
        });

        positionRef.current = undockedPosition;
        setPosition(undockedPosition);
        await persistPosition(undockedPosition);
        return;
      }

      setIsOpen((current) => !current);
      return;
    }

    positionRef.current = nextPosition;
    setPosition(nextPosition);
    await persistPosition(nextPosition);
  };

  const handlePointerCancel = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;

    dragRef.current.pointerId = null;
    dragRef.current.moved = false;

    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCannedReaction = async (reactionId) => {
    const reaction = CANNED_REACTIONS.find((item) => item.id === reactionId);

    if (!config?.aiReactionsEnabled) {
      showBubble(pickCannedReply(reactionId));
      return;
    }

    setCannedBubble('');
    setIsReactionLoading(true);

    try {
      const aiReply = await generateAiReactionReply({
        chatId,
        chat: chatContext?.chat,
        character,
        reactionLabel: reaction?.label || '互动',
      });

      showBubble(aiReply || pickCannedReply(reactionId));
    } finally {
      setIsReactionLoading(false);
    }
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

  const dockSide = isDragging ? null : getDockSide(position.x);

  const bubbleLeft = dockSide === 'left'
    ? 0
    : dockSide === 'right'
      ? window.innerWidth - HANDLE_WIDTH
      : position.x;

  const popupWidth = Math.min(320, window.innerWidth - 24);
  const popupMaxHeight = Math.min(540, window.innerHeight - 24);

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
          className="fixed z-[60] flex flex-col overflow-hidden border shadow-2xl"
          style={{
            left: popupLeft,
            top: popupTop,
            width: popupWidth,
            maxHeight: popupMaxHeight,
            borderRadius: '28px',
            color: 'var(--text-main)',
            background: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
          }}
          aria-label="桌宠面板"
        >
          <div
            className="relative flex items-center justify-between gap-3 px-4 py-3.5"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 22%, transparent), transparent)',
              borderBottom: '1px solid var(--divider)',
            }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2"
                style={{
                  borderColor: 'var(--accent-color)',
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

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
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
                        className="mt-1 h-2 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--control-soft-bg)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round(value * 100)}%`,
                            backgroundColor: 'var(--accent-color)',
                            opacity: isDominant ? 1 : 0.5,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className="pt-3"
              style={{ borderTop: '1px dashed var(--divider)' }}
            >
              <div className="flex flex-wrap gap-2">
                {CANNED_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.id}
                    type="button"
                    onClick={() => handleCannedReaction(reaction.id)}
                    disabled={isReactionLoading}
                    className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-50"
                    style={{
                      borderColor: 'var(--card-border)',
                      backgroundColor:
                        'color-mix(in srgb, var(--accent-color) 12%, var(--control-soft-bg))',
                      color: 'var(--text-main)',
                    }}
                  >
                    {reaction.label}
                  </button>
                ))}
              </div>

              {(cannedBubble || isReactionLoading) && (
                <div className="relative mt-3 ml-2">
                  <div
                    className="inline-block max-w-full rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs"
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, var(--accent-color) 16%, var(--control-soft-bg))',
                      color: 'var(--text-main)',
                    }}
                  >
                    {isReactionLoading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                        想一下……
                      </span>
                    ) : (
                      cannedBubble
                    )}
                  </div>
                </div>
              )}
            </section>

            <section
              className="pt-3"
              style={{ borderTop: '1px dashed var(--divider)' }}
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
                  {recentMessages.map((message) => {
                    const isUser = message.sender === 'user';

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <p
                          className="max-w-[80%] truncate rounded-2xl px-3 py-1.5 text-[11px]"
                          style={{
                            backgroundColor: isUser
                              ? 'var(--control-soft-bg)'
                              : 'color-mix(in srgb, var(--accent-color) 14%, var(--control-soft-bg))',
                            color: 'var(--text-main)',
                          }}
                        >
                          {getMessagePreview(message)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="跟它说点什么"
                  className="min-w-0 flex-1 rounded-full border px-3.5 py-2 text-xs outline-none"
                  style={{
                    color: 'var(--text-main)',
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                  }}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex shrink-0 items-center justify-center rounded-full px-3.5 disabled:opacity-40"
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

      {!isOpen && proactiveMessage && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed z-[55] max-w-[220px] rounded-2xl border px-3.5 py-2.5 text-left text-xs shadow-xl transition-transform active:scale-95"
          style={{
            left: dockSide === 'left'
              ? HANDLE_WIDTH + 10
              : Math.max(12, Math.min(bubbleLeft - 160, window.innerWidth - 232)),
            top: Math.max(12, position.y - 8),
            borderColor: 'var(--card-border)',
            backgroundColor:
              'color-mix(in srgb, var(--accent-color) 18%, var(--modal-bg))',
            color: 'var(--text-main)',
            boxShadow: 'var(--modal-shadow)',
          }}
        >
          <span className="line-clamp-3">{proactiveMessage}</span>
        </button>
      )}

      <div
        className="fixed z-50"
        style={{
          left: bubbleLeft,
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
          className={`relative flex items-center justify-center border shadow-xl transition-transform ${
            isDragging ? 'scale-95' : 'active:scale-90'
          }`}
          style={{
            width: dockSide ? HANDLE_WIDTH : WIDGET_SIZE,
            height: WIDGET_SIZE,
            borderRadius: dockSide === 'left'
              ? '0 18px 18px 0'
              : dockSide === 'right'
                ? '18px 0 0 18px'
                : '9999px',
            color: 'var(--accent-foreground)',
            backgroundColor: 'var(--accent-color)',
            borderColor: 'var(--card-border)',
            boxShadow:
              '0 12px 30px color-mix(in srgb, var(--accent-color) 30%, transparent)',
          }}
          aria-label={dockSide ? '展开桌宠' : '打开桌宠面板'}
          title={character?.name || '桌宠'}
        >
          {dockSide ? (
            <>
              {dockSide === 'left' ? (
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              )}

              {hasUnseenProactive && (
                <span
                  className="pointer-events-none absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border"
                  style={{
                    backgroundColor: '#ff5d7a',
                    borderColor: 'var(--card-bg)',
                  }}
                />
              )}
            </>
          ) : (
            <>
              <span
                className="pointer-events-none absolute -top-1.5 left-2 h-3 w-3 rounded-full border"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  borderColor: 'var(--card-border)',
                }}
              />
              <span
                className="pointer-events-none absolute -top-1.5 right-2 h-3 w-3 rounded-full border"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  borderColor: 'var(--card-border)',
                }}
              />

              {config?.customAvatar ? (
                <img
                  src={config.customAvatar}
                  alt={character?.name || '桌宠'}
                  className="h-full w-full rounded-full object-cover"
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

              {hasUnseenProactive && (
                <span
                  className="pointer-events-none absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border"
                  style={{
                    backgroundColor: '#ff5d7a',
                    borderColor: 'var(--card-bg)',
                  }}
                />
              )}
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default DesktopPetWidget;