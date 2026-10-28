// src/apps/greeting/greetingConstants.js
//
// 贺卡 subapp 的常量与款式注册表。这个文件只放"数据"，不依赖 React、
// 不依赖 db，方便 greetingAiService.js（校验角色返回的内容）和各个 UI
// 组件共用同一份取值范围。
//
// 设计约定（和用户确认过的）：
//   - 封面（cover）是简约系，颜色全部跟随 app 主题，角色只能选"款式"
//     和写标题，不能改颜色。
//   - 内页（inside）完全由角色定义，不跟随 app 主题：积木库模式下角色
//     自己挑颜色/场景/字体，自由创作模式下角色直接写一整张内页的 HTML。

export const GREETING_STATUS = {
  MAKING: 'making',
  READY: 'ready',
  FAILED: 'failed',
};

export const GREETING_SOURCE = {
  REQUESTED: 'requested',
  PROACTIVE: 'proactive',
};

export const GREETING_MODE = {
  BLOCKS: 'blocks',
  FREE: 'free',
};

// 封面款式：只决定封面底色/弥散的构图，全部取自主题变量。
export const COVER_MOTIFS = ['mist', 'ink', 'blank', 'line'];

export const COVER_MOTIF_LABELS = {
  mist: '雾面',
  ink: '墨',
  blank: '留白',
  line: '细线',
};

// 积木库模式下内页上半页的场景。
export const SCENES = ['ripple', 'horizon', 'orbit', 'waves', 'glow', 'none'];

export const SCENE_LABELS = {
  ripple: '涟漪',
  horizon: '地平线',
  orbit: '轨道',
  waves: '细浪',
  glow: '光晕',
  none: '纯色',
};

export const FONT_KEYS = ['serif', 'sans', 'mono', 'kai'];

export const FONT_STACKS = {
  serif: '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong",Georgia,serif',
  sans: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',
  mono: '"IBM Plex Mono","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans SC",monospace',
  kai: '"Kaiti SC","STKaiti","KaiTi","楷体","Noto Serif SC",serif',
};

// 角色没给颜色（或给的颜色不合法）时的兜底：一套中性的黑白灰。
export const DEFAULT_PALETTE = {
  paper: '#fbfbf9',
  ink: '#1a1a1a',
  mute: '#7a7a76',
  sceneBg: '#f1f1ee',
  sceneInk: '#1a1a1a',
  glowA: '#cfcfca',
  glowB: '#e6e6e1',
};

export const PALETTE_KEYS = Object.keys(DEFAULT_PALETTE);

// 点名做的场合。hint 会写进给角色的提示词里，帮它理解语气。
export const OCCASIONS = [
  { id: 'comfort', label: '哄我开心', hint: '用户有点低落或疲惫，想被哄一下，但不要说教、不要空泛安慰' },
  { id: 'tired', label: '辛苦了', hint: '用户最近很辛苦，想被看见、被肯定' },
  { id: 'anniv', label: '纪念日', hint: '一个值得记一下的日子，克制地表达，不要堆砌甜话' },
  { id: 'sorry', label: '对不起', hint: '角色想认真道歉，真诚、具体、不推卸' },
  { id: 'any', label: '随便什么', hint: '没有特别的场合，角色自己决定想说什么' },
];

export const getOccasion = (id) =>
  OCCASIONS.find((item) => item.id === id) || OCCASIONS[OCCASIONS.length - 1];

// 文本长度上限（宁可截断也不让内页被撑爆）。
export const LIMITS = {
  title: 14,
  to: 12,
  sign: 12,
  bodyLines: 8,
  bodyLineChars: 60,
  freeHtmlChars: 48000,
};

// "制作中"的展示延迟：生成完成后并不立刻送到，而是再等一会儿，让"TA 在做"
// 这件事有时间感。范围是毫秒。
export const MAKE_DELAY_RANGE_MS = [45000, 120000];

// 一张处于 making 的卡，如果超过这个时间还没有生成结果（比如生成到一半
// 用户把 app 关了），就判定为中断，标记失败，让用户可以重试。
export const MAKING_STALE_MS = 10 * 60 * 1000;

// "制作中"卡片上轮换显示的进度文字。
export const MAKING_STAGES = ['裁切', '上色', '写字', '封口'];
