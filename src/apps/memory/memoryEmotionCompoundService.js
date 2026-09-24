import db from '../../db';

import {
  createMemory,
  getChatMemory,
  setMemoryStatus
} from './memoryService';

import {
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
  buildLingeringEmotionContext,
  findCompoundProposals,
  getCompoundIntensity,
  isCompoundActive,
  isCompoundEmotion
} from './memoryEmotionCompound';

import {
  judgeCompoundResolution,
  nameUnmatchedEmotions
} from './memoryCompoundAiService';

import {
  applyCharacterEmotionMemory
} from './memoryCharacterState';

import {
  getEmotionPersonality
} from './emotionPersonalityService';

/*
 * 复合情绪的执行层：把 memoryEmotionCompound.js 里算出来的"该合成 / 该叠加"
 * 真正写进 memories 表，并负责"被化解"的判断与落库。
 *
 * 复合情绪是角色内部的情绪整理，不需要用户确认；但每一步都可逆：
 *   - 被合成的零散情绪只是打上 compoundedIntoId，不删除、不改内容；
 *   - 化解后的复合情绪是"暂存"状态（dormant），可以在记忆页恢复。
 *
 * 所有失败都只在控制台警告，不向上抛错，不影响正常记忆提炼。
 */

const SUBJECTS = ['user', 'character', 'shared'];

const MAX_UNMATCHED_FOR_AI = 8;
const MIN_UNMATCHED_FOR_AI = 3;
const MAX_RESOLUTION_TARGETS = 4;

// 化解判断只看最近这么多条消息，够覆盖一轮提炼的内容。
const MAX_RESOLUTION_MESSAGES = 30;

// 累计缓解到这个比例，就当作已经化解。
const RESOLVED_RELIEF_THRESHOLD = 0.85;

// 化解时，对角色心情的抚平强度（相对于当初合成时推动的幅度）。
const RELIEF_MOOD_RATIO = 0.7;

const nowIso = () => new Date().toISOString();

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

const round2 = (value) => Math.round(value * 100) / 100;

const getSubjectLabel = (subject) => ({
  user: '用户',
  character: '角色',
  shared: '两人之间'
}[subject] || '');

const mapSubject = (subject) => {
  if (subject === 'character') return MEMORY_SUBJECTS.CHARACTER;
  if (subject === 'shared') return MEMORY_SUBJECTS.RELATIONSHIP;

  return MEMORY_SUBJECTS.USER;
};

const getEmotionSubject = (memory) => (
  memory?.emotionSubject || (
    memory?.subject === 'character' ? 'character'
      : memory?.subject === 'user' ? 'user'
        : 'shared'
  )
);

const isLiveStatus = (memory) => (
  memory.status === MEMORY_STATUSES.ACTIVE ||
  memory.status === MEMORY_STATUSES.TEMPORARY
);

// 可以被合成的零散情绪：生效中、还没并进别的复合情绪、自己也不是复合情绪。
const isComposableEmotion = (memory) => (
  memory.type === MEMORY_TYPES.EMOTION &&
  isLiveStatus(memory) &&
  !isCompoundEmotion(memory) &&
  !memory.compoundedIntoId
);

const getPersonalityFor = async (chatId) => {
  const chat = await db.chats.get(chatId);
  const characterId = chat?.characterId || null;
  const personality = await getEmotionPersonality(characterId);

  return { characterId, personality };
};

const markComponents = async (memoryIds, compoundId) => {
  for (const memoryId of memoryIds) {
    // eslint-disable-next-line no-await-in-loop
    await db.memories
      .where('memoryId')
      .equals(memoryId)
      .modify({ compoundedIntoId: compoundId });
  }
};

const applyMoodFromCompound = async ({
  chatId,
  characterId,
  compound,
  moodDelta
}) => {
  if (
    !moodDelta ||
    !['character', 'shared'].includes(getEmotionSubject(compound))
  ) {
    return;
  }

  try {
    await applyCharacterEmotionMemory({
      chatId,
      characterId,
      memory: {
        ...compound,
        type: MEMORY_TYPES.EMOTION,
        moodDelta
      }
    });
  } catch (error) {
    console.warn('[EmotionCompound] 更新角色心情失败，已跳过：', error);
  }
};

const unionMessageIds = (members) => [
  ...new Set(
    members
      .flatMap((memory) => memory.sourceMessageIds || [])
      .filter((id) => id !== undefined && id !== null)
  )
];

const createCompound = async ({
  chatId,
  characterId,
  subject,
  name,
  content,
  valence,
  intensity,
  kind,
  families,
  members,
  moodDelta
}) => {
  const createdAt = nowIso();

  const created = await createMemory({
    chatId,
    title: name,
    content,
    type: MEMORY_TYPES.EMOTION,
    status: MEMORY_STATUSES.ACTIVE,
    importance: intensity >= 0.7 ? 4 : 3,
    confidence: MEMORY_CONFIDENCES.INFERRED,

    subject: mapSubject(subject),
    emotionSubject: subject,
    topicKey: `emotion_compound_${subject}_${kind}`,
    topicKeys: [`emotion_compound_${subject}_${kind}`],
    stability: MEMORY_STABILITIES.TEMPORARY,
    memoryScope: MEMORY_SCOPES.CONVERSATION,
    recallPolicy: MEMORY_RECALL_POLICIES.NORMAL,

    sourceMessageIds: unionMessageIds(members),
    sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
    sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
    note: '由几条相关的情绪累积合成。'
  });

  const extraFields = {
    emotionCompound: true,
    compoundKind: kind,
    compoundFamilies: families,
    compoundComponentIds: members.map((memory) => memory.memoryId),
    compoundComponentCount: members.length,
    compoundedAt: createdAt,
    lastReinforcedAt: createdAt,
    emotionTag: name,
    emotionIntensity: round2(intensity),
    emotionValence: valence,
    moodDelta: subject === 'user' ? null : (moodDelta || null),
    resolvedAt: null,
    reliefFactor: 0
  };

  await db.memories.update(created.id, extraFields);

  const compound = { ...created, ...extraFields };

  await markComponents(
    members.map((memory) => memory.memoryId),
    created.memoryId
  );

  await applyMoodFromCompound({
    chatId,
    characterId,
    compound,
    moodDelta: extraFields.moodDelta
  });

  return compound;
};

const absorbIntoCompound = async ({
  chatId,
  characterId,
  compound,
  proposal
}) => {
  const timestamp = nowIso();

  const updates = {
    emotionIntensity: round2(proposal.intensity),
    compoundComponentIds: [
      ...(compound.compoundComponentIds || []),
      ...proposal.componentIds
    ],
    compoundComponentCount: proposal.componentCount,
    lastReinforcedAt: timestamp,
    updatedAt: timestamp
  };

  if (proposal.name) {
    const previousName = compound.emotionTag || compound.title;

    updates.title = proposal.name;
    updates.emotionTag = proposal.name;
    updates.content = `${getSubjectLabel(getEmotionSubject(compound))}的“${previousName}”还在累积，已经发展成“${proposal.name}”。`;
    updates.normalizedContent = updates.content;
  }

  await db.memories.update(compound.id, updates);
  await markComponents(proposal.componentIds, compound.memoryId);

  if (proposal.name) {
    await applyMoodFromCompound({
      chatId,
      characterId,
      compound: { ...compound, ...updates },
      moodDelta: proposal.moodDelta
    });
  }

  return { ...compound, ...updates };
};

/* ------------------------------------------------------------------ */
/* 合成                                                                */
/* ------------------------------------------------------------------ */

/*
 * 对一个聊天检查一遍：有没有零散的情绪该合成、该叠加。
 * useAiFallback 为 true 时（记忆整理里），本地合成表认不出的情绪会让 AI 试着命名。
 * 每轮记忆提炼后调用的是纯本地版本（不带 AI），成本很低。
 */
export const runCompoundCompose = async (
  chatId,
  { useAiFallback = false, allMemories = null, now = Date.now() } = {}
) => {
  const summary = { created: 0, absorbed: 0, aiNamed: 0, error: '' };

  try {
    const memories = allMemories || await getChatMemory(chatId);
    const { characterId, personality } = await getPersonalityFor(chatId);

    const emotions = memories.filter(isComposableEmotion);
    const compounds = memories.filter(isCompoundActive);

    for (const subject of SUBJECTS) {
      // 用户自己的情绪不按角色的性格来算。
      const sensitivity = subject === 'user' ? 0.5 : personality.sensitivity;

      const { proposals, unclassified } = findCompoundProposals({
        emotions,
        compounds,
        sensitivity,
        subject,
        now
      });

      for (const proposal of proposals) {
        if (proposal.action === 'absorb') {
          const target = compounds.find(
            (compound) => compound.memoryId === proposal.compoundId
          );

          if (!target) continue;

          // eslint-disable-next-line no-await-in-loop
          await absorbIntoCompound({
            chatId,
            characterId,
            compound: target,
            proposal
          });

          summary.absorbed += 1;
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        await createCompound({
          chatId,
          characterId,
          subject,
          name: proposal.name,
          content: proposal.content,
          valence: proposal.valence,
          intensity: proposal.intensity,
          kind: proposal.kind,
          families: proposal.families,
          members: proposal.members,
          moodDelta: proposal.moodDelta
        });

        summary.created += 1;
      }

      if (!useAiFallback) continue;

      const untried = unclassified
        .filter((memory) => !memory.compoundNamingTriedAt)
        .sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt))
        .slice(-MAX_UNMATCHED_FOR_AI);

      if (untried.length < MIN_UNMATCHED_FOR_AI) continue;

      let named = [];

      try {
        // eslint-disable-next-line no-await-in-loop
        named = await nameUnmatchedEmotions({ emotions: untried, subject });
      } catch (error) {
        console.warn('[EmotionCompound] AI 命名失败：', error);
        summary.error = error?.message || '未知错误';
        continue;
      }

      // 不管这次有没有命名成功，这几条都不再重复问 AI。
      for (const memory of untried) {
        // eslint-disable-next-line no-await-in-loop
        await db.memories
          .where('memoryId')
          .equals(memory.memoryId)
          .modify({ compoundNamingTriedAt: nowIso() });
      }

      for (const item of named) {
        const members = untried.filter(
          (memory) => item.sourceMemoryIds.includes(memory.memoryId)
        );

        if (members.length < 2) continue;

        // eslint-disable-next-line no-await-in-loop
        await createCompound({
          chatId,
          characterId,
          subject,
          name: item.name,
          content: item.content,
          valence: item.valence,
          intensity: item.intensity,
          kind: 'ai',
          families: [],
          members,
          moodDelta: item.moodDelta
        });

        summary.aiNamed += 1;
        summary.created += 1;
      }
    }
  } catch (error) {
    console.warn('[EmotionCompound] 合成情绪失败：', error);
    summary.error = error?.message || '未知错误';
  }

  return summary;
};

/* ------------------------------------------------------------------ */
/* 化解                                                                */
/* ------------------------------------------------------------------ */

const buildReliefDelta = (moodDelta, ratio) => {
  if (!moodDelta || typeof moodDelta !== 'object') return null;

  const result = {};

  for (const [key, value] of Object.entries(moodDelta)) {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue !== 0) {
      result[key] = -numberValue * ratio;
    }
  }

  return Object.keys(result).length ? result : null;
};

export const resolveCompound = async (
  compound,
  { by = 'other', reason = '', relief = 1, characterId = null } = {}
) => {
  const timestamp = nowIso();

  await db.memories.update(compound.id, {
    resolvedAt: timestamp,
    resolvedBy: by,
    resolvedNote: reason,
    reliefFactor: 1
  });

  await setMemoryStatus(compound.memoryId, MEMORY_STATUSES.DORMANT, {
    note: `这份情绪已经化解${reason ? `：${reason}` : ''}；暂存起来，可以在记忆页恢复。`
  });

  await applyMoodFromCompound({
    chatId: compound.chatId,
    characterId,
    compound,
    moodDelta: buildReliefDelta(compound.moodDelta, RELIEF_MOOD_RATIO * relief)
  });
};

const easeCompound = async (compound, { relief, characterId }) => {
  const nextRelief = Math.min(1, Number(compound.reliefFactor || 0) + relief);

  await db.memories.update(compound.id, {
    reliefFactor: round2(nextRelief),
    updatedAt: nowIso()
  });

  await applyMoodFromCompound({
    chatId: compound.chatId,
    characterId,
    compound,
    moodDelta: buildReliefDelta(compound.moodDelta, RELIEF_MOOD_RATIO * relief)
  });

  return nextRelief;
};

/*
 * 用这一批新消息判断：还没化解的难受情绪，有没有被安慰、被解释，
 * 或者角色自己想通了。没有这类情绪时不调用 AI。
 * 正面的复合情绪（幸福之类）不需要"化解"，只会随时间淡去。
 */
export const runCompoundResolution = async (chatId, { messages = [] } = {}) => {
  const summary = { resolved: 0, eased: 0, checked: 0, error: '' };

  try {
    const recentMessages = messages
      .filter((message) => message?.content)
      .slice(-MAX_RESOLUTION_MESSAGES);

    if (!recentMessages.length) return summary;

    const memories = await getChatMemory(chatId);

    const targets = memories
      .filter((memory) => (
        isCompoundActive(memory) &&
        memory.emotionValence !== 'positive'
      ))
      .sort((left, right) => (
        getCompoundIntensity(right) - getCompoundIntensity(left)
      ))
      .slice(0, MAX_RESOLUTION_TARGETS);

    if (!targets.length) return summary;

    const { characterId } = await getPersonalityFor(chatId);

    let results = [];

    try {
      results = await judgeCompoundResolution({
        compounds: targets,
        messages: recentMessages
      });
    } catch (error) {
      console.warn('[EmotionCompound] 判断情绪是否化解失败：', error);
      summary.error = error?.message || '未知错误';
      return summary;
    }

    summary.checked = targets.length;

    for (const result of results) {
      if (result.outcome === 'unchanged') continue;

      if (result.outcome === 'resolved') {
        // eslint-disable-next-line no-await-in-loop
        await resolveCompound(result.compound, {
          by: result.by,
          reason: result.reason,
          characterId
        });

        summary.resolved += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const nextRelief = await easeCompound(result.compound, {
        relief: result.relief,
        characterId
      });

      if (nextRelief >= RESOLVED_RELIEF_THRESHOLD) {
        // eslint-disable-next-line no-await-in-loop
        await resolveCompound(
          { ...result.compound, reliefFactor: nextRelief },
          { by: result.by, reason: result.reason, relief: 0.3, characterId }
        );

        summary.resolved += 1;
      } else {
        summary.eased += 1;
      }
    }
  } catch (error) {
    console.warn('[EmotionCompound] 化解情绪失败：', error);
    summary.error = error?.message || '未知错误';
  }

  return summary;
};

// 记忆页上的手动"已化解"：AI 没判断出来、或者用户想直接放下这份情绪时用。
export const resolveCompoundManually = async (memoryId) => {
  const memories = await db.memories
    .where('memoryId')
    .equals(memoryId)
    .toArray();

  const compound = memories[0];

  if (!compound || !isCompoundEmotion(compound)) {
    throw new Error('这不是一条复合情绪。');
  }

  const { characterId } = await getPersonalityFor(compound.chatId);

  await resolveCompound(compound, {
    by: 'manual',
    reason: '由你手动标记为已化解',
    characterId
  });
};

/* ------------------------------------------------------------------ */
/* 进入提示词                                                          */
/* ------------------------------------------------------------------ */

export const getLingeringEmotionContext = async (
  chatId,
  { memories = null } = {}
) => {
  const source = memories || await getChatMemory(chatId);

  if (!source.some(isCompoundActive)) return '';

  const { personality } = await getPersonalityFor(chatId);

  return buildLingeringEmotionContext(
    source,
    Date.now(),
    { decaySpeed: personality.decaySpeed }
  );
};