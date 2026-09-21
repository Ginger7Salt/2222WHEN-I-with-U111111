import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { finishUnavailableCall } from '../../../services/callService';
import {
  VOICEMAIL_AFTER_PLAY_MS,
  estimateVoicemailReadMs,
  getVoicemail,
} from '../../../services/voicemailService';

// 呼出的电话对方接不了时，显示在"响铃界面"声波位置的语音信箱：
// 文字卡片 + （有语音时）自动播放语音，播完约 2 秒后挂断。
//
// - 没有语音：文字停留一段按字数估算的时间，然后挂断。
// - iOS Safari 等可能拦截"延迟几秒后的自动播放"，被拦时按钮会提示手动播放。
// - 音频对象只依赖 messageId 建立一次。角色记录每次从 Dexie 读出来 Blob 都是新引用，
//   拿它当依赖会让语音被反复打断重播（和 CallOverlayHost 里铃声的教训一样）。
const VoicemailStage = ({ messageId, voicemail, character }) => {
  const hasAudio = Boolean(voicemail?.hasAudio);

  const characterRef = useRef(character);
  characterRef.current = character;

  const audioElRef = useRef(null);
  const finishTimerRef = useRef(null);

  // 'text' 只有文字 | 'playing' | 'paused' | 'blocked' 自动播放被拦 | 'ended'
  const [playState, setPlayState] = useState(hasAudio ? 'paused' : 'text');

  useEffect(() => {
    const clearFinishTimer = () => {
      if (finishTimerRef.current) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };

    const scheduleFinish = (delayMs) => {
      clearFinishTimer();
      finishTimerRef.current = window.setTimeout(() => {
        void finishUnavailableCall({ messageId });
      }, delayMs);
    };

    const audioBlob = hasAudio ? getVoicemail(characterRef.current)?.audioBlob : null;

    // 只有文字，或者语音这会儿读不出来：文字停留一段时间就挂断。
    if (!audioBlob) {
      setPlayState('text');
      scheduleFinish(estimateVoicemailReadMs(voicemail?.text));

      return clearFinishTimer;
    }

    const objectUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio();
    audio.src = objectUrl;
    audioElRef.current = audio;

    const handlePlay = () => {
      clearFinishTimer();
      setPlayState('playing');
    };
    const handlePause = () => {
      if (!audio.ended) setPlayState('paused');
    };
    const handleEnded = () => {
      setPlayState('ended');
      scheduleFinish(VOICEMAIL_AFTER_PLAY_MS);
    };

    // 语音本身坏了 / 格式不支持：退回"只显示文字"，别把用户卡在通话界面。
    const fallbackToText = () => {
      setPlayState('text');
      scheduleFinish(estimateVoicemailReadMs(voicemail?.text));
    };
    const handlePlayFailure = (error) => {
      if (error?.name === 'NotAllowedError') {
        setPlayState('blocked');
        return;
      }

      fallbackToText();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', fallbackToText);

    audio.play().catch(handlePlayFailure);

    return () => {
      clearFinishTimer();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', fallbackToText);
      audio.pause();
      audio.removeAttribute('src');
      audioElRef.current = null;
      URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, hasAudio]);

  const handleTogglePlay = () => {
    const audio = audioElRef.current;
    if (!audio) return;

    if (playState === 'playing') {
      audio.pause();
      return;
    }

    if (playState === 'ended') {
      audio.currentTime = 0;
    }

    audio.play().catch(() => setPlayState('blocked'));
  };

  const buttonLabel = {
    playing: '暂停',
    paused: '播放语音',
    blocked: '点击播放语音',
    ended: '再听一遍',
  }[playState];

  return (
    <div className="voicemail-stage flex w-full max-w-[19rem] flex-col items-center gap-4 text-center">
      <style>{`
        @keyframes voicemail-stage-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .voicemail-stage__card {
          animation: voicemail-stage-in 0.45s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .voicemail-stage__card { animation: none; }
        }
      `}</style>

      <div
        className="voicemail-stage__card w-full rounded-3xl px-5 py-5"
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.22)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <p className="mb-2.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
          语音信箱
        </p>
        <p
          className="font-serif text-[15px] leading-relaxed"
          style={{ color: '#fff', overflowWrap: 'anywhere' }}
        >
          {voicemail?.text}
        </p>
      </div>

      {buttonLabel && (
        <button
          type="button"
          onClick={handleTogglePlay}
          className="call-ringing__pill flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
        >
          {playState === 'playing'
            ? <Pause className="h-3.5 w-3.5" />
            : <Play className="h-3.5 w-3.5" />}
          {buttonLabel}
        </button>
      )}
    </div>
  );
};

export default VoicemailStage;