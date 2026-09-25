import React, { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';

const EFFECT_DURATION_MS = 1100;

// "群发"发送成功后的全屏动效：给每一个收件人飞出一架纸飞机（用 Send
// 图标代替），从屏幕中心朝各自的方向飞出去、渐隐，播完一次就消失。
// 写法跟 ConfettiBurstEffect 一样——纯 CSS/DOM，不用图片也不用 canvas。
const BroadcastFlyEffect = ({ count = 1, onDone }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, EFFECT_DURATION_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planes = useMemo(() => {
    const total = Math.max(1, Math.min(5, count));

    // 扇形展开：总数越多，扇面越宽，但都朝右上方飞出屏幕，
    // 像"一封封信从手里飞出去"的感觉。
    const spread = total === 1 ? 0 : 70;
    const startAngle = -35 - spread / 2;

    return Array.from({ length: total }, (_, index) => {
      const angleDeg = total === 1
        ? -35
        : startAngle + (spread / (total - 1)) * index;
      const angle = (angleDeg * Math.PI) / 180;
      const distance = 420 + Math.random() * 60;

      return {
        id: index,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        rotate: angleDeg,
        delay: index * 0.06,
        duration: 0.8 + Math.random() * 0.15,
      };
    });
  }, [count]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden">
      {planes.map((plane) => (
        <span
          key={plane.id}
          className="broadcast-fly-plane absolute flex items-center justify-center rounded-full"
          style={{
            left: '50%',
            top: '58%',
            width: '2.75rem',
            height: '2.75rem',
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            '--tx': `${plane.tx}px`,
            '--ty': `${plane.ty}px`,
            '--rot': `${plane.rotate}deg`,
            animation: `broadcast-fly-out ${plane.duration}s cubic-bezier(0.2, 0.7, 0.3, 1) ${plane.delay}s forwards`,
          }}
        >
          <Send className="h-4 w-4" strokeWidth={2.2} />
        </span>
      ))}

      <style>{`
        @keyframes broadcast-fly-out {
          0% {
            transform: translate(-50%, -50%) rotate(var(--rot)) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--rot)) scale(1);
          }
          100% {
            transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(var(--rot)) scale(0.85);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .broadcast-fly-plane {
            animation: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BroadcastFlyEffect;