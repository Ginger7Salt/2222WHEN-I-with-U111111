import React, { useEffect, useMemo, useState } from 'react';
import { Ghost, Moon, Sunrise } from 'lucide-react';

// chatroom 里"今天有点不一样"的瞬时提示卡：早安/晚安问候、节日彩蛋。
// 播完自动消失，不写进聊天记录、不挡住聊天操作（pointer-events-none）。
// 跟 ChatHeaderBar 那种精致卡片是一路的极简风格，不是天气窗那种像素
// 画风格——这里不加粒子特效，只做一个安静的浮现/淡出。

const DISPLAY_MS = 2600;
const EXIT_MS = 420;

const KIND_ICONS = {
  'greeting:morning': Sunrise,
  'greeting:night': Moon,
};

function resolveIcon(kind) {
  if (kind && KIND_ICONS[kind]) return KIND_ICONS[kind];
  if (kind && kind.startsWith('festival:')) return Ghost;
  return Sunrise;
}

// card: { kind, title, subtitle, accent } | null，由 useChatEntryCard 给出。
const ChatEntryCardOverlay = ({ card, onDone }) => {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    if (!card) return undefined;

    setPhase('enter');

    const exitTimer = window.setTimeout(() => setPhase('exit'), DISPLAY_MS);
    const doneTimer = window.setTimeout(() => {
      onDone?.();
    }, DISPLAY_MS + EXIT_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.kind]);

  const Icon = useMemo(() => resolveIcon(card?.kind), [card?.kind]);

  if (!card) return null;

  const accent = card.accent || 'var(--accent-color)';

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-8">
      <div
        className={
          phase === 'exit'
            ? 'entry-card-shell entry-card-exit flex flex-col items-center gap-2.5 rounded-[1.75rem] px-6 py-5 text-center shadow-2xl'
            : 'entry-card-shell entry-card-enter flex flex-col items-center gap-2.5 rounded-[1.75rem] px-6 py-5 text-center shadow-2xl'
        }
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          minWidth: '13.5rem',
          maxWidth: '78vw',
        }}
      >
        <div
          className="entry-card-icon-glow flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: `color-mix(in srgb, ${accent} 22%, transparent)`,
            boxShadow: `0 0 22px 2px color-mix(in srgb, ${accent} 35%, transparent)`,
          }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>

        <div className="text-sm font-bold leading-tight">{card.title}</div>

        {card.subtitle && (
          <div className="text-[11px] leading-snug opacity-70">{card.subtitle}</div>
        )}
      </div>

      <style>{`
        @keyframes entry-card-pop-in {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.86);
          }
          60% {
            opacity: 1;
            transform: translateY(0) scale(1.03);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes entry-card-pop-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px) scale(0.92);
          }
        }

        @keyframes entry-card-icon-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .entry-card-enter {
          animation: entry-card-pop-in 0.42s cubic-bezier(0.22, 0.7, 0.32, 1) forwards;
        }

        .entry-card-exit {
          animation: entry-card-pop-out ${EXIT_MS}ms ease-in forwards;
        }

        .entry-card-icon-glow {
          animation: entry-card-icon-breathe 1.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .entry-card-enter,
          .entry-card-exit,
          .entry-card-icon-glow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatEntryCardOverlay;