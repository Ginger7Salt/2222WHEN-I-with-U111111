// src/services/memoryTidySettingsService.js
//
// 记忆整理的"自主程度"开关。
// 全局一个开关，存到 db.settings 的键值表里（'memoryTidyAutoExecute'），
// 不新增表，备份/恢复会自动带上。
//
//   false（默认）——整理动作（合并重复记忆、情绪回顾）只会生成"待确认"候选，
//                   由用户在记忆空间里确认后才生效。
//   true          ——角色直接执行整理：合并会归档被并入的旧记忆（可找回），
//                   情绪回顾会直接写成一条阶段性记忆。所有改动都保留修订记录。
//
// 无论开关如何，用户手动写入、手动编辑或已确认过的记忆，
// 永远不会被自动合并，只会走待确认候选。

import db from '../db';

const MEMORY_TIDY_AUTO_EXECUTE_KEY = 'memoryTidyAutoExecute';

export const getMemoryTidyAutoExecute = async () => {
  try {
    const row = await db.settings.get(MEMORY_TIDY_AUTO_EXECUTE_KEY);

    return row?.value === true;
  } catch (error) {
    console.warn('[Memory] 读取整理自主程度设置失败，按"需确认"处理：', error);
    return false;
  }
};

export const setMemoryTidyAutoExecute = async (enabled) => {
  const value = enabled === true;

  await db.settings.put({
    key: MEMORY_TIDY_AUTO_EXECUTE_KEY,
    value
  });

  return value;
};