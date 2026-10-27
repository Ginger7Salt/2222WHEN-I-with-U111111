import { HARP_STRING_COUNT } from './harpNotes';

// ============================================================
// 星光小竖琴 —— 把 src/styles/themes.css 里的主题变量读成画布能用的颜色。
//
// 竖琴是画在 <canvas> 上的，canvas 吃不了 CSS 变量，所以在这里用
// getComputedStyle 读出当前主题的变量值，解析成 [r, g, b]。HarpCanvas 会
// 监听 <html data-theme> 的变化，切主题时重新调用 readHarpPalette()。
//
// 只用 themes.css 里每套主题都有的变量（--bg-main / --card-bg / --text-* /
// --accent-color / --star-color / --star-bright / --bg-blob-*），所以以后
// 新增主题，只要它按同样的变量名写，竖琴不用改。
// ============================================================

const FALLBACK = {
  '--bg-main': [255, 255, 255],
  '--card-bg': [255, 255, 255],
  '--card-border': [220, 220, 220],
  '--text-main': [17, 17, 17],
  '--text-sub': [72, 72, 72],
  '--text-muted': [112, 112, 112],
  '--accent-color': [17, 17, 17],
  '--star-color': [140, 140, 140],
  '--star-bright': [255, 255, 255],
  '--bg-blob-1': [210, 210, 205],
  '--bg-blob-2': [232, 232, 228],
  '--bg-blob-3': [196, 196, 191],
};

const clamp255 = (value) => Math.max(0, Math.min(255, Math.round(value)));

// 支持 #rgb / #rrggbb / #rrggbbaa / rgb() / rgba()，解析不了就用兜底色。
export const parseCssColor = (raw, fallback) => {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return fallback;

  if (value[0] === '#') {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return [0, 1, 2].map((k) => parseInt(hex[k] + hex[k], 16));
    }
    if (hex.length === 6 || hex.length === 8) {
      return [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
    }
    return fallback;
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      return parts.map(clamp255);
    }
  }

  return fallback;
};

export const mixColor = (a, b, t) => [
  clamp255(a[0] + (b[0] - a[0]) * t),
  clamp255(a[1] + (b[1] - a[1]) * t),
  clamp255(a[2] + (b[2] - a[2]) * t),
];

export const luminance = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export const rgbaString = (c, alpha) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;

export const readHarpPalette = () => {
  const style =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null;

  const get = (name) =>
    parseCssColor(style ? style.getPropertyValue(name) : '', FALLBACK[name]);

  const bg = get('--bg-main');
  const card = get('--card-bg');
  const cardBorder = get('--card-border');
  const textMain = get('--text-main');
  const textSub = get('--text-sub');
  const textMuted = get('--text-muted');
  const accent = get('--accent-color');
  const starColor = get('--star-color');
  const starBright = get('--star-bright');
  const blob1 = get('--bg-blob-1');
  const blob2 = get('--bg-blob-2');
  const blob3 = get('--bg-blob-3');

  const dark = luminance(bg) < 0.42;

  // 点亮的弦：深色主题里从 star-color 渐变到 star-bright（发亮），
  // 浅色主题里从 star-color 渐变到 accent（变深变实），这样不管哪套
  // 主题，被拨到的弦都比静止的弦更醒目。十根弦各取渐变上的一格。
  const litEnd = dark ? starBright : accent;
  const tints = [];
  for (let i = 0; i < HARP_STRING_COUNT; i += 1) {
    tints.push(mixColor(starColor, litEnd, i / (HARP_STRING_COUNT - 1)));
  }

  return {
    dark,
    bg,
    card,
    cardBorder,
    textMain,
    textSub,
    textMuted,
    accent,
    blob1,
    blob2,
    blob3,
    tints,
    // 静止的弦
    string: textSub,
    // 弦被拨到时中间那条亮线
    litCore: dark ? starBright : accent,
    // 琴架（琴柱/琴颈）
    frameA: accent,
    frameB: mixColor(accent, textSub, 0.55),
    // 琴架上的一道高光
    frameHighlight: dark ? starBright : bg,
    // 角色弹奏时的光晕和光点
    taGlow: dark ? starBright : starColor,
    // 空闲时沿着弦滑过的一点微光
    glint: dark ? starBright : starColor,
  };
};
