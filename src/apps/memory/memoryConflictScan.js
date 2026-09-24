import {
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

import {
  calculateMemorySimilarity
} from './memoryQuality';

/*
 * 找出"可能新旧冲突 / 可以精简合并"的记忆对。纯函数，不读写数据库，
 * 也不调用 AI：这里只做本地初筛，真正的判断由 memoryInsightAiService.js 的
 * judgeMemoryPairs 完成。
 *
 * 只看稳定陈述型的记忆。刻意不看：
 *   - episode：不同时间的两次经历是两件事，不是冲突；
 *   - emotion：情绪本来就会变，是时间线，不是"认知"；
 *   - reflection / belief / character_action：综合产物或短期记录。
 */

const COMPARABLE_TYPES = new Set([
  MEMORY_TYPES.FACT,
  MEMORY_TYPES.PREFERENCE,
  MEMORY_TYPES.RELATIONSHIP,
  MEMORY_TYPES.EXPRESSION_RULE,
  MEMORY_TYPES.CHARACTER_THOUGHT,
  MEMORY_TYPES.COMMON_SENSE
]);

/*
 * 文字相似度达到这个值，多半是"重复"，交给原有的合并重复记忆去处理
 * （memoryTidyService.js 里的 MERGE_SIMILARITY_THRESHOLD，保持一致）。
 * 但"喜欢辣 / 不喜欢辣"这类冲突恰恰文字很像，所以冲突判断不受这条限制，
 * 只有"补充合并"才要求低于它。
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.42;

// 没有共同主题键时，文字相似度至少要到这个值才值得让 AI 看一眼。
const MIN_PAIR_SIMILARITY = 0.25;

export const DEFAULT_MAX_PAIRS = 6;

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

const getMemoryTime = (memory) => (
  toTime(memory.updatedAt || memory.createdAt)
);

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const getTopicKeys = (memory) => new Set(
  [memory.topicKey, ...(Array.isArray(memory.topicKeys) ? memory.topicKeys : [])]
    .map(normalizeKey)
    .filter(Boolean)
);

const shareTopic = (left, right) => {
  const rightKeys = getTopicKeys(right);

  for (const key of getTopicKeys(left)) {
    if (rightKeys.has(key)) return true;
  }

  return false;
};

export const isComparableMemory = (memory) => {
  if (
    !memory ||
    memory.status !== MEMORY_STATUSES.ACTIVE ||
    !COMPARABLE_TYPES.has(memory.type) ||
    memory.supersededByMemoryId ||
    memory.duplicateOfMemoryId
  ) {
    return false;
  }

  // 带有"计划中/进行中"时间信息的记忆代表具体事件，不参与。
  const temporalStatus = memory.temporal?.status;

  return temporalStatus !== 'planned' && temporalStatus !== 'ongoing';
};

export const buildPairSignature = (left, right) => (
  `pair:${[left.memoryId, right.memoryId].sort().join('|')}`
);

/*
 * sinceTime：只看"至少有一条在这个时间之后才产生"的记忆对（提炼时查新的用）；
 * 传 0 表示全量扫描（整理时用）。
 * handledSignatures：已经处理过、不用再看的记忆对。
 * 每条记忆一轮最多出现在一个记忆对里，避免对同一条记忆同时给出互相矛盾的处理。
 */
export const findMemoryPairs = ({
  allMemories = [],
  sinceTime = 0,
  handledSignatures = new Set(),
  maxPairs = DEFAULT_MAX_PAIRS
} = {}) => {
  const eligible = allMemories.filter(isComparableMemory);

  const scored = [];

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const left = eligible[i];
      const right = eligible[j];

      if (left.subject !== right.subject) continue;

      if (
        sinceTime > 0 &&
        toTime(left.createdAt) <= sinceTime &&
        toTime(right.createdAt) <= sinceTime
      ) {
        continue;
      }

      const signature = buildPairSignature(left, right);

      if (handledSignatures.has(signature)) continue;

      const similarity = calculateMemorySimilarity(left, right);
      const topicShared = shareTopic(left, right);

      if (!topicShared && similarity < MIN_PAIR_SIMILARITY) continue;

      const [older, newer] = getMemoryTime(left) <= getMemoryTime(right)
        ? [left, right]
        : [right, left];

      scored.push({
        older,
        newer,
        similarity,
        signature,
        score: similarity + (topicShared ? 0.3 : 0)
      });
    }
  }

  scored.sort((left, right) => right.score - left.score);

  const used = new Set();
  const pairs = [];

  for (const pair of scored) {
    if (pairs.length >= maxPairs) break;

    if (used.has(pair.older.memoryId) || used.has(pair.newer.memoryId)) {
      continue;
    }

    used.add(pair.older.memoryId);
    used.add(pair.newer.memoryId);
    pairs.push(pair);
  }

  return pairs;
};