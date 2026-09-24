import {
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

import {
  isManualAuthorityMemory
} from './memoryQuality';

/*
 * 常识：用户是哪里人、住在哪个城市、做什么工作、生日……这类长期稳定的基本事实。
 * 都是纯函数，不读写数据库。
 *
 * 规则：
 *   - 只有"确认过"的才算常识：要么用户在待确认列表里点了采纳，要么是用户自己手写的。
 *     AI 从对话里提取出来的常识一律先走待确认列表（见 memoryScheduler.js）。
 *   - 确认过的常识不参与时间衰减，不被自动暂存，也不会被自动合并
 *     （用户确认过的记忆本来就属于 isManualAuthorityMemory，这几处已经有保护）。
 *     只有用户自己可以撤回或更正它。
 *   - 每个聊天各存一份，不跨聊天。
 *   - 确认过的常识不走关键词召回，而是作为一小块稳定背景一直带着，
 *     这样角色不会因为用户这句话没提到"杭州"就忘了用户住在杭州。
 */

const MAX_COMMON_SENSE_ITEMS = 8;
const MAX_COMMON_SENSE_CHARS = 600;

export const isCommonSenseMemory = (memory) => (
  memory?.type === MEMORY_TYPES.COMMON_SENSE
);

export const isConfirmedCommonSense = (memory) => (
  isCommonSenseMemory(memory) &&
  (
    memory.status === MEMORY_STATUSES.ACTIVE ||
    memory.status === MEMORY_STATUSES.TEMPORARY
  ) &&
  !memory.supersededByMemoryId &&
  !memory.duplicateOfMemoryId &&
  isManualAuthorityMemory(memory)
);

const getSubjectPrefix = (memory) => (
  memory.subject === 'character' ? '角色自身' : '用户'
);

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

/*
 * 已确认的常识，作为稳定背景一直带进提示词。
 * 同一个 topicKey 只留最新的一条（比如搬了家，旧的住址不再带着）。
 */
export const buildCommonSenseContext = (memories = []) => {
  const confirmed = memories
    .filter(isConfirmedCommonSense)
    .sort((left, right) => (
      toTime(right.updatedAt || right.createdAt)
      - toTime(left.updatedAt || left.createdAt)
    ));

  const seenTopics = new Set();
  const unique = [];

  for (const memory of confirmed) {
    const topic = String(memory.topicKey || '').trim().toLowerCase();

    if (topic) {
      if (seenTopics.has(topic)) continue;

      seenTopics.add(topic);
    }

    unique.push(memory);
  }

  unique.sort((left, right) => (
    Number(right.importance || 3) - Number(left.importance || 3)
  ));

  const lines = [];
  let length = 0;

  for (const memory of unique.slice(0, MAX_COMMON_SENSE_ITEMS)) {
    const line = `- ${getSubjectPrefix(memory)}：${memory.content}`;

    if (length + line.length > MAX_COMMON_SENSE_CHARS) break;

    lines.push(line);
    length += line.length;
  }

  if (!lines.length) return '';

  return `
【已确认的常识】
以下是已经和用户确认过的基本事实，是稳定的背景。不用主动重复提起，也不要当作新发现来复述，只在话题自然相关时用上。
${lines.join('\n')}
`;
};