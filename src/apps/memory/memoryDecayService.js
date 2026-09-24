import {
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

import {
  getActionWindowEnd
} from './memoryActionContext';

import {
  shouldBecomeDormant
} from './memoryDecay';

import {
  isCompoundFaded
} from './memoryEmotionCompound';

import {
  setMemoryStatus
} from './memoryService';

/*
 * 把"久到该淡出"的记忆暂存起来（status: dormant）。
 * 暂存不是删除：记忆和修订记录都保留，可以在记忆页恢复。
 *
 * 判断规则在 memoryDecay.js（纯函数）；这里只负责执行，由记忆整理
 * （memoryTidyService.js）在每轮整理时顺带调用。
 * 单条失败只警告、跳过，不影响其他条目。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// "角色刚做过的事"过了不宜重复的窗口期，再多留几天就可以暂存了。
const ACTION_GRACE_DAYS = 2;

// 一轮最多处理这么多条，避免第一次运行时一口气改动太多。
const MAX_DORMANT_PER_RUN = 50;

const isActionExpired = (memory, now) => (
  memory.type === MEMORY_TYPES.CHARACTER_ACTION &&
  (
    memory.status === MEMORY_STATUSES.ACTIVE ||
    memory.status === MEMORY_STATUSES.TEMPORARY
  ) &&
  now > getActionWindowEnd(memory) + ACTION_GRACE_DAYS * DAY_MS
);


export const runDecayTidy = async ({
  allMemories = [],
  now = Date.now(),
  decaySpeed = 0.5
} = {}) => {
  const targets = allMemories
    .filter((memory) => (
      isActionExpired(memory, now) ||
      shouldBecomeDormant(memory, now) ||
      (
        (
          memory.status === MEMORY_STATUSES.ACTIVE ||
          memory.status === MEMORY_STATUSES.TEMPORARY
        ) &&
        isCompoundFaded(memory, now, {
          decaySpeed: memory.emotionSubject === 'user' ? 0.5 : decaySpeed
        })
      )
    ))
    .slice(0, MAX_DORMANT_PER_RUN);

  let dormantCount = 0;

  for (const memory of targets) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await setMemoryStatus(memory.memoryId, MEMORY_STATUSES.DORMANT, {
        note: memory.type === MEMORY_TYPES.CHARACTER_ACTION
          ? '这件事已经过去很久，不再需要提醒角色避免重复，暂时存放起来；可以在记忆页恢复。'
          : '随时间已经淡去，且长期没有被用到，暂时存放起来；可以在记忆页恢复。'
      });

      dormantCount += 1;
    } catch (error) {
      console.warn('[MemoryDecay] 暂存记忆失败，已跳过：', error);
    }
  }

  return { dormantCount };
};