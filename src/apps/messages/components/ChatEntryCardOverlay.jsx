import React, { useEffect, useMemo, useState } from 'react';
import { Ghost } from 'lucide-react';

import GreetingScene, { GREETING_SCENE_DURATION_MS } from './GreetingScene';

// chatroom 里"今天有点不一样"的瞬时提示卡：早安/晚安问候、节日彩蛋。
// 播完自动消失，不写进聊天记录、不挡住聊天操作（pointer-events-none）。
// 卡片外壳跟 ChatHeaderBar 那种精致卡片是一路的极简风格；早安/晚安
// 这两种现在用 GreetingScene 演一小段"月亮升起+星星点亮"式的动画，
// 其余（节日彩蛋）暂时还是图标+文字的简单版本，以后要升级再照这个
// 思路给每个节日单独配一个动画组件。

const DEFAULT_DISPLAY_MS = 2600;
const EXIT_MS = 420;

// 只有在这里登记过的 kind 才会用 GreetingScene 播动画，并且用它自己的
// 时长；没登记的（比如节日彩蛋）走下面的简单图标卡片，用默认时长。
const GREETING_VARIANTS = {
  'greeting:morning': 'morning',
  'greeting:night': 'night',
};

function resolveDisplayMs(kind) {
  if (kind && GREETING_VARIANTS[kind]) return GREETING_SCENE_DURATION_MS;
  return DEFAULT_DISPLAY_MS;
}

function resolveFallbackIcon(kind) {
  if (kind && kind.startsWith('festival:')) return Ghost;
  return Ghost;
}

// card: { kind, title, subtitle, accent } | null，由 useChatEntryCard 给出。
const ChatEntryCardOverlay = ({ card, onDone }) => {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    if (!card) return undefined;

    setPhase('enter');

    const displayMs = resolveDisplayMs(card.kind);
    const exitTimer = window.setTimeout(() => setPhase('exit'), displayMs);
    const doneTimer = window.setTimeout(() => {
      onDone?.();
    }, displayMs + EXIT_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.kind]);

  const greetingVariant = card?.kind ? GREETING_VARIANTS[card.kind] : null;
  const FallbackIcon = useMemo(() => resolveFallbackIcon(card?.kind), [card?.kind]);

  if (!card) return null;

  const accent = card.accent || 'var(--accent-color)';
  const shellClassName = `entry-card-shell flex flex-col items-center gap-2.5 rounded-[1.75rem] text-center shadow-2xl ${
    phase === 'exit' ? 'entry-card-exit' : 'entry-card-enter'
  } ${greetingVariant ? 'p-3' : 'px-6 py-5'}`;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-8">
      <div
        className={shellClassName}
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          minWidth: greetingVariant ? '16rem' : '13.5rem',
          maxWidth: '78vw',
        }}
      >
        {greetingVariant ? (
          <>
            <GreetingScene variant={greetingVariant} />

            {card.subtitle && (
              <div className="px-2 pb-1 text-[11px] leading-snug opacity-70">
                {card.subtitle}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className="entry-card-icon-glow flex h-11 w-11 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${accent} 22%, transparent)`,
                boxShadow: `0 0 22px 2px color-mix(in srgb, ${accent} 35%, transparent)`,
              }}
            >
              <FallbackIcon className="h-5 w-5" style={{ color: accent }} />
            </div>

            <div className="text-sm font-bold leading-tight">{card.title}</div>

            {card.subtitle && (
              <div className="text-[11px] leading-snug opacity-70">{card.subtitle}</div>
            )}
          </>
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