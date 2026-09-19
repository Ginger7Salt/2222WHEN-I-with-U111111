import React, { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  Heart,
  Loader2,
  MessageCircle,
  PawPrint,
  Send,
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
const MOOD_PREVIEW_COUNT = 4;
const CANNED_BUBBLE_DURATION = 4200;

const DEFAULT_POSITION = { x: null, y: null };

/*
 * 三张"错落卡片"各自相对悬浮球的位置/尺寸上限/旋转角度——数值来自
 * 可视化稿里调好的那版摆法（心情卡左上、聊天卡中间偏右、说话卡偏
 * 下方，各转了不同角度），做出"随手摆开"而不是居中弹窗的感觉。
 * width/maxHeight 只用来做屏幕边界的夹紧计算，卡片内部真实内容
 * 超出时会自己滚动，不会把布局撑坏。
 */
const CARD_SPECS = {
  mood: { width: 236, maxHeight: 340, offsetX: -230, offsetY: -420, rotate: -3 },
  chat: { width: 272, maxHeight: 300, offsetX: -272, offsetY: -378, rotate: 2 },
  send: { width: 252, maxHeight: 250, offsetX: -220, offsetY: -300, rotate: -1.5 },
};

const MENU_WIDTH = 128;
const MENU_HEIGHT = 176;

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

/*
 * 卡片/入口菜单都用同一种"贴着悬浮球、但绝不超出屏幕"的夹紧算法：
 * 先算出"理想中应该摆在悬浮球哪个方向"的原始坐标，再夹到
 * [12, 屏幕边界 - 自身尺寸 - 12] 这个范围里。悬浮球拖到屏幕任何角落，
 * 弹出来的东西都不会被裁掉，只是不一定还保持原来那个"错落"的相对
 * 位置——这点和旧版面板的 popupLeft/popupTop 算法是一个思路。
 */
const clampBoxPosition = (rawLeft, rawTop, width, height) => ({
  left: Math.min(
    Math.max(12, rawLeft),
    Math.max(12, window.innerWidth - width - 12)
  ),
  top: Math.min(
    Math.max(12, rawTop),
    Math.max(12, window.innerHeight - height - 12)
  ),
});

const getMessagePreview = (message) => {
  const content = String(message?.content || '').trim();
  if (!content) return '（发送了一条消息）';
  return content.length > 60 ? `${content.slice(0, 60)}……` : content;
};

export const DesktopPetWidget = () => {
  const [config, setConfig] = useState(null);
  const [chatContext, setChatContext] = useState(null);

  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [isMoodExpanded, setIsMoodExpanded] = useState(false);

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
      setIsMenuOpen(false);
      setActiveCard(null);
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
    if (activeCard === 'mood' && chatId) {
      void refreshMood();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard, chatId]);

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
   * 聊天卡里的迷你聊天流：直接订阅这个消息框自己的 db.messages，跟完整
   * 聊天页面共用同一份数据。
   *
   * 聊天卡没开着的时候也订阅——这样才能"发现"这个消息框里冒出了一条
   * 新的角色消息（比如"跨聊天关心"功能补的一句话），把它当成桌宠自己
   * 冒出来说了一句话，用小气泡提醒用户。
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
          activeCard !== 'chat' &&
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
  }, [chatId, activeCard]);

  /*
   * 聊天卡一打开，就认为用户已经看到了这个消息框目前为止的所有消息——
   * 清掉待展示的"桌宠主动说的话"气泡，并把已读标记推进到最新一条。
   */
  useEffect(() => {
    if (activeCard !== 'chat' || !chatId) return;

    setProactiveMessage('');
    setHasUnseenProactive(false);

    const latestId = recentMessages[recentMessages.length - 1]?.id;

    if (typeof latestId === 'number' && latestId > (lastSeenMessageIdRef.current ?? 0)) {
      lastSeenMessageIdRef.current = latestId;
      void setPetLastSeenMessageId(chatId, latestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard]);

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

  const closeCluster = () => {
    setIsMenuOpen(false);
    setActiveCard(null);
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

    if (!drag.moved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      drag.moved = true;
      setIsDragging(true);
      // 一旦真的开始拖动悬浮球，先把弹出来的入口/卡片收掉，
      // 不然拖着拖着卡片会跟着飘，观感很奇怪。
      if (isMenuOpen || activeCard) {
        closeCluster();
      }
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
         * 贴边状态下点一下，先把它从边上"拉出来"，不直接展开入口——
         * 这样贴边的小把手不会一碰就弹一堆东西出来，符合"先露出来
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

      if (isMenuOpen) {
        closeCluster();
      } else {
        setIsMenuOpen(true);
      }
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

  const handleSelectCard = (cardId) => {
    setActiveCard((current) => (current === cardId ? null : cardId));
    setCannedBubble('');
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

  const moodItems = MOOD_KEYS
    .map((key) => ({
      key,
      label: EMOTION_LABELS[key] || key,
      value: moodState?.mood?.[key] ?? 0,
      isDominant: key === moodState?.dominantEmotion,
    }))
    .sort((a, b) => b.value - a.value);

  const visibleMoodItems = isMoodExpanded
    ? moodItems
    : moodItems.slice(0, MOOD_PREVIEW_COUNT);

  const dockSide = isDragging ? null : getDockSide(position.x);

  const bubbleLeft = dockSide === 'left'
    ? 0
    : dockSide === 'right'
      ? window.innerWidth - HANDLE_WIDTH
      : position.x;

  const menuBox = clampBoxPosition(
    position.x - MENU_WIDTH + WIDGET_SIZE,
    position.y - MENU_HEIGHT - 12,
    MENU_WIDTH,
    MENU_HEIGHT
  );

  const getCardBox = (cardId) => {
    const spec = CARD_SPECS[cardId];
    return clampBoxPosition(
      position.x + spec.offsetX,
      position.y + spec.offsetY,
      spec.width,
      spec.maxHeight
    );
  };

  const renderCardChrome = (cardId, label, children) => {
    const spec = CARD_SPECS[cardId];
    const box = getCardBox(cardId);

    return (
      <div
        key={cardId}
        className="fixed z-[57]"
        style={{
          left: box.left,
          top: box.top,
          width: spec.width,
          maxHeight: spec.maxHeight,
          transform: `rotate(${spec.rotate}deg)`,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveCard(null)}
          className="absolute -top-3 right-4 z-[1] flex h-[30px] w-[30px] items-center justify-center rounded-full border"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--text-main)',
            color: 'var(--text-main)',
          }}
          aria-label="关闭"
        >
          <X className="h-3 w-3" strokeWidth={2.4} />
        </button>

        <div
          className="overflow-y-auto rounded-[22px] border p-[18px]"
          style={{
            maxHeight: spec.maxHeight,
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--text-main)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 32px color-mix(in srgb, var(--text-main) 14%, transparent)',
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </p>

          {children}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 心情卡 */}
      {activeCard === 'mood' && renderCardChrome('mood', 'MOOD · 心情', (
        <>
          <p
            className="mt-1 text-[20px] font-extrabold"
            style={{ color: 'var(--text-main)' }}
          >
            {dominantLabel
              ? `${dominantLabel} · 强度 ${dominantIntensity}`
              : isMoodLoading ? '正在读取心情……' : '心情很平稳'}
          </p>

          <div className="mt-3.5">
            {visibleMoodItems.map((item) => (
              <div
                key={item.key}
                className="mb-2.5 flex items-center gap-2"
                style={{ opacity: item.isDominant ? 1 : 0.55 }}
              >
                <span
                  className="w-10 shrink-0 text-[11px] font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  {item.label}
                </span>
                <div
                  className="h-1 flex-grow overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--control-soft-bg)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(item.value * 100)}%`,
                      backgroundColor: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsMoodExpanded((current) => !current)}
            className="mt-1.5 w-full rounded-full border py-2 text-[10px] font-bold tracking-wide"
            style={{ borderColor: 'var(--text-main)', color: 'var(--text-main)' }}
          >
            {isMoodExpanded ? '收起' : `查看全部 ${MOOD_KEYS.length} 项`}
          </button>
        </>
      ))}

      {/* 聊天卡：只读的最近消息，用来"保留聊天"这个场景 */}
      {activeCard === 'chat' && renderCardChrome('chat', `CHAT · ${chatContext?.chat?.title || '未命名聊天'}`, (
        <div className="mt-3">
          {recentMessages.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              还没有聊天记录。
            </p>
          )}

          {recentMessages.map((message) => {
            const isUser = message.sender === 'user';

            return (
              <div
                key={message.id}
                className={`mb-2.5 flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <p
                  className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug"
                  style={{
                    backgroundColor: isUser ? 'var(--text-main)' : 'var(--card-bg)',
                    color: isUser ? 'var(--accent-foreground)' : 'var(--text-main)',
                    border: isUser ? 'none' : '1.5px solid var(--text-main)',
                  }}
                >
                  {getMessagePreview(message)}
                </p>
              </div>
            );
          })}

          {isReplying && (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-1 rounded-2xl border px-3.5 py-2.5"
                style={{ borderColor: 'var(--text-main)' }}
              >
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} style={{ color: 'var(--text-main)' }} />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 说话卡：只是发一句话，或者戳一戳/打招呼/抱一抱这类小动作 */}
      {activeCard === 'send' && renderCardChrome('send', 'SAY SOMETHING · 说句话', (
        <div className="mt-3">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="跟它说点什么"
              className="min-w-0 flex-grow rounded-full border px-3.5 py-2.5 text-[11px] outline-none"
              style={{
                borderColor: 'var(--text-main)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
              }}
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
              style={{ backgroundColor: 'var(--text-main)' }}
              aria-label="发送"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2.2} style={{ color: 'var(--card-bg)' }} />
            </button>
          </form>

          <div className="mt-3 flex gap-2">
            {CANNED_REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() => handleCannedReaction(reaction.id)}
                disabled={isReactionLoading}
                className="flex-1 rounded-full border py-2 text-[10px] font-bold disabled:opacity-50"
                style={{ borderColor: 'var(--text-main)', color: 'var(--text-main)' }}
              >
                {reaction.label}
              </button>
            ))}
          </div>

          {(cannedBubble || isReactionLoading) && (
            <div
              className="mt-3 rounded-2xl border px-3.5 py-2.5 text-xs"
              style={{ borderColor: 'var(--text-main)', color: 'var(--text-main)' }}
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
          )}
        </div>
      ))}

      {/* 三个小入口：心情 / 聊天 / 说话，点桌宠悬浮球之后才出现 */}
      {isMenuOpen && (
        <div
          className="fixed z-[56] flex flex-col items-end gap-2.5"
          style={{ left: menuBox.left, top: menuBox.top, width: MENU_WIDTH }}
        >
          <button
            type="button"
            onClick={() => handleSelectCard('mood')}
            className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold"
            style={{
              borderColor: 'var(--text-main)',
              backgroundColor: activeCard === 'mood' ? 'var(--text-main)' : 'var(--card-bg)',
              color: activeCard === 'mood' ? 'var(--accent-foreground)' : 'var(--text-main)',
            }}
          >
            <Heart className="h-3.5 w-3.5" strokeWidth={1.8} fill={activeCard === 'mood' ? 'currentColor' : 'none'} />
            心情
          </button>

          <button
            type="button"
            onClick={() => handleSelectCard('chat')}
            className="relative flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold"
            style={{
              borderColor: 'var(--text-main)',
              backgroundColor: activeCard === 'chat' ? 'var(--text-main)' : 'var(--card-bg)',
              color: activeCard === 'chat' ? 'var(--accent-foreground)' : 'var(--text-main)',
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
            聊天
            {hasUnseenProactive && activeCard !== 'chat' && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border"
                style={{ backgroundColor: 'var(--text-main)', borderColor: 'var(--card-bg)' }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectCard('send')}
            className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold"
            style={{
              borderColor: 'var(--text-main)',
              backgroundColor: activeCard === 'send' ? 'var(--text-main)' : 'var(--card-bg)',
              color: activeCard === 'send' ? 'var(--accent-foreground)' : 'var(--text-main)',
            }}
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.9} fill={activeCard === 'send' ? 'currentColor' : 'none'} />
            说话
          </button>
        </div>
      )}

      {/* 桌宠没被点开、且有条没看过的话时，冒一个小气泡预览 */}
      {!isMenuOpen && proactiveMessage && (
        <button
          type="button"
          onClick={() => {
            setIsMenuOpen(true);
            setActiveCard('chat');
          }}
          className="fixed z-[55] max-w-[220px] rounded-2xl border px-3.5 py-2.5 text-left text-xs shadow-xl transition-transform active:scale-95"
          style={{
            left: dockSide === 'left'
              ? HANDLE_WIDTH + 10
              : Math.max(12, Math.min(bubbleLeft - 160, window.innerWidth - 232)),
            top: Math.max(12, position.y - 8),
            borderColor: 'var(--text-main)',
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-main)',
          }}
        >
          <span className="line-clamp-3">{proactiveMessage}</span>
        </button>
      )}

      {/* 桌宠悬浮球本体 */}
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
          className={`relative flex items-center justify-center border transition-transform ${
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
  color: 'var(--text-main)',
  backgroundColor: dockSide ? 'var(--card-bg)' : 'transparent',
  borderColor: dockSide ? 'var(--text-main)' : 'transparent',
  boxShadow: dockSide
    ? '0 10px 24px color-mix(in srgb, var(--text-main) 16%, transparent)'
    : 'none',
}}
          aria-label={dockSide ? '展开桌宠' : (isMenuOpen ? '收起桌宠' : '打开桌宠')}
          title={character?.name || '桌宠'}
        >
          {dockSide ? (
            <>
              <PawPrint className="h-3 w-3" strokeWidth={2} />
              {hasUnseenProactive && (
                <span
                  className="pointer-events-none absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border"
                  style={{ backgroundColor: 'var(--text-main)', borderColor: 'var(--card-bg)' }}
                />
              )}
            </>
          ) : isMenuOpen ? (
            <X className="h-5 w-5" strokeWidth={1.8} />
          ) : (
            <>
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
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--text-main)' }}
                />
              )}

              {hasUnseenProactive && !isReplying && (
                <span
                  className="pointer-events-none absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border"
                  style={{ backgroundColor: 'var(--text-main)', borderColor: 'var(--card-bg)' }}
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