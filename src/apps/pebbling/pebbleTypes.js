// src/apps/pebbling/pebbleTypes.js
// 全站零 Emoji 铁律：使用 lucide-react 矢量图标

import {
  Sparkles,
  Droplets,
  Sun,
  Moon,
  HeartHandshake,
  Shield,
  Gift,
  Smile,
  CloudRain,
  Zap,
  Wind,
  Leaf,
  Mail,
  Gem,
  Cookie,
} from 'lucide-react';

export const PEBBLE_TYPES = {
  'stream-pebble': {
    id: 'stream-pebble',
    name: '河流润石',
    subtitle: 'Stream Pebble',
    desc: '平静安稳、温润如水的日常点滴分享',
    icon: Sparkles,
    stoneColor: 'rgba(148, 163, 184, 0.25)', // 石头本身特有的矿石光泽（极淡）
    borderColor: 'rgba(148, 163, 184, 0.4)',
    glowColor: 'rgba(148, 163, 184, 0.15)',
  },
  'sea-glass': {
    id: 'sea-glass',
    name: '蒂芙尼海玻璃',
    subtitle: 'Sea Glass',
    desc: '偶然捡拾的小确幸、清澈治愈的灵感',
    icon: Droplets,
    stoneColor: 'rgba(45, 212, 191, 0.2)',
    borderColor: 'rgba(45, 212, 191, 0.45)',
    glowColor: 'rgba(45, 212, 191, 0.2)',
  },
  'amber-fossil': {
    id: 'amber-fossil',
    name: '暖琥珀',
    subtitle: 'Amber Fossil',
    desc: '想要永久凝固珍藏的温馨时光',
    icon: Sun,
    stoneColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    glowColor: 'rgba(245, 158, 11, 0.2)',
  },
  'moon-stone': {
    id: 'moon-stone',
    name: '沉静月石',
    subtitle: 'Moonstone',
    desc: '深夜的喃喃自语、心底轻诉的秘密',
    icon: Moon,
    stoneColor: 'rgba(129, 140, 248, 0.22)',
    borderColor: 'rgba(129, 140, 248, 0.45)',
    glowColor: 'rgba(129, 140, 248, 0.2)',
  },
  'rose-quartz': {
    id: 'rose-quartz',
    name: '盐晶粉晶',
    subtitle: 'Rose Quartz',
    desc: '柔软的问候、轻声撒娇与感谢',
    icon: HeartHandshake,
    stoneColor: 'rgba(244, 114, 182, 0.22)',
    borderColor: 'rgba(244, 114, 182, 0.45)',
    glowColor: 'rgba(244, 114, 182, 0.2)',
  },
  'volcanic-ore': {
    id: 'volcanic-ore',
    name: '黑曜火山石',
    subtitle: 'Volcanic Ore',
    desc: '倾诉烦恼与低谷、坚固温热的陪伴',
    icon: Shield,
    stoneColor: 'rgba(100, 116, 139, 0.3)',
    borderColor: 'rgba(100, 116, 139, 0.5)',
    glowColor: 'rgba(71, 85, 105, 0.25)',
  },

  /*
   * 心情类石头：不再对应"事情的性质"（日常/低谷/秘密...），
   * 而是直接对应"当下这一刻的心情本身"，挑石头的时候更像是在说
   * "我现在是这种感觉"，而不是"我要讲一件这样的事"。
   */
  'sunny-citrine': {
    id: 'sunny-citrine',
    name: '雀跃暖阳石',
    subtitle: 'Sunny Citrine',
    desc: '心情类 · 忍不住想分享的开心与雀跃',
    icon: Smile,
    stoneColor: 'rgba(250, 204, 21, 0.22)',
    borderColor: 'rgba(250, 204, 21, 0.45)',
    glowColor: 'rgba(250, 204, 21, 0.2)',
  },
  'rain-cloud-stone': {
    id: 'rain-cloud-stone',
    name: '微雨浅蓝石',
    subtitle: 'Rain Cloud Stone',
    desc: '心情类 · 说不清楚的低落、有点心事的时刻',
    icon: CloudRain,
    stoneColor: 'rgba(96, 165, 250, 0.2)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
    glowColor: 'rgba(96, 165, 250, 0.18)',
  },
  'spark-quartz': {
    id: 'spark-quartz',
    name: '悸动电光石',
    subtitle: 'Spark Quartz',
    desc: '心情类 · 心跳漏了一拍的小鹿乱撞',
    icon: Zap,
    stoneColor: 'rgba(232, 121, 249, 0.2)',
    borderColor: 'rgba(232, 121, 249, 0.42)',
    glowColor: 'rgba(232, 121, 249, 0.2)',
  },
  'breeze-jade': {
    id: 'breeze-jade',
    name: '清风软玉',
    subtitle: 'Breeze Jade',
    desc: '心情类 · 舒展平静、什么都不必多想的松弛',
    icon: Wind,
    stoneColor: 'rgba(110, 231, 183, 0.2)',
    borderColor: 'rgba(110, 231, 183, 0.42)',
    glowColor: 'rgba(110, 231, 183, 0.18)',
  },
};

/*
 * "带回礼物"功能：礼物的名字和描述交给 AI 按角色人设自由发挥
 * （见 pebbleService.js 里的 parseGiftFromReply），这里只负责两件事：
 * 1. 一份「类别 -> 图标」的对照表，AI 说出大致类别后，代码从对应类别里
 *    挑一枚贴切的 SVG 图标，不需要 AI 自己出图。
 * 2. 万一 AI 这次没有按格式给出结构化礼物信息（没解析出来），
 *    就从下面这个固定小池子里随便抽一件保底，保证功能不会直接哑掉。
 */
// 每个类别固定对应一枚图标（不做随机挑选）：这样同一件礼物不管被重新渲染
// 多少次、列表刷新多少遍，图标都是同一个，不会出现"同一件礼物图标一直在跳"。
export const GIFT_CATEGORIES = {
  plant: { label: '植物类', icon: Leaf },
  letter: { label: '信件类', icon: Mail },
  accessory: { label: '饰品类', icon: Gem },
  food: { label: '食物类', icon: Cookie },
};

export const GIFT_FALLBACK_ICON = Gift;

// 把 AI 输出的、五花八门的类别原文（"植物类" / "植物" / "食物" / "plant" ...）
// 归一化成 GIFT_CATEGORIES 里的 key；一个都对不上时返回 null，走保底图标。
export function normalizeGiftCategory(rawLabel = '') {
  const text = String(rawLabel).trim().toLowerCase();
  if (!text) return null;

  if (/植物|花|叶|草|plant|flower|leaf/.test(text)) return 'plant';
  if (/信|字条|纸条|letter|mail|note/.test(text)) return 'letter';
  if (/饰品|首饰|配饰|宝石|accessory|jewel|gem/.test(text)) return 'accessory';
  if (/食物|吃|零食|糖|茶|咖啡|food|snack/.test(text)) return 'food';

  return null;
}

// 依据类别 key 取出该类别对应的图标；类别未知或对不上时返回保底的礼物盒图标。
export function pickGiftIcon(categoryKey) {
  return GIFT_CATEGORIES[categoryKey]?.icon || GIFT_FALLBACK_ICON;
}

// 保底礼物池：仅在 AI 没能按格式生成结构化礼物信息时才会用到。
const FALLBACK_GIFT_POOL = [
  { name: '压平的枫叶', desc: '走路时踩到的，觉得形状很好看，就夹进了口袋。', category: 'plant' },
  { name: '一颗话梅糖', desc: '路过小卖部时顺手买的，酸酸甜甜，留了一颗给你。', category: 'food' },
  { name: '手写的小纸条', desc: '临时想到一句话，怕忘记，就随手写了下来。', category: 'letter' },
  { name: '一枚旧胸针', desc: '抽屉里翻出来的，样式有点旧，但很喜欢。', category: 'accessory' },
  { name: '晒干的小雏菊', desc: '路边长得很精神的一小朵，摘下来晒了两天。', category: 'plant' },
  { name: '一小包茶叶', desc: '路过茶馆时讨了一点，说是今年新采的。', category: 'food' },
  { name: '一张手绘的小图', desc: '等人的时候随手画的，画得不算好看，但很像今天的天气。', category: 'letter' },
  { name: '一枚光滑的贝壳发夹', desc: '在潮水线附近捡的贝壳，顺手做成了一个发夹。', category: 'accessory' },
];

// 强制从保底池子里抽一件礼物（不带概率判断）。
// 只在"这一轮已经决定要带礼物回来，但 AI 没能按格式生成结构化礼物信息"时兜底用，
// 避免说好了要带礼物、AI 却没写清楚格式，最后什么都没有。
export function pickRandomFallbackGift() {
  const idx = Math.floor(Math.random() * FALLBACK_GIFT_POOL.length);
  const picked = FALLBACK_GIFT_POOL[idx];
  return { ...picked, categoryKey: picked.category };
}