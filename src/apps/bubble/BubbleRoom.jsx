// src/apps/bubble/BubbleRoom.jsx
//
// 泡泡模式（Bubble Mode）切片A：房间空壳。
// 只负责把房间信息（标题、成员头像/姓名）显示出来，还没有消息收发——
// 那是切片B的范围：广播消息 + 每个角色独立隔离上下文、顺序逐个生成回复，
// 复用 MessageList/MessageRow 渲染。这里先放一个占位输入框，禁用状态，
// 提示这部分下一轮再做。
//
// 本轮新增：房间外观自定义（背景图/输入框与按钮颜色/按钮外观预设/消息气泡
// 配色与装饰），参照 messages 聊天室 ChatRoom.jsx 的同一套机制原样搬过来，
// 作用域从 .chat-room-container 换成 .bubble-room-container。消息气泡相关
// 的几项（气泡文字颜色、气泡配色与装饰）现在设置了还看不出效果，要等切片B
// 把 MessageList/MessageRow 接进来才会生效——这是有意提前留好设置入口。

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';

import db from '../../db';
import { getBubbleRoomById } from './bubbleService';
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

  // 外观设置面板/气泡定制面板保存后，本地 room 状态原地合并，不用整页重新加载。
  const handleAppearanceUpdated = (patch) => {
    setRoom((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // 消息气泡默认配色——跟 messages/ChatRoom.jsx 的 defaultCss 保持一致，
  // 这样切片B接入 MessageList/MessageRow（复用同一套 .user-bubble/.ai-bubble
  // class）之后，没设置过自定义CSS的房间也能有正常的默认外观。
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

      <div
        className="flex items-center gap-2 px-1 pb-3 border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="bubble-room-top-btn p-1.5 -ml-1 rounded-full opacity-70 hover:opacity-100"
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

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="bubble-room-top-btn p-1.5 rounded-full opacity-70 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
          title="房间外观设置"
        >
          <Settings className="w-4 h-4" />
        </button>
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
          className="bubble-room-input-bar w-full p-2.5 rounded-full text-xs border outline-none opacity-50 cursor-not-allowed"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
        />
      </div>

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