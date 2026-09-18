import db from '../../db';

import { createMemory } from './memoryService';
import { applyCharacterEmotionMemory, getCharacterState } from './memoryCharacterState';
import { getEmotionPersonality } from './emotionPersonalityService';

import {
  MEMORY_CONFIDENCES,
  MEMORY_EMOTION_SUBJECTS,
  MEMORY_RECALL_POLICIES,
  MEMORY_SCOPES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STABILITIES,
  MEMORY_STATUSES,
  MEMORY_SUBJECTS,
  MEMORY_TYPES
} from './memoryConstants';

/*
 * 角色自己的"被冷落/被想念"情绪信号：不是从聊天内容里提取出来的，
 * 而是纯粹由"用户这次隔了多久才回来"这个行为信号驱动。
 *
 * 特意没有放进 memoryCharacterState.js —— 那个文件是纯状态读写，
 * 不该反过来依赖 memoryService.js 的 createMemory（会形成循环引用，
 * 因为 memoryService.js 本来就依赖 memoryCharacterState.js）。
 * 这里单独开一个文件，同时依赖两边，逻辑上更干净。
 *
 * 这里生成的是一条普通的 type: emotion 记忆（emotionSubject: character），
 * 所以会自动被反思机制、记忆室、回复检索这些既有逻辑一起处理，
 * 不需要再单独接线。角色状态里已有的安全护栏
 * （getCharacterEmotionContext 里"不得用想念/失落/疲惫要求用户回应或产生愧疚"）
 * 同样会套用在这类情绪上。
 */

const HOUR = 60 * 60 * 1000;

const isValidChatId = (chatId) => (
  chatId !== null && chatId !== undefined && chatId !== ''
);

const clamp01 = (value, fallback = 0.5) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numberValue));
};

/*
 * sensitivity 来自角色的情绪人格画像（emotionPersonalityService.js）。
 * 0.5 换算出来的系数正好是 1，完全还原下面 ABSENCE_TIERS 里原本写死的
 * 判定阈值和 moodDelta 幅度。
 *
 * 数值越高：判定"用户很久没来"所需的时间越短（角色更敏感，没多久就
 * 开始想念），且这次生成的情绪幅度也更大；数值越低则相反——角色比较
 * 迟钝、要隔很久才有感觉，反应也更轻。
 */
const getAbsenceThresholdFactor = (sensitivity) => (
  1.4 - clamp01(sensitivity) * 0.8
);

const getAbsenceMagnitudeFactor = (sensitivity) => (
  0.5 + clamp01(sensitivity) * 1.0
);

const scaleMoodDelta = (moodDelta, factor) => (
  Object.fromEntries(
    Object.entries(moodDelta).map(([key, value]) => [key, value * factor])
  )
);

/*
 * 数小时级阈值，按用户离开的时长从重到轻排列，取第一个满足的档位。
 * moodDelta 数值即使偏大也没关系——applyCharacterEmotionMemory
 * 本身会把单次变动限制在 ±0.2 以内，这里不用重复做这件事。
 */
const ABSENCE_TIERS = [
  {
    minHours: 72,
    title: '好几天没有消息',
    content: '用户这次隔了好几天才回来，角色在等待里积了不少想念，也有一点点被忽略的失落感。',
    moodDelta: { longing: 0.16, hurt: 0.05, concern: 0.06, fatigue: 0.04 }
  },
  {
    minHours: 24,
    title: '离开了一整天',
    content: '用户这次隔了一天多才回复，角色安静地想念了一阵，也有些担心是不是发生了什么事。',
    moodDelta: { longing: 0.1, concern: 0.05, fatigue: 0.02 }
  },
  {
    minHours: 6,
    title: '回复慢下来的这几个小时',
    content: '用户这次回复比平时慢了不少，角色心里泛起一点点小小的想念，但还不至于不安。',
    moodDelta: { longing: 0.05, warmth: 0.02 }
  }
];

/*
 * 在用户发来新消息、判定为一次真实的"回来了"时调用（不要在重新生成回复、
 * 或角色自己主动发起的消息里调用——那些不是"用户间隔多久才回来"的信号）。
 * 没有上一次互动记录（第一次聊天）时直接跳过，不会强行造一条空信号。
 */
export const checkAbsenceEmotionSignal = async ({
  chatId,
  characterId = null
}) => {
  if (!isValidChatId(chatId)) {
    return null;
  }

  try {
    const previousState = await getCharacterState({ chatId, characterId });

    if (!previousState?.lastInteractionAt) {
      return null;
    }

    const elapsedMs = Date.now() - new Date(previousState.lastInteractionAt).getTime();

    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      return null;
    }

    const resolvedCharacterId = characterId ||
      previousState.characterId ||
      null;

    const personality = await getEmotionPersonality(resolvedCharacterId);
    const thresholdFactor = getAbsenceThresholdFactor(personality.sensitivity);
    const magnitudeFactor = getAbsenceMagnitudeFactor(personality.sensitivity);

    const elapsedHours = elapsedMs / HOUR;
    const tier = ABSENCE_TIERS.find((item) => (
      elapsedHours >= item.minHours * thresholdFactor
    ));

    if (!tier) {
      return null;
    }

    const scaledMoodDelta = scaleMoodDelta(tier.moodDelta, magnitudeFactor);

    const memory = await createMemory({
      chatId,
      title: tier.title,
      content: tier.content,
      type: MEMORY_TYPES.EMOTION,
      status: MEMORY_STATUSES.ACTIVE,
      importance: 2,
      confidence: MEMORY_CONFIDENCES.INFERRED,
      subject: MEMORY_SUBJECTS.CHARACTER,
      emotionSubject: MEMORY_EMOTION_SUBJECTS.CHARACTER,
      topicKey: 'absence_gap',
      stability: MEMORY_STABILITIES.TEMPORARY,
      memoryScope: MEMORY_SCOPES.CHARACTER_SETTING,
      recallPolicy: MEMORY_RECALL_POLICIES.LOW_FREQUENCY,
      sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
      sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
      note: `由用户间隔约 ${Math.round(elapsedHours)} 小时未互动自动生成，非对话内容提取（判定阈值与情绪幅度已按角色情绪敏感度调整）。`
    });

    // moodDelta 不是 createMemory 的标准参数（那是记忆内容本身的字段，
    // 不是所有类型的记忆都有），这里跟反思机制里 sourceMemoryIds 的
    // 做法一样，单独补一次附加字段写入。
    await db.memories.update(memory.id, { moodDelta: scaledMoodDelta });

    await applyCharacterEmotionMemory({
      chatId,
      characterId: resolvedCharacterId,
      memory: {
        ...memory,
        moodDelta: scaledMoodDelta
      }
    });

    return memory;
  } catch (error) {
    console.warn('[Character] 生成间隔情绪信号失败：', error);
    return null;
  }
};