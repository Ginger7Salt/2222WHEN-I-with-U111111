import React, { useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';

const HEART_COUNT = 7;
const EFFECT_DURATION_MS = 2600;

// "爱你"类消息的专属特效：几颗小爱心从消息气泡底部往上飘，
// 一边飘一边淡出，播完一次就自动消失。
const FloatingHeartsEffect = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const hearts = useMemo(() => (
    Array.from({ length: HEART_COUNT }, (_, index) => ({
      id: index,
      left: 6 + Math.random() * 88,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 0.9,
      size: 10 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 24,
    }))
  ), []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 -bottom-2 top-0 overflow-visible z-20">
      {hearts.map((heart) => (
        <Heart
          key={heart.id}
          className="absolute opacity-0"
          style={{
            left: `${heart.left}%`,
            bottom: '-6px',
            width: `${heart.size}px`,
            height: `${heart.size}px`,
            color: '#FF5D8F',
            fill: '#FF5D8F',
            '--drift': `${heart.drift}px`,
            animation: `specialFloatingHeart ${heart.duration}s ease-out ${heart.delay}s forwards`,
          }}
        />
      ))}

      <style>{`
        @keyframes specialFloatingHeart {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          20% { opacity: 0.95; }
          100% { transform: translate(var(--drift), -58px) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default FloatingHeartsEffect;