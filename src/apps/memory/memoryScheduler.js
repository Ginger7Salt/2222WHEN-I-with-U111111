import db from '../../db';

import {
  createMemory,
  createPendingMemoryCandidate,
  ensureMemoryJob,
  expireOutdatedPlannedMemories,
  getChatMemory,
  getMemoryJob
} from './memoryService';
import {
  applyCharacterEmotionMemory
} from './memoryCharacterState';
import {
  backfillChatMemories
} from './memoryMigration';





import {
  MEMORY_JOB_STATUSES,
  MEMORY_STATUSES,
  MEMORY_TYPES,
  MEMORY_CANDIDATE_PROPOSALS

} from './memoryConstants';

import {
  extractMemoryFromConversation
} from './memoryAiService';

import {
  runReflectionForChat
} from './reflectionService';

import {
  ensureEmotionPersonalityFresh
} from './emotionPersonalityService';

import {
  buildMemorySourceBatch,
  getUsableMessages,
  inspectMemorySignals
} from './memorySignals';
import {
  decideMemoryProposal,
  normalizeComparableText
} from './memoryQuality';

const activeMemoryJobs = new Set();
const pendingTimers = new Map();

const NORMAL_CHECKPOINT = 30;
const HIGH_PRIORITY_DELAY = 15000;
const NORMAL_DELAY = 90000;
const RETRY_DELAY = 10 * 60 * 1000;
const CONTINUATION_DELAY = 1000;
const MAX_RETRY_COUNT = 3;

/*
 * 累计这么多条新的、生效中的具体记忆（不含反思本身）之后，
 * 才值得跑一轮反思——太频繁会导致反思互相重复、也没有新东西可综合。
 * 用 memoryJobs 记录上新增的 reflectionMemoryCursor 字段
 * （附加字段，不需要 db 版本升级）记住"上次反思时有多少条"，
 * 每次只比较增量，不用每次都重新判断"够不够 30 条消息"这种事。
 */
const REFLECTION_MEMORY_THRESHOLD = 8;

const nowIso = () => new Date().toISOString();

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

const isDocumentVisible = () => (
  typeof document !== 'undefined' &&
  document.visibilityState === 'visible'
);

const getChatMessagesById = async (chatId) => {
  const messages = await db.messages
    .where('chatId')
    .equals(chatId)
    .toArray();

  return messages.sort((a, b) => {
    const aId = Number(a.id);
    const bId = Number(b.id);

    if (
      Number.isFinite(aId) &&
      Number.isFinite(bId)
    ) {
      return aId - bId;
    }

    return new Date(a.timestamp || 0).getTime()
      - new Date(b.timestamp || 0).getTime();
  });
};

const getMessagesSinceCursor = (
  messages,
  lastProcessedMessageId
) => {
  if (
    lastProcessedMessageId === null ||
    lastProcessedMessageId === undefined
  ) {
    return messages;
  }

  const numericCursor = Number(lastProcessedMessageId);

  if (!Number.isFinite(numericCursor)) {
    return messages;
  }

  return messages.filter((message) => (
    Number(message.id) > numericCursor
  ));
};

const getHighestMessageId = (
  messages,
  fallbackValue = null
) => {
  const ids = messages
    .map((message) => Number(message?.id))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  return ids[0] ?? fallbackValue;
};

const updateMemoryJob = async (chatId, updates) => {
  const currentJob = await getMemoryJob(chatId);

  if (!currentJob) {
    return null;
  }

  const nextJob = {
    ...currentJob,
    ...updates,
    updatedAt: nowIso()
  };

  await db.memoryJobs.update(currentJob.id, nextJob);

  return nextJob;
};

/*
 * 每次一轮"记忆提炼"成功跑完之后顺带检查一下：
 * 距离上次反思，这个聊天又新增了多少条生效中的具体记忆？
 * 够阈值才真正跑一次反思，不够就什么也不做——
 * 复用记忆调度器本来就有的触发节点，不另开一个定时器。
 * 失败要静默吞掉，不能因为反思出错就影响本轮记忆提炼的正常返回。
 */
const maybeRunReflection = async (chatId) => {
  try {
    const job = await getMemoryJob(chatId);

    if (!job) {
      return;
    }

    const activeMemoryCount = await db.memories
      .where('chatId')
      .equals(chatId)
      .filter((memory) => (
        memory.status === MEMORY_STATUSES.ACTIVE &&
        memory.type !== MEMORY_TYPES.REFLECTION
      ))
      .count();

    const cursor = Number(job.reflectionMemoryCursor) || 0;

    if (activeMemoryCount - cursor < REFLECTION_MEMORY_THRESHOLD) {
      return;
    }

    await runReflectionForChat(chatId);

    await updateMemoryJob(chatId, {
      reflectionMemoryCursor: activeMemoryCount,
      lastReflectionAt: nowIso()
    });
  } catch (error) {
    console.warn('[Memory] Reflection check failed safely:', error);
  }
};

/*
 * 复用记忆调度器本来就有的触发节点：每轮记忆提炼跑完之后，顺带检查一下
 * 这个角色的情绪人格画像是不是该刷新了（人设文本变了，或者从没生成过）。
 * ensureEmotionPersonalityFresh 内部已经做好信号量判断和失败节流，
 * 这里只负责在合适的时机调用它，并且吞掉任何异常——不能因为画像刷新
 * 失败影响本轮记忆提炼的正常返回。
 */
const maybeRefreshEmotionPersonality = async (chatId) => {
  try {
    const chat = await db.chats.get(chatId);
    const characterId = chat?.characterId || null;

    if (!characterId) {
      return;
    }

    await ensureEmotionPersonalityFresh(characterId);
  } catch (error) {
    console.warn(
      '[Memory] Emotion personality refresh check failed safely:',
      error
    );
  }
};

const clearPendingTimer = (chatId) => {
  const timer = pendingTimers.get(chatId);

  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(chatId);
  }
};

const scheduleTimer = ({
  chatId,
  delay,
  callback
}) => {
  clearPendingTimer(chatId);

  const timer = setTimeout(() => {
    pendingTimers.delete(chatId);
    void callback();
  }, delay);

  pendingTimers.set(chatId, timer);

  return timer;
};


const persistExtractionResult = async ({
  chatId,
  extraction,
  lastProcessedMessageId
}) => {
      const chat = await db.chats.get(chatId);

  const characterId = chat?.characterId || null;

  const [
    existingMemories,
    existingCandidates
  ] = await Promise.all([
    getChatMemory(chatId),
    db.memoryCandidates
      .where('chatId')
      .equals(chatId)
      .toArray()
  ]);

  const existingContents = new Set(
    [...existingMemories, ...existingCandidates]
      .map((item) => normalizeComparableText(item.content))
      .filter(Boolean)
  );

  const sourceTextById = new Map();

  for (const source of extraction.sourceMessages || []) {
    sourceTextById.set(
      Number(source.id),
      String(source.content || '')
    );
  }

  let createdMemories = 0;
  let createdCandidates = 0;
  let skippedDuplicates = 0;
  let proposedUpdates = 0;
  let proposedCorrections = 0;
  let proposedConflicts = 0;

  const getSourceTexts = (item) => (
    (item.sourceMessageIds || [])
      .map((id) => sourceTextById.get(Number(id)))
      .filter(Boolean)
  );

  const createCandidateFromItem = async ({
    item,
    proposal,
    priority
  }) => {
    await createPendingMemoryCandidate({
      chatId,
      title: item.title,
      content: item.content,
      type: item.type,
      priority,

      subject: item.subject,
      emotionSubject: item.emotionSubject,
      topicKey: item.topicKey,
      topicKeys: item.topicKeys,
      stability: item.stability,
      memoryScope: item.memoryScope,
      recallPolicy: item.recallPolicy,
      temporal: item.temporal,

      sourceMessageIds: item.sourceMessageIds,
      sourceMessageTimestamps: item.sourceMessageTimestamps,
      sourceKind: item.sourceKind,

      proposalType: proposal.proposalType,
      targetMemoryId: proposal.targetMemoryId,
      relatedMemoryIds: proposal.relatedMemoryIds,
      similarityScore: proposal.similarityScore,
      conflictReason: proposal.conflictReason
    });
  };

  const recordProposalStats = (proposalType) => {
    if (
      proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING
    ) {
      proposedUpdates += 1;
    }

    if (
      proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.CORRECT_EXISTING
    ) {
      proposedCorrections += 1;
    }

    if (
      proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.CONFLICT
    ) {
      proposedConflicts += 1;
    }
  };

  for (const memory of extraction.memories || []) {
    const comparableContent = normalizeComparableText(
      memory.content
    );

    if (
      !comparableContent ||
      existingContents.has(comparableContent)
    ) {
      skippedDuplicates += 1;
      continue;
    }

    const proposal = decideMemoryProposal({
      incomingMemory: memory,
      existingMemories,
      sourceTexts: getSourceTexts(memory)
    });

    if (
      proposal.proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.CREATE
    ) {
      const createdMemory = await createMemory({
        chatId,
        title: memory.title,
        content: memory.content,
        type: memory.type,
        status: MEMORY_STATUSES.ACTIVE,
        importance: memory.importance,
        confidence: memory.confidence,

        subject: memory.subject,
        emotionSubject: memory.emotionSubject,
        topicKey: memory.topicKey,
        topicKeys: memory.topicKeys,
        stability: memory.stability,
        memoryScope: memory.memoryScope,
        recallPolicy: memory.recallPolicy,
        temporal: memory.temporal,

        sourceMessageIds: memory.sourceMessageIds,
        sourceMessageTimestamps: memory.sourceMessageTimestamps,
        sourceState: memory.sourceState,
        sourceKind: memory.sourceKind,
        note: '由对话整理形成。'
      });

      /*
       * moodDelta / emotionTag 都不是 createMemory 的标准参数（那是
       * 记忆内容本身的字段，不是所有类型的记忆都有），这里跟反思机制里
       * sourceMemoryIds、以及 characterAbsenceService.js 的做法一样，
       * 单独补一次附加字段写入。
       *
       * 这里同时修了一个既有问题：之前 applyCharacterEmotionMemory
       * 传的是 createdMemory（不带 moodDelta），而不是带 moodDelta 的
       * memory，导致从对话里正式提炼出来的情绪记忆从未真正影响过角色的
       * 实时心情状态——只有 characterAbsenceService.js 生成的"被冷落"
       * 情绪记忆生效。现在两条路径行为一致。
       */
      const extraMemoryFields = {};

      if (memory.moodDelta) {
        extraMemoryFields.moodDelta = memory.moodDelta;
      }

      if (memory.emotionTag) {
        extraMemoryFields.emotionTag = memory.emotionTag;
      }

      if (Object.keys(extraMemoryFields).length > 0) {
        await db.memories.update(createdMemory.id, extraMemoryFields);
      }

      const persistedMemory = {
        ...createdMemory,
        ...extraMemoryFields
      };

          existingMemories.push(persistedMemory);
      existingContents.add(comparableContent);

      /*
       * 仅正式写入、且归属于角色/共同关系的情绪记忆，
       * 才会进入角色当前情绪状态。
       */
      await applyCharacterEmotionMemory({
        chatId,
        characterId,
        memory: persistedMemory
      });

      createdMemories += 1;
      continue;

    }

    if (
      proposal.proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.DUPLICATE
    ) {
      skippedDuplicates += 1;
      continue;
    }

    await createCandidateFromItem({
      item: memory,
      proposal,
      priority: memory.importance
    });

    existingContents.add(comparableContent);
    createdCandidates += 1;
    recordProposalStats(proposal.proposalType);
  }

  for (const candidate of extraction.candidates || []) {
    const comparableContent = normalizeComparableText(
      candidate.content
    );

    if (
      !comparableContent ||
      existingContents.has(comparableContent)
    ) {
      skippedDuplicates += 1;
      continue;
    }

    const proposal = decideMemoryProposal({
      incomingMemory: candidate,
      existingMemories,
      sourceTexts: getSourceTexts(candidate)
    });

    if (
      proposal.proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.DUPLICATE
    ) {
      skippedDuplicates += 1;
      continue;
    }

    await createCandidateFromItem({
      item: candidate,
      proposal,
      priority: candidate.priority
    });

    existingContents.add(comparableContent);
    createdCandidates += 1;
    recordProposalStats(proposal.proposalType);
  }

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.IDLE,
    lastProcessedMessageId,
    nextRunAt: null,
    retryCount: 0,
    lastError: '',
    lastCompletedAt: nowIso()
  });

  return {
    createdMemories,
    createdCandidates,
    skippedDuplicates,
    proposedUpdates,
    proposedCorrections,
    proposedConflicts
  };
};



const scheduleContinuationIfNeeded = async ({
  chatId,
  lastProcessedMessageId
}) => {
  const allMessages = await getChatMessagesById(chatId);

  const remainingMessages = getMessagesSinceCursor(
    allMessages,
    lastProcessedMessageId
  );

  const remainingUsableMessages = getUsableMessages(
    remainingMessages
  );

  if (remainingUsableMessages.length === 0) {
    return false;
  }

  /*
   * 当前批次达到上限后，说明仍有待处理消息。
   * 即使剩余不足 30 条，也应该继续处理：
   * 否则一段历史积压的尾部消息会长期停留在 cursor 之后。
   */
  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.PENDING,
    nextRunAt: new Date(
      Date.now() + CONTINUATION_DELAY
    ).toISOString()
  });

  scheduleTimer({
    chatId,
    delay: CONTINUATION_DELAY,
    callback: () => runMemoryProcessing(chatId, {
      force: true,
      allowHidden: true
    })
  });

  return true;
};

const scheduleRetry = async ({
  chatId,
  error
}) => {
  const currentJob = await getMemoryJob(chatId);

  if (!currentJob) {
    return;
  }

  const retryCount = Number(currentJob.retryCount || 0) + 1;

  if (retryCount > MAX_RETRY_COUNT) {
    await updateMemoryJob(chatId, {
      status: MEMORY_JOB_STATUSES.FAILED,
      nextRunAt: null,
      retryCount,
      lastError: error?.message || '未知错误'
    });

    return;
  }

  const retryAt = new Date(
    Date.now() + RETRY_DELAY
  ).toISOString();

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.FAILED,
    nextRunAt: retryAt,
    retryCount,
    lastError: error?.message || '未知错误'
  });

  scheduleTimer({
    chatId,
    delay: RETRY_DELAY,
    callback: () => runMemoryProcessing(chatId, {
      force: true,
      allowHidden: true
    })
  });
};

export const runMemoryProcessing = async (
  chatId,
  {
    force = false,
    allowHidden = false
  } = {}
) => {
  if (
    !isValidChatId(chatId) ||
    activeMemoryJobs.has(chatId)
  ) {
    return {
      skipped: true,
      reason: 'already_running_or_invalid'
    };
  }

  if (
    !force &&
    !allowHidden &&
    !isDocumentVisible()
  ) {
    return {
      skipped: true,
      reason: 'document_hidden'
    };
  }

  activeMemoryJobs.add(chatId);

  try {
        const job = await ensureMemoryJob(chatId);

    /*
     * 记忆后台处理前补齐旧记录字段。
     * 这是结构迁移，不会重新调用 AI，也不会改写用户内容。
     */
    try {
      await backfillChatMemories(chatId);
    } catch (error) {
      console.warn(
        '[Memory] Background memory backfill skipped:',
        error
      );
    }


    /*
     * 即使本轮没有新消息，也先让已过期的计划退出普通召回。
     * 不把“本周五要去约会”无限留在 active 计划状态。
     */
    await expireOutdatedPlannedMemories(chatId);

    const allMessages = await getChatMessagesById(chatId);


    const pendingMessages = getMessagesSinceCursor(
      allMessages,
      job.lastProcessedMessageId
    );

    const usableMessages = getUsableMessages(pendingMessages);

    if (usableMessages.length === 0) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'no_usable_messages'
      };
    }

    const signals = inspectMemorySignals(pendingMessages);

    const shouldProcess = (
      force ||
      usableMessages.length >= NORMAL_CHECKPOINT ||
      signals.hasHighPrioritySignal
    );

    if (!shouldProcess) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'checkpoint_not_reached',
        usableMessageCount: usableMessages.length
      };
    }

    /*
     * buildMemorySourceBatch 已按消息 ID 从早到晚挑选最多 40 条。
     * 这批消息才是本轮实际交给 AI 的内容，也是 cursor 唯一可安全推进的范围。
     */
    const sourceBatch = buildMemorySourceBatch(
      pendingMessages
    );

    if (sourceBatch.length === 0) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'no_valid_source_batch'
      };
    }

    await updateMemoryJob(chatId, {
      status: MEMORY_JOB_STATUSES.RUNNING,
      nextRunAt: null,
      lastError: ''
    });

    const extraction = await extractMemoryFromConversation({
      chatId,
      messages: sourceBatch
    });

    /*
     * 不能使用 pendingMessages 的最大 ID。
     * 否则 pendingMessages 超过 40 条时，未送入 AI 的消息会被永久跳过。
     */
    const lastProcessedMessageId = getHighestMessageId(
      extraction.sourceMessageIds?.map((id) => ({ id })) || [],
      getHighestMessageId(
        sourceBatch,
        job.lastProcessedMessageId
      )
    );

    const persisted = await persistExtractionResult({
      chatId,
      extraction,
      lastProcessedMessageId
    });

    const continuationScheduled = await scheduleContinuationIfNeeded({
      chatId,
      lastProcessedMessageId
    });

    await maybeRunReflection(chatId);
    await maybeRefreshEmotionPersonality(chatId);

    return {
      skipped: false,
      createdMemories: persisted.createdMemories,
      createdCandidates: persisted.createdCandidates,
      skippedDuplicates: persisted.skippedDuplicates,
      proposedUpdates: persisted.proposedUpdates,
proposedCorrections: persisted.proposedCorrections,
proposedConflicts: persisted.proposedConflicts,
      sourceMessageCount: sourceBatch.length,
      lastProcessedMessageId,
      continuationScheduled
    };
  } catch (error) {
    console.warn(
      '[Memory] Processing failed safely:',
      error
    );

    try {
      await scheduleRetry({
        chatId,
        error
      });
    } catch (jobUpdateError) {
      console.warn(
        '[Memory] Failed to persist retry state:',
        jobUpdateError
      );
    }

    return {
      skipped: false,
      error: error?.message || '未知错误'
    };
  } finally {
    activeMemoryJobs.delete(chatId);
  }
};

export const scheduleMemoryProcessing = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return;
  }

  const job = await ensureMemoryJob(chatId);

  const allMessages = await getChatMessagesById(chatId);

  const pendingMessages = getMessagesSinceCursor(
    allMessages,
    job.lastProcessedMessageId
  );

  const usableMessages = getUsableMessages(pendingMessages);

  if (usableMessages.length === 0) {
    return;
  }

  const signals = inspectMemorySignals(pendingMessages);

  const shouldPrepare = (
    usableMessages.length >= NORMAL_CHECKPOINT ||
    signals.hasHighPrioritySignal
  );

  if (!shouldPrepare) {
    return;
  }

  const delay = signals.hasHighPrioritySignal
    ? HIGH_PRIORITY_DELAY
    : NORMAL_DELAY;

  const nextRunAt = new Date(
    Date.now() + delay
  ).toISOString();

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.PENDING,
    nextRunAt,
    lastError: ''
  });

  scheduleTimer({
    chatId,
    delay,
    callback: () => runMemoryProcessing(chatId)
  });
};

export const cancelScheduledMemoryProcessing = (chatId) => {
  if (!isValidChatId(chatId)) {
    return;
  }

  clearPendingTimer(chatId);
};

/**
 * 取消所有聊天窗已排的整理任务（切到外部 / 关闭记忆来源时用）。
 * 不清空 IndexedDB 里的任务记录，只是不再让它们在这次页面会话里触发。
 */
export const cancelAllScheduledMemoryProcessing = () => {
  for (const chatId of Array.from(pendingTimers.keys())) {
    clearPendingTimer(chatId);
  }
};

/**
 * 页面重新打开或应用重新载入后，可恢复 IndexedDB 中尚未完成的记忆任务。
 *
 * 可在 App.jsx 的初始化 useEffect 中执行：
 *
 *   void restoreMemoryProcessingSchedules();
 */
export const restoreMemoryProcessingSchedules = async () => {
  const jobs = await db.memoryJobs
    .where('status')
    .anyOf([
      MEMORY_JOB_STATUSES.PENDING,
      MEMORY_JOB_STATUSES.FAILED
    ])
    .toArray();

  const now = Date.now();

  for (const job of jobs) {
    if (!isValidChatId(job.chatId)) {
      continue;
    }

    const nextRunTime = new Date(
      job.nextRunAt || 0
    ).getTime();

    const delay = Number.isFinite(nextRunTime)
      ? Math.max(0, nextRunTime - now)
      : 0;

    scheduleTimer({
      chatId: job.chatId,
      delay,
      callback: () => runMemoryProcessing(job.chatId, {
        force: true,
        allowHidden: true
      })
    });
  }

  return jobs.length;
};

export const runMemoryProcessingNow = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return {
      skipped: true,
      reason: 'invalid_chat_id'
    };
  }

  cancelScheduledMemoryProcessing(chatId);

  return runMemoryProcessing(chatId, {
    force: true,
    allowHidden: true
  });
};