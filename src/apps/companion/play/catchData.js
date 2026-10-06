/**
 * catchData.js
 *
 * 「接住掉落物」小游戏的静态配置：掉落物类型与权重、难度曲线、
 * 分数 -> 奖励档位的换算表、每日奖励次数上限。
 *
 * 纯数据 + 纯函数，不碰 Dexie、不碰 React、不碰 canvas——
 * 照抄 fortuneData.js 的角色分工（xxxData.js 只管配置和换算）。
 */

/* ------------------------------------------------------------------ */
/* 一局的基础参数                                                       */
/* ------------------------------------------------------------------ */

export const ROUND_SECONDS = 45;

/* ------------------------------------------------------------------ */
/* 掉落物类型
 *   key        要跟引擎/组件里的素材 key 对上（fish/bone/star/rock）
 *   kind       'good' 普通好物 / 'rare' 稀有好物 / 'bad' 捣乱的坏东西
 *   score      接住之后对分数的影响（bad 是负数）
 *   startWeight 难度曲线 0 进度时的权重，bad 的权重会随时间升高（见下）
 * ------------------------------------------------------------------ */

export const ITEM_TYPES = [
  { key: 'fish', kind: 'good', startWeight: 46, score: 1 },
  { key: 'bone', kind: 'good', startWeight: 30, score: 1 },
  { key: 'star', kind: 'rare', startWeight: 12, score: 4 },
  { key: 'rock', kind: 'bad', startWeight: 12, score: -1 },
];

// bad 掉落物的权重曲线：开局 12%，局末爬到 32%
// （用户明确要求"之后可以做得更困难一些，坏东西掉落得更多"）。
// 其它类型按原权重等比例缩小，让任意时刻的权重总和都still是 100。
const BAD_WEIGHT_START = 12;
const BAD_WEIGHT_END = 32;

/**
 * 根据当前进度（0~1）算出这一刻每种掉落物的实际权重。
 * @param {number} progress 0（刚开局）~ 1（局末）
 * @returns {Array<ItemType & { weight: number }>}
 */
export function weightsAt(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const badWeight = BAD_WEIGHT_START + (BAD_WEIGHT_END - BAD_WEIGHT_START) * p;
  const goodRareTotal = 100 - badWeight;
  const baseGoodRareTotal = ITEM_TYPES
    .filter((t) => t.kind !== 'bad')
    .reduce((sum, t) => sum + t.startWeight, 0);

  return ITEM_TYPES.map((t) => {
    if (t.kind === 'bad') return { ...t, weight: badWeight };
    return { ...t, weight: (t.startWeight / baseGoodRareTotal) * goodRareTotal };
  });
}

/** 按当前进度对应的权重，随机抽一种掉落物类型 */
export function pickItemType(progress) {
  const weighted = weightsAt(progress);
  const sum = weighted.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < weighted.length; i += 1) {
    r -= weighted[i].weight;
    if (r <= 0) return weighted[i];
  }
  return weighted[0];
}

/* ------------------------------------------------------------------ */
/* 难度曲线：掉落间隔 & 下落速度随时间推进而变化                         */
/* ------------------------------------------------------------------ */

/** 距离下一次生成掉落物还要多少毫秒（随进度从 900ms 缩短到 450ms） */
export function spawnIntervalMsAt(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return 900 - p * 450;
}

/** 掉落物的下落速度 px/s（随进度从 130 升到 240） */
export function fallSpeedAt(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return 130 + p * 110;
}

/* ------------------------------------------------------------------ *
 * 分数 -> 奖励档位
 *
 * 数值参照 companionService.js 里"玩耍"(performFreeAction.play) 的
 * 真实基准：satiety -5 / mood +18 / hearts +2。
 * A 档直接对齐这个基准（相当于"一局普通发挥 = 一次正常玩耍"），
 * S/B/C 按发挥好坏向上向下浮动。
 *
 * 这几个数字本身是可调的占位值，如果后续想重新平衡，只改这一处即可，
 * 不用动 catchService.js 或引擎代码。
 * ------------------------------------------------------------------ */

export const TIERS = [
  { key: 'S', min: 90, label: '手速惊人！', effect: { mood: 26, satiety: -5, hearts: 4 } },
  { key: 'A', min: 60, label: '接得很稳～', effect: { mood: 18, satiety: -5, hearts: 2 } },
  { key: 'B', min: 30, label: '还不错哦', effect: { mood: 10, satiety: -3, hearts: 1 } },
  { key: 'C', min: 0, label: '陪它玩了一会儿', effect: { mood: 4, satiety: -2, hearts: 0 } },
];

export function tierFor(score) {
  for (let i = 0; i < TIERS.length; i += 1) {
    if (score >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[TIERS.length - 1];
}

/* ------------------------------------------------------------------ */
/* 每日奖励次数上限（占位，可调：改这一个数字即可）                      */
/* ------------------------------------------------------------------ */

export const DAILY_REWARD_LIMIT = 3;