import {
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

import {
  formatElapsedFine
} from './memoryTimeContext';

/*
 * "角色刚做过的事"：防止角色因为"用户喜欢 X"就一直反复做 X。
 *
 * 现有的召回冷却数的是"这条记忆被放进提示词几次"，并不知道角色有没有真的
 * 把那件事做掉。这里的做法是：记忆提炼时顺带把角色做过的具体行为
 * （点了外卖、推荐了电影、送了礼物……）记成 type: character_action 的记忆，
 * 并给一个"多少小时内不应重复"（avoidRepeatHours）。之后：
 *   1. 在窗口期内，提示词里会多一块"角色近期已经做过的事"，明确告诉角色；
 *   2. 窗口期内，跟这件事相关的偏好/经历记忆不会再被召回去诱导重复
 *      （用户明确再次提起时除外，沿用现有的"直接提及可突破冷却"规则）。
 *
 * character_action 不参与普通的记忆召回排序，只走这里。
 * 这个文件里的函数都不读写数据库，方便测试。
 */

const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_AVOID_REPEAT_HOURS = 12;
export const MIN_AVOID_REPEAT_HOURS = 1;
export const MAX_AVOID_REPEAT_HOURS = 336;

const MAX_ACTIONS_IN_PROMPT = 6;

const normalizeText = (value) => String(value || '').trim();

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) && time > 0 ? time : 0;
};

const normalizeKey = (value) => normalizeText(value).toLowerCase();

export const normalizeAvoidRepeatHours = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.max(
    MIN_AVOID_REPEAT_HOURS,
    Math.min(MAX_AVOID_REPEAT_HOURS, Math.round(numberValue))
  );
};

/*
 * 同一条来源消息不会被提炼成两条行为记忆（重复处理同一批消息时的保护）。
 * 不能像普通记忆那样按内容去重：几天后"又点了海底捞"是新的一次，不是重复。
 */
export const isDuplicateActionMemory = (memory, existingMemories = []) => {
  const incomingIds = new Set(
    (Array.isArray(memory?.sourceMessageIds) ? memory.sourceMessageIds : [])
      .map(Number)
      .filter(Number.isFinite)
  );

  if (incomingIds.size === 0) {
    return false;
  }

  return existingMemories.some((existing) => (
    existing?.type === MEMORY_TYPES.CHARACTER_ACTION &&
    (Array.isArray(existing.sourceMessageIds) ? existing.sourceMessageIds : [])
      .some((id) => incomingIds.has(Number(id)))
  ));
};

/*
 * 这件事是什么时候做的：已解析且不模糊的事件时间优先，
 * 其次是来源消息的时间，最后才是记录时间。
 */
export const getActionTime = (memory) => {
  const temporal = memory?.temporal;

  if (temporal && !temporal.isAmbiguous) {
    const start = toTime(temporal.startAt);

    if (start) {
      return start;
    }
  }

  const sourceTimes = (
    Array.isArray(memory?.sourceMessageTimestamps)
      ? memory.sourceMessageTimestamps
      : []
  )
    .map(toTime)
    .filter(Boolean);

  if (sourceTimes.length > 0) {
    return Math.max(...sourceTimes);
  }

  return toTime(memory?.createdAt || memory?.updatedAt);
};

export const getActionWindowEnd = (memory) => {
  const hours = normalizeAvoidRepeatHours(memory?.avoidRepeatHours)
    ?? DEFAULT_AVOID_REPEAT_HOURS;

  return getActionTime(memory) + hours * HOUR_MS;
};

/*
 * 还在"不宜重复"窗口期内的行为记忆，最近的在前。
 */
export const pickActiveCharacterActions = (
  memories = [],
  now = Date.now()
) => (
  memories
    .filter((memory) => (
      memory?.type === MEMORY_TYPES.CHARACTER_ACTION &&
      (
        memory.status === MEMORY_STATUSES.ACTIVE ||
        memory.status === MEMORY_STATUSES.TEMPORARY
      ) &&
      getActionTime(memory) > 0 &&
      getActionWindowEnd(memory) > now
    ))
    .sort((left, right) => getActionTime(right) - getActionTime(left))
    .slice(0, MAX_ACTIONS_IN_PROMPT)
);

const getActionKeys = (action) => (
  [action?.topicKey, ...(Array.isArray(action?.topicKeys) ? action.topicKeys : [])]
    .map(normalizeKey)
    .filter((key) => key.length >= 2)
);

const getMemoryKeys = (memory) => (
  [memory?.topicKey, ...(Array.isArray(memory?.topicKeys) ? memory.topicKeys : [])]
    .map(normalizeKey)
    .filter((key) => key.length >= 2)
);

/*
 * 这条普通记忆是否跟某件刚做过的事是同一个话题。
 * 先比主题键；主题键写法不一致时（coffee 和 coffee_preference），
 * 再看这件事的主题键有没有出现在这条记忆的文字里。
 * 表达方式与边界类记忆永远不拦截：那是必须一直遵守的规则。
 */
export const isMemoryBlockedByRecentAction = (memory, actions = []) => {
  if (
    !memory ||
    actions.length === 0 ||
    memory.type === MEMORY_TYPES.EXPRESSION_RULE ||
    memory.type === MEMORY_TYPES.CHARACTER_ACTION
  ) {
    return false;
  }

  const memoryKeys = new Set(getMemoryKeys(memory));

  const memoryText = normalizeKey([
    memory.title,
    memory.content,
    ...getMemoryKeys(memory)
  ].filter(Boolean).join(' '));

  return actions.some((action) => (
    getActionKeys(action).some((key) => (
      memoryKeys.has(key) || memoryText.includes(key)
    ))
  ));
};

const formatWindowHint = (hours) => {
  if (hours < 24) return `${hours} 小时内`;

  const days = Math.round(hours / 24);

  return `${days} 天内`;
};

/*
 * 提示词里的"角色近期已经做过的事"块。没有就返回空字符串。
 */
export const buildCharacterActionContext = (
  actions = [],
  now = Date.now()
) => {
  if (!actions.length) {
    return '';
  }

  const lines = actions.map((action) => {
    const hours = normalizeAvoidRepeatHours(action.avoidRepeatHours)
      ?? DEFAULT_AVOID_REPEAT_HOURS;

    const elapsed = formatElapsedFine(getActionTime(action), now);

    return `- ${elapsed ? `${elapsed}：` : ''}${normalizeText(action.content)}（${formatWindowHint(hours)}不宜再重复）`;
  });

  return `
【角色近期已经做过的事】
以下是你（角色）近期已经为用户做过、给过或推荐过的事，都已经完成了。
不要因为用户喜欢相关的东西，就再次做同样的事，也不要表现得像是第一次做；用户明确再次要求时除外。
可以自然地记得它们，比如顺口提一句"刚才那个"，但不要提及记忆系统或内部记录。

${lines.join('\n')}
`;
};