// src/apps/messages/components/bubbleDecorations.jsx
//
// 气泡"装饰"和气泡"配色"是两套独立的开关：配色继续走 BubbleCustomizer 里原有的
// CSS 预设/自定义 CSS 那一套；装饰则是叠加在气泡上的一小串图标（比如描边上排开的
// 星星、波浪线），任意配色都可以搭配任意装饰，互不影响。
//
// 【关于图标来源的说明，务必读一下】
// 你提到想用项目里已经装的动画图标库 lucide-animated（它给 lucide 的每个图标都
// 加了 "xxxIcon" 的动效版本，ChatRoom.jsx / OfflineInviteArchive.jsx 里已经在用
// SparklesIcon / ArchiveIcon 等几个）。但这次开发环境网络被限制，没能把依赖装
// 完整、也没法本地起服务实际渲染确认 lucide-animated 这个版本里到底导出了哪些
// 图标名字（星星/波浪对应的 StarIcon / WavesIcon 具体存不存在，我没法在这边
// 100% 验证），所以这里先用同名图标在 lucide-react（项目里稳定在用、版本锁定、
// 一定存在）里的静态版本，保证不会因为猜错导出名字导致直接打不开页面。
// 如果你确认 lucide-animated 里确实有 StarIcon / WavesIcon，把下面这行换成：
//   import { StarIcon as Star, WavesIcon as Waves } from 'lucide-animated';
// 其余代码不用动，图标就会自动带上 lucide-animated 的手势动效。
import React from 'react';
import { Star, Waves } from 'lucide-react';

// 每种装饰：一串沿气泡顶部边框排开的小图标，用 icon + 一点随机感的
// 大小/旋转/透明度参数让它们看起来是"随手缀上去的"，而不是机械重复。
export const BUBBLE_DECORATIONS = {
  none: {
    id: 'none',
    name: '无装饰',
  },
  'stars-trail': {
    id: 'stars-trail',
    name: '星星描边',
    Icon: Star,
    count: 5,
  },
  'wave-trail': {
    id: 'wave-trail',
    name: '波浪描边',
    Icon: Waves,
    count: 4,
  },
};

export const BUBBLE_DECORATION_LIST = Object.values(BUBBLE_DECORATIONS);

// 用消息 id / 索引之类的东西做个简单的确定性伪随机数，
// 避免每次重渲染时装饰图标的大小/旋转角度都在跳动。
function seededVariance(seed, spread) {
  const x = Math.sin(seed * 999.7) * 10000;
  const fraction = x - Math.floor(x);
  return (fraction - 0.5) * 2 * spread;
}

/**
 * 叠加在气泡上的装饰图标条。挂在气泡容器（需要 position: relative，
 * 气泡本身已经是 `relative`）内部，绝对定位到顶部边框上，不吃交互事件。
 */
export function BubbleDecorationOverlay({ decoration }) {
  const config = BUBBLE_DECORATIONS[decoration];
  if (!config || config.id === 'none' || !config.Icon) return null;

  const { Icon, count } = config;
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      className="bubble-decoration-overlay"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '-7px',
        left: '8%',
        right: '8%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {items.map((i) => {
        const rotate = seededVariance(i + 1, 18);
        const lift = seededVariance(i + 7, 3);
        const scale = 0.82 + Math.abs(seededVariance(i + 13, 0.22));

        return (
          <Icon
            key={i}
            size={11}
            strokeWidth={1.6}
            // animateOnHover={false} —— 换回 lucide-animated 时把这行取消注释，
            // 静态气泡装饰不需要 hover 触发的动效。
            style={{
              color: 'var(--accent-color)',
              opacity: 0.85,
              transform: `translateY(${lift}px) rotate(${rotate}deg) scale(${scale})`,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))',
            }}
          />
        );
      })}
    </div>
  );
}

export default BubbleDecorationOverlay;