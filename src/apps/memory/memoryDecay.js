import {
  MEMORY_STABILITIES,
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

import {
  isManualAuthorityMemory
} from './memoryQuality';

/*
 * 记忆的时间衰减：越久远、越不重要的日常小事和情绪，越不容易被想起。
 *
 * 两层，都是纯函数，不读写数据库：
 *   1. 软衰减（每次召回时实时算）：getDecayPenalty 会从召回得分里扣一点分，
 *      用户直接提起时（话题重合度高）仍然能被找回。
 *   2. 情绪淡出：情绪记忆衰减到很淡之后，不再被召回（isFadedOutOfRecall）。
 *   3. 暂存（由 memoryDecayService.js 定期执行）：shouldBecomeDormant 判断
 *      是否久到该暂存起来。暂存不是删除，可以在记忆页恢复。
 *
 * 会衰减的：共同经历(episode)、情绪痕迹(emotion)、短期事实
 *   （stability 为 momentary / temporary 的 fact）。
 * 不衰减的：偏好、关系理解、表达边界、角色心事、反思、稳定/长期事实，
 *   以及用户手动写入、编辑或确认过的记忆——用户已经表态要留的，不自动淡掉。
 *
 * 下面的数字都是可以调的手感参数，集中放在这里。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// 软衰减最多从得分里扣多少（召回得分大致在 0 到 1 之间）。
const MAX_DECAY_PENALTY = 0.3;

// 事件类记忆的半衰期基准（天）：每过这么久，"残留程度"减半。
// 实际半衰期还会乘上重要度系数：重要度 1 是 0.8 倍，3 是 1.2 倍，5 是 1.6 倍。
const EVENT_HALF_LIFE_DAYS = {
  [MEMORY_STABILITIES.MOMENTARY]: 1.5,
  [MEMORY_STABILITIES.TEMPORARY]: 7
};

// 情绪的半衰期由强度决定：轻微的约 1 天就淡，强烈的能持续一周左右。
const EMOTION_HALF_LIFE_MIN_DAYS = 0.5;
const EMOTION_HALF_LIFE_SPAN_DAYS = 7;
const DEFAULT_EMOTION_INTENSITY = 0.5;

// 残留程度低于这个值，情绪不再被召回（仅限重要度 3 及以下）。
const EMOTION_FADE_CUTOFF = 0.12;

// 暂存的门槛：残留程度低于多少，且重要度不高，才暂存。
const DORMANT_MULTIPLIER_BY_IMPORTANCE = {
  1: 0.25,
  2: 0.25,
  3: 0.1
};

// 太新的记忆不暂存；最近刚被用过的记忆也不暂存。
const MIN_AGE_DAYS_FOR_DORMANCY = 2;
const RECENTLY_USED_DAYS = 3;

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) && time > 0 ? time : 0;
};

const getImportance = (memory) => {
  const importance = Number(memory?.importance);

  return Number.isFinite(importance) ? importance : 3;
};

export const isDecayableMemory = (memory) => {
  if (!memory || isManualAuthorityMemory(memory)) {
    return false;
  }

  if (
    memory.type === MEMORY_TYPES.EPISODE ||
    memory.type === MEMORY_TYPES.EMOTION
  ) {
    return true;
  }

  return (
    memory.type === MEMORY_TYPES.FACT &&
    (
      memory.stability === MEMORY_STABILITIES.MOMENTARY ||
      memory.stability === MEMORY_STABILITIES.TEMPORARY
    )
  );
};

/*
 * 衰减的起点：事件本身发生的时间（已解析且不模糊）优先，
 * 否则用记录时间。计划中的未来事件还没发生，不算"年龄"。
 */
const getAnchorTime = (memory) => {
  const temporal = memory?.temporal;

  if (temporal && !temporal.isAmbiguous) {
    const start = toTime(temporal.startAt);

    if (start) {
      return start;
    }
  }

  return toTime(memory?.createdAt || memory?.updatedAt);
};

export const getAgeDays = (memory, now = Date.now()) => {
  const anchor = getAnchorTime(memory);

  if (!anchor) {
    return 0;
  }

  return Math.max(0, (now - anchor) / DAY_MS);
};

export const getEmotionHalfLifeDays = (intensity) => {
  const numberValue = (
    intensity === null || intensity === undefined || intensity === ''
  )
    ? DEFAULT_EMOTION_INTENSITY
    : Number(intensity);

  const safeIntensity = Number.isFinite(numberValue)
    ? Math.max(0, Math.min(1, numberValue))
    : DEFAULT_EMOTION_INTENSITY;

  return EMOTION_HALF_LIFE_MIN_DAYS
    + EMOTION_HALF_LIFE_SPAN_DAYS * (safeIntensity ** 1.3);
};

export const getHalfLifeDays = (memory) => {
  if (memory?.type === MEMORY_TYPES.EMOTION) {
    return getEmotionHalfLifeDays(memory.emotionIntensity);
  }

  const base = EVENT_HALF_LIFE_DAYS[memory?.stability]
    ?? EVENT_HALF_LIFE_DAYS[MEMORY_STABILITIES.TEMPORARY];

  const importanceFactor = 0.6 + getImportance(memory) * 0.2;

  return base * importanceFactor;
};

/*
 * "残留程度"：1 表示完全没衰减，越接近 0 越淡。
 * 不会衰减的记忆恒为 1。
 */
export const getDecayMultiplier = (memory, now = Date.now()) => {
  if (!isDecayableMemory(memory)) {
    return 1;
  }

  const halfLife = getHalfLifeDays(memory);

  if (!Number.isFinite(halfLife) || halfLife <= 0) {
    return 1;
  }

  return 0.5 ** (getAgeDays(memory, now) / halfLife);
};

export const getDecayPenalty = (memory, now = Date.now()) => (
  (1 - getDecayMultiplier(memory, now)) * MAX_DECAY_PENALTY
);

/*
 * 情绪淡到一定程度后不再被召回。
 * 重要度 4 以上的情绪（比如很重大的事带来的情绪）不做硬淡出，
 * 只受上面的软衰减影响。
 */
export const isFadedOutOfRecall = (memory, now = Date.now()) => (
  memory?.type === MEMORY_TYPES.EMOTION &&
  isDecayableMemory(memory) &&
  getImportance(memory) <= 3 &&
  getDecayMultiplier(memory, now) < EMOTION_FADE_CUTOFF
);

/*
 * 是否该暂存起来。只针对生效中或暂时记录的记忆。
 * 重要度 4 及以上永远不会被自动暂存；情绪按淡出线判断。
 */
export const shouldBecomeDormant = (memory, now = Date.now()) => {
  if (
    !memory ||
    (
      memory.status !== MEMORY_STATUSES.ACTIVE &&
      memory.status !== MEMORY_STATUSES.TEMPORARY
    ) ||
    !isDecayableMemory(memory)
  ) {
    return false;
  }

  if (getAgeDays(memory, now) < MIN_AGE_DAYS_FOR_DORMANCY) {
    return false;
  }

  const lastUsed = toTime(memory.lastUsedAt);

  if (lastUsed && now - lastUsed < RECENTLY_USED_DAYS * DAY_MS) {
    return false;
  }

  const importance = getImportance(memory);

  if (importance >= 4) {
    return false;
  }

  const threshold = memory.type === MEMORY_TYPES.EMOTION
    ? EMOTION_FADE_CUTOFF
    : DORMANT_MULTIPLIER_BY_IMPORTANCE[Math.max(1, Math.round(importance))]
      ?? 0.1;

  return getDecayMultiplier(memory, now) < threshold;
};