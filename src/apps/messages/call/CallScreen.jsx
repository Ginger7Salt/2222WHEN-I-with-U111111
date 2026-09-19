import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Loader2,
  Phone,
  PhoneOff,
  Send,
  Volume2,
} from 'lucide-react';

import {
  acceptCall,
  declineCall,
  endCall,
  isRealVoiceAvailableForCharacter,
  sendCallTurn,
} from '../../../services/callService';

import './call-screen.css';

const formatElapsed = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

// 全屏"通话中"界面，参照微信语音通话的基本骨架：头像 + 计时/状态、
// 一段简短的文字转写、底部操作区。来电时是接听/拒绝，通话中是
// 打字输入 + 挂断，可以缩小成悬浮球（onMinimize）但不会自动挂断。
const CallScreen = ({ call, onMinimize }) => {
  const { message, character } = call;
  const metadata = message.metadata || {};
  const { status, direction, mode, connectedAt } = metadata;
  const turns = Array.isArray(metadata.turns) ? metadata.turns : [];

  const [draftText, setDraftText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const transcriptRef = useRef(null);
  const audioRef = useRef(null);
  const lastPlayedTurnIdRef = useRef(null);

  const realVoiceAvailable = isRealVoiceAvailableForCharacter(character);

  useEffect(() => {
    if (status !== 'active' || !connectedAt) return undefined;

    const tick = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000))
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [status, connectedAt]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns.length]);

  // 真实语音模式下，新到达的 AI 语音轮次自动播放一次。通话本身就是
  // 用户主动发起/接听的交互，不算是"未经许可自动出声"，跟 RealVoice
  // 卡片默认不自动播放（那是打字聊天里被动收到的消息）是不同场景。
  useEffect(() => {
    if (mode !== 'real' || !audioRef.current) return;

    const latestReadyTurn = [...turns].reverse().find((turn) => (
      turn.by === 'ai' && turn.audioStatus === 'ready' && turn.audio?.audioBlob
    ));

    if (!latestReadyTurn || latestReadyTurn.id === lastPlayedTurnIdRef.current) {
      return;
    }

    lastPlayedTurnIdRef.current = latestReadyTurn.id;

    const objectUrl = URL.createObjectURL(latestReadyTurn.audio.audioBlob);
    audioRef.current.src = objectUrl;

    audioRef.current.play().catch(() => {
      // 浏览器拦截了自动播放，文字转写依然会显示，不影响通话继续。
    });
  }, [turns, mode]);

  const handleAccept = (chosenMode) => {
    void acceptCall({ messageId: message.id, mode: chosenMode });
  };

  const handleDecline = () => {
    void declineCall({ messageId: message.id });
  };

  const handleHangUp = () => {
    void endCall({ messageId: message.id });
  };

  const handleSend = async () => {
    const text = draftText.trim();
    if (!text || isSending) return;

    setDraftText('');
    setIsSending(true);

    try {
      await sendCallTurn({ messageId: message.id, text });
    } finally {
      setIsSending(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (status === 'ringing') {
      return direction === 'incoming' ? '邀请你语音通话' : '正在呼叫...';
    }

    return formatElapsed(elapsedSeconds);
  }, [status, direction, elapsedSeconds]);

  return (
    <div
      className="call-screen fixed inset-0 z-[59] flex flex-col"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <audio ref={audioRef} />

      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <button
          type="button"
          onClick={onMinimize}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          aria-label="缩小通话"
          title="缩小到悬浮球"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-50">
          Voice Call
        </span>

        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6">
        <div className="call-screen__avatar-ring flex h-28 w-28 items-center justify-center rounded-full">
          {character?.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="h-24 w-24 rounded-full border object-cover"
              style={{ borderColor: 'var(--card-bg)' }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border font-serif text-3xl font-semibold"
              style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-bg)' }}
            >
              {character?.name?.[0] || 'C'}
            </div>
          )}
        </div>

        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold">{character?.name}</h2>
          <p className="mt-1 text-sm opacity-60">{statusLabel}</p>
        </div>

        {status === 'active' && (
          <div
            ref={transcriptRef}
            className="call-screen__transcript w-full max-w-sm flex-1 space-y-2 overflow-y-auto no-scrollbar"
          >
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex ${turn.by === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed"
                  style={{
                    background: turn.by === 'user' ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                    color: turn.by === 'user' ? 'var(--accent-foreground)' : 'var(--text-main)',
                  }}
                >
                  {turn.by === 'ai' && turn.mode === 'real' && (
                    <span className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] opacity-60">
                      {turn.audioStatus === 'pending' ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Volume2 className="h-2.5 w-2.5" />
                      )}
                      语音
                    </span>
                  )}
                  <span>{turn.content}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
        {status === 'ringing' && direction === 'incoming' ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleAccept('text')}
                className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                <Phone className="h-3.5 w-3.5" />
                接听（文字语气）
              </button>

              {realVoiceAvailable && (
                <button
                  type="button"
                  onClick={() => handleAccept('real')}
                  className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                  style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  接听（真实语音）
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDecline}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform active:scale-95"
              aria-label="拒绝通话"
              title="拒绝通话"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        ) : status === 'ringing' ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleHangUp}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform active:scale-95"
              aria-label="取消呼叫"
              title="取消呼叫"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="在通话中打字说话..."
              className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-[12px] outline-none"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--divider)',
                color: 'var(--text-main)',
              }}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !draftText.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              aria-label="发送"
              title="发送"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleHangUp}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-transform active:scale-95"
              aria-label="挂断"
              title="挂断"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallScreen;
