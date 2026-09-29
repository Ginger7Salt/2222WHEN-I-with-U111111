// src/apps/bubble/BubbleRoom.jsx
//
// 泡泡模式（Bubble Mode）切片B："最小核心链路"：广播发送 + 每个角色
// 独立隔离上下文、顺序逐个生成回复 + 消息渲染（气泡折叠）+ 记忆写入。
// 编排逻辑在 bubbleAiService.js（不进 aiService.js 那个大文件），渲染
// 用轻量的 BubbleMessageRow.jsx（不是整个复用 messages/MessageRow.jsx）。
//
// 这一轮还没有的（下一轮再做）：语音/图片/转账的"发送方"入口（AI侧已经
// 顺带支持了，因为复用了 aiService.js 的 parseAiResponseToMessages 和
// messages 的卡片组件——只是composer这边还没有让用户主动选"发语音/发
// 图片/发转账"的"+"菜单）、房间共用人设的编辑入口（数据字段已经在读，
// 只是还没有设置面板）、@定向可见度（切片C）。
//
// 房间外观自定义（背景图/输入框与按钮颜色/按钮外观预设/消息气泡配色与装
// 饰），参照 messages 聊天室 ChatRoom.jsx 的同一套机制原样搬过来，作用域
// 从 .chat-room-container 换成 .bubble-room-container。
//
// header/footer 布局：跟 ChatRoom.jsx 的 .chat-input-bar 一样的悬浮胶囊条
// （rounded-full + shadow-2xl + backdrop-blur-2xl，外层 px-4 留边距），
// 不是贴边通栏 + border 分割线的"长条"样式。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Settings, SendHorizontal } from 'lucide-react';

import db from '../../db';
import { getBubbleRoomById, getBubbleMessages } from './bubbleService';
import { sendBubbleBroadcastMessage, subscribeBubbleAiEvents } from './bubbleAiService';
import BubbleMessageRow from './BubbleMessageRow';
import BubbleRoomSettingsModal from './BubbleRoomSettingsModal';
import BubbleCustomizer from '../messages/components/BubbleCustomizer';
import { isValidHexColor, getReadableTextColor } from '../messages/utils/chatColors';
import { getControlStyleRules } from '../messages/chatControlStylePresets';

const BubbleRoom = ({ roomId, onBack, onChatRoomStateChange }) => {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showBubbleCustomizer, setShowBubbleCustomizer] = useState(false);

  const [messages, setMessages] = useState([]);
  const [typingCharacterIds, setTypingCharacterIds] = useState(() => new Set());
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const scrollRef = useRef(null);

  const membersById = useMemo(() => (
    members.reduce((acc, m) => {
      acc[m.id] = m;
      return acc;
    }, {})
  ), [members]);

  const refreshMessages = async (targetRoomId) => {
    const rows = await getBubbleMessages(targetRoomId);
    setMessages(rows);
  };

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

      await refreshMessages(roomId);
      if (!isMounted) return;
      setIsLoading(false);
    };

    void load();

    onChatRoomStateChange?.(true);

    return () => {
      isMounted = false;
      onChatRoomStateChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onChatRoomStateChange]);

  // 订阅泡泡模式的AI事件：新消息到了就重新拉一遍这个房间的消息，
  // 角色开始/结束生成回复时更新"正在输入"的角色集合。房间消息量还不大，
  // 每次事件整表重拉一遍足够简单可靠，等真的有性能问题再优化成增量更新。
  useEffect(() => {
    const unsubscribe = subscribeBubbleAiEvents((event) => {
      if (event.roomId !== room?.id) return;

      if (event.type === 'BUBBLE_MESSAGE_ADDED') {
        void refreshMessages(room.id);
      } else if (event.type === 'BUBBLE_TYPING_START') {
        setTypingCharacterIds((prev) => new Set(prev).add(event.characterId));
      } else if (event.type === 'BUBBLE_TYPING_END') {
        setTypingCharacterIds((prev) => {
          const next = new Set(prev);
          next.delete(event.characterId);
          return next;
        });
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // 新消息到了自动滚到底部。
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // 外观设置面板/气泡定制面板保存后，本地 room 状态原地合并，不用整页重新加载。
  const handleAppearanceUpdated = (patch) => {
    setRoom((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !room?.id) return;

    setInputText('');
    setIsSending(true);

    try {
      await sendBubbleBroadcastMessage(room.id, text);
    } finally {
      setIsSending(false);
    }
  };

  // 消息气泡默认配色——跟 messages/ChatRoom.jsx 的 defaultCss 保持一致。
  const defaultBubbleCss = useMemo(() => `
    .user-bubble {
      background: var(--accent-color);
      color: var(--accent-foreground);
      border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
    }

    .ai-bubble {
      background: var(--control-soft-bg);
      color: var(--text-main);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
    }
  `, []);

  const customCssStr = room?.customCss || '';

  const bubbleMessageStyle = useMemo(() => {
    const cssToApply = customCssStr || defaultBubbleCss;
    return <style>{`.bubble-room-container ${cssToApply}`}</style>;
  }, [customCssStr, defaultBubbleCss]);

  const controlStyleId = room?.controlStyle || 'default';

  const controlStylePresetStyle = useMemo(() => {
    const selectors = [
      '.bubble-room-container .bubble-room-input-bar',
      '.bubble-room-container .bubble-room-top-bar',
      '.bubble-room-container .bubble-room-top-btn',
    ];

    const rules = getControlStyleRules(controlStyleId, selectors);
    if (rules.length === 0) return null;

    return <style>{rules.join('\n')}</style>;
  }, [controlStyleId]);

  const inputBarColor = isValidHexColor(room?.inputBarColor) ? room.inputBarColor : null;
  const inputTextColor = isValidHexColor(room?.inputTextColor) ? room.inputTextColor : null;
  const topBtnColor = isValidHexColor(room?.topBtnColor) ? room.topBtnColor : null;
  const userBubbleTextColor = isValidHexColor(room?.userBubbleTextColor) ? room.userBubbleTextColor : null;
  const aiBubbleTextColor = isValidHexColor(room?.aiBubbleTextColor) ? room.aiBubbleTextColor : null;

  const roomColorStyle = useMemo(() => {
    const rules = [];
    const scope = '.bubble-room-container';

    if (inputBarColor) {
      const fg = getReadableTextColor(inputBarColor);
      rules.push(`${scope} .bubble-room-input-bar { background: ${inputBarColor} !important; color: ${fg} !important; }`);
    }

    if (topBtnColor) {
      rules.push(`${scope} .bubble-room-top-btn { color: ${topBtnColor} !important; }`);
    }

    if (userBubbleTextColor) {
      rules.push(`${scope} .user-bubble { color: ${userBubbleTextColor} !important; }`);
    }

    if (aiBubbleTextColor) {
      rules.push(`${scope} .ai-bubble { color: ${aiBubbleTextColor} !important; }`);
    }

    // 输入框文字颜色放最后一条，确保不管有没有设置 inputBarColor 都能覆盖。
    if (inputTextColor) {
      rules.push(`${scope} .bubble-room-input-bar { color: ${inputTextColor} !important; }`);
    }

    if (rules.length === 0) return null;
    return <style>{rules.join('\n')}</style>;
  }, [inputBarColor, inputTextColor, topBtnColor, userBubbleTextColor, aiBubbleTextColor]);

  const typingNames = Array.from(typingCharacterIds)
    .map((id) => membersById[id]?.name)
    .filter(Boolean);

  return (
    <div className="bubble-room-container relative flex flex-col h-full animate-fade-in overflow-hidden">
      {bubbleMessageStyle}
      {controlStylePresetStyle}
      {roomColorStyle}

      {room?.bgImage && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${room.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />

          {(room?.isBgDimmed ?? true) && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: 'var(--bg-main)',
                opacity: room?.bgOpacity ?? 0.3,
              }}
            />
          )}
        </div>
      )}

      <header className="z-20 shrink-0 px-4 pt-3">
        <div
          className="bubble-room-top-bar flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl"
          style={{
            background: 'var(--card-bg-gradient)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            className="bubble-room-top-btn p-1 rounded-full opacity-70 hover:opacity-100 shrink-0"
            style={{ color: 'var(--text-main)' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex -space-x-2 shrink-0">
            {members.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="w-6 h-6 rounded-full border-2 overflow-hidden flex items-center justify-center text-[9px] font-semibold"
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

          <div className="flex-1 min-w-0">
            <h2
              className="text-xs font-semibold truncate"
              style={{ color: 'var(--text-main)' }}
            >
              {room?.title || (isLoading ? '加载中...' : '未命名房间')}
            </h2>

            {typingNames.length > 0 && (
              <p className="text-[9px] opacity-60 truncate">
                {typingNames.join('、')} 正在输入...
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="bubble-room-top-btn p-1 rounded-full opacity-70 hover:opacity-100 shrink-0"
            style={{ color: 'var(--text-main)' }}
            title="房间外观设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center opacity-50 text-xs">
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center opacity-50 text-xs text-center px-6">
            跟房间里的大家说点什么吧。
          </div>
        ) : (
          <BubbleMessageRow messages={messages} membersById={membersById} />
        )}
      </div>

      <footer
        className="z-20 shrink-0 px-4 pt-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div
          className="bubble-room-input-bar flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl"
          style={{
            background: 'var(--card-bg-gradient)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={`跟房间里的大家说点什么...`}
            className="w-full bg-transparent text-xs outline-none chat-input-font"
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || isSending}
            className="bubble-room-send-btn shrink-0 rounded-full p-2 transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          >
            <SendHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {showSettings && (
        <BubbleRoomSettingsModal
          room={room}
          onClose={() => setShowSettings(false)}
          onUpdated={handleAppearanceUpdated}
          onOpenBubbleCustomizer={() => setShowBubbleCustomizer(true)}
        />
      )}

      {showBubbleCustomizer && (
        <BubbleCustomizer
          currentCss={room?.customCss || ''}
          currentDecoration={room?.bubbleDecoration || 'none'}
          onClose={() => setShowBubbleCustomizer(false)}
          onSave={async (cssCode) => {
            await db.bubbleRooms.update(room.id, { customCss: cssCode });
            handleAppearanceUpdated({ customCss: cssCode });
          }}
          onSaveDecoration={async (decorationId) => {
            await db.bubbleRooms.update(room.id, { bubbleDecoration: decorationId });
            handleAppearanceUpdated({ bubbleDecoration: decorationId });
          }}
        />
      )}
    </div>
  );
};

export default BubbleRoom;