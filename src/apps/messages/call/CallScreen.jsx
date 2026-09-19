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

// 打字机逐字吐字的速度，以及"这条轮次算不算刚刚发生"的时间窗——
// 只对刚落地的新轮次做逐字动画，翻旧记录、缩小再展开悬浮球时不会
// 把已经说完的话重新打一遍。跟 specialMessageEffects.js 里
// "最近消息才播放特效"是同一个思路。
const TYPEWRITER_MS_PER_CHAR = 32;
const TYPEWRITER_FRESH_WINDOW_MS = 6000;

const formatElapsed = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

// 沉浸式通话界面：背景继承这个聊天窗自己的背景图，没有顶部横条，
// 对话不是气泡列表，而是一行行居中的文字像歌词一样往上飘走
// （用 CSS mask 做渐隐，DOM 里还在，可以向上滚动回看）。
const CallScreen = ({ call, onMinimize }) => {
  const { message, character, chat } = call;
  const metadata = message.metadata || {};
  const { status, direction, mode, connectedAt, aiThinking } = metadata;
  const turns = Array.isArray(metadata.turns) ? metadata.turns : [];
  const latestTurn = turns[turns.length - 1] || null;

  const [draftText, setDraftText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [revealedText, setRevealedText] = useState('');

  const transcriptRef = useRef(null);
  const audioRef = useRef(null);
  const lastPlayedTurnIdRef = useRef(null);
  const animatedTurnIdsRef = useRef(new Set());
  const revealTimerRef = useRef(null);

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
  }, [turns.length, revealedText, aiThinking]);

  // 真实语音模式下，新到达的 AI 语音轮次自动播放一次——通话本身就是
  // 用户主动发起/接听的交互，不算是"未经许可自动出声"。
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

  // 打字机效果：只对"刚刚"到达的 AI 轮次生效。旧轮次（翻看历史、
  // 缩小再展开悬浮球触发的重新渲染）直接整句显示，不重播动画。
  useEffect(() => {
    if (!latestTurn || latestTurn.by !== 'ai') {
      setRevealedText('');
      return undefined;
    }

    const turnTimeMs = new Date(latestTurn.at).getTime();
    const isFresh = Number.isFinite(turnTimeMs)
      && (Date.now() - turnTimeMs) < TYPEWRITER_FRESH_WINDOW_MS;

    if (animatedTurnIdsRef.current.has(latestTurn.id) || !isFresh) {
      setRevealedText(latestTurn.content);
      return undefined;
    }

    animatedTurnIdsRef.current.add(latestTurn.id);

    const fullText = latestTurn.content;
    let index = 0;
    setRevealedText('');

    const tick = () => {
      index += 1;
      setRevealedText(fullText.slice(0, index));

      if (index < fullText.length) {
        revealTimerRef.current = window.setTimeout(tick, TYPEWRITER_MS_PER_CHAR);
      }
    };

    revealTimerRef.current = window.setTimeout(tick, TYPEWRITER_MS_PER_CHAR);

    return () => window.clearTimeout(revealTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestTurn?.id, latestTurn?.content]);

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
      className="call-screen fixed inset-0 z-[59] overflow-hidden"
      style={{ color: '#fff' }}
    >
      <div className="call-screen__backdrop absolute inset-0 -z-10" aria-hidden="true">
        {chat?.bgImage ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${chat.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: 'var(--bg-main)' }} />
        )}

        <div className="call-screen__backdrop-veil absolute inset-0" />
      </div>

      <audio ref={audioRef} />

      <button
        type="button"
        onClick={onMinimize}
        className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-10 flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
        aria-label="缩小通话"
        title="缩小到悬浮球"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      <div className="relative z-0 flex h-full flex-col items-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="call-screen__avatar-ring flex h-16 w-16 items-center justify-center rounded-full">
            {character?.avatar ? (
              <img
                src={character.avatar}
                alt={character.name}
                className="h-14 w-14 rounded-full border object-cover"
                style={{ borderColor: 'rgba(255,255,255,0.5)' }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border font-serif text-xl font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderColor: 'rgba(255,255,255,0.5)',
                }}
              >
                {character?.name?.[0] || 'C'}
              </div>
            )}
          </div>

          <h2
            className="font-serif text-base font-semibold"
            style={{ textShadow: '0 1px 10px rgba(0,0,0,0.45)' }}
          >
            {character?.name}
          </h2>

          <p
            className="font-mono text-[11px] tracking-[0.08em]"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            {statusLabel}
          </p>
        </div>

        {status === 'active' ? (
          <>
            <div
              ref={transcriptRef}
              className="call-screen__flow mt-6 w-full max-w-sm flex-1 space-y-5 overflow-y-auto no-scrollbar"
            >
              {turns.map((turn) => {
                const isLatestAi = turn.id === latestTurn?.id && turn.by === 'ai';
                const displayText = isLatestAi ? revealedText : turn.content;

                return (
                  <div
                    key={turn.id}
                    className={`call-screen__line text-center ${
                      turn.by === 'ai' ? 'call-screen__line--ai' : 'call-screen__line--user'
                    }`}
                  >
                    {turn.by === 'ai' && turn.mode === 'real' && (
                      <div className="mb-1 flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.14em] opacity-60">
                        {turn.audioStatus === 'pending' ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <Volume2 className="h-2.5 w-2.5" />
                        )}
                        语音
                      </div>
                    )}
                    <p>{displayText}</p>
                  </div>
                );
              })}

              {aiThinking && (
                <div className="call-screen__thinking flex items-center justify-center gap-1.5">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>

            <div className="mt-6 flex w-full max-w-sm shrink-0 items-center gap-2">
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
                className="call-screen__input min-w-0 flex-1 rounded-full px-4 py-3 text-[13px] outline-none"
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || !draftText.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/90 text-white transition-transform active:scale-95"
                aria-label="挂断"
                title="挂断"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : status === 'ringing' && direction === 'incoming' ? (
          <div className="mt-auto flex flex-col items-center gap-4 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleAccept('text')}
                className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
              >
                <Phone className="h-3.5 w-3.5" />
                接听（文字语气）
              </button>

              {realVoiceAvailable && (
                <button
                  type="button"
                  onClick={() => handleAccept('real')}
                  className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  接听（真实语音）
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDecline}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/90 text-white shadow-lg transition-transform active:scale-95"
              aria-label="拒绝通话"
              title="拒绝通话"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="mt-auto flex justify-center pb-4">
            <button
              type="button"
              onClick={handleHangUp}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/90 text-white shadow-lg transition-transform active:scale-95"
              aria-label="取消呼叫"
              title="取消呼叫"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallScreen;