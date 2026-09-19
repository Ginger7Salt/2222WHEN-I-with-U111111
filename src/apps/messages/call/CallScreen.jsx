import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import {
  acceptCall,
  declineCall,
  endCall,
  isRealVoiceAvailableForCharacter,
  rerollCallTurn,
  sendCallTurn,
  switchCallTurnVersion,
} from '../../../services/callService';

import CallRingingScreen from './CallRingingScreen';
import CallActiveScreen from './CallActiveScreen';

import './call-screen.css';

// 打字机逐字吐字的速度，以及"这条轮次算不算刚刚发生"的时间窗——
// 只对刚落地的新轮次做逐字动画，翻旧记录、缩小再展开悬浮球时不会
// 把已经说完的话重新打一遍。跟 specialMessageEffects.js 里
// "最近消息才播放特效"是同一个思路。
const TYPEWRITER_MS_PER_CHAR = 68;
const TYPEWRITER_FRESH_WINDOW_MS = 6000;

const formatElapsed = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

// 通话最外层容器：只负责背景/缩小按钮这些两种状态共用的东西，以及
// 通话数据、计时、打字机效果这些跟视觉无关的逻辑。"来电中"和
// "通话中"两种截然不同的视觉分别交给 CallRingingScreen /
// CallActiveScreen 两个独立组件。
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

  const handleRerollTurn = (turnId) => (
    rerollCallTurn({ messageId: message.id, turnId })
  );

  const handleSwitchTurnVersion = (turnId, direction) => {
    void switchCallTurnVersion({ messageId: message.id, turnId, direction });
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

      <div className="relative z-0 h-full px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]">
        {status === 'active' ? (
          <CallActiveScreen
            character={character}
            statusLabel={statusLabel}
            turns={turns}
            latestTurn={latestTurn}
            revealedText={revealedText}
            aiThinking={aiThinking}
            transcriptRef={transcriptRef}
            draftText={draftText}
            onDraftChange={setDraftText}
            onSend={handleSend}
            isSending={isSending}
            onHangUp={handleHangUp}
            onRerollTurn={handleRerollTurn}
            onSwitchTurnVersion={handleSwitchTurnVersion}
          />
        ) : (
          <CallRingingScreen
            character={character}
            direction={direction}
            statusLabel={statusLabel}
            realVoiceAvailable={realVoiceAvailable}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onCancel={handleHangUp}
          />
        )}
      </div>
    </div>
  );
};

export default CallScreen;