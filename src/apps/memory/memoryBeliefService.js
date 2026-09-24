import db from '../../db';

import {
  acceptMemoryCandidate,
  createMemory,
  createPendingMemoryCandidate
} from './memoryService';

import {
  MEMORY_CANDIDATE_PROPOSALS,
  MEMORY_CANDIDATE_STATUSES,
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
  isManualAuthorityMemory
} from './memoryQuality';

import {
  generateDomainBeliefs
} from './memoryInsightAiService';

/*
 * 形成看法：把这个聊天里积累的具体记忆，按领域（饮食、工作、作息、感情……）
 * 综合成"角色对用户的稳定看法"，写成 type: belief 的记忆。
 *
 * 跟反思（reflectionService.js）的区别：反思是阶段性的总结，每次新写；
 * 看法是按领域长期维护的——同一个领域有新证据时，是修订原来那条，
 * 而不是不断新增。旧看法会和新记忆一起交给 AI，让它写成"现在的样子"，
 * 所以看法不会停在第一次形成的样子，可以反复更新。
 *
 * 看法不衰减，也不参与自动合并；它靠下一轮综合来自我修正。
 * 召回沿用普通记忆的排序、冷却和去重，不需要额外接线。
 *
 * 自主程度沿用记忆整理的开关：默认先放待确认列表，打开"角色直接整理"后直接写入
 * （修订旧看法走 acceptMemoryCandidate，保留修订记录）。你手动改过的看法，
 * 无论开关如何，修订都需要你确认。
 */

// 证据类型：稳定陈述和共同经历。情绪有自己的回顾，表达边界不是"看法"。
const EVIDENCE_TYPES = new Set([
  MEMORY_TYPES.FACT,
  MEMORY_TYPES.PREFERENCE,
  MEMORY_TYPES.RELATIONSHIP,
  MEMORY_TYPES.EPISODE,
  MEMORY_TYPES.COMMON_SENSE
]);

// 新增了这么多条证据记忆，才值得重新综合一次；手动整理时门槛更低，方便验证。
const NEW_EVIDENCE_THRESHOLD = 12;
const NEW_EVIDENCE_THRESHOLD_FORCED = 4;

// 一共至少有这么多条证据，才谈得上形成看法。
const MIN_EVIDENCE = 6;

const MAX_EVIDENCE_FOR_AI = 50;
const MAX_EXISTING_BELIEFS_FOR_AI = 10;

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

export const pickEvidenceMemories = (allMemories = []) => (
  allMemories
    .filter((memory) => (
      memory.status === MEMORY_STATUSES.ACTIVE &&
      EVIDENCE_TYPES.has(memory.type) &&
      !memory.supersededByMemoryId &&
      !memory.duplicateOfMemoryId
    ))
    .sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt))
);

const pickExistingBeliefs = (allMemories = []) => (
  allMemories
    .filter((memory) => (
      memory.type === MEMORY_TYPES.BELIEF &&
      memory.status === MEMORY_STATUSES.ACTIVE
    ))
    .sort((left, right) => toTime(right.updatedAt) - toTime(left.updatedAt))
    .slice(0, MAX_EXISTING_BELIEFS_FOR_AI)
);

const buildTopicKey = (domain) => (
  `belief_${String(domain || '').trim().toLowerCase().replace(/\s+/g, '_')}`
);

const semanticFieldsFor = (domain) => ({
  subject: MEMORY_SUBJECTS.USER,
  topicKey: buildTopicKey(domain),
  topicKeys: [buildTopicKey(domain)],
  stability: MEMORY_STABILITIES.ONGOING,
  memoryScope: MEMORY_SCOPES.CONVERSATION,
  recallPolicy: MEMORY_RECALL_POLICIES.NORMAL
});

export const runBeliefFormation = async ({
  chatId,
  allMemories = [],
  job = null,
  autoExecute = false,
  force = false
}) => {
  const summary = {
    proposed: 0,
    applied: 0,
    ran: false,
    evidenceCount: 0,
    reason: '',
    error: ''
  };

  const evidence = pickEvidenceMemories(allMemories);

  summary.evidenceCount = evidence.length;

  if (evidence.length < MIN_EVIDENCE) {
    summary.reason = 'not_enough_evidence';
    return summary;
  }

  const cursor = Math.min(
    Number(job?.beliefEvidenceCursor) || 0,
    evidence.length
  );

  const threshold = force
    ? NEW_EVIDENCE_THRESHOLD_FORCED
    : NEW_EVIDENCE_THRESHOLD;

  if (evidence.length - cursor < threshold) {
    summary.reason = 'not_enough_new_memories';
    return summary;
  }

  const forAi = evidence.slice(-MAX_EVIDENCE_FOR_AI);
  const existingBeliefs = pickExistingBeliefs(allMemories);

  let beliefs = [];

  try {
    beliefs = await generateDomainBeliefs({
      memories: forAi,
      existingBeliefs
    });
  } catch (error) {
    console.warn('[Belief] 形成看法失败：', error);
    summary.error = error?.message || '未知错误';
    return summary;
  }

  // AI 调用成功（哪怕这次没有值得写的看法）就算综合过一次。
  summary.ran = true;

  // 同一个领域已经有一条待确认的看法时，先不再重复提。
  const pendingCandidates = await db.memoryCandidates
    .where('chatId')
    .equals(chatId)
    .toArray();

  const pendingDomains = new Set(
    pendingCandidates
      .filter((candidate) => (
        candidate.tidyKind === 'belief' &&
        candidate.status === MEMORY_CANDIDATE_STATUSES.PENDING
      ))
      .map((candidate) => candidate.beliefDomain)
      .filter(Boolean)
  );

  for (const belief of beliefs) {
    if (pendingDomains.has(belief.domain)) {
      continue;
    }

    const target = existingBeliefs.find((item) => (
      item.memoryId === belief.updatesBeliefId ||
      (
        item.beliefDomain &&
        item.beliefDomain === belief.domain
      )
    )) || null;

    const fields = semanticFieldsFor(belief.domain);

    if (!target) {
      if (autoExecute) {
        // eslint-disable-next-line no-await-in-loop
        const created = await createMemory({
          chatId,
          title: belief.title,
          content: belief.content,
          type: MEMORY_TYPES.BELIEF,
          status: MEMORY_STATUSES.ACTIVE,
          importance: belief.importance,
          confidence: MEMORY_CONFIDENCES.INFERRED,
          sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
          sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
          note: '由角色综合某个领域的记忆后形成的看法。',
          ...fields
        });

        // eslint-disable-next-line no-await-in-loop
        await db.memories.update(created.id, {
          beliefDomain: belief.domain,
          sourceMemoryIds: belief.sourceMemoryIds
        });

        summary.applied += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const candidate = await createPendingMemoryCandidate({
        chatId,
        title: belief.title,
        content: belief.content,
        type: MEMORY_TYPES.BELIEF,
        priority: belief.importance,
        sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
        proposalType: MEMORY_CANDIDATE_PROPOSALS.CREATE,
        conflictReason: `这是综合“${belief.domain}”领域的多条记忆后形成的看法，采纳后才会成为正式记忆。`,
        extraFields: {
          beliefDomain: belief.domain,
          sourceMemoryIds: belief.sourceMemoryIds
        },
        ...fields
      });

      // eslint-disable-next-line no-await-in-loop
      await db.memoryCandidates
        .where('candidateId')
        .equals(candidate.candidateId)
        .modify({ tidyKind: 'belief' });

      summary.proposed += 1;
      continue;
    }

    // 已有同一领域的看法：修订它，不新增。
    const autoThis = autoExecute && !isManualAuthorityMemory(target);

    // eslint-disable-next-line no-await-in-loop
    const candidate = await createPendingMemoryCandidate({
      chatId,
      title: belief.title || target.title,
      content: belief.content,
      type: MEMORY_TYPES.BELIEF,
      priority: Math.max(belief.importance, Number(target.importance || 3)),
      sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
      proposalType: MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING,
      targetMemoryId: target.memoryId,
      relatedMemoryIds: [target.memoryId],
      similarityScore: 1,
      conflictReason: `有新的记忆让“${belief.domain}”领域的看法需要修订，采纳后会更新原来的看法，旧内容保留在修订记录里。`,
      extraFields: {
        beliefDomain: belief.domain,
        sourceMemoryIds: belief.sourceMemoryIds
      },
      ...fields
    });

    // eslint-disable-next-line no-await-in-loop
    await db.memoryCandidates
      .where('candidateId')
      .equals(candidate.candidateId)
      .modify({
        tidyKind: 'belief',
        tidyAuto: autoThis
      });

    if (!autoThis) {
      summary.proposed += 1;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await acceptMemoryCandidate(candidate.candidateId, {
        note: '由角色综合新的记忆后修订了这个领域的看法。'
      });

      summary.applied += 1;
    } catch (error) {
      console.warn('[Belief] 自动修订失败，已保留为待确认候选：', error);
      summary.proposed += 1;
    }
  }

  return summary;
};