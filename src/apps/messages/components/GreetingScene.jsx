import React, { useMemo } from 'react';

// 早安/晚安卡片里那一小块"有戏"的动画舞台：
// 晚安——月亮从底下慢慢浮上来，停稳之后周围的星星一颗颗被点亮、
// 然后轻轻闪烁，最后中间浮现 "Goodnight" 字样。
// 早安——太阳同样浮上来，停稳后向四周散开几道光，最后浮现
// "Good morning" 字样。
// 纯 CSS/DOM 动画（随机量用 useMemo 固定住，避免每次重渲染都重新
// 随机导致动画跳变），不用图片、不用 canvas，跟项目里其它特效
// 组件是一路的写法。

const NIGHT_STAR_COUNT = 14;
const MORNING_RAY_COUNT = 8;

// 从月亮/太阳"浮上来"开始算起，到整段动画（含文字浮现）基本播完、
// 可以准备淡出为止的时长——外层弹层组件用这个来决定停留多久。
export const GREETING_SCENE_DURATION_MS = 3550;

function useNightStars() {
  return useMemo(
    () => Array.from({ length: NIGHT_STAR_COUNT }, (_, index) => {
      const left = 6 + Math.random() * 88;
      const top = 8 + Math.random() * 58;
      const size = 1.5 + Math.random() * 2;
      const appearDelay = 0.35 + Math.random() * 1.1;

      return { id: index, left, top, size, appearDelay };
    }),
    [],
  );
}

function useMorningRays() {
  return useMemo(
    () => Array.from({ length: MORNING_RAY_COUNT }, (_, index) => {
      const angle = (index / MORNING_RAY_COUNT) * 360;
      const appearDelay = 0.55 + index * 0.05;

      return { id: index, angle, appearDelay };
    }),
    [],
  );
}

// variant: 'night' | 'morning'
const GreetingScene = ({ variant }) => {
  const isNight = variant === 'night';
  const stars = useNightStars();
  const rays = useMorningRays();

  return (
    <div
      className={`greeting-scene-stage relative w-full overflow-hidden rounded-[1.1rem] ${
        isNight ? 'greeting-scene-night' : 'greeting-scene-morning'
      }`}
      style={{ height: '7.25rem' }}
    >
      {isNight && stars.map((star) => (
        <span
          key={star.id}
          className="greeting-star absolute rounded-full"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            background: '#fff',
            animationDelay: `${star.appearDelay}s, ${star.appearDelay + 0.45}s`,
          }}
        />
      ))}

      {!isNight && rays.map((ray) => (
        <span
          key={ray.id}
          className="greeting-ray absolute"
          style={{
            transform: `rotate(${ray.angle}deg)`,
            animationDelay: `${ray.appearDelay}s`,
          }}
        />
      ))}

      <div
        className={`greeting-orb absolute rounded-full ${
          isNight ? 'greeting-orb-moon' : 'greeting-orb-sun'
        }`}
      />

      <div className="greeting-scene-text absolute inset-x-0 bottom-2.5 text-center">
        <span
          className={`greeting-scene-word ${isNight ? '' : 'greeting-scene-word-morning'}`}
        >
          {isNight ? 'Goodnight' : 'Good morning'}
        </span>
      </div>

      <style>{`
        .greeting-scene-night {
          background: linear-gradient(180deg, #0b1230 0%, #182451 55%, #223066 100%);
        }

        .greeting-scene-morning {
          background: linear-gradient(180deg, #ffd9a0 0%, #ffb684 45%, #ff9a76 100%);
        }

        .greeting-orb {
          left: 50%;
          width: 2.5rem;
          height: 2.5rem;
          transform: translate(-50%, 60px) scale(0.7);
          opacity: 0;
        }

        .greeting-orb-moon {
          top: 26%;
          background: radial-gradient(circle at 35% 35%, #fffdf2, #f3e9c8 55%, #d8c98f 100%);
          box-shadow: 0 0 18px 4px rgba(255, 249, 214, 0.55);
          animation: greeting-orb-rise 1.1s cubic-bezier(0.22, 0.7, 0.32, 1) 0.1s forwards;
        }

        .greeting-orb-sun {
          top: 30%;
          background: radial-gradient(circle at 35% 35%, #fff6d8, #ffd873 55%, #ff9d4d 100%);
          box-shadow: 0 0 24px 8px rgba(255, 189, 92, 0.65);
          animation:
            greeting-orb-rise 1.1s cubic-bezier(0.22, 0.7, 0.32, 1) 0.1s forwards,
            greeting-orb-glow-pulse 2.2s ease-in-out 1.3s infinite;
        }

        @keyframes greeting-orb-rise {
          0% {
            transform: translate(-50%, 60px) scale(0.7);
            opacity: 0;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
        }

        @keyframes greeting-orb-glow-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
        }

        .greeting-star {
          opacity: 0;
          animation-name: greeting-star-appear, greeting-star-twinkle;
          animation-duration: 0.5s, 1.8s;
          animation-timing-function: ease-out, ease-in-out;
          animation-iteration-count: 1, infinite;
          animation-fill-mode: forwards, none;
        }

        @keyframes greeting-star-appear {
          0% { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes greeting-star-twinkle {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        .greeting-ray {
          left: 50%;
          top: 52%;
          width: 2px;
          height: 0;
          transform-origin: top center;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), transparent);
          opacity: 0;
          animation: greeting-ray-extend 0.9s ease-out forwards;
        }

        @keyframes greeting-ray-extend {
          0% { opacity: 0; height: 0; }
          60% { opacity: 0.9; }
          100% { opacity: 0.35; height: 46px; }
        }

        .greeting-scene-text {
          opacity: 0;
          transform: translateY(8px);
          animation: greeting-text-reveal 0.5s ease-out 1.35s forwards;
        }

        .greeting-scene-word {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 1.05rem;
          letter-spacing: 0.04em;
          color: #fdf6e3;
          text-shadow: 0 0 12px rgba(255, 244, 214, 0.5);
        }

        .greeting-scene-word-morning {
          color: #4a2a12;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }

        @keyframes greeting-text-reveal {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .greeting-orb,
          .greeting-star,
          .greeting-ray,
          .greeting-scene-text {
            animation: none !important;
            opacity: 1 !important;
            transform: translate(-50%, 0) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GreetingScene;