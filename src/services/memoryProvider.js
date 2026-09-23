/**
 * 记忆入口（统一出入口）
 *
 * 阶段 2：按"记忆来源开关"（builtin / external / off，见
 * memorySettingsService.js）分流，内置模式下行为与阶段 1 逐字一致。
 *
 * 所有"把记忆放进提示词""聊完后整理记忆"的地方，都从这里拿函数，
 * 而不是直接去 apps/memory 里拿。这样要加/改"记忆来源开关"时，
 * 只需要改这一个文件，不用再动 aiService、callService 等大文件。
 *
 * 函数名刻意和原来保持一致，方便 grep，也让接入点只需要换 import 路径。
 *
 *   getChatMemoryContext       提示词里的"记忆块"（出错时由调用处降级为空串）
 *                              builtin：内置检索；external：已启用 MCP 工具时
 *                              返回"记忆使用说明"，否则空串（仿 lookup_user_saved_info
 *                              的门槛，没有可用工具就一个字都不加）；off：空串。
 *   getCharacterEmotionContext 提示词里的"情绪 / 角色状态块"（不属于记忆开关，保持内置）
 *   scheduleMemoryProcessing   聊完后安排整理记忆（只有 builtin 才会真正安排）
 *
 * 注意：这个文件不要 import aiService / callService，避免循环引用。
 */
import { getChatMemoryContext as builtinGetChatMemoryContext } from '../apps/memory/memoryRetrieval';
import { getCharacterEmotionContext as builtinGetCharacterEmotionContext } from '../apps/memory/memoryCharacterState';
import { scheduleMemoryProcessing as builtinScheduleMemoryProcessing } from '../apps/memory/memoryScheduler';
import { getEnabledMcpTools } from './mcp/mcpConnectionService';
import {
  MEMORY_SOURCE,
  getMemoryExternalNote,
  getMemorySource,
} from './memorySettingsService';

export const getChatMemoryContext = async (...args) => {
  let source = MEMORY_SOURCE.BUILTIN;

  try {
    source = await getMemorySource();
  } catch (error) {
    // 读取开关失败按内置处理，不影响正常聊天。
    console.warn('[Memory] 读取记忆来源开关失败，按内置处理：', error);
  }

  if (source === MEMORY_SOURCE.OFF) {
    return '';
  }

  if (source === MEMORY_SOURCE.EXTERNAL) {
    try {
      const enabledTools = await getEnabledMcpTools();

      if (!enabledTools || enabledTools.length === 0) {
        return '';
      }
    } catch (error) {
      console.warn('[Memory] 检查外部记忆工具是否可用失败：', error);
      return '';
    }

    return await getMemoryExternalNote();
  }

  return builtinGetChatMemoryContext(...args);
};

export const getCharacterEmotionContext = (...args) => builtinGetCharacterEmotionContext(...args);

export const scheduleMemoryProcessing = async (...args) => {
  let source = MEMORY_SOURCE.BUILTIN;

  try {
    source = await getMemorySource();
  } catch (error) {
    console.warn('[Memory] 读取记忆来源开关失败，按内置处理：', error);
  }

  if (source !== MEMORY_SOURCE.BUILTIN) {
    return;
  }

  return builtinScheduleMemoryProcessing(...args);
};