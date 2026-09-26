import React, { useMemo } from 'react';

// 早安/晚安卡片：整张卡片本身就是一幕小小的唯美剧场，不再是"卡片里嵌一个
// 小舞台"——弥散的极光色块打底、胶片颗粒质感、天体（月亮/太阳）从下方
// 带着虚化缓缓升起、月晕/日晕跟着轻轻呼吸、星星错落地一颗颗醒来后
// 持续柔和地明灭、诗意的标题和文字最后浮现。整体走"电影感慢直出"的
// 味道，没有任何回弹（Q弹）式的缩放动效，全部是缓入缓出的渐变/位移。
//
// 早安改成了亮蓝天空打底（用户明确要求"做成蓝色背景"），太阳本体用
// 更亮、更饱和的暖光球去跟蓝底形成对比，视觉上会比之前"晨雾暖橙"版
// 更透亮。

const NIGHT_STAR_COUNT = 11;

// 从天体开始升起，到整幕基本都已就位、可以准备淡出为止的时长——
// 外层弹层组件用这个决定停留多久。
export const GREETING_SCENE_DURATION_MS = 4600;
export const GREETING_SCENE_EXIT_MS = 620;

const NIGHT_STAR_POSITIONS = [
  { top: 12, left: 16 }, { top: 18, left: 82 }, { top: 30, left: 10 },
  { top: 8, left: 52 }, { top: 26, left: 90 }, { top: 46, left: 20 },
  { top: 40, left: 78 }, { top: 66, left: 14 }, { top: 60, left: 86 },
  { top: 74, left: 46 }, { top: 20, left: 62 },
];

function useNightStars() {
  return useMemo(
    () => NIGHT_STAR_POSITIONS.slice(0, NIGHT_STAR_COUNT).map((pos, index) => ({
      id: index,
      top: pos.top + (Math.random() * 4 - 2),
      left: pos.left + (Math.random() * 4 - 2),
      delay: 1.8 + Math.random() * 1.3,
      twinkleDuration: 2.6 + Math.random() * 1.6,
    })),
    [],
  );
}

// variant: 'night' | 'morning'
// title: 卡片主标题（"晚安" / "早安"），desc: 下方的诗意小字
const GreetingScene = ({ variant, title, desc }) => {
  const isNight = variant === 'night';
  const stars = useNightStars();

  const spacedTitle = String(title || '').split('').join(' ');

  return (
    <div
      className={`greeting-scene relative flex w-full flex-col items-center overflow-hidden ${
        isNight ? 'greeting-scene-night' : 'greeting-scene-morning'
      }`}
    >
      {/* 弥散极光色块打底 */}
      <div className="greeting-aurora pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="greeting-aurora-orb greeting-aurora-orb-a" />
        <span className="greeting-aurora-orb greeting-aurora-orb-b" />
        <span className="greeting-aurora-orb greeting-aurora-orb-c" />
      </div>

      {/* 胶片颗粒质感 */}
      <div className="greeting-grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="greeting-masthead relative z-[1]">
        {isNight ? 'MIDNIGHT LULLABY' : 'MORNING AUBADE'}
      </div>

      <div className="greeting-theater relative z-[1] w-full">
        {isNight && stars.map((star) => (
          <span
            key={star.id}
            className="greeting-star absolute"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              animationDelay: `${star.delay}s`,
              '--twinkle-duration': `${star.twinkleDuration}s`,
            }}
          />
        ))}

        <div className="greeting-orbit relative mx-auto">
          <span className="greeting-aura absolute" />
          <span className="greeting-body absolute" />
        </div>

        <span className="greeting-mist absolute" aria-hidden="true" />
      </div>

      <div className="greeting-poetry relative z-[1] flex flex-col items-center">
        <h3 className="greeting-poetry-title">{spacedTitle}</h3>
        {desc && <p className="greeting-poetry-desc">{desc}</p>}
      </div>

      <style>{`
        .greeting-scene {
          padding: 1.6rem 1.25rem 1.4rem;
          border-radius: 1.5rem;
          isolation: isolate;
          font-family: 'Songti SC', 'Noto Serif SC', Georgia, 'Times New Roman', serif;
        }

        .greeting-scene-night {
          background: radial-gradient(120% 140% at 50% 0%, #12102a 0%, #070614 62%, #050410 100%);
          color: #f0edf6;
        }

        .greeting-scene-morning {
          background: linear-gradient(180deg, #2f86e0 0%, #4fa3ec 45%, #a9dcfb 100%);
          color: #fffdfa;
        }

        .greeting-aurora {
          filter: blur(30px);
          opacity: 0.9;
        }

        .greeting-aurora-orb {
          position: absolute;
          border-radius: 9999px;
          mix-blend-mode: screen;
          animation: greeting-aurora-float 16s ease-in-out infinite alternate;
        }

        .greeting-scene-night .greeting-aurora-orb-a {
          width: 12rem;
          height: 12rem;
          top: -3rem;
          left: -1.5rem;
          background: radial-gradient(circle, rgba(35, 23, 77, 0.75) 0%, transparent 72%);
        }
        .greeting-scene-night .greeting-aurora-orb-b {
          width: 13rem;
          height: 13rem;
          bottom: -4rem;
          right: -3rem;
          background: radial-gradient(circle, rgba(94, 43, 115, 0.5) 0%, transparent 72%);
          animation-duration: 20s;
          animation-direction: alternate-reverse;
        }
        .greeting-scene-night .greeting-aurora-orb-c {
          width: 9rem;
          height: 9rem;
          top: 35%;
          right: 12%;
          background: radial-gradient(circle, rgba(18, 53, 91, 0.55) 0%, transparent 72%);
          animation-duration: 13s;
        }

        .greeting-scene-morning .greeting-aurora-orb-a {
          width: 12rem;
          height: 12rem;
          top: -3rem;
          left: -1.5rem;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.55) 0%, transparent 72%);
        }
        .greeting-scene-morning .greeting-aurora-orb-b {
          width: 13rem;
          height: 13rem;
          bottom: -4rem;
          right: -3rem;
          background: radial-gradient(circle, rgba(255, 246, 210, 0.4) 0%, transparent 72%);
          animation-duration: 20s;
          animation-direction: alternate-reverse;
        }
        .greeting-scene-morning .greeting-aurora-orb-c {
          width: 9rem;
          height: 9rem;
          top: 35%;
          right: 12%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, transparent 72%);
          animation-duration: 13s;
        }

        @keyframes greeting-aurora-float {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(0.7rem, 0.5rem) scale(1.06); }
          100% { transform: translate(-0.5rem, 0.8rem) scale(0.96); }
        }

        .greeting-grain {
          opacity: 0.05;
          background-image: radial-gradient(rgba(255,255,255,0.9) 1px, transparent 0);
          background-size: 12px 12px;
        }

        .greeting-masthead {
          font-size: 0.55rem;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          opacity: 0.5;
          margin-bottom: 0.5rem;
        }

        .greeting-theater {
          position: relative;
          height: 6.75rem;
          margin-bottom: 0.4rem;
        }

        .greeting-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 3.6rem;
          height: 3.6rem;
          transform: translate(-50%, -50%);
        }

        .greeting-aura {
          inset: -1rem;
          border-radius: 9999px;
          filter: blur(9px);
          opacity: 0;
          animation: greeting-aura-fade-in 1.4s ease-out 1.4s forwards,
            greeting-aura-pulse 3.6s ease-in-out 2.8s infinite alternate;
        }

        .greeting-scene-night .greeting-aura {
          background: radial-gradient(circle, rgba(230, 240, 255, 0.32) 0%, transparent 70%);
        }
        .greeting-scene-morning .greeting-aura {
          background: radial-gradient(circle, rgba(255, 250, 220, 0.75) 0%, transparent 70%);
        }

        @keyframes greeting-aura-fade-in {
          0% { opacity: 0; }
          100% { opacity: 0.7; }
        }
        @keyframes greeting-aura-pulse {
          0% { opacity: 0.55; transform: scale(0.96); }
          100% { opacity: 0.95; transform: scale(1.16); }
        }

        .greeting-body {
          inset: 0;
          border-radius: 9999px;
          opacity: 0;
          transform: translateY(3.4rem);
          filter: blur(7px);
          animation: greeting-body-rise 3s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
        }

        .greeting-scene-night .greeting-body {
          background: radial-gradient(circle at 35% 32%, #fffdfa 0%, #edf2f7 48%, #c9d4e1 100%);
          box-shadow: 0 0 22px rgba(255, 255, 255, 0.55), 0 0 46px rgba(230, 240, 255, 0.35);
        }

        .greeting-scene-morning .greeting-body {
          background: radial-gradient(circle at 38% 34%, #ffffff 0%, #fffbe0 38%, #ffe27a 70%, #ffc94d 100%);
          box-shadow: 0 0 34px rgba(255, 250, 220, 0.95), 0 0 70px rgba(255, 224, 140, 0.7),
            0 0 120px rgba(255, 255, 255, 0.5);
        }

        @keyframes greeting-body-rise {
          0% { transform: translateY(3.4rem); opacity: 0; filter: blur(7px); }
          62% { opacity: 1; filter: blur(0); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }

        .greeting-star {
          width: 3px;
          height: 3px;
          border-radius: 9999px;
          background: #fff;
          opacity: 0;
          box-shadow: 0 0 6px 1px #fff, 0 0 12px 2px rgba(186, 215, 255, 0.65);
          animation: greeting-star-twinkle var(--twinkle-duration, 3s) ease-in-out infinite;
        }

        @keyframes greeting-star-twinkle {
          0% { opacity: 0; transform: scale(0.4); }
          35% { opacity: 0.9; transform: scale(1.05); }
          70% { opacity: 0.35; transform: scale(0.75); }
          100% { opacity: 0.75; transform: scale(0.95); }
        }

        .greeting-mist {
          left: 50%;
          bottom: -0.25rem;
          width: 9rem;
          height: 2.4rem;
          transform: translateX(-50%);
          border-radius: 9999px;
          filter: blur(11px);
          animation: greeting-mist-drift 9s ease-in-out infinite alternate;
        }

        .greeting-scene-night .greeting-mist {
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, transparent 72%);
        }
        .greeting-scene-morning .greeting-mist {
          background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, transparent 72%);
        }

        @keyframes greeting-mist-drift {
          0% { transform: translateX(-56%) scaleY(0.9); }
          100% { transform: translateX(-44%) scaleY(1.1); }
        }

        .greeting-poetry-title {
          font-size: 1.4rem;
          font-weight: 300;
          letter-spacing: 0.05em;
          margin-bottom: 0.35rem;
          opacity: 0;
          transform: translateY(10px);
          animation: greeting-fade-in-up 1.2s ease-out 1s forwards;
        }

        .greeting-poetry-desc {
          font-size: 0.7rem;
          letter-spacing: 0.03em;
          line-height: 1.5;
          max-width: 15rem;
          opacity: 0;
          transform: translateY(10px);
          color: rgba(240, 237, 246, 0.7);
          animation: greeting-fade-in-up 1.2s ease-out 1.35s forwards;
        }

        .greeting-scene-morning .greeting-poetry-desc {
          color: rgba(255, 240, 230, 0.78);
        }

        @keyframes greeting-fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .greeting-aurora-orb,
          .greeting-aura,
          .greeting-body,
          .greeting-star,
          .greeting-mist,
          .greeting-poetry-title,
          .greeting-poetry-desc {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GreetingScene;