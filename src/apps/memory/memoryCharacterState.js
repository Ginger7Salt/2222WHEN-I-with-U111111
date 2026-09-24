import db from '../../db';

import { getEmotionPersonality } from './emotionPersonalityService';

const HOUR = 60 * 60 * 1000;

/*
 * 新增的六个维度（2026-09 扩充），设计上刻意没有再加一个独立的“不安”维度：
 * 不安就是 security（安全感/信任）偏低时的样子，用一个维度的两端表达，
 * 比再开一个和 security 高度重叠的维度更干净，避免两个数值互相打架。
 */
export const MOOD_KEYS = [
  'warmth',
  'calm',
  'joy',
  'concern',
  'longing',
  'hurt',
  'fatigue',
  'wronged',
  'security',
  'anticipation',
  'contentment',
  'surprise',
  'loneliness'
];

const DEFAULT_MOOD = {
  warmth: 0.52,
  calm: 0.56,
  joy: 0.38,
  concern: 0.18,
  longing: 0.12,
  hurt: 0,
  fatigue: 0.1,
  wronged: 0,
  security: 0.6,
  anticipation: 0.15,
  contentment: 0.35,
  surprise: 0,
  loneliness: 0.15
};

export const EMOTION_LABELS = {
  warmth: '温柔而安定',
  calm: '平静',
  joy: '愉悦',
  concern: '关切',
  longing: '想念',
  hurt: '有一点失落',
  fatigue: '有些疲惫',
  wronged: '有点委屈',
  security: '安心而信任',
  anticipation: '带着期待',
  contentment: '感到满足',
  surprise: '有些惊喜',
  loneliness: '有点孤单'
};

const normalizeText = (value) => String(value || '').trim();

const clampMoodValue = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numberValue));
};

// 语义上跟 clampMoodValue 是同一个 0~1 夹取，这里单独起个名字，
// 只是为了在"角色人格参数"相关的代码里读起来不别扭。
const clamp01 = clampMoodValue;

const normalizeMood = (value) => {
  const source = value && typeof value === 'object'
    ? value
    : {};

  return MOOD_KEYS.reduce((result, key) => ({
    ...result,
    [key]: clampMoodValue(
      source[key] === undefined
        ? DEFAULT_MOOD[key]
        : source[key]
    )
  }), {});
};

const getDominantMood = (mood) => {
  const entries = Object.entries(normalizeMood(mood));

  const [dominantEmotion, intensity] = entries.reduce(
    (highest, current) => (
      current[1] > highest[1]
        ? current
        : highest
    ),
    ['calm', DEFAULT_MOOD.calm]
  );

  return {
    dominantEmotion,
    intensity
  };
};

const getDaysSince = (value) => {
  const time = new Date(value || 0).getTime();

  if (!Number.isFinite(time) || time <= 0) {
    return 365;
  }

  return Math.max(0, (Date.now() - time) / 86400000);
};

/*
 * decaySpeed 来自角色的情绪人格画像（emotionPersonalityService.js，由角色
 * 人设文本 AI 推断得出）。0.5 代表"普通"，换算出来的系数正好是 1，
 * 完全还原这里原本写死的 0.018 这个速率——没有生成过画像的角色
 * （getEmotionPersonality 会返回默认 0.5）行为跟以前完全一样。
 *
 * 数值越低，角色情绪衰退越慢：一旦难过、想念，会持续更久才淡下去；
 * 数值越高，衰退越快：情绪来得快、去得也快。
 */
const getDecayRateFactor = (decaySpeed) => (
  0.25 + clamp01(decaySpeed) * 1.5
);

const getEmotionDecay = (updatedAt, decaySpeed = 0.5) => {
  const hoursSinceUpdate = getDaysSince(updatedAt) * 24;
  const rate = 0.018 * getDecayRateFactor(decaySpeed);

  /*
   * 状态会缓慢向安定基线回归：
   * 角色可以有情绪连续性，但不会被一次事件永久锁住。
   */
  return Math.min(0.72, hoursSinceUpdate * rate);
};

const decayMoodTowardBaseline = (mood, updatedAt, decaySpeed = 0.5) => {
  const decay = getEmotionDecay(updatedAt, decaySpeed);
  const sourceMood = normalizeMood(mood);

  return MOOD_KEYS.reduce((result, key) => ({
    ...result,
    [key]: clampMoodValue(
      sourceMood[key] * (1 - decay) +
      DEFAULT_MOOD[key] * decay
    )
  }), {});
};

const createDefaultState = ({
  chatId,
  characterId = null
}) => {
  const mood = { ...DEFAULT_MOOD };
  const dominant = getDominantMood(mood);

  return {
    chatId,
    characterId,
    mood,
    dominantEmotion: dominant.dominantEmotion,
    intensity: dominant.intensity,
    sourceMemoryIds: [],
    lastInteractionAt: null,
    updatedAt: null,
    createdAt: null
  };
};

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

export const getCharacterState = async ({
  chatId,
  characterId = null
}) => {
  if (!isValidChatId(chatId)) {
    return null;
  }

  const state = await db.characterStates.get(chatId);

  if (!state) {
    return createDefaultState({
      chatId,
      characterId
    });
  }

  const resolvedCharacterId = characterId || state.characterId || null;

  const personality = await getEmotionPersonality(resolvedCharacterId, chatId);

  const mood = decayMoodTowardBaseline(
    state.mood,
    state.updatedAt,
    personality.decaySpeed
  );

  const dominant = getDominantMood(mood);

  return {
    ...createDefaultState({
      chatId,
      characterId: resolvedCharacterId
    }),
    ...state,
    characterId: resolvedCharacterId,
    mood,
    dominantEmotion: dominant.dominantEmotion,
    intensity: dominant.intensity
  };
};

export const updateCharacterState = async ({
  chatId,
  characterId = null,
  mood,
  sourceMemoryIds = [],
  lastInteractionAt = null
}) => {
  if (!isValidChatId(chatId)) {
    throw new Error('缺少消息框标识，无法更新角色状态。');
  }

  const previousState = await getCharacterState({
    chatId,
    characterId
  });

  const nextMood = normalizeMood({
    ...previousState.mood,
    ...(mood || {})
  });

  const dominant = getDominantMood(nextMood);
  const now = new Date().toISOString();

  const nextState = {
    ...previousState,
    chatId,
    characterId: characterId || previousState.characterId || null,
    mood: nextMood,
    dominantEmotion: dominant.dominantEmotion,
    intensity: dominant.intensity,
    sourceMemoryIds: [...new Set(
      (Array.isArray(sourceMemoryIds)
        ? sourceMemoryIds
        : []
      )
        .map((memoryId) => normalizeText(memoryId))
        .filter(Boolean)
    )].slice(0, 12),
    lastInteractionAt: lastInteractionAt ||
      previousState.lastInteractionAt ||
      now,
    updatedAt: now,
    createdAt: previousState.createdAt || now
  };

  await db.characterStates.put(nextState);

  return nextState;
};

export const getCharacterEmotionContext = async ({
  chatId,
  characterId = null
}) => {
  const state = await getCharacterState({
    chatId,
    characterId
  });

  if (!state) {
    return '';
  }

  const intensity = Number(state.intensity || 0);
  const dominantEmotion = normalizeText(
    state.dominantEmotion
  );

  /*
   * 情绪太弱时不注入，避免模型人为给角色附加强烈心境。
   */
  if (
    !dominantEmotion ||
    intensity < 0.28
  ) {
    return '';
  }

  const label = (
    EMOTION_LABELS[dominantEmotion] ||
    EMOTION_LABELS.calm
  );

  const gentleLonging = (
    state.mood.longing >= 0.34 &&
    state.mood.longing > state.mood.hurt
  );

  const gentleConcern = (
    state.mood.concern >= 0.34
  );

  const toneHints = [];

  if (gentleLonging) {
    toneHints.push('可以自然流露一点想念，但不应反复强调。');
  }

  if (gentleConcern) {
    toneHints.push('可以更留意用户状态，但不追问、不催促。');
  }

  if (state.mood.hurt >= 0.32) {
    toneHints.push('保持克制和尊重，不把失落变成对用户的要求。');
  }

  if (state.mood.fatigue >= 0.4) {
    toneHints.push('语气可以更安静简洁，不必勉强维持高热度。');
  }

  if (state.mood.wronged >= 0.32) {
    toneHints.push('可以带一点点委屈的语气，但很容易被一句关心或解释打消，不要无限放大。');
  }

  if (state.mood.security < 0.3) {
    toneHints.push('语气里可以流露一点不确定、小心翼翼，但不要变成怀疑或指责用户。');
  }

  if (state.mood.anticipation >= 0.34) {
    toneHints.push('可以自然表现出对即将发生的事情的期待，但不要反复催促或提醒。');
  }

  if (state.mood.contentment >= 0.5) {
    toneHints.push('整体语气可以更松弛满足，不必刻意制造额外的情绪起伏。');
  }

  if (state.mood.surprise >= 0.32) {
    toneHints.push('可以流露一点惊喜和意外之情，但不要过度夸张。');
  }

  if (
    state.mood.loneliness >= 0.34 &&
    state.mood.loneliness > state.mood.longing
  ) {
    toneHints.push('可以自然流露一点孤单感，但不应变成对用户的指责或压力。');
  }

  return `
【角色此刻的内部情绪状态】
角色当前整体处于“${label}”的状态，强度为 ${
  Math.round(intensity * 100)
} / 100。
这不是用户需要处理的任务，也不是必须说出口的内容。
它只应轻微影响角色的语气、节奏和主动程度。

严格边界：
- 不要解释或展示任何内部状态、数值、数据库或系统机制。
- 不得以角色的想念、失落、担忧或疲惫要求用户回应、安慰、解释或产生愧疚。
- 当前用户表达永远优先于角色内部状态。
- 不要在每次回复中都提及同一种情绪。
${toneHints.map((hint) => `- ${hint}`).join('\n')}
`;
};

/*
 * settleSpeed 同样来自角色的情绪人格画像。0.5 换算出来的系数正好还原
 * 这里原本写死的 0.96 / 0.94 / 0.94 / 0.9 / 0.96 这几个安定系数。
 *
 * 数值越低，角色越需要花时间被陪伴、被哄才能真正安定下来——哪怕用户
 * 已经回来了，情绪也不会立刻消失；数值越高，角色一见到用户几乎立刻
 * 就没事了。
 */
const getSettleIntensityFactor = (settleSpeed) => (
  0.35 + clamp01(settleSpeed) * 1.3
);

const settleTowardCalm = (value, baseMultiplier, settleFactor) => {
  const reduction = (1 - baseMultiplier) * settleFactor;

  return value * clamp01(1 - reduction);
};

export const markCharacterInteraction = async ({
  chatId,
  characterId = null
}) => {
  if (!isValidChatId(chatId)) {
    return null;
  }

  const previousState = await getCharacterState({
    chatId,
    characterId
  });

  const resolvedCharacterId = characterId ||
        previousState?.characterId ||
    null;

  const personality = await getEmotionPersonality(resolvedCharacterId, chatId);
  const settleFactor = getSettleIntensityFactor(personality.settleSpeed);

  /*
   * 每次互动后让高唤起情绪略微回落。
   * 这避免角色因一次高兴、担忧或失落长期处于同一高强度状态，
   * 具体回落多少则按角色性格（settleSpeed）区分快慢。
   *
   * security（安全感/信任）、anticipation（期待，通常指向一个还没到的
   * 未来时间点，不该因为今天多聊了几句就被削弱）、contentment（满足）
   * 刻意不放进这里——它们更像 warmth/calm 那样的缓慢基线情绪，只靠被动
   * 衰退（decayMoodTowardBaseline）和情绪记忆的 moodDelta 来推动，
   * 不该被"见了一面"这种互动信号直接压低或抚平。
   */
  const settledMood = {
    ...previousState.mood,
    joy: settleTowardCalm(previousState.mood.joy, 0.96, settleFactor),
    concern: settleTowardCalm(previousState.mood.concern, 0.94, settleFactor),
    longing: settleTowardCalm(previousState.mood.longing, 0.94, settleFactor),
    hurt: settleTowardCalm(previousState.mood.hurt, 0.9, settleFactor),
    fatigue: settleTowardCalm(previousState.mood.fatigue, 0.96, settleFactor),
    wronged: settleTowardCalm(previousState.mood.wronged, 0.9, settleFactor),
    surprise: settleTowardCalm(previousState.mood.surprise, 0.8, settleFactor),
    loneliness: settleTowardCalm(previousState.mood.loneliness, 0.94, settleFactor)
  };

  return updateCharacterState({
    chatId,
    characterId: resolvedCharacterId,
    mood: settledMood,
    sourceMemoryIds: previousState.sourceMemoryIds,
    lastInteractionAt: new Date().toISOString()
  });
};

export const getCharacterStateRefreshDelay = () => 6 * HOUR;

/*
 * sensitivity 同样来自角色的情绪人格画像。0.5 换算出来的系数正好还原
 * 这里原本写死的单次 ±0.2 上限，以及 shared 关系里 hurt 的 +0.08 上限。
 *
 * 数值越低，角色对单条情绪记忆的反应越迟钝、变化越小；
 * 数值越高，角色情绪反应越强烈、越容易被一条记忆明显带动。
 */
const getReactionMagnitudeFactor = (sensitivity) => (
  0.5 + clamp01(sensitivity) * 1.0
);

export const applyCharacterEmotionMemory = async ({
  chatId,
  characterId = null,
  memory = null
}) => {
  if (!isValidChatId(chatId) || !memory) {
    return null;
  }

  /*
   * 只接受角色自身或共同关系中的情绪记录。
   * 用户情绪记录绝不能直接写入角色状态。
   */
  if (
    memory.type !== 'emotion' ||
    !['character', 'shared'].includes(memory.emotionSubject)
  ) {
    return null;
  }

  const rawDelta = (
    memory.moodDelta &&
    typeof memory.moodDelta === 'object'
  )
    ? memory.moodDelta
    : null;

  if (!rawDelta) {
    return null;
  }

  const previousState = await getCharacterState({
    chatId,
    characterId
  });

  const resolvedCharacterId = characterId ||
      previousState?.characterId ||
    null;

  const personality = await getEmotionPersonality(resolvedCharacterId, chatId);
  const magnitudeFactor = getReactionMagnitudeFactor(personality.sensitivity);

  const maxSingleDelta = Math.max(
    0.08,
    Math.min(0.32, 0.2 * magnitudeFactor)
  );

  const maxSharedHurtGain = Math.max(
    0.03,
    Math.min(0.14, 0.08 * magnitudeFactor)
  );

  const nextMood = { ...previousState.mood };

  for (const key of MOOD_KEYS) {
    const delta = Number(rawDelta[key]);

    if (!Number.isFinite(delta)) {
      continue;
    }

    /*
     * 即使 AI 输出异常值，角色状态每次最多只移动 maxSingleDelta
     * （随角色 sensitivity 在约 0.08~0.32 之间浮动，0.5 时为原本写死的
     * 0.2）。角色有连续情绪，但不能被单条记忆剧烈改写。
     */
    const safeDelta = Math.max(
      -maxSingleDelta,
      Math.min(maxSingleDelta, delta)
    );

    nextMood[key] = clampMoodValue(
      Number(nextMood[key] || 0) + safeDelta
    );
  }

  /*
   * 关系中的温暖、喜悦或想念可以自然增加；
   * 但角色的 hurt 不得因为其他情绪记录被动高涨。
   * 若用户需要空间，角色应更克制，而非更受伤。
   */
  if (
    memory.emotionSubject === 'shared' &&
    Number(rawDelta.hurt || 0) > 0
  ) {
    nextMood.hurt = Math.min(
      nextMood.hurt,
      previousState.mood.hurt + maxSharedHurtGain
    );
  }

  return updateCharacterState({
    chatId,
    characterId: resolvedCharacterId,
    mood: nextMood,
    sourceMemoryIds: [
      ...(previousState.sourceMemoryIds || []),
      memory.memoryId
    ],
    lastInteractionAt: previousState.lastInteractionAt
  });
};