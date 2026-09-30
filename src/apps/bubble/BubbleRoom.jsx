// src/apps/bubble/BubbleRoom.jsx
//
// 泡泡模式（Bubble Mode）：广播发送 + 每个角色独立隔离上下文、顺序逐个
// 生成回复 + 消息渲染（气泡折叠）+ 记忆写入 + composer 的"+"菜单（发语音/
// 图片/转账）+ 房间共用人设编辑面板 + 切片C的@定向可见度。
// 编排逻辑在 bubbleAiService.js（不进 aiService.js 那个大文件），渲染
// 用轻量的 BubbleMessageRow.jsx（不是整个复用 messages/MessageRow.jsx）。
//
// @定向（切片C）：输入框里打 "@" 会弹出房间成员列表（只在输入框整体是
// "@" + 还没打空格的搜索词时触发——即 @ 必须是这条消息唯一/领头的token，
// 不支持句子中间插入@，这是跟用户确认过的简化范围，不是bug）。选中后自动
// 插入"@角色名 "，发送时用 parseMention 把这个前缀解析成 targetCharacterId
// 和剩余正文，交给 sendBubbleBroadcastMessage——真正的可见度隔离逻辑在
// bubbleAiService.js（哪个角色能看到这条消息、该派给谁回复），这边只负责
// UI 交互和解析。定向消息在消息列表里会带一个"→ 角色名"小标记（跟用户确
// 认过要加），方便你自己回头看聊天记录时分辨哪条是定向发的——这个标记只是
// 给你自己看的，其他角色完全不知道这条消息存在，更不会看到这个标记。
//
// 房间外观自定义（背景图/输入框与按钮颜色/按钮外观预设/消息气泡配色与装
// 饰），参照 messages 聊天室 ChatRoom.jsx 的同一套机制原样搬过来，作用域
// 从 .chat-room-container 换成 .bubble-room-container。
//
// header/footer 布局：跟 ChatRoom.jsx 的 .chat-input-bar 一样的悬浮胶囊条
// （rounded-full + shadow-2xl + backdrop-blur-2xl，外层 px-4 留边距），
// 不是贴边通栏 + border 分割线的"长条"样式。
//
// composer 的"+"菜单（发语音/图片/转账）：照抄 ChatRoom.jsx 那一套
// selectedType + extraInputMeta 的写法——点"+"弹出小菜单选类型，选中后在
// 输入行上方多显示一条小"修饰条"（图片填画面描述、转账填金额+留言，语音
// 直接用主输入框打字当"语音内容"），发送时把 {type, content, metadata}
// 一起交给 sendBubbleBroadcastMessage。跟 ChatRoom 不同的是泡泡模式目前
// 没有"表情包/礼物/外卖/亲属卡"这些——AI侧的 parseAiResponseToMessages
// 已经顺带支持了角色回复语音/图片/转账，但用户主动发送这一轮只做语音/
// 图片/转账三种（跟用户确认过的范围）。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Settings,
  SendHorizontal,
  Plus,
  Image as ImageIcon,
  Volume2,
  DollarSign,
} from 'lucide-react';

import db from '../../db';
import { getBubbleRoomById, getBubbleMessages } from './bubbleService';
import { sendBubbleBroadcastMessage, subscribeBubbleAiEvents } from './bubbleAiService';
import BubbleMessageRow from './BubbleMessageRow';
import BubbleRoomSettingsModal from './BubbleRoomSettingsModal';
import BubbleCustomizer from '../messages/components/BubbleCustomizer';
import { isValidHexColor, getReadableTextColor } from '../messages/utils/chatColors';
import { getControlStyleRules } from '../messages/chatControlStylePresets';
import { TypingIndicator } from '../messages/components/TypingIndicator';

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

  // composer 的"+"菜单状态：selectedType 决定这次发送的消息类型，
  // extraInputMeta 装类型专属的附加字段（目前只有 transfer 的 amount）。
  const [selectedType, setSelectedType] = useState('text');
  const [extraInputMeta, setExtraInputMeta] = useState({});
  const [showInputMenu, setShowInputMenu] = useState(false);

  const scrollRef = useRef(null);
  const textInputRef = useRef(null);

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

  // @ 定向：只在输入框整体是"@" + 还没打空格的搜索词时触发候选列表
  // （比如 "@" 或 "@晓"），一旦打了空格就说明这个 @ 已经"选完了"，不再是
  // 正在输入中的 mention——不支持句子中间插入 @，这是跟用户确认过的简化
  // 范围。
  const mentionQuery = /^@([^\s@]*)$/.exec(inputText)?.[1] ?? null;
  const mentionCandidates = mentionQuery === null
    ? []
    : members.filter((m) => (m.name || '').includes(mentionQuery));

  const handleSelectMention = (member) => {
    setInputText(`@${member.name} `);
    textInputRef.current?.focus();
  };

  // 把 "@角色名 剩余内容" 解析成 { targetCharacterId, content }；角色名对不
  // 上房间任何一个成员（比如打了一半就发送、或者名字里正好没匹配上）就当
  // 普通广播处理，不报错也不强行猜测。
  const parseMention = (text) => {
    const match = /^@(\S+)\s+([\s\S]*)$/.exec(text);
    if (!match) return { targetCharacterId: null, content: text };

    const [, name, rest] = match;
    const member = members.find((m) => m.name === name);
    if (!member) return { targetCharacterId: null, content: text };

    return { targetCharacterId: member.id, content: rest.trim() };
  };

  const handleSend = async () => {
    const raw = inputText.trim();
    const { targetCharacterId, content: parsed } = parseMention(raw);

    // 纯文本模式下解析完没内容就不发（比如只打了"@晓晓 "就点发送）；
    // 非文本类型（语音/图片/转账）允许内容为空（比如转账只填了金额没留
    // 言），跟 ChatRoom.jsx 的发送判断一致。
    if (selectedType === 'text' && !parsed) return;
    if (isSending || !room?.id) return;

    setIsSending(true);

    try {
      await sendBubbleBroadcastMessage(room.id, {
        type: selectedType,
        content: parsed || (selectedType === 'image' ? '画面描述' : ''),
        metadata: extraInputMeta,
        targetCharacterId,
      });

      setInputText('');
      setSelectedType('text');
      setExtraInputMeta({});
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
    <div className="bubble-room-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up">
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

        {typingNames.length > 0 && (
          <div className="mt-2 px-1">
            <TypingIndicator
              customText={`${typingNames.join('、')} 正在输入...`}
              styleType={room?.typingStyle || 'default'}
            />
          </div>
        )}
      </div>

      <footer
        className="z-20 shrink-0 px-4 pt-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        {/* 类型修饰条：选了语音/图片/转账之后才出现，跟 ChatRoom.jsx 的
            MODIFIER 小面板同一个思路——图片填画面描述、转账填金额+留言，
            语音直接用下面主输入框打字当"语音内容"，不需要额外字段。 */}
        {selectedType !== 'text' && (
          <div
            className="mb-2 rounded-2xl p-2.5 text-[11px] space-y-2"
            style={{ background: 'var(--card-bg-gradient)', border: '1px solid var(--card-border)' }}
          >
            <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
              <span>MODIFIER: {selectedType.toUpperCase()}</span>
              <button type="button" onClick={() => { setSelectedType('text'); setExtraInputMeta({}); }}>
                &times;
              </button>
            </div>

            {selectedType === 'transfer' && (
              <input
                type="text"
                placeholder="转账数字"
                value={extraInputMeta.amount || ''}
                onChange={(e) => setExtraInputMeta({ ...extraInputMeta, amount: e.target.value })}
                className="w-full rounded-xl p-2 font-mono outline-none"
                style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
            )}
          </div>
        )}

        <div
          className="bubble-room-input-bar flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl"
          style={{
            background: 'var(--card-bg-gradient)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          }}
        >
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowInputMenu((prev) => !prev)}
              className={`bubble-room-top-btn rounded-full p-2 transition-all active:scale-90 ${
                showInputMenu || selectedType !== 'text' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                background: showInputMenu || selectedType !== 'text' ? 'var(--control-soft-bg)' : 'transparent',
                color: 'var(--text-main)',
              }}
              title="更多输入方式"
            >
              <Plus className={`h-4 w-4 transition-transform duration-300 ${showInputMenu ? 'rotate-45' : ''}`} />
            </button>

            {showInputMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowInputMenu(false)} />

                <div
                  className="absolute bottom-full left-0 z-40 mb-2 w-36 overflow-hidden rounded-2xl py-1 shadow-xl"
                  style={{
                    background: 'var(--card-bg-gradient)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { setShowInputMenu(false); setSelectedType('image'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>画面描述</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowInputMenu(false); setSelectedType('voice'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>模拟语音</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowInputMenu(false); setSelectedType('transfer'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>心意转账</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="relative flex-1 min-w-0">
            {/* 候选列表完全从 inputText 派生（不是单独的 open/close 状态）——
                打空格、清空输入框或直接选中一个成员都会让它自然消失，不需要
                一个"点击外部关闭"的遮罩（那样反而容易误触把 "@" 也清掉）。 */}
            {mentionCandidates.length > 0 && (
              <div
                className="absolute bottom-full left-0 z-40 mb-2 w-40 max-h-48 overflow-y-auto rounded-2xl py-1 shadow-xl"
                style={{
                  background: 'var(--card-bg-gradient)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--card-border)',
                }}
              >
                {mentionCandidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMention(m)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <div
                      className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-semibold"
                      style={{ backgroundColor: 'var(--control-soft-bg)' }}
                    >
                      {m.avatar ? (
                        <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(m.name || '?').slice(0, 1)}</span>
                      )}
                    </div>
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            <input
              ref={textInputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                selectedType === 'text'
                  ? '跟房间里的大家说点什么...（打 @ 可以定向发给某个角色）'
                  : selectedType === 'transfer'
                    ? '心意留言（可留空）'
                    : selectedType === 'voice'
                      ? '模拟语音内容...'
                      : '输入图片的视觉描写细节...'
              }
              className="w-full bg-transparent text-xs outline-none chat-input-font"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={(selectedType === 'text' && !parseMention(inputText.trim()).content) || isSending}
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
    members={members}
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