// src/apps/greeting/popupBookConstants.js
//
// 立体书的常量与"模型积木"注册表。只放数据，不依赖 React / db / three，
// 方便生成层（校验角色返回的内容）和阅读器（渲染）共用同一份取值范围。
//
// 约定：角色只能挑"模型类型"并填参数，参数全部当作不可信数据——枚举走白名单，
// 文字限长去 emoji，颜色只收十六进制，数量有上限。模型不合法就降级成纯文字页。

export const BOOK_STATUS = {
  MAKING: 'making',
  READY: 'ready',
  FAILED: 'failed',
};

export const BOOK_SOURCE = {
  REQUESTED: 'requested',
  PROACTIVE: 'proactive',
};

// 三种立体书：哄人 / 回忆 / 讲解。
export const BOOK_KIND = {
  CHEER: 'cheer',
  MEMORY: 'memory',
  EXPLAIN: 'explain',
};

export const BOOK_KINDS = [
  { id: BOOK_KIND.CHEER, label: '哄我开心', hint: '用户想被哄一下，温柔、具体，不说教，不空泛安慰', useChat: false },
  { id: BOOK_KIND.MEMORY, label: '一起的回忆', hint: '把你们之间发生过的事做成一本小书，克制、真实、有细节', useChat: true },
  { id: BOOK_KIND.EXPLAIN, label: '讲点什么', hint: '用你的口吻给用户讲清楚一件事，准确、易懂、有一点你的个性', useChat: true },
];

export const getBookKind = (id) => BOOK_KINDS.find((item) => item.id === id) || BOOK_KINDS[0];

// 封面款式：直接复用贺卡的 4 款，颜色跟随主题变量。
export const BOOK_COVER_MOTIFS = ['mist', 'ink', 'blank', 'line'];

// 模型积木。第一刀只实现 house（小房子夜景）。
export const BOOK_MODELS = ['house'];

// 每种模型能接受的参数说明（会写进提示词）。
export const MODEL_SPECS = {
  house: {
    label: '小房子夜景',
    desc: '一间立起来的小房子，夜里亮着窗，天上有月亮和星星。适合回忆、陪伴、晚安一类的内容。',
    params: [
      'windows：亮着的窗子数量，1 到 3',
      'stars：星星数量，0 到 8',
      'moon：月亮形状，full（圆月）或 crescent（弯月）',
      'label：一句贴在房子下面的小字，不超过 10 个字',
    ],
  },
};

export const HOUSE_LIMITS = { windows: [1, 3], stars: [0, 8], label: 10 };
export const HOUSE_MOONS = ['full', 'crescent'];

// 文字块类型（左页），第一刀只开放这几种，其余等后面的模型需要时再加。
export const PAGE_ITEM_TYPES = ['kick', 'h', 'p', 'sign'];

export const BOOK_LIMITS = {
  title: 14,
  kick: 24,
  heading: 16,
  paragraph: 90,
  paragraphs: 3,
  sign: 12,
  caption: 40,
  spreads: 3,
  userNote: 120,
};

// 阅读器里的内页配色：灰阶底 + 至多一个低饱和点缀色。
export const DEFAULT_BOOK_PALETTE = {
  ink: '#2b2622',
  paper: '#f4f0e7',
  mute: '#8a8175',
  accent: '#7b7494',
};

// 点缀色的饱和度上限（HSL 的 s，0 到 1）。角色给的颜色太艳会被拉回来。
export const ACCENT_MAX_SATURATION = 0.32;

// 用于 memory / explain 的聊天上下文：取最近多少条、每条截断多少字。
export const CONTEXT_MESSAGE_COUNT = 30;
export const CONTEXT_MESSAGE_CHARS = 200;

// "制作中"展示延迟（毫秒）与中断判定。
export const BOOK_MAKE_DELAY_RANGE_MS = [45000, 120000];
export const BOOK_MAKING_STALE_MS = 10 * 60 * 1000;

// "制作中"卡片上轮换显示的进度文字。
export const BOOK_MAKING_STAGES = ['构思', '裁切', '折叠', '装订', '上胶'];

// 第一本书的默认跨页数。
export const DEFAULT_SPREAD_COUNT = 2;

// 角色主动送书：同一个角色两次主动送之间至少隔这么久（毫秒）。冷却期内聊天提示词里
// 不会带"想做书就写 [BOOK_WANT]"那段说明，所以不占 token。和贺卡的冷却各算各的。
export const BOOK_PROACTIVE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// 角色写了 [BOOK_WANT] 但没写类型（或写的认不出来）时用哪一种。
export const BOOK_PROACTIVE_DEFAULT_KIND = BOOK_KIND.CHEER;