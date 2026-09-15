import React, { useState, useEffect, useCallback } from 'react';
import { Lock, KeyRound, Loader2, X } from 'lucide-react';

import {
  ensureAccessRecord,
  attemptUnlock,
} from '../../services/innerworld/innerWorldAccessService';
import { generateTodayEntryIfNeeded } from '../../services/innerworld/innerWorldService';

const MAX_ATTEMPTS = 3;

export const InnerWorldLockScreen = ({
  chatId,
  characterId,
  character,
  chat,
  onUnlocked,
  onClose,
}) => {
  const [phase, setPhase] = useState('checking'); // checking | entering | wrong-shake | locked-out | generating
  const [guess, setGuess] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [errorText, setErrorText] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('正在靠近...');

  const backdropImage = character?.avatar || chat?.bgImage || '';

  const proceedToGeneration = useCallback(async () => {
    setPhase('generating');

    const labels = ['正在推开门...', '正在读TA今天的心情...', '正在整理碎碎念...'];
    let labelIndex = 0;
    setLoadingLabel(labels[0]);

    const interval = setInterval(() => {
      labelIndex = (labelIndex + 1) % labels.length;
      setLoadingLabel(labels[labelIndex]);
    }, 1400);

    try {
      const entry = await generateTodayEntryIfNeeded(chatId, characterId, character);
      clearInterval(interval);
      onUnlocked?.(entry);
    } catch (error) {
      clearInterval(interval);
      console.error('[InnerWorldLockScreen] 生成内心内容失败:', error);
      setErrorText('TA的内心暂时有点乱，稍后再试试。');
      setPhase('entering');
    }
  }, [chatId, characterId, character, onUnlocked]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const record = await ensureAccessRecord(chatId, characterId);
      if (cancelled) return;

      setAttemptsUsed(record.attemptsUsed || 0);

      if (record.isUnlocked) {
        void proceedToGeneration();
        return;
      }

      if ((record.attemptsUsed || 0) >= MAX_ATTEMPTS) {
        setPhase('locked-out');
        return;
      }

      setPhase('entering');
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, characterId, proceedToGeneration]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!guess.trim() || phase !== 'entering') return;

    const result = await attemptUnlock(chatId, guess);

    if (result.success) {
      setErrorText('');
      void proceedToGeneration();
      return;
    }

    setAttemptsUsed((previous) => previous + 1);
    setGuess('');

    if (result.lockedOut) {
      setPhase('locked-out');
      return;
    }

    setPhase('wrong-shake');
    setErrorText(`不是这个词。今天还剩 ${result.remaining} 次机会。`);

    window.setTimeout(() => {
      setPhase((current) => (current === 'wrong-shake' ? 'entering' : current));
    }, 500);
  };

  const remaining = Math.max(0, MAX_ATTEMPTS - attemptsUsed);

  return (
    <div className="inner-world-lock fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black text-white">
      {backdropImage && (
        <div
          className="inner-world-lock-bg absolute inset-0"
          style={{ backgroundImage: `url(${backdropImage})` }}
        />
      )}

      <div className="absolute inset-0 bg-black/75 backdrop-blur-2xl" />

      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-10 rounded-full border border-white/15 p-2 text-white/60 transition hover:text-white"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center px-6 text-center">
        {phase === 'checking' && (
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        )}

        {phase === 'generating' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            <p className="font-serif text-sm italic text-white/70 transition-opacity duration-500">
              {loadingLabel}
            </p>
          </div>
        )}

        {phase === 'locked-out' && (
          <div className="flex flex-col items-center gap-3">
            <Lock className="h-7 w-7 text-white/40" />
            <p className="font-serif text-base tracking-wide text-white/85">
              今天的机会已经用完了
            </p>
            <p className="text-xs leading-relaxed text-white/45">
              {character?.name || 'TA'} 的内心，明天再来看看吧。
            </p>
          </div>
        )}

        {(phase === 'entering' || phase === 'wrong-shake') && (
          <form
            onSubmit={handleSubmit}
            className={`flex w-full flex-col items-center gap-5 ${
              phase === 'wrong-shake' ? 'inner-world-lock-shake' : ''
            }`}
          >
            <div className="inner-world-lock-key flex h-14 w-14 items-center justify-center rounded-full border border-white/20">
              <KeyRound className="h-5 w-5 text-white/70" strokeWidth={1.6} />
            </div>

            <div>
              <p className="font-serif text-[0.7rem] uppercase tracking-[0.3em] text-white/40">
                {character?.name || 'TA'} 的内心主页
              </p>
              <p className="mt-1 font-serif text-sm italic text-white/60">
                只有对上密码，才能看见
              </p>
            </div>

            <input
              type="text"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="输入密码"
              autoFocus
              className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-center text-sm tracking-widest text-white outline-none placeholder:text-white/30 focus:border-white/50"
            />

            {errorText && (
              <p className="text-[11px] text-white/50">{errorText}</p>
            )}

            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 rounded-full transition-colors"
                  style={{
                    background: index < remaining ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={!guess.trim()}
              className="rounded-full border border-white/25 px-6 py-2 text-xs font-medium tracking-wide text-white/85 transition active:scale-95 disabled:opacity-30"
            >
              解锁
            </button>
          </form>
        )}
      </div>

      <style>{`
        .inner-world-lock-bg {
          background-size: cover;
          background-position: center;
          filter: blur(38px) saturate(1.1);
          transform: scale(1.2);
          opacity: 0.55;
        }

        .inner-world-lock-key {
          animation: inner-world-key-breathe 3.2s ease-in-out infinite;
        }

        @keyframes inner-world-key-breathe {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        .inner-world-lock-shake {
          animation: inner-world-shake 0.4s ease;
        }

        @keyframes inner-world-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .inner-world-lock-key,
          .inner-world-lock-shake {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default InnerWorldLockScreen;