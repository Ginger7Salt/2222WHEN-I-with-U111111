import React, { useEffect, useMemo, useState } from 'react';

// "群发"发送成功后的全屏仪式感动效：一架大纸飞机从屏幕中间飞出去，
// 带着弥散拖尾，飞到半空中化开成一小片星光，慢慢闪烁着散开、淡出。
// 纯 CSS/DOM 动画（跟 ConfettiBurstEffect 一个写法），不用图片、不用 canvas。

const PLANE_DURATION_S = 1.05;
const SPARKLE_DELAY_S = 0.62;
const SPARKLE_DURATION_S = 0.95;
const EFFECT_DURATION_MS = (SPARKLE_DELAY_S + SPARKLE_DURATION_S) * 1000 + 150;

// 飞行方向：固定朝右上方飞出去，量感上更像"信寄出去了"，不再按目标
// 数量拆成好几个方向——一架飞机、一次仪式，比几个小图标各自飞更有分量。
const FLIGHT_ANGLE_DEG = -52;
const FLIGHT_DISTANCE = 300;
const TX = Math.cos((FLIGHT_ANGLE_DEG * Math.PI) / 180) * FLIGHT_DISTANCE;
const TY = Math.sin((FLIGHT_ANGLE_DEG * Math.PI) / 180) * FLIGHT_DISTANCE;
// 星光在飞机快飞到终点、还没完全消失前的位置"接棒"炸开。
const SPARKLE_TX = TX * 0.92;
const SPARKLE_TY = TY * 0.92;

// 简化的折纸飞机剪影：一个尖头三角机身 + 一条中线折痕，纯矢量图形，
// 不是照片也不是任何品牌/角色素材。
function PaperPlaneShape({ opacity = 1 }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" style={{ opacity }} aria-hidden="true">
      <path
        d="M50 6 L92 88 L50 68 L8 88 Z"
        fill="var(--accent-color)"
        stroke="var(--accent-foreground)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M50 6 L50 68"
        stroke="var(--accent-foreground)"
        strokeWidth="1.5"
        strokeOpacity="0.55"
      />
      <path
        d="M50 68 L8 88 L50 6 Z"
        fill="var(--accent-foreground)"
        fillOpacity="0.12"
      />
    </svg>
  );
}

function SparkleBurst() {
  const sparkles = useMemo(
    () => Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 26 + Math.random() * 46;

      return {
        id: index,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 0.2,
        duration: 0.55 + Math.random() * 0.35,
      };
    }),
    [],
  );

  return (
    <>
      {sparkles.map((sparkle) => (
        <span
          key={sparkle.id}
          className="broadcast-sparkle-dot absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            background: '#fff',
            boxShadow: '0 0 6px 1px rgba(255,255,255,0.85), 0 0 14px 3px color-mix(in srgb, var(--accent-color) 55%, transparent)',
            '--stx': `${sparkle.tx}px`,
            '--sty': `${sparkle.ty}px`,
            animation: `broadcast-sparkle-scatter ${sparkle.duration}s ease-out ${sparkle.delay}s forwards`,
          }}
        />
      ))}
    </>
  );
}

const BroadcastFlyEffect = ({ onDone }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, EFFECT_DURATION_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const trailGhosts = [0.05, 0.1, 0.16];

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[999] overflow-hidden"
      style={{
        '--broadcast-tx': `${TX}px`,
        '--broadcast-ty': `${TY}px`,
        '--broadcast-rot': `${FLIGHT_ANGLE_DEG + 90}deg`,
      }}
    >
      {/* 拖尾：几个越来越淡、越来越糊的"残影"，晚一点点出发，
          制造纸飞机身后弥散开的空气感。 */}
      {trailGhosts.map((delay, index) => (
        <div
          key={delay}
          className="broadcast-plane-trail absolute h-14 w-14"
          style={{
            left: '50%',
            top: '58%',
            opacity: 0.32 - index * 0.09,
            filter: `blur(${3 + index * 3}px)`,
            animation: `broadcast-plane-fly ${PLANE_DURATION_S}s cubic-bezier(0.22, 0.6, 0.32, 1) ${delay}s forwards`,
          }}
        >
          <PaperPlaneShape />
        </div>
      ))}

      {/* 主角：那一架大纸飞机 */}
      <div
        className="broadcast-plane-hero absolute h-20 w-20 drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)]"
        style={{
          left: '50%',
          top: '58%',
          animation: `broadcast-plane-fly ${PLANE_DURATION_S}s cubic-bezier(0.22, 0.6, 0.32, 1) forwards`,
        }}
      >
        <PaperPlaneShape />
      </div>

      {/* 星光：飞机快到终点时接棒炸开，闪烁着散开、淡出。 */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '58%',
          width: 0,
          height: 0,
          animation: `broadcast-sparkle-arrive ${SPARKLE_DURATION_S}s ease-out ${SPARKLE_DELAY_S}s forwards`,
          opacity: 0,
        }}
      >
        <SparkleBurst />
      </div>

      <style>{`
        @keyframes broadcast-plane-fly {
          0% {
            transform: translate(-50%, -50%) rotate(var(--broadcast-rot)) scale(0.35);
            opacity: 0;
          }
          14% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--broadcast-rot)) scale(1.15);
          }
          60% {
            opacity: 1;
            transform: translate(
              calc(-50% + var(--broadcast-tx) * 0.72),
              calc(-50% + var(--broadcast-ty) * 0.72)
            ) rotate(var(--broadcast-rot)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(-50% + var(--broadcast-tx)),
              calc(-50% + var(--broadcast-ty))
            ) rotate(var(--broadcast-rot)) scale(0.55);
          }
        }

        @keyframes broadcast-sparkle-arrive {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%);
          }
          25% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translate(
              calc(-50% + var(--broadcast-tx) * 0.92),
              calc(-50% + var(--broadcast-ty) * 0.92)
            );
          }
        }

        @keyframes broadcast-sparkle-scatter {
          0% {
            transform: translate(-50%, -50%) scale(0.4);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(-50% + var(--stx)),
              calc(-50% + var(--sty))
            ) scale(0.3);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .broadcast-plane-hero,
          .broadcast-plane-trail,
          .broadcast-sparkle-dot {
            animation: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BroadcastFlyEffect;