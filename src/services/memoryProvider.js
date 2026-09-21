/**
 * 记忆入口（统一出入口）
 *
 * 阶段 1：只做转发，行为与原来逐字一致。
 *
 * 所有"把记忆放进提示词""聊完后整理记忆"的地方，都从这里拿函数，
 * 而不是直接去 apps/memory 里拿。这样以后要加"记忆来源开关"
 * （内置 / 外部 / 关闭）时，只需要改这一个文件，不用再动
 * aiService、callService 等大文件。
 *
 * 函数名刻意和原来保持一致，方便 grep，也让接入点只需要换 import 路径。
 *
 *   getChatMemoryContext       提示词里的"记忆块"（出错时由调用处降级为空串）
 *   getCharacterEmotionContext 提示词里的"情绪 / 角色状态块"（不属于记忆开关，保持内置）
 *   scheduleMemoryProcessing   聊完后安排整理记忆
 *
 * 注意：这个文件不要 import aiService / callService，避免循环引用。
 */
import { getChatMemoryContext as builtinGetChatMemoryContext } from '../apps/memory/memoryRetrieval';
import { getCharacterEmotionContext as builtinGetCharacterEmotionContext } from '../apps/memory/memoryCharacterState';
import { scheduleMemoryProcessing as builtinScheduleMemoryProcessing } from '../apps/memory/memoryScheduler';

export const getChatMemoryContext = (...args) => builtinGetChatMemoryContext(...args);

export const getCharacterEmotionContext = (...args) => builtinGetCharacterEmotionContext(...args);

export const scheduleMemoryProcessing = (...args) => builtinScheduleMemoryProcessing(...args);