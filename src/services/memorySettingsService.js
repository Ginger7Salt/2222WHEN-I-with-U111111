// src/services/memorySettingsService.js
//
// 记忆来源开关（#1 拆分记忆系统 阶段 2）。
// 全局一个开关，三态：builtin（默认，内置记忆）| external（角色自己用
// 用户接好的 MCP 记忆工具）| off（关闭）。存到 db.settings 的键值表里
// （'memorySource'、'memoryExternalNote'），不新增表，备份/恢复会自动带上。
//
// 切走 builtin 模式时，顺手取消已经排上的内置记忆整理任务，
// 避免后台调度器空转（用户明确担心后台调度器太多）。

import db from '../db';
import { cancelAllScheduledMemoryProcessing } from '../apps/memory/memoryScheduler';

export const MEMORY_SOURCE = {
  BUILTIN: 'builtin',
  EXTERNAL: 'external',
  OFF: 'off',
};

const MEMORY_SOURCE_KEY = 'memorySource';
const MEMORY_NOTE_KEY = 'memoryExternalNote';

export const DEFAULT_MEMORY_NOTE = [
  '你接入了外部记忆工具。',
  '需要回忆之前聊过的事时，先用记忆工具查一查，不要瞎猜、也不要直接说不知道。',
  '聊天中遇到值得长期记住的事（比如用户的重要偏好、经历、重要日子），可以主动存下来，但不用每句话都查、每件小事都存。',
  '查阅和保存记忆的过程不需要说给用户听，就像你本来就记得一样自然。',
].join('\n');

export const getMemorySource = async () => {
  try {
    const row = await db.settings.get(MEMORY_SOURCE_KEY);
    const value = row?.value;

    if (
      value === MEMORY_SOURCE.EXTERNAL ||
      value === MEMORY_SOURCE.OFF
    ) {
      return value;
    }

    return MEMORY_SOURCE.BUILTIN;
  } catch (error) {
    console.warn('[Memory] 读取记忆来源设置失败，按内置处理：', error);
    return MEMORY_SOURCE.BUILTIN;
  }
};

export const setMemorySource = async (source) => {
  const value = [
    MEMORY_SOURCE.BUILTIN,
    MEMORY_SOURCE.EXTERNAL,
    MEMORY_SOURCE.OFF,
  ].includes(source)
    ? source
    : MEMORY_SOURCE.BUILTIN;

  await db.settings.put({ key: MEMORY_SOURCE_KEY, value });

  if (value !== MEMORY_SOURCE.BUILTIN) {
    // 离开内置模式：取消所有已排的整理任务，不留后台定时器。
    cancelAllScheduledMemoryProcessing();
  }

  return value;
};

export const getMemoryExternalNote = async () => {
  try {
    const row = await db.settings.get(MEMORY_NOTE_KEY);
    const value = row?.value;

    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    return DEFAULT_MEMORY_NOTE;
  } catch (error) {
    console.warn('[Memory] 读取记忆使用说明失败，按默认文案处理：', error);
    return DEFAULT_MEMORY_NOTE;
  }
};

export const setMemoryExternalNote = async (text) => {
  const value = typeof text === 'string' ? text.trim() : '';

  if (!value) {
    await db.settings.delete(MEMORY_NOTE_KEY);
    return DEFAULT_MEMORY_NOTE;
  }

  await db.settings.put({ key: MEMORY_NOTE_KEY, value });

  return value;
};

export const resetMemoryExternalNote = async () => {
  await db.settings.delete(MEMORY_NOTE_KEY);
  return DEFAULT_MEMORY_NOTE;
};