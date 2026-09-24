import db from '../../db';

import {
  acceptMemoryCandidate,
  createPendingMemoryCandidate,
  ensureMemoryJob,
  getChatMemory
} from './memoryService';

import {
  MEMORY_CANDIDATE_PROPOSALS,
  MEMORY_SOURCE_KINDS
} from './memoryConstants';

import {
  isManualAuthorityMemory
} from './memoryQuality';

import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  findMemoryPairs
} from './memoryConflictScan';

import {
  judgeMemoryPairs
} from './memoryInsightAiService';

import {
  getMemoryTidyAutoExecute
} from '../../services/memoryTidySettingsService';

/*
 * 冲突修正与精简合并的执行层。判断"哪几对该看"在 memoryConflictScan.js，
 * 判断"到底是不是冲突"交给 AI，这里负责把结果变成待确认候选，或者在
 * "角色直接整理"开关打开时直接执行。
 *
 * 自主程度沿用记忆整理的开关（memoryTidySettingsService.js）：
 *   - 关（默认）：只生成待确认候选，你确认后才生效；
 *   - 开：角色直接执行，被更正或被合并掉的旧记忆不删除，可以找回，并保留修订记录。
 * 只要涉及你手动写过、改过或确认过的记忆，无论开关如何，都只走待确认。
 *
 * 两种时机：
 *   - mode 'new'：每轮提炼之后，只看这一轮之后才新出现的记忆，只查冲突；
 *   - mode 'full'：记忆整理时全量扫一遍，冲突之外还会把"补充同一件事的细枝末节"
 *     精简合并成一条（文字太像的重复交给原有的合并重复记忆，不在这里处理）。
 * 所有失败都只在控制台警告，不向上抛错。
 */

const MAX_CHECKED_SIGNATURES = 200;

const nowIso = () => new Date().toISOString();

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

const unionLists = (lists) => [
  ...new Set(lists.flat().filter((item) => item !== undefined && item !== null))
];

const getPriority = (memory) => Number(memory.importance || 3);

// 合并时保留哪一条：手动维护的优先，其次重要度高的，最后取更新的。
const pickKeeper = (left, right) => {
  const manualDiff = Number(isManualAuthorityMemory(right))
    - Number(isManualAuthorityMemory(left));

  if (manualDiff !== 0) return manualDiff > 0 ? right : left;

  if (getPriority(left) !== getPriority(right)) {
    return getPriority(left) > getPriority(right) ? left : right;
  }

  return toTime(left.updatedAt || left.createdAt)
    >= toTime(right.updatedAt || right.createdAt)
    ? left
    : right;
};

const createTidyCandidate = async ({
  chatId,
  keeper,
  others,
  title,
  content,
  importance,
  tidyKind,
  signature,
  similarityScore,
  conflictReason,
  shouldAutoExecute
}) => {
  const group = [keeper, ...others];

  const candidate = await createPendingMemoryCandidate({
    chatId,
    title: title || keeper.title,
    content,
    type: keeper.type,
    priority: Math.max(importance, ...group.map(getPriority)),
    sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
    sourceMessageIds: unionLists(group.map((memory) => memory.sourceMessageIds || [])),

    proposalType: MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING,
    targetMemoryId: keeper.memoryId,
    relatedMemoryIds: group.map((memory) => memory.memoryId),
    similarityScore,
    conflictReason,

    subject: keeper.subject,
    emotionSubject: keeper.emotionSubject,
    topicKey: keeper.topicKey,
    topicKeys: keeper.topicKeys,
    stability: keeper.stability,
    memoryScope: keeper.memoryScope,
    recallPolicy: keeper.recallPolicy,
    temporal: keeper.temporal
  });

  await db.memoryCandidates
    .where('candidateId')
    .equals(candidate.candidateId)
    .modify({
      tidyKind,
      tidySignature: signature,
      mergeMemoryIds: others.map((memory) => memory.memoryId),
      tidyAuto: shouldAutoExecute
    });

  if (!shouldAutoExecute) {
    return 'proposed';
  }

  try {
    await acceptMemoryCandidate(candidate.candidateId, {
      note: tidyKind === 'resolve_conflict'
        ? '由角色自动整理：解决新旧认知冲突。'
        : '由角色自动整理：精简合并。'
    });

    return 'applied';
  } catch (error) {
    // 自动执行失败时，候选仍留在待确认列表里，不丢内容。
    console.warn('[ConflictTidy] 自动执行失败，已保留为待确认候选：', error);

    return 'proposed';
  }
};

export const runConflictCheck = async (
  chatId,
  {
    mode = 'new',
    allMemories = null,
    job = null,
    autoExecute = null
  } = {}
) => {
  const summary = {
    conflictProposed: 0,
    conflictApplied: 0,
    mergeProposed: 0,
    mergeApplied: 0,
    checked: 0,
    error: ''
  };

  try {
    const currentJob = job || await ensureMemoryJob(chatId);
    const memories = allMemories || await getChatMemory(chatId);

    const existingCandidates = await db.memoryCandidates
      .where('chatId')
      .equals(chatId)
      .toArray();

    const handledSignatures = new Set([
      ...(Array.isArray(currentJob?.conflictCheckedSignatures)
        ? currentJob.conflictCheckedSignatures
        : []),
      ...existingCandidates
        .map((candidate) => candidate.tidySignature)
        .filter(Boolean)
    ]);

    const pairs = findMemoryPairs({
      allMemories: memories,
      sinceTime: mode === 'new' ? toTime(currentJob?.lastConflictCheckAt) : 0,
      handledSignatures
    });

    const checkedSignatures = [];

    const finish = async () => {
      const previous = Array.isArray(currentJob?.conflictCheckedSignatures)
        ? currentJob.conflictCheckedSignatures
        : [];

      // AI 不可用时，不记录"查过"，下次还会再试。
      const updates = summary.error
        ? {}
        : {
          lastConflictCheckAt: nowIso(),
          conflictCheckedSignatures: [
            ...previous,
            ...checkedSignatures
          ].slice(-MAX_CHECKED_SIGNATURES)
        };

      if (currentJob?.id !== undefined && Object.keys(updates).length) {
        await db.memoryJobs.update(currentJob.id, updates);
      }

      return summary;
    };

    if (!pairs.length) {
      return await finish();
    }

    const shouldAuto = autoExecute === null
      ? await getMemoryTidyAutoExecute()
      : autoExecute;

    let judgments = [];

    try {
      judgments = await judgeMemoryPairs({
        pairs: pairs.map((pair) => ({ older: pair.older, newer: pair.newer }))
      });
    } catch (error) {
      console.warn('[ConflictTidy] 判断新旧记忆关系失败：', error);
      summary.error = error?.message || '未知错误';
      return await finish();
    }

    summary.checked = pairs.length;

    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      const judgment = judgments[index];

      const hasManual = (
        isManualAuthorityMemory(pair.older) ||
        isManualAuthorityMemory(pair.newer)
      );

      const autoThis = shouldAuto && !hasManual;

      if (judgment.relation === 'conflict') {
        const keeper = judgment.winner === 'older' ? pair.older : pair.newer;
        const loser = keeper === pair.older ? pair.newer : pair.older;

        // eslint-disable-next-line no-await-in-loop
        const outcome = await createTidyCandidate({
          chatId,
          keeper,
          others: [loser],
          title: judgment.title,
          content: judgment.content,
          importance: judgment.importance,
          tidyKind: 'resolve_conflict',
          signature: pair.signature,
          similarityScore: pair.similarity,
          conflictReason: `整理时发现这两条记忆互相矛盾：${judgment.reason || '较新的说法可能已经取代了较旧的'}。${hasManual && shouldAuto ? '其中包含你手动维护过的记忆，所以需要你确认。' : ''}采纳后会保留更可信的一条，另一条标记为已更正，可以找回。`,
          shouldAutoExecute: autoThis
        });

        if (outcome === 'applied') summary.conflictApplied += 1;
        else summary.conflictProposed += 1;

        continue;
      }

      if (
        judgment.relation === 'complementary' &&
        mode === 'full' &&
        pair.similarity < DUPLICATE_SIMILARITY_THRESHOLD
      ) {
        const keeper = pickKeeper(pair.older, pair.newer);
        const other = keeper === pair.older ? pair.newer : pair.older;

        // eslint-disable-next-line no-await-in-loop
        const outcome = await createTidyCandidate({
          chatId,
          keeper,
          others: [other],
          title: judgment.title,
          content: judgment.content,
          importance: judgment.importance,
          tidyKind: 'merge_duplicates',
          signature: pair.signature,
          similarityScore: pair.similarity,
          conflictReason: `整理时发现这两条记忆说的是同一件事的不同细节，可以精简成一条。${hasManual && shouldAuto ? '其中包含你手动维护过的记忆，所以需要你确认。' : ''}另一条会被归档，可以找回。`,
          shouldAutoExecute: autoThis
        });

        if (outcome === 'applied') summary.mergeApplied += 1;
        else summary.mergeProposed += 1;

        continue;
      }

      // 提炼时只查冲突：可以精简的先不记下来，留给整理时全量扫描处理。
      if (judgment.relation === 'complementary' && mode === 'new') {
        continue;
      }

      // 不冲突、不需要精简，或者留给"合并重复记忆"处理的：记下来，下次不再问。
      checkedSignatures.push(pair.signature);
    }

    return await finish();
  } catch (error) {
    console.warn('[ConflictTidy] 冲突检查失败：', error);
    summary.error = error?.message || '未知错误';

    return summary;
  }
};