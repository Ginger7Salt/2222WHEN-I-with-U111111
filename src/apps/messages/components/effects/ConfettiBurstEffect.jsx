import React, { useEffect, useMemo, useState } from 'react';

const CONFETTI_COUNT = 14;
const EFFECT_DURATION_MS = 2600;

// 彩色纸屑的固定调色盘：纯装饰用的动效素材，跟"全站零 Emoji"是
//两回事——这里没有任何表情符号或文案，只是几块彩色小方块。
const CONFETTI_COLORS = ['#FF6B6B', '#FFD166', '#06D6A0', '#4D96FF', '#C77DFF', '#FF8FAB'];

// "生日快乐"类消息的专属特效：一小把彩色纸屑从消息气泡中心炸开，
// 播完一次就消失。
const ConfettiBurstEffect = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const pieces = useMemo(() => (
    Array.from({ length: CONFETTI_COUNT }, (_, index) => {
      const angle = (index / CONFETTI_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 30 + Math.random() * 26;

      return {
        id: index,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        rotate: Math.random() * 360,
        delay: Math.random() * 0.15,
        duration: 1.3 + Math.random() * 0.6,
        size: 5 + Math.random() * 4,
      };
    })
  ), []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-20">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute rounded-sm opacity-0"
          style={{
            left: '50%',
            top: '50%',
            width: `${piece.size}px`,
            height: `${piece.size * 1.6}px`,
            background: piece.color,
            '--tx': `${piece.tx}px`,
            '--ty': `${piece.ty}px`,
            '--rot': `${piece.rotate}deg`,
            animation: `specialConfettiBurst ${piece.duration}s ease-out ${piece.delay}s forwards`,
          }}
        />
      ))}

      <style>{`
        @keyframes specialConfettiBurst {
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0; }
          12% { opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty) + 26px)) rotate(var(--rot));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ConfettiBurstEffect;