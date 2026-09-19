import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';

const STAR_COUNT = 6;
const EFFECT_DURATION_MS = 2400;

// "想你"类消息的专属特效：几颗小星星从消息气泡顶部飘落下来，
// 播完一次就自动消失，不循环、不常驻，不会打扰阅读旧消息。
// 使用方需要保证外层容器是 position: relative（消息气泡本身已经是）。
const FallingStarsEffect = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const stars = useMemo(() => (
    Array.from({ length: STAR_COUNT }, (_, index) => ({
      id: index,
      left: 8 + Math.random() * 84,
      delay: Math.random() * 0.5,
      duration: 1.6 + Math.random() * 0.8,
      size: 10 + Math.random() * 6,
    }))
  ), []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 bottom-0 overflow-visible z-20">
      {stars.map((star) => (
        <Star
          key={star.id}
          className="absolute opacity-0"
          style={{
            left: `${star.left}%`,
            top: '-10px',
            width: `${star.size}px`,
            height: `${star.size}px`,
            color: 'var(--accent-color)',
            fill: 'var(--accent-color)',
            animation: `specialFallingStar ${star.duration}s ease-in ${star.delay}s forwards`,
          }}
        />
      ))}

      <style>{`
        @keyframes specialFallingStar {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translateY(52px) rotate(45deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default FallingStarsEffect;