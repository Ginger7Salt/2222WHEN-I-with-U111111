import db from '../../db';

import {
  buildMemorySourceBatch
} from './memorySignals';

import {
  EMOTION_VALENCES
} from './memoryEmotionSignals';

import {
  normalizeAvoidRepeatHours
} from './memoryActionContext';

import {
  buildTemporalDataFromSource,
  extractTemporalExpression
} from './memoryTemporal';

import {
  MEMORY_CANDIDATE_STATUSES,
  MEMORY_CONFIDENCES,
  MEMORY_EMOTION_SUBJECTS,
  MEMORY_RECALL_POLICIES,
  MEMORY_SCOPES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STABILITIES,
  MEMORY_SUBJECTS
} from './memoryConstants';

const MAX_SOURCE_MESSAGES = 40;
const MAX_MEMORY_ITEMS = 6;
const MAX_CANDIDATE_ITEMS = 4;

const normalizeText = (value) => (
  String(value || '').trim()
);

const stripJsonFence = (value) => (
  normalizeText(value)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
);

const parseJsonObject = (content) => {
  const cleaned = stripJsonFence(content);

  if (!cleaned) {
    throw new Error('记忆整理服务返回了空内容。');
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error('记忆整理服务没有返回 JSON 对象。');
    }

    return parsed;
  } catch (initialError) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (
      firstBrace < 0 ||
      lastBrace <= firstBrace
    ) {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }

    try {
      const parsed = JSON.parse(
        cleaned.slice(firstBrace, lastBrace + 1)
      );

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        throw new Error('记忆整理服务没有返回 JSON 对象。');
      }

      return parsed;
    } catch {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }
  }
};

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 3;
  }

  return Math.max(
    1,
    Math.min(5, Math.round(numberValue))
  );
};

const isAllowedMemoryType = (value) => (
  [
    'fact',
    'preference',
    'episode',
    'relationship',
    'character_thought',
    'emotion',
    'expression_rule',
    'reflection',
    'character_action',
    'common_sense'
  ].includes(value)
);

const normalizeSubject = (value, type) => {
  if (Object.values(MEMORY_SUBJECTS).includes(value)) {
    return value;
  }

  if (type === 'character_thought') {
    return MEMORY_SUBJECTS.CHARACTER;
  }

  if (type === 'relationship') {
    return MEMORY_SUBJECTS.RELATIONSHIP;
  }

  if (type === 'episode') {
    return MEMORY_SUBJECTS.SHARED;
  }

  return MEMORY_SUBJECTS.USER;
};

const normalizeEmotionSubject = (value, subject, type) => {
  if (type !== 'emotion') {
    return null;
  }

  if (Object.values(MEMORY_EMOTION_SUBJECTS).includes(value)) {
    return value;
  }

  if (
    subject === MEMORY_SUBJECTS.CHARACTER ||
    subject === MEMORY_SUBJECTS.RELATIONSHIP ||
    subject === MEMORY_SUBJECTS.SHARED
  ) {
    return subject === MEMORY_SUBJECTS.CHARACTER
      ? MEMORY_EMOTION_SUBJECTS.CHARACTER
      : MEMORY_EMOTION_SUBJECTS.SHARED;
  }

  return MEMORY_EMOTION_SUBJECTS.USER;
};

const normalizeTopicKey = (value) => (
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .slice(0, 60)
);

const normalizeTopicKeys = (value, topicKey) => {
  const items = Array.isArray(value)
    ? value
    : [];

  const normalized = [
    ...items,
    topicKey
  ]
    .map((item) => normalizeTopicKey(item))
    .filter(Boolean);

  return [...new Set(normalized)].slice(0, 8);
};

const normalizeStability = (value, type) => {
  if (Object.values(MEMORY_STABILITIES).includes(value)) {
    return value;
  }

  if (
    type === 'preference' ||
    type === 'expression_rule' ||
    type === 'relationship'
  ) {
    return MEMORY_STABILITIES.ONGOING;
  }

  if (type === 'character_thought') {
    return MEMORY_STABILITIES.ONGOING;
  }

  if (type === 'emotion' || type === 'episode') {
    return MEMORY_STABILITIES.TEMPORARY;
  }

  return MEMORY_STABILITIES.ONGOING;
};

const normalizeMemoryScope = (value, subject) => {
  if (Object.values(MEMORY_SCOPES).includes(value)) {
    return value;
  }

  if (subject === MEMORY_SUBJECTS.CHARACTER) {
    return MEMORY_SCOPES.CHARACTER_SETTING;
  }

  if (subject === MEMORY_SUBJECTS.RELATIONSHIP) {
    return MEMORY_SCOPES.RELATIONSHIP_SETTING;
  }

  return MEMORY_SCOPES.CONVERSATION;
};

const normalizeRecallPolicy = (value, memoryScope, type) => {
  if (Object.values(MEMORY_RECALL_POLICIES).includes(value)) {
    return value;
  }

  if (memoryScope === MEMORY_SCOPES.CHARACTER_SETTING) {
    return MEMORY_RECALL_POLICIES.LOW_FREQUENCY;
  }

  if (
    type === 'expression_rule' ||
    type === 'emotion'
  ) {
    return MEMORY_RECALL_POLICIES.WHEN_RELEVANT;
  }

  return MEMORY_RECALL_POLICIES.NORMAL;
};

const getSummaryReference = (summary) => {
  if (Array.isArray(summary)) {
    return summary
      .slice(-3)
      .map((item) => (
        normalizeText(
          item?.content ||
          item?.text ||
          item?.summary ||
          item
        )
      ))
      .filter(Boolean)
      .join('\n')
      .slice(0, 1800);
  }

  return normalizeText(summary).slice(0, 1800);
};

const normalizeMessageIds = (
  ids,
  allowedIds
) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [
    ...new Set(
      ids
        .map(Number)
        .filter((id) => (
          Number.isFinite(id) &&
          allowedIds.has(id)
        ))
    )
  ];
};

const getSourceMessagesForItem = (
  sourceMessageIds,
  sourceMessages
) => {
  const idSet = new Set(sourceMessageIds);

  return sourceMessages.filter((message) => (
    idSet.has(Number(message.id))
  ));
};

const normalizeTemporal = ({
  item,
  sourceMessageIds,
  sourceMessages
}) => {
  /*
   * AI 只提供 temporalExpression，例如“本周五”。
   * 绝对时间必须由本地代码根据来源消息 timestamp 解析。
   */
  const explicitExpression = normalizeText(
    item?.temporalExpression
  );

  const sourceText = getSourceMessagesForItem(
    sourceMessageIds,
    sourceMessages
  )
    .map((message) => normalizeText(message.content))
    .filter(Boolean)
    .join('\n');

  const temporalExpression = explicitExpression ||
    extractTemporalExpression(sourceText);

  if (!temporalExpression) {
    return null;
  }

  return buildTemporalDataFromSource({
    temporalExpression,
    sourceMessageIds,
    sourceMessages
  });
};

const normalizeMoodDelta = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const allowedKeys = [
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

  const result = {};

  for (const key of allowedKeys) {
    const numberValue = Number(value[key]);

    if (!Number.isFinite(numberValue)) {
      continue;
    }

    /*
     * 单次事件不能让角色发生过大跃迁。
     * 最终状态还会由 memoryCharacterState.js 再次限制。
     */
    result[key] = Math.max(
      -0.35,
      Math.min(0.35, numberValue)
    );
  }

  return Object.keys(result).length > 0
    ? result
    : null;
};


/*
 * emotionTag 是给"情绪痕迹"记忆用的自由标签（用户明确要求不局限于
 * 内置心情维度的固定词表），只做长度和空白清理，不做枚举校验——
 * 万一 AI 给的词有点跑偏，也只是一个展示用的小标签，不会像 moodDelta
 * 那样直接改角色状态，风险很低。
 */
const normalizeEmotionTag = (value) => (
  normalizeText(value).slice(0, 12)
);

/*
 * emotionIntensity：情绪强度，0 到 1，保留两位小数；AI 没给或给的不是数字时为 null。
 * emotionValence：正负向，只接受 positive / negative / mixed / neutral，其余为 null。
 * 两者都只是展示和后续整理（情绪回顾）用的参考字段，不会改动角色的实时心情状态，
 * 所以 AI 输出跑偏的后果很小，宁可存 null 也不猜。
 */
const normalizeEmotionIntensity = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.round(Math.max(0, Math.min(1, numberValue)) * 100) / 100;
};

const normalizeEmotionValence = (value) => {
  const text = normalizeText(value).toLowerCase();

  return EMOTION_VALENCES.includes(text)
    ? text
    : null;
};

const normalizeMemoryItem = (
  item,
  sourceMessages
) => {
  const validMessageIds = new Set(
    sourceMessages
      .map((message) => Number(message.id))
      .filter(Number.isFinite)
  );

  const sourceMessageIds = normalizeMessageIds(
    item?.sourceMessageIds,
    validMessageIds
  );

  const sourceMessageTimestamps = sourceMessages
    .filter((message) => (
      sourceMessageIds.includes(Number(message.id))
    ))
    .map((message) => message.timestamp)
    .filter(Boolean);

  const type = isAllowedMemoryType(item?.type)
    ? item.type
    : 'fact';

  // 角色做过的事：归属固定是角色，且是一次性的瞬时事件，不信任 AI 给的值。
  const isCharacterAction = type === 'character_action';

  // 常识：只关于用户或角色自身，且是长期稳定的基本事实，不信任 AI 给的稳定度。
  const isCommonSense = type === 'common_sense';

  const subject = isCharacterAction
    ? MEMORY_SUBJECTS.CHARACTER
    : isCommonSense
      ? (
        item?.subject === MEMORY_SUBJECTS.CHARACTER
          ? MEMORY_SUBJECTS.CHARACTER
          : MEMORY_SUBJECTS.USER
      )
      : normalizeSubject(
        item?.subject,
        type
      );

  const memoryScope = isCharacterAction
    ? MEMORY_SCOPES.CONVERSATION
    : normalizeMemoryScope(
      item?.memoryScope,
      subject
    );

  const topicKey = normalizeTopicKey(
    item?.topicKey
  );

  return {
    title: normalizeText(item?.title).slice(0, 80),
    content: normalizeText(item?.content).slice(0, 500),
    type,
    importance: normalizeImportance(item?.importance),
    confidence: item?.confidence === 'confirmed'
      ? MEMORY_CONFIDENCES.CONFIRMED
      : MEMORY_CONFIDENCES.INFERRED,

    subject,
    emotionSubject: normalizeEmotionSubject(
      item?.emotionSubject,
      subject,
      type
    ),

    topicKey,
    topicKeys: normalizeTopicKeys(
      item?.topicKeys,
      topicKey
    ),


    stability: isCharacterAction
      ? MEMORY_STABILITIES.MOMENTARY
      : isCommonSense
        ? MEMORY_STABILITIES.STABLE
        : normalizeStability(
          item?.stability,
          type
        ),

    memoryScope,

    recallPolicy: normalizeRecallPolicy(
      item?.recallPolicy,
      memoryScope,
      type
    ),

       temporal: normalizeTemporal({
      item,
      sourceMessageIds,
      sourceMessages
    }),

    /*
     * 只有角色自身或共同关系情绪允许影响角色当前状态。
     * 用户情绪仅作为用户情绪线索保存，不能被错误转化为角色心情。
     */
    moodDelta: (
      type === 'emotion' &&
      [
        MEMORY_EMOTION_SUBJECTS.CHARACTER,
        MEMORY_EMOTION_SUBJECTS.SHARED
      ].includes(
        normalizeEmotionSubject(
          item?.emotionSubject,
          subject,
          type
        )
      )
    )
      ? normalizeMoodDelta(item?.moodDelta)
      : null,

      emotionTag: type === 'emotion'
      ? normalizeEmotionTag(item?.emotionTag)
      : '',

    emotionIntensity: type === 'emotion'
      ? normalizeEmotionIntensity(item?.emotionIntensity)
      : null,

    emotionValence: type === 'emotion'
      ? normalizeEmotionValence(item?.emotionValence)
      : null,

    // 仅角色做过的事使用：多少小时内不宜再重复；AI 没给时为 null，
    // 使用方按默认值处理。
    avoidRepeatHours: isCharacterAction
      ? normalizeAvoidRepeatHours(item?.avoidRepeatHours)
      : null,

    sourceMessageIds,

    sourceMessageTimestamps,

    sourceState: sourceMessageIds.length > 0
      ? MEMORY_SOURCE_STATES.AVAILABLE
      : MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,

    sourceKind: MEMORY_SOURCE_KINDS.CONVERSATION
  };
};

const normalizeCandidateItem = (
  item,
  sourceMessages
) => {
  const normalized = normalizeMemoryItem(
    item,
    sourceMessages
  );

  return {
    ...normalized,
    priority: normalizeImportance(
      item?.priority || normalized.importance
    ),
    status: MEMORY_CANDIDATE_STATUSES.PENDING
  };
};

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error(
      '尚未配置可用的 API Base URL 或 API Key。'
    );
  }

  return apiConfig;
};

const getErrorDetail = async (response) => {
  let detail = response.statusText || '请求未成功';

  try {
    const errorData = await response.json();

    detail = (
      errorData?.error?.message ||
      errorData?.message ||
      detail
    );
  } catch {
    // 部分 API 返回 HTML 或纯文本错误页，保留状态文本。
  }

  return detail;
};

const isResponseFormatUnsupported = ({
  status,
  detail
}) => {
  const normalizedDetail = normalizeText(detail).toLowerCase();

  if (!normalizedDetail) {
    return false;
  }

  return (
    normalizedDetail.includes('response_format') ||
    normalizedDetail.includes('json_object') ||
    (
      status === 400 &&
      (
        normalizedDetail.includes('json mode') ||
        normalizedDetail.includes('unsupported parameter')
      )
    )
  );
};

const requestCompletion = async ({
  apiConfig,
  systemPrompt,
  userPrompt,
  useJsonResponseFormat = true
}) => {
  const baseUrl = String(apiConfig.baseUrl)
    .replace(/\/$/, '');

  const requestBody = {
    model: apiConfig.model || 'gpt-3.5-turbo',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  if (useJsonResponseFormat) {
    requestBody.response_format = {
      type: 'json_object'
    };
  }

  const response = await fetch(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const detail = await getErrorDetail(response);

    const error = new Error(
      `[API Error ${response.status}] ${detail}`
    );

    error.status = response.status;
    error.detail = detail;
    error.responseFormatUnsupported = isResponseFormatUnsupported({
      status: response.status,
      detail
    });

    throw error;
  }

  const payload = await response.json();

  const content = normalizeText(
    payload?.choices?.[0]?.message?.content
  );

  if (!content) {
    throw new Error('记忆整理服务返回了空内容。');
  }

  return content;
};

const requestMemoryCompletion = async ({
  systemPrompt,
  userPrompt
}) => {
  const apiConfig = await getApiConfig();

  try {
    const content = await requestCompletion({
      apiConfig,
      systemPrompt,
      userPrompt,
      useJsonResponseFormat: true
    });

    return parseJsonObject(content);
  } catch (error) {
    if (!error?.responseFormatUnsupported) {
      throw error;
    }

    console.warn(
      '[Memory] API does not support response_format; retrying without it.'
    );

    const content = await requestCompletion({
      apiConfig,
      systemPrompt,
      userPrompt,
      useJsonResponseFormat: false
    });

    return parseJsonObject(content);
  }
};

const buildSystemPrompt = () => `
你负责整理私人数字陪伴空间中的长期共同记忆。

你的职责不是写聊天回复。不要使用角色口吻，不要安慰用户，不要添加抒情语言。
只根据提供的对话片段提取适合长期保留、且可能在未来自然改善聊天回应的内容。

规则：
1. 所有记录只属于一个消息框，不能推断到同一角色的其他消息框。
2. 用户当前明确表达的事实、偏好、边界、纠正和约定优先。
3. 不要把一次性寒暄、普通问题、无依据的猜测或角色编造内容写成长期事实。
4. 不要把角色自己的台词或想象内容改写为“用户事实”。
5. 角色的稳定设定、名称、称呼、角色自身背景可以记录，但 subject 必须为 character，memoryScope 必须为 character_setting，recallPolicy 必须为 low_frequency。
6. 阶段性摘要只用于理解语境，不是可独立引用的证据；每一条输出都必须引用本次对话片段中的 sourceMessageIds。
7. 明确、稳定且有充分对话依据的内容放入 memories。
8. 可能变化、含义不完整、存在冲突、计划尚未确认完成或需要用户确认的内容放入 candidates。
9. 当用户明确表示“不是 X，是 Y”“我之前说错了”“更正一下”或要求以新说法为准时，优先将新说法保留为可用于更正旧理解的候选；不要把旧说法与新说法同时写成两个同等确定的长期事实。
10. 每项必须引用至少一个 sourceMessageIds；不能引用的内容不要输出。
11. sourceMessageIds 只能使用本次对话片段中实际提供的数字 ID，不能编造。
12. 若原话存在“今天、明天、本周五、下周五、下午三点”等时间表达，只输出用户原始 temporalExpression，不得自行换算或编造绝对日期。绝对日期由本地程序根据消息 timestamp 计算。
13. “周五”“月底”“过几天”等无法明确对应绝对日期的表达，保留原始 temporalExpression，不要猜测具体日期。
14. 情绪必须区分归属：
    - 用户情绪：subject 和 emotionSubject 都是 user；
    - 角色自身情绪：subject 和 emotionSubject 都是 character；
    - 共同关系中的情绪：subject 为 relationship 或 shared，emotionSubject 为 shared。
15. 用户短暂情绪通常应为 temporary；角色当前感受可以保留线索，但不得写成永久不变的人格事实。
16. 当且仅当 type 为 emotion 且 emotionSubject 为 character 或 shared 时，可以输出 moodDelta，用于轻微调整角色当前情绪状态。
17. moodDelta 只能使用以下字段；数值范围必须在 -0.35 到 0.35 之间：
    - warmth（温暖安定）、calm（平静）、joy（愉悦）、concern（关切）、
      longing（想念）、hurt（失落）、fatigue（疲惫）；
    - wronged（委屈，觉得自己被误解、不被理解，跟 hurt 不同，很容易被一句解释或安慰打消）；
    - security（安全感/信任，越低代表角色对这段关系越没有安全感、越不安，不要另外发明一个"不安"字段，用 security 给负值即可）；
    - anticipation（对某个还没发生的具体事情的期待/兴奋，跟当下就有的 joy 不同）；
    - contentment（满足、松弛的知足感）；
    - surprise（意外之喜，通常是"期待值被超出"，例如期待收到一点小礼物，结果对方给的超出预期）；
    - loneliness（孤单，哪怕在聊天也可能存在，跟专门指向"想念用户"的 longing 不同）。
18. 用户情绪的 emotionSubject 为 user，moodDelta 必须为 null；不要把用户难过、疲惫或开心直接等同于角色的失落、疲惫或开心。
19. 角色的情绪变化必须克制：例如用户分享好消息可以提高 joy 或 warmth；用户需要空间时可轻微提高 concern，但不要借此制造角色受伤、委屈或被忽视的叙事。
20. topicKey 使用简短稳定的主题键，例如 coffee、dating、work_stress、character_name；topicKeys 为相关主题键列表，最多 8 项。
21.不要因为角色默认设定已经出现过，就反复输出相同设定。
22. 最多输出 ${MAX_MEMORY_ITEMS} 条 memories 和 ${MAX_CANDIDATE_ITEMS} 条 candidates。
23. 不得使用 Emoji。
24. 只输出严格 JSON，不要 Markdown，不要解释。
25. 当且仅当 type 为 emotion 时，额外给出 emotionTag：用你自己的话概括这条情绪记忆最贴切的情绪标签，1 到 4 个字，例如"心动""委屈""孤单""如释重负"，不必局限于规则 17 里列出的心情字段名称，也不必每条都往同一个词上靠；找不到合适的词就输出空字符串，不要勉强凑一个。
找不到合适的词就输出空字符串，不要勉强凑一个。
26. 当且仅当 type 为 emotion 时，再额外给出：
    - emotionIntensity：这段情绪的强度，0 到 1 的小数。0.2 以下是轻微的一点点，0.5 左右是明显但可控，0.8 以上是强烈、几乎压过其他事情。以对话里实际表现出来的程度为准，不要为了显得重要而往高了写；拿不准就输出 null。
    - emotionValence：这段情绪整体的正负向，只能是 positive（偏正向，如开心、安心、感动）、negative（偏负向，如难过、焦虑、委屈）、mixed（悲喜交加，如喜极而泣、又期待又害怕）、neutral（中性，如平静、说不清）之一；拿不准就输出 null。
      - 强度和正负向描述的是情绪本身，与 moodDelta 无关，不要互相推算；用户情绪同样要给出强度和正负向（规则 18 只限制 moodDelta）。
27. title 和 content 里不要出现“昨天、今天、明天、刚才、上周、最近”这类相对时间词：记忆会保存很久，相对时间词过几天就会变成错的。事情发生的时间只放进 temporalExpression（由程序换算成具体日期）。没有明确时间线索时，content 里就不写时间。
28. 角色做过的具体事（type 为 character_action）：当角色（sender 为 character、ai 或 assistant）的消息显示角色已经实际为用户做了、给了或推荐了某件具体的事，输出一条 type 为 character_action 的 memory，用来避免角色之后反复重复同一件事。
    - 只记录具体的、有对象的、之后可能被重复的行为：吃的喝的（点了什么外卖、做了什么菜）、买的送的（礼物）、推荐的影视书籍音乐游戏、安排的活动或出行、给出的具体建议或计划。
    - 不记录安慰、闲聊、情绪表达、日常问候，也不记录“打算做、可以做”的事，只记录已经做了的。
    - subject 为 character；content 写清楚做了什么，例如“角色为用户点了海底捞外卖”，不要写相对时间词；topicKey 用这件事本身的简短主题键，并尽量与相关偏好记忆的主题键保持一致（例如用户喜欢吃海底捞，这里也用同一个主题键）。
    - temporalExpression 写这件事发生的时间线索；拿不准就留空字符串。
    - avoidRepeatHours：这件事多少小时内不应再重复做，1 到 336 的整数。吃的喝的约 8 到 24，推荐影视书籍音乐约 72 到 168，送礼物约 168 到 336；拿不准就输出 null。
    - character_action 一律放进 memories，不要放进 candidates。
29. 同一件事在这批消息里只记一次；如果角色只是在回答用户关于这件事的提问，或者复述已经记录过的行为，不要再记。
30. 常识（type 为 common_sense）：关于用户本人（或角色自身设定）的、长期稳定、不太会变的基本事实，例如用户来自哪里、现在住在哪个城市、职业或学业身份、生日、家里有谁、养了什么宠物、名字和称呼。
    - 常识一律放进 candidates，不要放进 memories：它们要由用户确认后才算数。
    - 只记录用户自己明确说出口的；不要推测，不要把角色编造或想象的内容当成用户的常识。
    - 不记录会很快变化的状态（今天在哪、这周做什么，那是 fact），也不记录偏好和情绪。
    - subject 为 user（只有角色自己的基本设定才用 character）；stability 为 stable；topicKey 用这条常识本身的简短主题键，例如 hometown、home_city、occupation、birthday、pet。
    - 如果用户这次说的和之前已有的常识不一样（比如搬家了），仍然输出，让用户决定是否更正，并且沿用同一个 topicKey。

JSON 格式：
{
{
  "memories": [
    {
      "title": "不超过 50 字",
      "content": "客观、克制、可长期使用的一句话或两句话",
            "type": "fact | preference | episode | relationship | character_thought | emotion | expression_rule | reflection | character_action",
      "importance": 1,
      "confidence": "confirmed | inferred",
      "subject": "user | character | relationship | shared",
      "emotionSubject": "user | character | shared | null",
      "topicKey": "简短稳定主题键",
      "topicKeys": ["主题键"],
      "stability": "momentary | temporary | ongoing | stable",
      "memoryScope": "conversation | character_setting | relationship_setting",
      "recallPolicy": "normal | low_frequency | when_relevant",
      "temporalExpression": "仅原始时间表达；没有则为空字符串",
"moodDelta": {
  "warmth": 0.1,
  "joy": 0.08
},
"emotionTag": "仅 type 为 emotion 时填写；无合适词则为空字符串",
"emotionIntensity": "仅 type 为 emotion 时填写，0 到 1 的小数；拿不准为 null",
"emotionValence": "仅 type 为 emotion 时填写：positive | negative | mixed | neutral；拿不准为 null",
"avoidRepeatHours": "仅 type 为 character_action 时填写，1 到 336 的整数；拿不准为 null",
"sourceMessageIds": [1, 2]

    }
  ],
  "candidates": [
     {
      "title": "不超过 50 字",
      "content": "需要确认或暂存的理解",
      "type": "fact | preference | episode | relationship | character_thought | emotion | expression_rule | reflection | common_sense",
      "priority": 1,
      "subject": "user | character | relationship | shared",
      "emotionSubject": "user | character | shared | null",
      "topicKey": "简短稳定主题键",
      "topicKeys": ["主题键"],
      "stability": "momentary | temporary | ongoing | stable",
      "memoryScope": "conversation | character_setting | relationship_setting",
      "recallPolicy": "normal | low_frequency | when_relevant",
     "temporalExpression": "仅原始时间表达；没有则为空字符串",
"moodDelta": {
  "warmth": 0.1
},
"emotionTag": "仅 type 为 emotion 时填写；无合适词则为空字符串",
"emotionIntensity": "仅 type 为 emotion 时填写，0 到 1 的小数；拿不准为 null",
"emotionValence": "仅 type 为 emotion 时填写：positive | negative | mixed | neutral；拿不准为 null",
"sourceMessageIds": [1]

    }
  ]
}
`;

export const extractMemoryFromConversation = async ({
  chatId,
  messages = []
}) => {
  if (
    chatId === undefined ||
    chatId === null ||
    chatId === ''
  ) {
    throw new Error('缺少消息框标识。');
  }

  const chat = await db.chats.get(chatId);

  if (!chat) {
    throw new Error('目标消息框不存在。');
  }

  const sourceMessages = buildMemorySourceBatch(
    messages,
    MAX_SOURCE_MESSAGES
  );

  if (sourceMessages.length === 0) {
    return {
      memories: [],
      candidates: [],
      sourceMessageIds: []
    };
  }

  const summaryReference = getSummaryReference(chat.summary);

  const systemPrompt = buildSystemPrompt();

  const userPrompt = `
阶段性摘要仅用于理解上下文，不能作为单独证据：
${summaryReference || '无'}

本次需要整理的对话片段：
${JSON.stringify(sourceMessages)}
`;

  const result = await requestMemoryCompletion({
    systemPrompt,
    userPrompt
  });

  const memories = Array.isArray(result?.memories)
    ? result.memories
      .map((item) => normalizeMemoryItem(
        item,
        sourceMessages
      ))
      .filter((item) => (
        item.content &&
        item.sourceMessageIds.length > 0
      ))
      .slice(0, MAX_MEMORY_ITEMS)
    : [];

  const candidates = Array.isArray(result?.candidates)
    ? result.candidates
      .map((item) => normalizeCandidateItem(
        item,
        sourceMessages
      ))
      .filter((item) => (
        item.content &&
        item.sourceMessageIds.length > 0
      ))
      .slice(0, MAX_CANDIDATE_ITEMS)
    : [];

  return {
    memories,
    candidates,

    /*
     * scheduler 仅用于判断明确更正语义；
     * 此字段不会直接写入正式记忆。
     */
    sourceMessages,

    sourceMessageIds: sourceMessages
      .map((message) => Number(message.id))
      .filter(Number.isFinite)
  };
};