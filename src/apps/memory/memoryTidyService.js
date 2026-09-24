import db from '../../db';

import {
  acceptMemoryCandidate,
  createMemory,
  createPendingMemoryCandidate,
  ensureMemoryJob,
  getChatMemory
} from './memoryService';

import {
  MEMORY_CANDIDATE_PROPOSALS,
  MEMORY_CONFIDENCES,
  MEMORY_RECALL_POLICIES,
  MEMORY_SCOPES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STABILITIES,
  MEMORY_STATUSES,
  MEMORY_SUBJECTS,
  MEMORY_TYPES
} from './memoryConstants';

import {
  calculateMemorySimilarity,
  isManualAuthorityMemory
} from './memoryQuality';

import {
  generateEmotionReview,
  generateMergedMemory
} from './memoryTidyAiService';

import {
  runDecayTidy
} from './memoryDecayService';

import {
  getMemoryTidyAutoExecute
} from '../../services/memoryTidySettingsService';

/*
 * 记忆的"主动整理"：在不新增定时器的前提下，复用记忆调度器每轮提炼之后
 * 已有的触发节点（memoryScheduler.js 里的 maybeRunMemoryTidy），做两件事：
 *
 * 1. 合并重复记忆：本地先用相似度找出"可能重复"的一组，再让 AI 判断
 *    是否真的在说同一件事、并写出合并后的内容，AI 说不能合并就放弃。
 * 2. 情绪回顾：累计了足够多新的情绪痕迹后，综合成一条阶段性回顾，
 *    写成 type: reflection 的普通记忆（沿用现有的召回与冷却逻辑）。
 *
 * 自主程度由设置开关决定（memoryTidySettingsService.js）：
 *   - 关（默认）：只生成待确认候选，用户确认后才生效。
 *   - 开：角色直接执行；合并复用 acceptMemoryCandidate 的合并分支，
 *     被并入的旧记忆只会被归档（可找回），并保留修订记录。
 * 无论开关如何，用户手动写入/编辑/确认过的记忆都不会被自动合并，
 * 只会走待确认候选。
 *
 * 所有失败都只在控制台警告，不向上抛错，不影响正常记忆提炼。
 */

/*
 * 用本项目 calculateMemorySimilarity 的实测标定：
 * 明显重复的记忆（同一件事，一条多了些细节或换了说法）得分约 0.46~0.64，
 * 不相关的同类型记忆得分不超过 0.38。取 0.42 在中间。
 * 这只是本地的"初筛"，真正是否合并由 AI 二次判断，
 * 而且默认还要经过用户确认，所以初筛宁可略宽也不要太严。
 * 措辞差异很大的同义改写（得分约 0.33）初筛抓不到，这是有意接受的取舍。
 */
const MERGE_SIMILARITY_THRESHOLD = 0.42;
const MAX_GROUP_SIZE = 4;
const MAX_MERGE_GROUPS_PER_RUN = 3;
const MAX_REJECTED_SIGNATURES = 60;

const MIN_TIDY_INTERVAL_MS = 12 * 60 * 60 * 1000;

const EMOTION_REVIEW_THRESHOLD = 5;
const MAX_EMOTION_SOURCE_MEMORIES = 20;
const MAX_EXISTING_REVIEWS_FOR_CONTEXT = 4;
const EMOTION_REVIEW_TOPIC_KEY = 'emotion_review';

/*
 * 只合并"稳定陈述型"记忆。刻意不合并：
 * - episode：两次相似的共同经历往往是两件事；
 * - emotion：不同时间的情绪痕迹本身就是时间线，交给情绪回顾去综合；
 * - reflection：本来就是综合产物。
 */
const MERGEABLE_TYPES = new Set([
  MEMORY_TYPES.FACT,
  MEMORY_TYPES.PREFERENCE,
  MEMORY_TYPES.RELATIONSHIP,
  MEMORY_TYPES.EXPRESSION_RULE,
  MEMORY_TYPES.CHARACTER_THOUGHT
]);

const activeTidyChats = new Set();

const nowIso = () => new Date().toISOString();

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

const getMemoryTime = (memory) => (
  toTime(memory.updatedAt || memory.createdAt)
);

const mapSubjectToMemoryScope = (subject) => {
  if (subject === MEMORY_SUBJECTS.CHARACTER) {
    return MEMORY_SCOPES.CHARACTER_SETTING;
  }

  if (subject === MEMORY_SUBJECTS.RELATIONSHIP) {
    return MEMORY_SCOPES.RELATIONSHIP_SETTING;
  }

  return MEMORY_SCOPES.CONVERSATION;
};

/* ------------------------------------------------------------------ */
/* 合并重复记忆                                                        */
/* ------------------------------------------------------------------ */

const isMergeEligible = (memory) => {
  if (
    !memory ||
    memory.status !== MEMORY_STATUSES.ACTIVE ||
    !MERGEABLE_TYPES.has(memory.type) ||
    memory.supersededByMemoryId
  ) {
    return false;
  }

  // 带有"计划中/进行中"时间信息的记忆代表具体事件，不参与合并。
  const temporalStatus = memory.temporal?.status;

  return temporalStatus !== 'planned' && temporalStatus !== 'ongoing';
};

const isPossibleDuplicatePair = (left, right) => (
  left.type === right.type &&
  left.subject === right.subject &&
  calculateMemorySimilarity(left, right) >= MERGE_SIMILARITY_THRESHOLD
);

/*
 * 保留哪一条作为合并目标：用户手动维护的优先（避免绕开用户权威），
 * 其次重要度高的，最后取更新的。
 */
const compareKeeperPriority = (left, right) => {
  const manualDiff = Number(isManualAuthorityMemory(right))
    - Number(isManualAuthorityMemory(left));

  if (manualDiff !== 0) {
    return manualDiff;
  }

  const importanceDiff = Number(right.importance || 3)
    - Number(left.importance || 3);

  if (importanceDiff !== 0) {
    return importanceDiff;
  }

  return getMemoryTime(right) - getMemoryTime(left);
};

export const buildGroupSignature = (memories) => (
  memories
    .map((memory) => memory.memoryId)
    .filter(Boolean)
    .sort()
    .join('|')
);

/*
 * 用并查集把"两两相似"的记忆连成组，每组最多 MAX_GROUP_SIZE 条。
 * 返回的每一组已按保留优先级排序，第一条就是合并目标。
 */
export const findDuplicateGroups = (allMemories = []) => {
  const eligible = allMemories.filter(isMergeEligible);

  const parent = new Map(
    eligible.map((memory) => [memory.memoryId, memory.memoryId])
  );

  const find = (id) => {
    let root = id;

    while (parent.get(root) !== root) {
      root = parent.get(root);
    }

    parent.set(id, root);

    return root;
  };

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      if (isPossibleDuplicatePair(eligible[i], eligible[j])) {
        parent.set(
          find(eligible[i].memoryId),
          find(eligible[j].memoryId)
        );
      }
    }
  }

  const groupsByRoot = new Map();

  for (const memory of eligible) {
    const root = find(memory.memoryId);

    if (!groupsByRoot.has(root)) {
      groupsByRoot.set(root, []);
    }

    groupsByRoot.get(root).push(memory);
  }

  return [...groupsByRoot.values()]
    .filter((group) => group.length >= 2)
    .map((group) => (
      [...group]
        .sort(compareKeeperPriority)
        .slice(0, MAX_GROUP_SIZE)
    ));
};

const mergeUniqueLists = (lists) => [
  ...new Set(lists.flat().filter((item) => item !== undefined && item !== null))
];

const runMergeTidy = async ({
  chatId,
  allMemories,
  job,
  autoExecute
}) => {
  const rejectedSignatures = Array.isArray(job?.tidyRejectedSignatures)
    ? [...job.tidyRejectedSignatures]
    : [];

  const summary = {
    proposed: 0,
    applied: 0,
    checkedGroups: 0,
    rejectedSignatures,
    error: ''
  };

  // 已经提过候选的组（不管是待确认、已采纳还是被忽略）都不再重复提。
  const existingCandidates = await db.memoryCandidates
    .where('chatId')
    .equals(chatId)
    .toArray();

  const handledSignatures = new Set([
    ...rejectedSignatures,
    ...existingCandidates
      .map((candidate) => candidate.tidySignature)
      .filter(Boolean)
  ]);

  const groups = findDuplicateGroups(allMemories)
    .filter((group) => !handledSignatures.has(buildGroupSignature(group)))
    .slice(0, MAX_MERGE_GROUPS_PER_RUN);

  for (const group of groups) {
    const signature = buildGroupSignature(group);
    const keeper = group[0];
    const others = group.slice(1);

    // 给 AI 看的顺序：从旧到新，编号越大越新。
    const orderedForAi = [...group].sort(
      (left, right) => getMemoryTime(left) - getMemoryTime(right)
    );

    let merged = null;

    try {
      // eslint-disable-next-line no-await-in-loop
      merged = await generateMergedMemory({ memories: orderedForAi });
    } catch (error) {
      console.warn('[MemoryTidy] 判断能否合并失败：', error);
      summary.error = error?.message || '未知错误';
      break;
    }

    summary.checkedGroups += 1;

    if (!merged.canMerge) {
      rejectedSignatures.push(signature);
      continue;
    }

    const hasManualAuthority = group.some(isManualAuthorityMemory);
    const shouldAutoExecute = autoExecute && !hasManualAuthority;

    const highestImportance = Math.max(
      ...group.map((memory) => Number(memory.importance || 3))
    );

    // eslint-disable-next-line no-await-in-loop
    const candidate = await createPendingMemoryCandidate({
      chatId,
      title: merged.title || keeper.title,
      content: merged.content,
      type: keeper.type,
      priority: Math.max(merged.importance, highestImportance),
      sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
      sourceMessageIds: mergeUniqueLists(
        group.map((memory) => memory.sourceMessageIds || [])
      ),

      proposalType: MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING,
      targetMemoryId: keeper.memoryId,
      relatedMemoryIds: group.map((memory) => memory.memoryId),
      similarityScore: 1,
      conflictReason: hasManualAuthority && autoExecute
        ? '整理时发现这几条记忆描述的是同一件事。其中包含你手动维护过的记忆，所以需要你确认后才会合并；其余几条会被归档，可随时找回。'
        : '整理时发现这几条记忆描述的是同一件事，建议合并为一条；其余几条会被归档，可随时找回。',

      subject: keeper.subject,
      emotionSubject: keeper.emotionSubject,
      topicKey: keeper.topicKey,
      topicKeys: keeper.topicKeys,
      stability: keeper.stability,
      memoryScope: keeper.memoryScope,
      recallPolicy: keeper.recallPolicy,
      temporal: keeper.temporal
    });

    // 整理专用的附加字段，不属于 createPendingMemoryCandidate 的标准参数，
    // 单独补写（附加字段，不需要 db 版本升级）。
    // eslint-disable-next-line no-await-in-loop
    await db.memoryCandidates
      .where('candidateId')
      .equals(candidate.candidateId)
      .modify({
        tidyKind: 'merge_duplicates',
        tidySignature: signature,
        mergeMemoryIds: others.map((memory) => memory.memoryId),
        tidyAuto: shouldAutoExecute
      });

    if (!shouldAutoExecute) {
      summary.proposed += 1;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await acceptMemoryCandidate(candidate.candidateId, {
        note: '由角色自动整理合并。'
      });

      summary.applied += 1;
    } catch (error) {
      // 自动合并失败时，候选仍留在待确认列表里，不丢内容。
      console.warn('[MemoryTidy] 自动合并失败，已保留为待确认候选：', error);
      summary.proposed += 1;
    }
  }

  summary.rejectedSignatures = rejectedSignatures.slice(
    -MAX_REJECTED_SIGNATURES
  );

  return summary;
};

/* ------------------------------------------------------------------ */
/* 情绪回顾                                                            */
/* ------------------------------------------------------------------ */

const runEmotionReview = async ({
  chatId,
  allMemories,
  job,
  autoExecute
}) => {
  const summary = {
    proposed: 0,
    applied: 0,
    reviewed: false,
    reason: '',
    error: ''
  };

  const lastReviewTime = toTime(job?.lastEmotionReviewAt);

  const freshEmotionMemories = allMemories
    .filter((memory) => (
      memory.type === MEMORY_TYPES.EMOTION &&
      (
        memory.status === MEMORY_STATUSES.ACTIVE ||
        memory.status === MEMORY_STATUSES.TEMPORARY
      ) &&
      toTime(memory.createdAt) > lastReviewTime
    ))
    .sort((left, right) => (
      toTime(left.createdAt) - toTime(right.createdAt)
    ));

  if (freshEmotionMemories.length < EMOTION_REVIEW_THRESHOLD) {
    summary.reason = 'not_enough_emotion_memories';
    return summary;
  }

  const emotionMemories = freshEmotionMemories.slice(
    -MAX_EMOTION_SOURCE_MEMORIES
  );

  const existingReviews = allMemories
    .filter((memory) => (
      memory.topicKey === EMOTION_REVIEW_TOPIC_KEY &&
      memory.status === MEMORY_STATUSES.ACTIVE
    ))
    .slice(0, MAX_EXISTING_REVIEWS_FOR_CONTEXT);

  let reviews = [];

  try {
    reviews = await generateEmotionReview({
      emotionMemories,
      existingReviews
    });
  } catch (error) {
    console.warn('[MemoryTidy] 生成情绪回顾失败：', error);
    summary.error = error?.message || '未知错误';
    return summary;
  }

  // AI 调用成功（哪怕这次没有值得写的回顾）就算回顾过一次，
  // 下次只看之后新增的情绪痕迹，避免每轮都重复问同一批。
  summary.reviewed = true;

  for (const review of reviews) {
    const memoryScope = mapSubjectToMemoryScope(review.subject);

    if (autoExecute) {
      // eslint-disable-next-line no-await-in-loop
      const created = await createMemory({
        chatId,
        title: review.title,
        content: review.content,
        type: MEMORY_TYPES.REFLECTION,
        status: MEMORY_STATUSES.ACTIVE,
        importance: review.importance,
        confidence: MEMORY_CONFIDENCES.INFERRED,
        subject: review.subject,
        topicKey: EMOTION_REVIEW_TOPIC_KEY,
        stability: MEMORY_STABILITIES.ONGOING,
        memoryScope,
        recallPolicy: MEMORY_RECALL_POLICIES.NORMAL,
        sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
        sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
        note: '由角色定期回顾情绪痕迹后自动生成。'
      });

      // sourceMemoryIds 不是 createMemory 的标准参数，跟反思机制一样单独补写。
      // eslint-disable-next-line no-await-in-loop
      await db.memories
        .where('memoryId')
        .equals(created.memoryId)
        .modify({ sourceMemoryIds: review.sourceMemoryIds });

      summary.applied += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const candidate = await createPendingMemoryCandidate({
      chatId,
      title: review.title,
      content: review.content,
      type: MEMORY_TYPES.REFLECTION,
      priority: review.importance,
      sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,

      proposalType: MEMORY_CANDIDATE_PROPOSALS.CREATE,
      conflictReason: '这是回顾最近的情绪痕迹后得出的阶段性总结，采纳后才会成为正式记忆。',

      subject: review.subject,
      topicKey: EMOTION_REVIEW_TOPIC_KEY,
      stability: MEMORY_STABILITIES.ONGOING,
      memoryScope,
      recallPolicy: MEMORY_RECALL_POLICIES.NORMAL
    });

    // eslint-disable-next-line no-await-in-loop
    await db.memoryCandidates
      .where('candidateId')
      .equals(candidate.candidateId)
      .modify({
        tidyKind: 'emotion_review',
        sourceMemoryIds: review.sourceMemoryIds
      });

    summary.proposed += 1;
  }

  return summary;
};

/* ------------------------------------------------------------------ */
/* 入口                                                                */
/* ------------------------------------------------------------------ */

/*
 * 对一个聊天跑一轮整理。
 * - 自动触发（memoryScheduler.js）：force 为 false，同一个聊天 12 小时内
 *   最多整理一次，避免每轮提炼都重复扫描。
 * - 手动触发（记忆空间里的"现在整理一次"）：force 为 true，跳过时间间隔，
 *   并且会把错误信息带回给界面。
 */
export const runMemoryTidyForChat = async (
  chatId,
  { force = false } = {}
) => {
  if (chatId === null || chatId === undefined || chatId === '') {
    return { skipped: true, reason: 'invalid_chat_id' };
  }

  if (activeTidyChats.has(chatId)) {
    return { skipped: true, reason: 'already_running' };
  }

  activeTidyChats.add(chatId);

  try {
    const job = await ensureMemoryJob(chatId);

    if (
      !force &&
      Date.now() - toTime(job?.lastTidyAt) < MIN_TIDY_INTERVAL_MS
    ) {
      return { skipped: true, reason: 'throttled' };
    }

    const autoExecute = await getMemoryTidyAutoExecute();
    let allMemories = await getChatMemory(chatId);

    /*
     * 先把久到该淡出的记忆暂存起来（可恢复），再做合并和情绪回顾，
     * 这样后两步不会再去处理已经暂存的记忆。
     * 暂存本身没有 AI 调用；它是可恢复的低风险动作，所以不受"先让我确认"开关限制。
     */
    const decay = await runDecayTidy({ allMemories });

    if (decay.dormantCount > 0) {
      allMemories = await getChatMemory(chatId);
    }

    const merge = await runMergeTidy({
      chatId,
      allMemories,
      job,
      autoExecute
    });

    // 合并可能改动了记忆，情绪回顾用最新的一份。
    const latestMemories = merge.applied > 0
      ? await getChatMemory(chatId)
      : allMemories;

    const emotion = await runEmotionReview({
      chatId,
      allMemories: latestMemories,
      job,
      autoExecute
    });

    const jobUpdates = {
      lastTidyAt: nowIso(),
      tidyRejectedSignatures: merge.rejectedSignatures
    };

    if (emotion.reviewed) {
      jobUpdates.lastEmotionReviewAt = nowIso();
    }

    // 两部分都因为 AI 不可用而失败时，不记录"整理过"，下次还会再试。
    if (merge.error && emotion.error) {
      delete jobUpdates.lastTidyAt;
    }

    await db.memoryJobs.update(job.id, jobUpdates);

    return {
      skipped: false,
      autoExecute,
      decay: {
        dormantCount: decay.dormantCount
      },
      merge: {
        proposed: merge.proposed,
        applied: merge.applied,
        checkedGroups: merge.checkedGroups
      },
      emotion: {
        proposed: emotion.proposed,
        applied: emotion.applied,
        reviewed: emotion.reviewed,
        reason: emotion.reason
      },
      error: merge.error || emotion.error || ''
    };
  } catch (error) {
    console.warn('[MemoryTidy] 整理失败：', error);

    return {
      skipped: false,
      error: error?.message || '未知错误'
    };
  } finally {
    activeTidyChats.delete(chatId);
  }
};