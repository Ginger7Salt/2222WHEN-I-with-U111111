import { getChatMemory, createMemory } from './memoryService';
import { generateReflections } from './reflectionAiService';
import {
  MEMORY_STATUSES,
  MEMORY_TYPES,
  MEMORY_SUBJECTS,
  MEMORY_SCOPES,
  MEMORY_RECALL_POLICIES,
  MEMORY_STABILITIES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES
} from './memoryConstants';
import db from '../../db';

/*
 * 反思机制（仿斯坦福 Generative Agents 论文的思路）：
 * 定期把这个聊天里已经生效的一批具体记忆，综合成更高层的阶段性认知，
 * 写成 type: reflection 的普通记忆。
 *
 * 刻意不新建反思专用的展示/召回逻辑——memoryRetrieval.js 早就把
 * reflection 当成一种普通可召回的记忆类型处理（带 24 小时冷却），
 * 所以反思记忆一旦写进 memories 表，会自动经过现有的排序、
 * 去重、冷却逻辑进入回复的 system prompt，不需要额外接线。
 */

const MAX_SOURCE_MEMORIES = 24;
const MAX_EXISTING_REFLECTIONS_FOR_CONTEXT = 6;

const mapSubjectToMemoryScope = (subject) => {
  if (subject === MEMORY_SUBJECTS.CHARACTER) {
    return MEMORY_SCOPES.CHARACTER_SETTING;
  }

  if (subject === MEMORY_SUBJECTS.RELATIONSHIP) {
    return MEMORY_SCOPES.RELATIONSHIP_SETTING;
  }

  return MEMORY_SCOPES.CONVERSATION;
};

/*
 * 供这一轮反思参考的"具体记忆"：排除反思本身，只取生效中的，
 * 按最近更新时间取前 MAX_SOURCE_MEMORIES 条——反思应该基于
 * 这段关系"最近的样子"，不需要扫描这个聊天从头到尾的全部记忆。
 */
const pickSourceMemories = (allMemories) => (
  allMemories
    .filter((memory) => (
      memory.status === MEMORY_STATUSES.ACTIVE &&
      memory.type !== MEMORY_TYPES.REFLECTION
    ))
    .slice(0, MAX_SOURCE_MEMORIES)
);

const pickExistingReflections = (allMemories) => (
  allMemories
    .filter((memory) => (
      memory.type === MEMORY_TYPES.REFLECTION &&
      memory.status === MEMORY_STATUSES.ACTIVE
    ))
    .slice(0, MAX_EXISTING_REFLECTIONS_FOR_CONTEXT)
);

/*
 * 对这个聊天跑一轮反思。调用方（memoryScheduler.js）负责判断
 * "现在该不该跑"（累计了多少条新记忆），这里只负责"跑起来"这一步：
 * 取数据 -> 调用 AI 综合 -> 写回 memories 表。
 */
export const runReflectionForChat = async (chatId) => {
  const allMemories = await getChatMemory(chatId);

  const sourceMemories = pickSourceMemories(allMemories);

  if (sourceMemories.length < 2) {
    return { createdCount: 0, reason: 'not_enough_source_memories' };
  }

  const existingReflections = pickExistingReflections(allMemories);

  let reflections = [];

  try {
    reflections = await generateReflections({
      sourceMemories,
      existingReflections
    });
  } catch (error) {
    console.warn('[Reflection] 生成反思失败：', error);
    return { createdCount: 0, error: error?.message || '未知错误' };
  }

  if (reflections.length === 0) {
    return { createdCount: 0, reason: 'no_new_reflection' };
  }

  const createdMemories = [];

  for (const reflection of reflections) {
    const memoryScope = mapSubjectToMemoryScope(reflection.subject);

    // eslint-disable-next-line no-await-in-loop
    const created = await createMemory({
      chatId,
      title: reflection.title,
      content: reflection.content,
      type: MEMORY_TYPES.REFLECTION,
      status: MEMORY_STATUSES.ACTIVE,
      importance: reflection.importance,
      confidence: reflection.confidence,
      subject: reflection.subject,
      topicKey: 'reflection',
      stability: MEMORY_STABILITIES.ONGOING,
      memoryScope,
      recallPolicy: MEMORY_RECALL_POLICIES.NORMAL,
      sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
      sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
      note: '由阶段性反思自动生成，基于已有记忆综合得出'
    });

    // sourceMemoryIds（这条反思综合自哪几条具体记忆）不是 createMemory
    // 的标准参数，单独补一次写入——附加字段，不需要改 createMemory 本身
    // 或升级 db 版本。
    // eslint-disable-next-line no-await-in-loop
    await db.memories.update(created.id, {
      sourceMemoryIds: reflection.sourceMemoryIds
    });

    createdMemories.push(created);
  }

  return {
    createdCount: createdMemories.length,
    createdMemories
  };
};