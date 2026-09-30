// src/apps/shell/shellTypes.js
//
// 潮汐贝壳的内容维度常量：身份（IDENTITY）× 形式（FORM）两个维度交叉
// 随机抽取，组合决定稀有度（TIER）。规则来自设计确认稿：
// 「按'身份 × 形式'两个维度共同决定稀有度，例如'平行世界'整体比
//   '本尊的另一个阶段'更稀有」，且「打捞时不让 user 选类型，完全
//   随机（两个维度都随机）」。

export const IDENTITY = {
  // 本尊：只是人生时间线上的另一个切片，可以是更年轻/更年长、认识
  // user 之前，或很久以后的假想未来——身份仍连续，只是换了个阶段。
  SELF: 'self',
  // 平行世界：彻底架空的另一个 ta，跟角色本尊没有身份连续性，纯虚构、
  // 每次单独编，不基于角色在其他 chat（世界线）里的真实经历。
  PARALLEL: 'parallel',
};

export const FORM = {
  MONOLOGUE: 'monologue', // 内心独白
  LETTER: 'letter',       // 写给 user 的信
  DIARY: 'diary',         // 日记
  SLICE: 'slice',         // 生活片段
};

export const IDENTITY_LABEL = {
  [IDENTITY.SELF]: '本尊 · 另一段时光',
  [IDENTITY.PARALLEL]: '平行世界',
};

export const FORM_LABEL = {
  [FORM.MONOLOGUE]: '内心独白',
  [FORM.LETTER]: '一封信',
  [FORM.DIARY]: '日记',
  [FORM.SLICE]: '生活片段',
};

// 每天最多打捞次数，按角色/chat 各自计算（不是全局共享）。
export const DAILY_QUOTA = 10;

// 身份出现概率：平行世界比本尊的另一段时光更少见，抽取阶段就先体现
// 一次稀有度差异。
const IDENTITY_WEIGHTS = [
  [IDENTITY.SELF, 0.7],
  [IDENTITY.PARALLEL, 0.3],
];

const FORM_LIST = Object.values(FORM);

const pickWeighted = (weighted) => {
  const roll = Math.random();
  let acc = 0;

  for (const [value, weight] of weighted) {
    acc += weight;
    if (roll < acc) return value;
  }

  return weighted[weighted.length - 1][0];
};

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

// 身份 × 形式 → 稀有度（0 常见 / 1 少见 / 2 稀有）。
// self 系整体压在 0/1 档；parallel 系整体上抬一档；parallel + letter/diary
// （最私密、最像"确有其事"的两种形式）落在最稀有的 2 档。
const TIER_MATRIX = {
  [IDENTITY.SELF]: {
    [FORM.MONOLOGUE]: 0,
    [FORM.SLICE]: 0,
    [FORM.LETTER]: 1,
    [FORM.DIARY]: 1,
  },
  [IDENTITY.PARALLEL]: {
    [FORM.MONOLOGUE]: 1,
    [FORM.SLICE]: 1,
    [FORM.LETTER]: 2,
    [FORM.DIARY]: 2,
  },
};

export const TIER_LABEL = ['寻常潮汐', '深潮回响', '孤域潮汐'];

// 打捞前的随机抽取：身份、形式各自独立随机，稀有度由两者组合查表
// 得出。返回值完全不需要、也不允许 user 干预。
export function rollShellDraw() {
  const identity = pickWeighted(IDENTITY_WEIGHTS);
  const form = pickRandom(FORM_LIST);
  const tier = TIER_MATRIX[identity][form];

  return { identity, form, tier };
}