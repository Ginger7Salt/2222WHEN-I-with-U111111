import db from '../../db';

import {
  MEMORY_CONFIDENCES,
  MEMORY_STATUSES,
  MEMORY_TYPES,
  RECALLABLE_MEMORY_STATUSES
} from './memoryConstants';
import {
  backfillChatMemories
} from './memoryMigration';
import {
  buildCharacterActionContext,
  isMemoryBlockedByRecentAction,
  pickActiveCharacterActions
} from './memoryActionContext';
import {
  getDecayPenalty,
  isFadedOutOfRecall
} from './memoryDecay';
import {
  buildCurrentTimeLine,
  formatMemoryTimeLabel
} from './memoryTimeContext';
import {
  isCompoundEmotion
} from './memoryEmotionCompound';
import {
  getLingeringEmotionContext
} from './memoryEmotionCompoundService';
import {
  buildCommonSenseContext
} from './memoryCommonSense';

const MAX_MEMORY_ITEMS = 4;
const MAX_CONTEXT_CHARS = 1800;
const MAX_SINGLE_MEMORY_CHARS = 420;

const EMOTION_MIN_SCORE = 0.62;
const DEFAULT_MIN_SCORE = 0.2;
const MIN_TOPIC_OVERLAP = 0.2;

const HOUR = 60 * 60 * 1000;

const MEMORY_RECALL_COOLDOWNS = {
  [MEMORY_TYPES.FACT]: 4 * HOUR,
  [MEMORY_TYPES.PREFERENCE]: 12 * HOUR,
  [MEMORY_TYPES.EPISODE]: 8 * HOUR,
  [MEMORY_TYPES.RELATIONSHIP]: 12 * HOUR,
  [MEMORY_TYPES.CHARACTER_THOUGHT]: 8 * HOUR,
  [MEMORY_TYPES.EMOTION]: 6 * HOUR,
  [MEMORY_TYPES.EXPRESSION_RULE]: 0,
  [MEMORY_TYPES.REFLECTION]: 24 * HOUR,
  [MEMORY_TYPES.BELIEF]: 24 * HOUR
};

const CHARACTER_SETTING_COOLDOWN = 24 * HOUR;

const normalizeText = (value) => String(value || '').trim();

const tokenize = (value) => {
  const text = normalizeText(value).toLowerCase();

  if (!text) return [];

  const tokens = new Set();

  text
    .split(/[\s,，。！？；：、“”‘’（）()、/\\|.!?;:\-[\]{}]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .forEach((item) => tokens.add(item));

  const chineseChunks = text.match(/[\u4e00-\u9fff]{2,}/g) || [];

  chineseChunks.forEach((chunk) => {
    for (let index = 0; index < chunk.length - 1; index += 1) {
      tokens.add(chunk.slice(index, index + 2));
    }
  });

  return [...tokens];
};

const getMemoryText = (memory) => (
  [
    memory?.title,
    memory?.content,
    memory?.type,
      ...(Array.isArray(memory?.topicKeys)
      ? memory.topicKeys
      : []),
    memory?.topicKey,
    // 联想用的人物/物品名也算主题词：用户直接提到"小红"时能命中相关记忆。
    ...(Array.isArray(memory?.entities)
      ? memory.entities
      : [])
  ]
    .filter(Boolean)
    .join(' ')
);

const getConfidenceScore = (confidence) => ({
  [MEMORY_CONFIDENCES.USER_WRITTEN]: 1,
  [MEMORY_CONFIDENCES.CONFIRMED]: 0.94,
  [MEMORY_CONFIDENCES.INFERRED]: 0.62,
  [MEMORY_CONFIDENCES.SUGGESTED]: 0.35
}[confidence] || 0.35);

const getTokenOverlap = (leftTokens, rightTokens) => {
  if (!leftTokens.length || !rightTokens.length) return 0;

  const matched = leftTokens.filter((token) => (
    rightTokens.some((other) => (
      token.includes(other) || other.includes(token)
    ))
  )).length;

  return matched / leftTokens.length;
};

const getDaysSince = (value) => {
  const time = new Date(value || 0).getTime();

  if (!Number.isFinite(time) || time <= 0) return 365;

  return Math.max(0, (Date.now() - time) / 86400000);
};

const isCurrentCorrection = (userText) => (
  /(不是|并不是|不是这样|我之前说错了|更正一下|纠正一下|改成|请以现在这句为准|以后请记住)/i
    .test(normalizeText(userText))
);

const isRecallableMemory = (memory, chatId) => {
  if (!memory || memory.chatId !== chatId) return false;

  if (!RECALLABLE_MEMORY_STATUSES.includes(memory.status)) {
    return false;
  }


  if (memory.supersededByMemoryId) return false;
  if (memory.duplicateOfMemoryId) return false;

  // 已经合成进某个复合情绪的零散情绪，不再单独召回，由复合情绪代表它们。
  if (memory.compoundedIntoId) return false;

  const temporalStatus = (
    memory.temporalStatus ||
    memory.temporal?.status ||
    ''
  );

  /*
   * completed（已经发生的事）不再在这里被排除：已发生的事是历史，
   * 由时间标注和时间衰减来决定它还该不该被想起，而不是一刀切排除。
   * 只有已取消，或计划过期后没有得到确认的（unknown），才不再召回。
   */
  if (
    [
      'cancelled',
      'unknown'
    ].includes(temporalStatus)
  ) {
    return false;
  }

  const temporalEndTime = new Date(
    memory.temporal?.endAt || 0
  ).getTime();

  /*
   * 即时安全过滤：
   * 计划结束超过 24 小时但后台尚未更新时，
   * 也不允许它继续作为当前计划进入 Prompt。
   */
  if (
    ['planned', 'ongoing'].includes(temporalStatus) &&
    Number.isFinite(temporalEndTime) &&
    temporalEndTime > 0 &&
    temporalEndTime < Date.now() - 24 * 60 * 60 * 1000
  ) {
    return false;
  }

  return true;
};


const getUserAuthorityBoost = (memory) => {
  let score = 0;

  if (memory.confidence === MEMORY_CONFIDENCES.USER_WRITTEN) {
    score += 0.2;
  }

  if (memory.userEditedAt) {
    score += 0.16;
  }

  if (memory.userConfirmedAt) {
    score += 0.12;
  }

  return score;
};

const getTypeBoost = (memory) => {
  if (memory.type === MEMORY_TYPES.EXPRESSION_RULE) return 0.15;
  if (memory.type === MEMORY_TYPES.PREFERENCE) return 0.06;

  return 0;
};

const getRecallState = (memory) => {
  const state = memory?.recallState || {};

  return {
    cooldownUntil: state.cooldownUntil || null,
    consecutiveRecallCount: Math.max(
      0,
      Number(state.consecutiveRecallCount || 0)
    ),
    lastRecallTurnId: state.lastRecallTurnId || null
  };
};

const isCharacterSettingMemory = (memory) => (
  memory?.memoryScope === 'character_setting' ||
  (
    memory?.subject === 'character' &&
    memory?.type === 'character_thought'
  )
);


const getBaseCooldown = (memory) => {
  if (isCharacterSettingMemory(memory)) {
    return CHARACTER_SETTING_COOLDOWN;
  }

  return MEMORY_RECALL_COOLDOWNS[memory?.type] ?? 6 * HOUR;
};

const isInRecallCooldown = (memory, now = Date.now()) => {
  const { cooldownUntil } = getRecallState(memory);

  if (!cooldownUntil) return false;

  const cooldownTime = new Date(cooldownUntil).getTime();

  return Number.isFinite(cooldownTime) && cooldownTime > now;
};

const getFatiguePenalty = (memory) => {
  const count = Number(memory.useCount || 0);
  const daysSinceUse = getDaysSince(memory.lastUsedAt);
  const { consecutiveRecallCount } = getRecallState(memory);

  if (count <= 0 && consecutiveRecallCount <= 0) {
    return 0;
  }

  const countPenalty = Math.min(
    0.18,
    Math.log2(count + 1) * 0.035
  );

  const consecutivePenalty = Math.min(
    0.3,
    consecutiveRecallCount * 0.1
  );

  const recovery = Math.min(0.1, daysSinceUse * 0.012);

  return Math.max(
    0,
    countPenalty + consecutivePenalty - recovery
  );
};

const calculateScore = (memory, queryTokens) => {
  const memoryTokens = tokenize(getMemoryText(memory));
  const overlap = getTokenOverlap(queryTokens, memoryTokens);

  const importance = Number(memory.importance || 3) / 5;
  const confidence = getConfidenceScore(memory.confidence);
  const freshness = Math.max(
    0,
    1 - getDaysSince(memory.updatedAt) / 365
  );

  const userAuthority = getUserAuthorityBoost(memory);
  const typeBoost = getTypeBoost(memory);
  const fatigue = getFatiguePenalty(memory);

  const inferredStalenessPenalty = (
    memory.confidence === MEMORY_CONFIDENCES.INFERRED &&
    getDaysSince(memory.updatedAt) > 120
  )
    ? 0.08
    : 0;

  return (
    overlap * 0.68 +
    importance * 0.06 +
    confidence * 0.06 +
    freshness * 0.03 +
    userAuthority +
    typeBoost -
    fatigue -
    inferredStalenessPenalty -
    getDecayPenalty(memory)
  );
};

const getTypeLabel = (type) => ({
  fact: '事实与近况',
  preference: '偏好与习惯',
  episode: '共同经历',
  relationship: '关系理解',
  character_thought: '角色内部背景',
  emotion: '情绪线索',
  expression_rule: '表达方式与边界',
  reflection: '阶段性反思',
  belief: '角色对用户的看法'
}[type] || '共同记忆');

const formatMemoryForPrompt = (memory) => {
  const rawContent = normalizeText(memory.content);

  const content = rawContent.length > MAX_SINGLE_MEMORY_CHARS
    ? `${rawContent.slice(0, MAX_SINGLE_MEMORY_CHARS)}…`
    : rawContent;

  const sourceNotice = memory.sourceState === 'available'
    ? ''
    : '；原始消息依据当前不可完整查看';

  const thoughtNotice = memory.type === MEMORY_TYPES.CHARACTER_THOUGHT
    ? '；这是角色自身的内部背景，不得表述为用户事实'
    : '';

  // 时间标注：让角色分清"昨天的事"和"今天的事"。
  // 表达方式与边界是一直要遵守的规则，不属于某个时间点，不加标注。
  const timeLabel = memory.type === MEMORY_TYPES.EXPRESSION_RULE
    ? ''
    : formatMemoryTimeLabel(memory);

  return `- [${getTypeLabel(memory.type)}] ${
    memory.title ? `${memory.title}：` : ''
  }${content}${timeLabel ? `（${timeLabel}）` : ''}${sourceNotice}${thoughtNotice}`;
};

/*
 * 联想到的记忆在提示词里的一行：标出是顺着什么想到的。
 * 节点如果是英文主题键（例如 friends），直接显示不自然，就只写"相关话题"。
 */
const formatAssociatedForPrompt = (memory, via) => {
  const label = /^[a-z0-9_|\-\s]+$/i.test(String(via || ''))
    ? '相关话题'
    : `“${via}”`;

  return formatMemoryForPrompt(memory)
    .replace(/^- /, `- 由${label}想到：`);
};

/*
 * 关键修复：
 * 不再拿角色刚刚说过的话反向驱动检索。
 * 长期记忆应服务于用户当前表达，而不是服务于模型自己的输出。
 */
const getRecentUserMessageText = (recentMessages) => (
  (Array.isArray(recentMessages) ? recentMessages : [])
    .filter((message) => (
      message &&
      message.type !== 'error' &&
      message.sender === 'user'
    ))
    .slice(-3)
    .map((message) => normalizeText(message.content))
    .filter(Boolean)
    .join(' ')
);

const getMemoryTopicKey = (memory) => {
  if (normalizeText(memory?.topicKey)) {
    return normalizeText(memory.topicKey).toLowerCase();
  }

  if (
    Array.isArray(memory?.topicKeys) &&
    memory.topicKeys.length > 0
  ) {
    return memory.topicKeys
      .map((item) => normalizeText(item).toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|');
  }

  const topicKeys = Array.isArray(memory?.topicKeys)
    ? memory.topicKeys
      .map((item) => normalizeText(item).toLowerCase())
      .filter(Boolean)
    : [];

  if (topicKeys.length) {
    return topicKeys.sort().join('|');
  }

  const tokens = tokenize(getMemoryText(memory))
    .filter((token) => token.length >= 2)
    .slice(0, 6)
    .sort();

  return tokens.join('|') || memory.memoryId;
};

const getTopicRecallState = (
  memories,
  topicKey
) => {
  const relatedMemories = memories.filter((memory) => (
    getMemoryTopicKey(memory) === topicKey
  ));

  const states = relatedMemories.map((memory) => {
    const recallState = getRecallState(memory);

    return {
      memory,
      cooldownUntil: recallState.cooldownUntil,
      consecutiveRecallCount: recallState.consecutiveRecallCount,
      lastRetrievedAt: memory.lastRetrievedAt || null
    };
  });

  const latestState = states
    .filter((item) => item.lastRetrievedAt)
    .sort((left, right) => (
      new Date(right.lastRetrievedAt).getTime()
      - new Date(left.lastRetrievedAt).getTime()
    ))[0] || null;

  const activeCooldown = states
    .filter((item) => {
      const cooldownTime = new Date(
        item.cooldownUntil || 0
      ).getTime();

      return (
        Number.isFinite(cooldownTime) &&
        cooldownTime > Date.now()
      );
    })
    .sort((left, right) => (
      new Date(right.cooldownUntil).getTime()
      - new Date(left.cooldownUntil).getTime()
    ))[0] || null;

  return {
    latestState,
    activeCooldown,
    relatedMemories
  };
};

const isTopicInRecallCooldown = (
  memories,
  memory
) => {
  const topicKey = getMemoryTopicKey(memory);

  if (!topicKey) {
    return false;
  }

  const topicState = getTopicRecallState(
    memories,
    topicKey
  );

  return Boolean(topicState.activeCooldown);
};


const canBreakCooldownForDirectMention = (
  memory,
  currentUserText,
  currentUserTokens
) => {
  const normalizedUserText = normalizeText(
    currentUserText
  ).toLowerCase();

  if (!normalizedUserText) {
    return false;
  }

  const topicKey = normalizeText(
    memory?.topicKey
  ).toLowerCase();

  const topicKeys = Array.isArray(memory?.topicKeys)
    ? memory.topicKeys
      .map((item) => normalizeText(item).toLowerCase())
      .filter(Boolean)
    : [];

  /*
   * 新记忆优先根据显式 topicKey / topicKeys 判断。
   * 例如 coffee、拿铁、咖啡等主题词出现在用户当前输入时，
   * 才允许突破主题冷却。
   */
  const explicitTopicMention = [
    topicKey,
    ...topicKeys
  ]
    .filter((item) => item.length >= 2)
    .some((item) => normalizedUserText.includes(item));

  if (explicitTopicMention) {
    return true;
  }

  /*
   * topicKey 常常是英文（如 haidilao），用户却用中文提起。
   * 所以标题里的核心词整段出现在用户输入里，也算直接提及。
   * 只取标题去掉“喜欢/偏爱”等泛词后长度>=3 的片段，避免误触发。
   */
  const titleCore = normalizeText(memory?.title)
    .toLowerCase()
    .replace(/[喜欢爱偏好吃了的和与，,。\s]/g, '');

  if (titleCore.length >= 3 && normalizedUserText.includes(titleCore)) {
    return true;
  }

  /*
   * 兼容尚未具备可靠 topicKey 的旧记忆。
   * 门槛提高到 0.68，避免“今天很累”这类泛表达
   * 因为与旧记忆存在零散中文二字片段而误触发。
   */
  const memoryTokens = tokenize(getMemoryText(memory));

  const overlap = getTokenOverlap(
    currentUserTokens,
    memoryTokens
  );

  return overlap >= 0.68;
};


const shouldRequireTopicMatch = (memory) => (
  memory.type !== MEMORY_TYPES.EXPRESSION_RULE
);

const isRelevantEnough = ({
  memory,
  overlap,
  score,
  currentUserTokens,
  correctionMode
}) => {
  if (correctionMode && overlap >= 0.35) {
    return false;
  }

  if (memory.type === MEMORY_TYPES.EMOTION) {
    // 情绪随时间淡到一定程度后不再被召回（用户和角色的情绪一视同仁）。
    if (isFadedOutOfRecall(memory)) {
      return false;
    }

    return overlap >= 0.35 && score >= EMOTION_MIN_SCORE;
  }

  /*
   * 最重要的门槛：
   * 普通事实、偏好、经历、关系等长期记忆，
   * 若与用户当前表达没有主题重合，不能凭重要度或历史使用次数入选。
   */
  if (
    shouldRequireTopicMatch(memory) &&
    overlap < MIN_TOPIC_OVERLAP
  ) {
    return false;
  }

  return score >= DEFAULT_MIN_SCORE;
};

const reserveMemoriesForRecall = async ({
  selected,
  currentUserText,
  currentUserTokens,
  turnId
}) => {

  if (!selected.length) return [];

  const now = new Date();
  const nowIso = now.toISOString();
  const nowTime = now.getTime();
  const selectedIds = selected
    .map((memory) => memory?.id)
    .filter((id) => id !== undefined && id !== null);

  if (!selectedIds.length) return [];

  const reserved = [];

  await db.transaction('rw', db.memories, async () => {
    for (const id of selectedIds) {
      const currentMemory = await db.memories.get(id);

      if (!currentMemory) continue;

      if (!RECALLABLE_MEMORY_STATUSES.includes(currentMemory.status)) {
        continue;
      }

      if (
        currentMemory.supersededByMemoryId ||
        currentMemory.duplicateOfMemoryId
      ) {
        continue;
      }

    const canBreakCooldown = canBreakCooldownForDirectMention(
  currentMemory,
  currentUserText,
  currentUserTokens
);


      if (
        isInRecallCooldown(currentMemory, nowTime) &&
        !canBreakCooldown
      ) {
        continue;
      }

      const previousState = getRecallState(currentMemory);
      const previousRecallTime = new Date(
        currentMemory.lastRetrievedAt || 0
      ).getTime();

      const baseCooldown = getBaseCooldown(currentMemory);

      const wasRecentlyRecalled = (
        Number.isFinite(previousRecallTime) &&
        previousRecallTime > 0 &&
        nowTime - previousRecallTime < baseCooldown
      );

      const consecutiveRecallCount = wasRecentlyRecalled
        ? previousState.consecutiveRecallCount + 1
        : 1;

      const multiplier = Math.min(
        4,
        Math.max(1, consecutiveRecallCount)
      );

      const cooldownUntil = new Date(
        nowTime + baseCooldown * multiplier
      ).toISOString();

      const nextMemory = {
        ...currentMemory,
        lastUsedAt: nowIso,
        lastRetrievedAt: nowIso,
        useCount: Number(currentMemory.useCount || 0) + 1,
        recallState: {
          cooldownUntil,
          consecutiveRecallCount,
          lastRecallTurnId: turnId
        }
      };

      await db.memories.update(id, nextMemory);
      reserved.push(nextMemory);
    }
  });

  return reserved;
};

export const getRecallableChatMemories = async (chatId) => {
  if (chatId === undefined || chatId === null || chatId === '') {
    return [];
  }

  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  return memories.filter((memory) => (
    isRecallableMemory(memory, chatId)
  ));
};

const getRelevantMemoryContext = async ({
  chatId,
  userText = '',
  recentMessages = []
}) => {
  if (chatId === undefined || chatId === null || chatId === '') {
    return '';
  }

  /*
   * 只补齐缺失字段，不重新生成内容、不修改正文。
   * 迁移失败不能影响正常聊天。
   */
  try {
    await backfillChatMemories(chatId);
  } catch (error) {
    console.warn(
      '[Memory] Legacy memory backfill skipped:',
      error
    );
  }

  const allRecallableMemories = await getRecallableChatMemories(chatId);

  /*
   * 角色做过的事不参与普通召回排序，只通过"角色近期已经做过的事"那一块进入提示词；
   * 同时，窗口期内跟这些事同一个话题的普通记忆，暂时不再召回去诱导角色重复。
   */
  const recentActions = pickActiveCharacterActions(
    allRecallableMemories
  );

  /*
   * 常识、复合情绪同样不参与普通召回排序：
   * 它们各自有单独的一块（"已确认的常识""近期积累的情绪状态"）稳定带进提示词。
   */
  const memories = allRecallableMemories.filter((memory) => (
    memory.type !== MEMORY_TYPES.CHARACTER_ACTION &&
    memory.type !== MEMORY_TYPES.COMMON_SENSE &&
    !isCompoundEmotion(memory)
  ));

  if (!memories.length) return '';

  const currentText = normalizeText(userText);

  /*
   * currentText 是第一优先级。
   * recentMessages 仅补充用户近几轮的表达，不包含角色输出。
   */
  const recentUserText = getRecentUserMessageText(recentMessages);

  const currentUserTokens = tokenize(currentText);
  const queryTokens = tokenize(`${currentText} ${recentUserText}`);

  if (!queryTokens.length) return '';

  const correctionMode = isCurrentCorrection(currentText);
  const now = Date.now();

  const ranked = memories
    .map((memory) => {
      const memoryTokens = tokenize(getMemoryText(memory));

      return {
        memory,
        score: calculateScore(memory, queryTokens),
        overlap: getTokenOverlap(queryTokens, memoryTokens),
        directOverlap: getTokenOverlap(
          currentUserTokens,
          memoryTokens
        )
      };
    })
    .filter((item) => {
          const canBreakCooldown = canBreakCooldownForDirectMention(
        item.memory,
        currentText,
        currentUserTokens
      );

      /*
       * 单条记忆冷却：
       * 同一条已被召回的内容，不能立刻再次进入 Prompt。
       */
      if (
        isInRecallCooldown(item.memory, now) &&
        !canBreakCooldown
      ) {
        return false;
      }

      /*
       * 主题级冷却：
       * 同一主题下的另一条近义记忆也不能绕过冷却。
       *
       * 例如“喜欢咖啡”刚被调用后，
       * “偏爱拿铁”不能在下一轮代替它进入 Prompt。
       */
      if (
        isTopicInRecallCooldown(memories, item.memory) &&
        !canBreakCooldown
      ) {
        return false;
      }


      /*
       * 刚做过的事：角色近期已经为用户做过某件事，
       * 跟它同一话题的偏好/经历记忆暂时不召回，避免"因为你喜欢就再来一次"。
       * 用户当前明确再次提起时，沿用直接提及可突破冷却的规则。
       */
      if (
        isMemoryBlockedByRecentAction(item.memory, recentActions) &&
        !canBreakCooldown
      ) {
        return false;
      }

      return isRelevantEnough({
        ...item,
        currentUserTokens,
        correctionMode
      });
    })
    .sort((left, right) => right.score - left.score);

  const selected = [];
  const selectedTypes = new Set();
  const selectedTopicKeys = new Set();
  let contextLength = 0;

  for (const item of ranked) {
    if (selected.length >= MAX_MEMORY_ITEMS) break;

    const topicKey = getMemoryTopicKey(item.memory);

    /*
     * 同一主题只允许一条记忆进入当前 Prompt。
     * 后续的 topicKey 字段上线后，这里会更准确；
     * 现在也会基于已有正文生成降级主题键。
     */
    if (selectedTopicKeys.has(topicKey)) {
      continue;
    }

    const line = formatMemoryForPrompt(item.memory);

    if (contextLength + line.length > MAX_CONTEXT_CHARS) {
      continue;
    }

    /*
     * 情绪一轮最多一条，避免角色不断强调旧情绪。
     * 非表达边界类记忆，同类型最多两条。
     */
    if (
      item.memory.type === MEMORY_TYPES.EMOTION &&
      selected.some((memory) => memory.type === MEMORY_TYPES.EMOTION)
    ) {
      continue;
    }

    if (
      selectedTypes.has(item.memory.type) &&
      selected.filter((memory) => (
        memory.type === item.memory.type
      )).length >= 2 &&
      item.memory.type !== MEMORY_TYPES.EXPRESSION_RULE
    ) {
      continue;
    }

    selected.push(item.memory);
    selectedTypes.add(item.memory.type);
    selectedTopicKeys.add(topicKey);
    contextLength += line.length;
  }


  if (!selected.length) return '';

  /*
   * 联想：顺着已选中记忆里的人物、物品外扩一到两步，最多带出两条。
   * 联想出来的记忆同样要过冷却、主题去重、"刚做过的事"这几关，
   * 并且带上疲劳和衰减的扣分，所以不会比直接相关的记忆更容易被想起。
   * 联想失败或没有结果都不影响主流程。
   */
  const associatedEntries = [];

  try {
    const overlapById = new Map(
      ranked.map((item) => [item.memory.memoryId, item.overlap])
    );

    const selectedMemoryIds = new Set(
      selected.map((memory) => memory.memoryId)
    );

    /*
     * 选中的记忆都已经通过了"与当前话题有重合"的门槛。用户一句话里的词
     * 很多，单条记忆的重合度数值通常不高（0.2 左右），所以出发强度是
     * 在基础值上再加重合度，而不是直接用重合度。
     */
    const found = findAssociatedMemories({
      seeds: selected.map((memory) => ({
        memory,
        strength: Math.min(1, 0.45 + (overlapById.get(memory.memoryId) || 0))
      })),
      pool: memories,
      isEligible: (memory) => (
        !selectedMemoryIds.has(memory.memoryId) &&
        !selectedTopicKeys.has(getMemoryTopicKey(memory)) &&
        !isInRecallCooldown(memory, now) &&
        !isTopicInRecallCooldown(memories, memory) &&
        !isMemoryBlockedByRecentAction(memory, recentActions)
      )
    });

    const associatedTopicKeys = new Set();

    for (const entry of found) {
      const adjusted = entry.score
        - getFatiguePenalty(entry.memory) * 0.5
        - getDecayPenalty(entry.memory) * 0.5;

      const topicKey = getMemoryTopicKey(entry.memory);

      if (
        adjusted < MIN_ASSOCIATION_SCORE ||
        associatedTopicKeys.has(topicKey)
      ) {
        continue;
      }

      const line = formatAssociatedForPrompt(entry.memory, entry.via);

      if (contextLength + line.length > MAX_CONTEXT_CHARS) {
        continue;
      }

      associatedTopicKeys.add(topicKey);
      contextLength += line.length;
      associatedEntries.push(entry);
    }
  } catch (error) {
    console.warn('[Memory] Association skipped safely:', error);
  }

  const turnId = `memory_recall_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  /*
   * 先同步登记，再返回 Prompt。
   * 下一个并发请求读取记忆时，已经能看到 cooldownUntil，
   * 不会继续选中同一条记忆。
   */
   const reservedMemories = await reserveMemoriesForRecall({
    selected,
    currentUserText: currentText,
    currentUserTokens,
    turnId
  });


  if (!reservedMemories.length) return '';

  let associationSection = '';

  if (associatedEntries.length) {
    try {
      const reservedAssociated = await reserveMemoriesForRecall({
        selected: associatedEntries.map((entry) => entry.memory),
        currentUserText: currentText,
        currentUserTokens,
        turnId
      });

      const viaByMemoryId = new Map(
        associatedEntries.map((entry) => [entry.memory.memoryId, entry.via])
      );

      if (reservedAssociated.length) {
        associationSection = `${buildAssociationHeader()}
${reservedAssociated
    .map((memory) => formatAssociatedForPrompt(
      memory,
      viaByMemoryId.get(memory.memoryId)
    ))
    .join('\n')}
`;
      }
    } catch (error) {
      console.warn('[Memory] Association reserve skipped safely:', error);
    }
  }

  return `
【仅供当前消息框回复参考的共同记忆】
以下内容仅属于当前消息框。用户当前明确表达的说法永远优先于旧记录。
只在与当前话题自然相关时参考，不要提及记忆系统、数据库、检索结果或内部字段。
不得使用已撤回、归档、失效、冲突、被更正或已被替代的记录。
已在近期被调用过的主题会暂时退出参考；不要用另一条近义记忆重新重复同一个话题。
情绪线索只在当前语境直接相关时谨慎参考，不得借此向用户施压、催促或制造愧疚。
角色内部背景不是用户事实，不得将其表述为“用户说过”。
不要逐条复述以下内容：

${reservedMemories.map(formatMemoryForPrompt).join('\n')}
${associationSection}`;
};

/*
 * 对外的入口，所有调用方（聊天、通话、线下）都通过它拿到记忆块。
 * 由三部分拼成：当前时间行、与当前话题相关的共同记忆、
 * "角色近期已经做过的事"。后两部分都没有内容时返回空字符串。
 *
 * "角色近期已经做过的事"不依赖用户这句话的话题：即使这次没有召回到任何
 * 共同记忆，角色也应该记得自己刚做过什么。
 */
export const getChatMemoryContext = async ({
  chatId,
  userText = '',
  recentMessages = []
}) => {
  if (chatId === undefined || chatId === null || chatId === '') {
    return '';
  }

  const relevantContext = await getRelevantMemoryContext({
    chatId,
    userText,
    recentMessages
  });

  let actionContext = '';

  try {
    const recallable = await getRecallableChatMemories(chatId);

    actionContext = buildCharacterActionContext(
      pickActiveCharacterActions(recallable)
    );
  } catch (error) {
    console.warn(
      '[Memory] Character action context skipped safely:',
      error
    );
  }

  let commonSenseContext = '';
  let lingeringEmotionContext = '';

  try {
    const recallable = await getRecallableChatMemories(chatId);

    commonSenseContext = buildCommonSenseContext(recallable);

    lingeringEmotionContext = await getLingeringEmotionContext(chatId, {
      memories: recallable
    });
  } catch (error) {
    console.warn(
      '[Memory] Common sense / lingering emotion context skipped safely:',
      error
       );
  }

  // 角色在这段关系里的成长变化：不依赖用户这句话的话题，一直作为背景带上。
  const growthContext = await getGrowthContext(chatId);

  if (
    !relevantContext &&
    !actionContext &&
    !commonSenseContext &&
    !lingeringEmotionContext &&
    !growthContext
  ) {
    return '';
  }

  return `
${buildCurrentTimeLine()}
${growthContext}${commonSenseContext}${relevantContext}${lingeringEmotionContext}${actionContext}`;
};

/*
 * 为保留与旧调用方的兼容性而保留。
 * 新的 getChatMemoryContext 已在返回 Prompt 前同步完成登记，
 * 正常聊天流程不应再额外调用这个函数。
 */
export const markMemoriesUsed = async (memories = []) => {
  const ids = [...new Set(
    memories
      .map((memory) => memory?.id)
      .filter((id) => id !== undefined && id !== null)
  )];

  if (!ids.length) return;

  const nowIso = new Date().toISOString();

  await db.transaction('rw', db.memories, async () => {
    for (const id of ids) {
      const memory = await db.memories.get(id);

      if (!memory || !RECALLABLE_MEMORY_STATUSES.includes(memory.status)) {
        continue;
      }

      if (memory.supersededByMemoryId || memory.duplicateOfMemoryId) {
        continue;
      }

      await db.memories.update(id, {
        ...memory,
        lastUsedAt: nowIso,
        lastRetrievedAt: nowIso,
        useCount: Number(memory.useCount || 0) + 1
      });
    }
  });
};
