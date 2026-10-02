// src/apps/messages/components/bubbleDecorations.jsx
//
// 气泡"装饰"和气泡"配色"是两套独立的开关：配色继续走 BubbleCustomizer 里原有的
// CSS 预设/自定义 CSS 那一套；装饰则是叠加在气泡角上的一小一大两个图标（不对称
// 摆放，不是沿边一整排），任意配色都可以搭配任意装饰，互不影响。
//
// 构图规范：同一种"一大一小、不对称"摆放，配合微倾斜角度与阴影，保持线条描边质感。
// 图标直接用 lucide-react，不依赖 lucide-animated，静态展示轻量无多余开销。
import React from 'react';
import {
  // 原有经典图标
  Star,
  Moon,
  Ghost,
  Heart,
  Snowflake,
  Flower2,
  Droplet,
  // 基础扩充图标
  Sparkles,
  PawPrint,
  Zap,
  Music2,
  Coffee,
  Sprout,
  Ribbon,
  Gamepad2,
  Cloud,
  Feather,
  // 新增：萌宠与生灵
  Cat,
  Dog,
  Fish,
  // 新增：甜蜜食刻
  Candy,
  Cookie,
  Cherry,
  // 新增：奇幻与冒险
  Crown,
  Gem,
  Wand2,
  Rocket,
  Swords,
  Dices,
  // 新增：自然与光晕
  Sun,
  Flame,
  Leaf,
  Rainbow,
  // 新增：灵感与日常
  Lightbulb,
  BookOpen,
  PartyPopper,
  Anchor,
} from 'lucide-react';

export const BUBBLE_DECORATIONS = {
  none: {
    id: 'none',
    name: '无装饰',
  },

  // ===== 原有经典 7 套 =====
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
  'heart-scatter': {
    id: 'heart-scatter',
    name: '爱心飘落',
    Icon: Heart,
    color: '#F2708C',
  },
  'snow-scatter': {
    id: 'snow-scatter',
    name: '雪花纷飞',
    Icon: Snowflake,
    color: '#9FD3E8',
  },
  'bloom-scatter': {
    id: 'bloom-scatter',
    name: '樱花瓣落',
    Icon: Flower2,
    color: '#F3A6C4',
  },
  'bubble-scatter': {
    id: 'bubble-scatter',
    name: '泡泡水光',
    Icon: Droplet,
    color: '#7FD1D9',
  },

  // ===== 现代轻灵 10 套 =====
  'sparkle-scatter': {
    id: 'sparkle-scatter',
    name: '星芒闪烁',
    Icon: Sparkles,
    color: '#FCD34D',
  },
  'paw-scatter': {
    id: 'paw-scatter',
    name: '萌爪肉垫',
    Icon: PawPrint,
    color: '#F472B6',
  },
  'feather-scatter': {
    id: 'feather-scatter',
    name: '轻灵羽毛',
    Icon: Feather,
    color: '#C084FC',
  },
  'zap-scatter': {
    id: 'zap-scatter',
    name: '赛博闪电',
    Icon: Zap,
    color: '#FACC15',
  },
  'music-scatter': {
    id: 'music-scatter',
    name: '律动音符',
    Icon: Music2,
    color: '#60A5FA',
  },
  'coffee-scatter': {
    id: 'coffee-scatter',
    name: '暖调咖啡',
    Icon: Coffee,
    color: '#D97706',
  },
  'sprout-scatter': {
    id: 'sprout-scatter',
    name: '嫩芽新生',
    Icon: Sprout,
    color: '#4ADE80',
  },
  'ribbon-scatter': {
    id: 'ribbon-scatter',
    name: '优雅丝带',
    Icon: Ribbon,
    color: '#FB7185',
  },
  'game-scatter': {
    id: 'game-scatter',
    name: '复古像素',
    Icon: Gamepad2,
    color: '#38BDF8',
  },
  'cloud-scatter': {
    id: 'cloud-scatter',
    name: '棉花晴云',
    Icon: Cloud,
    color: '#93C5FD',
  },

  // ===== 萌宠灵动系列 =====
  'cat-scatter': {
    id: 'cat-scatter',
    name: '猫耳漫步',
    Icon: Cat,
    color: '#FB923C',
  },
  'dog-scatter': {
    id: 'dog-scatter',
    name: '忠诚小狗',
    Icon: Dog,
    color: '#FBBF24',
  },
  'fish-scatter': {
    id: 'fish-scatter',
    name: '游弋金鱼',
    Icon: Fish,
    color: '#38BDF8',
  },

  // ===== 甜蜜食刻系列 =====
  'candy-scatter': {
    id: 'candy-scatter',
    name: '缤纷糖果',
    Icon: Candy,
    color: '#F43F5E',
  },
  'cookie-scatter': {
    id: 'cookie-scatter',
    name: '香脆曲奇',
    Icon: Cookie,
    color: '#B45309',
  },
  'cherry-scatter': {
    id: 'cherry-scatter',
    name: '红樱缀枝',
    Icon: Cherry,
    color: '#E11D48',
  },

  // ===== 奇幻与冒险系列 =====
  'wand-scatter': {
    id: 'wand-scatter',
    name: '魔法使者',
    Icon: Wand2,
    color: '#C084FC',
  },
  'crown-scatter': {
    id: 'crown-scatter',
    name: '璀璨王冠',
    Icon: Crown,
    color: '#EAB308',
  },
  'gem-scatter': {
    id: 'gem-scatter',
    name: '晶莹宝石',
    Icon: Gem,
    color: '#06B6D4',
  },
  'rocket-scatter': {
    id: 'rocket-scatter',
    name: '星际火箭',
    Icon: Rocket,
    color: '#EC4899',
  },
  'swords-scatter': {
    id: 'swords-scatter',
    name: '誓约之刃',
    Icon: Swords,
    color: '#818CF8',
  },
  'dice-scatter': {
    id: 'dice-scatter',
    name: '幸运骰子',
    Icon: Dices,
    color: '#A855F7',
  },

  // ===== 自然与光晕系列 =====
  'sun-scatter': {
    id: 'sun-scatter',
    name: '朝阳初升',
    Icon: Sun,
    color: '#F59E0B',
  },
  'flame-scatter': {
    id: 'flame-scatter',
    name: '炽热微火',
    Icon: Flame,
    color: '#F97316',
  },
  'leaf-scatter': {
    id: 'leaf-scatter',
    name: '林间清风',
    Icon: Leaf,
    color: '#10B981',
  },
  'rainbow-scatter': {
    id: 'rainbow-scatter',
    name: '雨后晴霓',
    Icon: Rainbow,
    color: '#F472B6',
  },

  // ===== 灵感与日常系列 =====
  'lightbulb-scatter': {
    id: 'lightbulb-scatter',
    name: '灵感微光',
    Icon: Lightbulb,
    color: '#FACC15',
  },
  'book-scatter': {
    id: 'book-scatter',
    name: '书卷墨香',
    Icon: BookOpen,
    color: '#8B5CF6',
  },
  'popper-scatter': {
    id: 'popper-scatter',
    name: '派对礼花',
    Icon: PartyPopper,
    color: '#FB7185',
  },
  'anchor-scatter': {
    id: 'anchor-scatter',
    name: '静水远航',
    Icon: Anchor,
    color: '#0284C7',
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
