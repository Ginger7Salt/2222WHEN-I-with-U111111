import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { ArrowLeft, Send, Sparkles, LogOut, Heart } from 'lucide-react';

import db from '../../db';
import MessageList from '../../components/chat/components/MessageList';
import { triggerOfflineAiResponse, subscribeOfflineAiEvents } from '../../services/offlineAiService';
import { getOfflineSession, completeOfflineSession } from './offlineSessionService';

const EMOTION_LABELS = {
  warmth: '暖意', calm: '平静', joy: '愉悦',
  concern: '牵挂', longing: '想念', hurt: '低落', fatigue: '疲惫',
};

const OfflineChatRoom = ({ chatId, offlineSessionId, onBack, readonly = false }) => {
  const [session, setSession] = useState(null);
  const [chat, setChat] = useState(null);
  const [character, setCharacter] = useState(null);
  const [characterState, setCharacterState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const scrollAreaRef = useRef(null);
  const hasScrolledToLatestRef = useRef(false);

  const isReadonly = readonly || session?.status === 'completed';

  const loadData = useCallback(async () => {
    const [sessionRecord, chatRecord] = await Promise.all([
      getOfflineSession(offlineSessionId),
      db.chats.get(chatId),
    ]);

    if (!sessionRecord || !chatRecord) return;

    const charRecord = await db.characters.get(chatRecord.characterId);
    const stateRecord = await db.characterStates.get(chatId).catch(() => null);

    setSession(sessionRecord);
    setChat(chatRecord);
    if (charRecord) setCharacter(charRecord);
    setCharacterState(stateRecord || null);

    const allMsgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');

    setMessages(allMsgs.filter((m) => (
      m.mode === 'offline' && m.offlineSessionId === offlineSessionId
    )));
  }, [chatId, offlineSessionId]);

  useEffect(() => {
    setIsAiTyping(false);
    void loadData();

    const unsubscribe = subscribeOfflineAiEvents((event) => {
      if (String(event.offlineSessionId) !== String(offlineSessionId)) return;

      if (event.type === 'AI_TYPING_START') {
        setIsAiTyping(true);
        return;
      }

      if (event.type === 'AI_TYPING_END') {
        setIsAiTyping(false);
        return;
      }

      if (event.type === 'NEW_MESSAGE') {
        setIsAiTyping(false);
        void loadData();
      }
    });

    return () => unsubscribe();
  }, [offlineSessionId, loadData]);

  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    scrollArea.scrollTo({
      top: scrollArea.scrollHeight,
      behavior: hasScrolledToLatestRef.current ? 'smooth' : 'auto',
    });

    hasScrolledToLatestRef.current = true;
  }, [messages, isAiTyping]);

  const messagesById = new Map(messages.map((m) => [m.id, m]));

  const handleSendMessage = async () => {
    if (!inputText.trim() || isReadonly) return;

    const nowIso = new Date().toISOString();
    const userAvatar = chat?.userAvatar || character?.userAvatar || '';
    const userName = chat?.userName || character?.userName || '你';

    const newMsg = {
      chatId,
      characterId: character?.id,
      mode: 'offline',
      offlineSessionId,
      sender: 'user',
      type: 'text',
      content: inputText.trim(),
      metadata: {},
      userAvatar,
      userName,
      isRead: true,
      timestamp: nowIso,
    };

    const msgId = await db.messages.add(newMsg);
    newMsg.id = msgId;

    setMessages((previous) => [...previous, newMsg]);
    setInputText('');

    await db.chats.update(chatId, { updatedAt: nowIso });
  };

  const handleTriggerAi = () => {
    if (!character || isAiTyping || isReadonly) return;
    void triggerOfflineAiResponse(chatId, offlineSessionId);
  };

  const handleEndSession = async () => {
    if (session?.status !== 'completed') {
      await completeOfflineSession(offlineSessionId);
    }
    onBack?.();
  };

  if (!session || !chat) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
        <p className="text-sm">正在进入场景...</p>
      </div>
    );
  }

  const dominantEmotionLabel = characterState?.dominantEmotion
    ? (EMOTION_LABELS[characterState.dominantEmotion] || characterState.dominantEmotion)
    : null;

  const intensityPercent = Number.isFinite(characterState?.intensity)
    ? Math.round(Math.max(0, Math.min(1, characterState.intensity)) * 100)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <header className="z-20 shrink-0 px-4 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center rounded-full p-2 opacity-85 hover:opacity-100"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
            aria-label="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-1 flex-col items-center">
            <span className="text-xs font-semibold">{session.sceneLabel}</span>
            <span className="text-[10px] opacity-60">
              {isReadonly ? '这次见面已经结束' : '你们正身处这个场景'}
            </span>
          </div>

          {!isReadonly ? (
            <button
              type="button"
              onClick={handleEndSession}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-semibold opacity-85 hover:opacity-100"
              style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
            >
              <LogOut className="h-3.5 w-3.5" />
              结束
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* 状态栏：场景细节 + 角色此刻的心情 */}
        {(session.sceneDescription || dominantEmotionLabel) && (
          <div
            className="mt-2 flex items-center justify-between gap-2 rounded-full px-3 py-1.5"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <span className="truncate text-[10px] opacity-70">
              {session.sceneDescription || ' '}
            </span>

            {dominantEmotionLabel && (
              <span
                className="flex shrink-0 items-center gap-1 text-[10px] font-semibold"
                style={{ color: 'var(--accent-color)' }}
              >
                <Heart className="h-3 w-3" />
                {dominantEmotionLabel}
                {intensityPercent !== null ? ` · ${intensityPercent}%` : ''}
              </span>
            )}
          </div>
        )}
      </header>

      <section
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar"
      >
        <MessageList
          visibleMessages={messages}
          messagesById={messagesById}
          character={character}
          activeUserAvatar={chat?.userAvatar || character?.userAvatar || ''}
          activeUserName={chat?.userName || character?.userName || '你'}
          isAiTyping={isAiTyping}
          mcpTrace={null}
          typingText={`${character?.name || '对方'} 正在回应...`}
          typingStyle="default"
          hasMoreOlderMessages={false}
          onReroll={() => {}}
          onDelete={() => {}}
          onQuote={() => {}}
          onSwitchVersion={() => {}}
          onResolvedInteraction={loadData}
          onEnterOfflineScene={() => {}}
        />
      </section>

      {!isReadonly && (
        <footer
          className="z-20 shrink-0 px-4 pt-1"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl"
            style={{ background: 'var(--card-bg-gradient)', color: 'var(--text-main)' }}
          >
            <textarea
              rows={1}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage();
                }
              }}
              placeholder={`在这个场景里，对 ${character?.name || '对方'} 说些什么...`}
              className="max-h-40 w-full resize-none bg-transparent text-xs leading-relaxed outline-none"
              style={{ color: 'var(--text-main)', minHeight: '24px' }}
            />

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleSendMessage}
                className="rounded-full p-2 transition-transform hover:opacity-90 active:scale-90"
                style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
                title="发送"
              >
                <Send className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTriggerAi}
                disabled={isAiTyping}
                className="flex items-center gap-1 rounded-full px-3.5 py-2 text-[10px] font-semibold shadow-sm disabled:opacity-50"
                style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                title="触发回应"
              >
                <Sparkles className="h-3 w-3" />
                <span>回应</span>
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default OfflineChatRoom;