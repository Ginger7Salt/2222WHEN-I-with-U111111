// src/apps/rp/RpRoom.jsx
//
// 长RP子应用切片C+D：消息收发管道 + 楼层折叠/存档 + 前情提要显示。
//
// 外壳（fixed铺满全屏、浮动头尾）是切片A就定好的，没再动。
//
// 编辑并截断（跟用户确认过的方案）：点"编辑"→改文字→保存时，如果这条
// 消息后面还有消息，先弹确认框，确认了才真的截断；如果这条已经是最后
// 一条，直接保存不用问。
//
// 切片D——楼层折叠 vs 存档移出是两件事（跟用户确认过）：
// - "折叠早期楼层"只是界面显示偏好（session.collapseEarlierFloors），
//   打开之后默认只渲染最近 contextWindowSize 条，更早的收进一条可展开的
//   提示条里——展开只是临时在界面上多看一眼，不影响AI能看到多少历史
//   （AI那边永远是走 rpAiService 的 contextWindowSize 截取，跟这个开关
//   完全无关）。
// - "存档移出"是真的把这些消息标记为 archived，之后不管
//   contextWindowSize 设多大、这个折叠开关开不开，AI 上下文和界面渲染
//   都会永久跳过它们，只能靠前情提要记得。这是个不可逆操作，点之前弹
//   确认框。
// 前情提要（session.summaryText）每 summaryIntervalTurns 轮自动更新，
// 这里只负责显示——点一下"前情提要"这行字可以展开看当前的提要文本，
// 不提供编辑（编辑前情提要这个功能这次没做）。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ScrollText, BookOpen, SendHorizontal, ChevronDown, ChevronUp, Archive,
} from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { getRpSessionById, updateRpSessionPreset, updateRpSessionCollapse } from './rpService';
import { getRpMessages, switchRpMessageVersion, editRpMessageAndTruncate } from './rpMessageService';
import { sendRpMessage, rerollRpMessage, archiveRpMessages, subscribeRpAiEvents } from './rpAiService';
import RpPresetManager from './RpPresetManager';
import RpMessageCard from './RpMessageCard';

const RpRoom = ({ sessionId, onBack, onChatRoomStateChange }) => {
  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null); // { messageId, newContent }
  const [foldExpanded, setFoldExpanded] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [pendingArchiveBeforeId, setPendingArchiveBeforeId] = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    onChatRoomStateChange?.(true);
    return () => onChatRoomStateChange?.(false);
  }, [onChatRoomStateChange]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const unsubscribe = subscribeRpAiEvents((event) => {
      if (event.sessionId !== Number(sessionId)) return;

      if (event.type === 'RP_MESSAGE_ADDED') {
        void refreshMessages();
      } else if (event.type === 'RP_TYPING_START') {
        setIsTyping(true);
      } else if (event.type === 'RP_TYPING_END') {
        setIsTyping(false);
      } else if (event.type === 'RP_SUMMARY_UPDATED') {
        void refreshSession();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const refreshMessages = async () => {
    const rows = await getRpMessages(sessionId);
    setMessages(rows);
  };

  const refreshSession = async () => {
    const s = await getRpSessionById(sessionId);
    if (s) setSession(s);
  };

  const loadData = async () => {
    setLoading(true);
    const s = await getRpSessionById(sessionId);
    setSession(s);

    if (s?.characterId) {
      const c = await db.characters.get(s.characterId);
      setCharacter(c);
    }

    await refreshMessages();
    setLoading(false);
  };

  const handleSelectPreset = async (presetId) => {
    await updateRpSessionPreset(sessionId, presetId);
    setSession((prev) => (prev ? { ...prev, presetId } : prev));
  };

  const handleToggleCollapse = async () => {
    const next = !session.collapseEarlierFloors;
    await updateRpSessionCollapse(sessionId, next);
    setSession((prev) => (prev ? { ...prev, collapseEarlierFloors: next } : prev));
    setFoldExpanded(false);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');
    try {
      await sendRpMessage(sessionId, text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSwitchVersion = async (messageId, direction) => {
    await switchRpMessageVersion(messageId, direction);
    await refreshMessages();
  };

  const handleReroll = async (messageId) => {
    await rerollRpMessage(sessionId, messageId);
  };

  const handleEditAndTruncate = (messageId, newContent, hasFollowing) => {
    if (hasFollowing) {
      setPendingEdit({ messageId, newContent });
      return;
    }
    void applyEdit(messageId, newContent);
  };

  const applyEdit = async (messageId, newContent) => {
    await editRpMessageAndTruncate(sessionId, messageId, newContent);
    await refreshMessages();
  };

  const handleQuote = (text) => {
    const quoted = String(text || '').split('\n')[0].slice(0, 40);
    setInputText((prev) => (prev ? `${prev}\n> ${quoted}\n` : `> ${quoted}\n`));
  };

  const handleArchiveOut = (beforeMessageId) => {
    setPendingArchiveBeforeId(beforeMessageId);
  };

  const confirmArchive = async () => {
    const beforeId = pendingArchiveBeforeId;
    setPendingArchiveBeforeId(null);
    await archiveRpMessages(sessionId, beforeId);
    setFoldExpanded(false);
  };

  // 已存档的消息在界面上彻底不存在——不是折叠，是真的不再显示。
  const activeMessages = useMemo(
    () => messages.filter((m) => !m.archived),
    [messages]
  );

  const { earlierMessages, recentMessages } = useMemo(() => {
    if (!session?.collapseEarlierFloors || activeMessages.length <= (session?.contextWindowSize || 60)) {
      return { earlierMessages: [], recentMessages: activeMessages };
    }
    const windowSize = session.contextWindowSize || 60;
    return {
      earlierMessages: activeMessages.slice(0, activeMessages.length - windowSize),
      recentMessages: activeMessages.slice(activeMessages.length - windowSize),
    };
  }, [activeMessages, session?.collapseEarlierFloors, session?.contextWindowSize]);

  const visibleMessages = foldExpanded ? activeMessages : recentMessages;

  const lastCharacterMessageId = [...activeMessages].reverse().find((m) => m.senderType === 'character')?.id;
  const lastMessageId = activeMessages[activeMessages.length - 1]?.id;

  const sinceLastSummary = session
    ? activeMessages.filter((m) => m.id > (session.summaryCoveredThroughMessageId || 0)).length
    : 0;
  const turnsThresholdMessages = (session?.summaryIntervalTurns || 50) * 2;
  const floorsUntilSummary = Math.max(0, turnsThresholdMessages - sinceLastSummary);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center text-xs opacity-50" style={{ background: 'var(--bg-main)' }}>
        加载中...
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 text-xs opacity-60"
        style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
      >
        <p>这个会话不存在，可能已被删除。</p>
        <button type="button" onClick={onBack} className="underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div
      className="rp-room-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      {/* 氛围背景：用主题自带的装饰色做一层柔和渐变，不是纯色平板——
          就算这一局还没设场景图，房间本身也有一点"故事感"的底色，
          而不是一片死白/死黑。 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(circle at 20% 0%, var(--bg-blob-1) 0%, transparent 55%),
            radial-gradient(circle at 85% 15%, var(--bg-blob-2) 0%, transparent 50%),
            var(--bg-main)
          `,
          opacity: 0.5,
        }}
      />

      {/* 浮动顶栏：透明，不是贴边实心长条，只有返回箭头 + 角色小药丸 */}
      <header className="z-20 flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div
          className="flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3.5 shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)' }}
        >
          {character?.avatar ? (
            <img src={character.avatar} alt={character.name} className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              {character?.name?.[0] || '?'}
            </div>
          )}
          <span className="text-[11px] font-semibold">{session.title}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowPresetManager(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 82%, transparent)' }}
        >
          <BookOpen className="h-4 w-4" />
        </button>
      </header>

      {/* 唯一可滚动的区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mx-auto flex max-w-[620px] flex-col gap-8 pt-2">
          {/* 楼层/总结提示条 */}
          {activeMessages.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-[10px] tracking-wide opacity-45">
                —— 第 {activeMessages.length} 楼
                {session.summaryIntervalTurns ? ` · 距下次总结还有 ${floorsUntilSummary} 楼` : ''}
                {' · '}
                <button type="button" className="underline" onClick={handleToggleCollapse}>
                  {session.collapseEarlierFloors ? '关闭楼层折叠' : '开启楼层折叠'}
                </button>
                {session.summaryText ? (
                  <>
                    {' · '}
                    <button type="button" className="underline" onClick={() => setShowSummary((v) => !v)}>
                      {showSummary ? '收起前情提要' : '查看前情提要'}
                    </button>
                  </>
                ) : null}
                {' ——'}
              </p>

              {showSummary && session.summaryText ? (
                <div
                  className="w-full rounded-2xl border px-4 py-3 text-left text-[11px] leading-relaxed opacity-75"
                  style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
                >
                  {session.summaryText}
                </div>
              ) : null}

              {earlierMessages.length > 0 && (
                <div
                  className="mt-1 flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-2.5 text-[11px]"
                  style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)', color: 'var(--text-muted)' }}
                >
                  <span>前面还有 {earlierMessages.length} 楼对话，已折叠</span>
                  <button
                    type="button"
                    className="flex items-center gap-0.5 underline"
                    onClick={() => setFoldExpanded((v) => !v)}
                  >
                    {foldExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {foldExpanded ? '收起' : '展开'}
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-0.5 underline"
                    onClick={() => handleArchiveOut(recentMessages[0]?.id)}
                  >
                    <Archive className="h-3 w-3" /> 存档移出
                  </button>
                </div>
              )}
            </div>
          )}

          {activeMessages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center opacity-55">
              <ScrollText className="h-8 w-8 opacity-30" />
              <p
                className="text-[13px] italic leading-relaxed"
                style={{ fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif' }}
              >
                故事还没有开始。
                <br />
                在下面写下第一句话吧。
              </p>
            </div>
          ) : (
            visibleMessages.map((msg) => (
              <RpMessageCard
                key={msg.id}
                message={msg}
                character={character}
                session={session}
                canReroll={msg.senderType === 'character' && msg.id === lastCharacterMessageId}
                hasFollowingMessages={msg.id !== lastMessageId}
                onSwitchVersion={(direction) => handleSwitchVersion(msg.id, direction)}
                onReroll={() => handleReroll(msg.id)}
                onEditAndTruncate={(newContent) => handleEditAndTruncate(
                  msg.id,
                  newContent,
                  msg.id !== lastMessageId
                )}
                onQuote={handleQuote}
              />
            ))
          )}

          {isTyping ? (
            <div className="flex flex-col items-center gap-2 opacity-50">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: 'var(--control-soft-bg)' }}
              >
                {character?.name?.[0] || '?'}
              </div>
              <p className="text-[11px] italic">{character?.name || 'TA'} 正在书写...</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* 浮动底栏：跟顶栏一样是透明浮动的圆角输入条，不是贴边的实心一整条 */}
      <div className="z-20 shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-2">
        <div
          className="flex items-end gap-2 rounded-[26px] px-4 py-2.5 shadow-lg backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--card-bg) 88%, transparent)' }}
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="写下这一段..."
            rows={1}
            className="max-h-32 w-full resize-none bg-transparent py-1 text-xs outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <SendHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showPresetManager && (
        <div
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
        >
          <RpPresetManager
            currentPresetId={session.presetId}
            onSelectPreset={handleSelectPreset}
            onClose={() => setShowPresetManager(false)}
          />
        </div>
      )}

      {pendingEdit && (
        <ConfirmModal
          isOpen={Boolean(pendingEdit)}
          title="编辑并截断"
          message="这条消息之后还有其他楼层。保存这次修改会把这条消息之后的所有内容永久删除，确定吗？"
          confirmText="保存并截断"
          onConfirm={() => {
            const { messageId, newContent } = pendingEdit;
            setPendingEdit(null);
            void applyEdit(messageId, newContent);
          }}
          onCancel={() => setPendingEdit(null)}
        />
      )}

      {pendingArchiveBeforeId && (
        <ConfirmModal
          isOpen={Boolean(pendingArchiveBeforeId)}
          title="存档移出"
          message="存档之后，这些楼层会从故事和AI的记忆里永久移除——AI以后只能靠前情提要记得它们发生过，不会再看到原文。这个操作不能撤销，确定吗？"
          confirmText="存档移出"
          onConfirm={confirmArchive}
          onCancel={() => setPendingArchiveBeforeId(null)}
        />
      )}
    </div>
  );
};

export default RpRoom;