// src/apps/messages/components/bubbleDecorations.jsx
//
// 气泡"装饰"和气泡"配色"是两套独立的开关：配色继续走 BubbleCustomizer 里原有的
// CSS 预设/自定义 CSS 那一套；装饰则是叠加在气泡角上的一小一大两个图标（不对称
// 摆放，不是沿边一整排），任意配色都可以搭配任意装饰，互不影响。
//
// 三套装饰是从预览稿里挑出来定下的："星星散点" / "新月剪影" / "幽灵剪影"，
// 都用同一种"一大一小、不对称"的摆法，只是换了图案和配色。之前"沿边一排图标"
// 的版本被否掉了（太机械），改成了这个更随手、更不对称的构图。
//
// 图标直接用 lucide-react（项目里稳定在用、版本锁定），不依赖 lucide-animated，
// 因为这里是静态贴上去的小装饰，不需要 hover 动效。
import React from 'react';
import { Star, Moon, Ghost } from 'lucide-react';

export const BUBBLE_DECORATIONS = {
  none: {
    id: 'none',
    name: '无装饰',
  },
  'star-scatter': {
    id: 'star-scatter',
    name: '星星散点',
    Icon: Star,
    color: '#F0B429',
  },
  'moon-scatter': {
    id: 'moon-scatter',
    name: '新月剪影',
    Icon: Moon,
    color: '#8FA8DE',
  },
  'ghost-scatter': {
    id: 'ghost-scatter',
    name: '幽灵剪影',
    Icon: Ghost,
    color: '#C7BFE0',
  },
};

export const BUBBLE_DECORATION_LIST = Object.values(BUBBLE_DECORATIONS);

/**
 * 叠加在气泡角上的装饰：一大一小两个同款图标，不对称地贴在气泡顶部的一角
 * （气泡本身已经是 `relative`，这里直接绝对定位）。放在哪一角跟着 `isUser`
 * 走——user 气泡的"尖角"在右下，所以装饰贴在左上角旁边的位置反过来贴到
 * 右上角；ai 气泡镜像贴在左上角，呼应各自气泡的收尾方向。
 */
export function BubbleDecorationOverlay({ decoration, isUser = false }) {
  const config = BUBBLE_DECORATIONS[decoration];
  if (!config || config.id === 'none' || !config.Icon) return null;

  const { Icon, color } = config;
  const side = isUser ? 'right' : 'left';

  const bigIconStyle = {
    position: 'absolute',
    top: '-9px',
    [side]: '8px',
    color,
    opacity: 0.92,
    transform: `rotate(${isUser ? -8 : 8}deg)`,
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
  };

  const smallIconStyle = {
    position: 'absolute',
    top: '6px',
    [side]: '-4px',
    color,
    opacity: 0.7,
    transform: `rotate(${isUser ? 14 : -14}deg)`,
    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
  };

  return (
    <div
      className="bubble-decoration-overlay"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {/*
        故意不传 fill="currentColor"：保持和项目里其它图标一致的线条风格
        （Ghost 图标的两个小眼睛是用描边画的圆点，填色反而会让眼睛被身体的
        同色填充盖掉，看不清）。
      */}
      <Icon size={17} strokeWidth={1.6} style={bigIconStyle} />
      <Icon size={9} strokeWidth={1.6} style={smallIconStyle} />
    </div>
  );
}

export default BubbleDecorationOverlay;