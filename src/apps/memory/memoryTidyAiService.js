import db from '../../db';

import {
  MEMORY_SUBJECTS
} from './memoryConstants';

/*
 * 记忆整理（合并重复记忆、情绪回顾）的 AI 调用层。
 * 跟 reflectionAiService.js 一样，自带一份轻量的本地 fetch + JSON 解析，
 * 不共用全局 aiService。
 *
 * 这里只负责"问 AI、把结果规范化"，不读写 memories 表，
 * 真正的落库和"是否需要用户确认"都在 memoryTidyService.js 里决定。
 */

const MAX_EMOTION_REVIEW_ITEMS = 2;

const normalizeText = (value) => String(value || '').trim();

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

  const tryParse = (text) => {
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('记忆整理服务没有返回 JSON 对象。');
    }

    return parsed;
  };

  try {
    return tryParse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }

    try {
      return tryParse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }
  }
};

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error('尚未配置可用的 API Base URL 或 API Key。');
  }

  return apiConfig;
};

const getErrorDetail = async (response) => {
  let detail = response.statusText || '请求未成功';

  try {
    const errorData = await response.json();

    detail = errorData?.error?.message || errorData?.message || detail;
  } catch {
    // 部分 API 返回 HTML 或纯文本错误页，保留状态文本。
  }

  return detail;
};

const requestTidyCompletion = async ({ systemPrompt, userPrompt }) => {
  const apiConfig = await getApiConfig();
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const detail = await getErrorDetail(response);
    throw new Error(`[API Error ${response.status}] ${detail}`);
  }

  const payload = await response.json();
  const content = normalizeText(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('记忆整理服务返回了空内容。');
  }

  return parseJsonObject(content);
};

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(numberValue)));
};

/* ------------------------------------------------------------------ */
/* 合并重复记忆                                                        */
/* ------------------------------------------------------------------ */

const MERGE_SYSTEM_PROMPT = `
你负责整理一段私人数字陪伴关系里的记忆档案。下面是几条被程序判定为"可能重复"的记忆，按从旧到新排列，编号越大越新。

你的职责：判断它们是不是在说同一件事；如果是，合并成一条更完整、更准确的记忆。不要使用角色口吻，不要安慰，不要添加抒情语言。

规则：
1. 只有当它们描述的是同一个人的同一件事、同一个偏好或同一个设定时，canMerge 才能为 true。
2. 如果它们其实是不同的事、不同时期的变化、或者互相矛盾，canMerge 必须为 false，不要强行合并。
3. 合并时不得添加给定记忆里没有的信息，不得推测，不得美化；保留所有仍然有效的细节。
4. 如果新旧说法有出入，以编号更大（更新）的说法为准。
5. content 用一到三句话，克制、客观。title 不超过 30 字。
6. importance 为 1 到 5 的整数，不低于给定记忆中的最高值。
7. canMerge 为 false 时，title 和 content 输出空字符串。
8. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "canMerge": true,
  "title": "不超过 30 字",
  "content": "合并后的记忆内容",
  "importance": 3,
  "reason": "一句话说明为什么可以或不可以合并"
}
`;

const buildMergeUserPrompt = (memories) => (
  `
待判断的记忆：
${memories
    .map((memory, index) => (
      `${index + 1}. [${memory.type}] ${memory.title || ''}：${memory.content}`
    ))
    .join('\n')}
`
);

/*
 * 输入：一组被判定为可能重复的记忆（已按从旧到新排好）。
 * 输出：{ canMerge, title, content, importance, reason }。
 * 内容为空时一律视为不可合并，调用方不需要再判断。
 */
export const generateMergedMemory = async ({ memories = [] }) => {
  if (memories.length < 2) {
    return {
      canMerge: false,
      title: '',
      content: '',
      importance: 3,
      reason: ''
    };
  }

  const result = await requestTidyCompletion({
    systemPrompt: MERGE_SYSTEM_PROMPT,
    userPrompt: buildMergeUserPrompt(memories)
  });

  const title = normalizeText(result?.title).slice(0, 60);
  const content = normalizeText(result?.content).slice(0, 500);

  return {
    canMerge: result?.canMerge === true && Boolean(content),
    title,
    content,
    importance: normalizeImportance(result?.importance),
    reason: normalizeText(result?.reason).slice(0, 120)
  };
};

/* ------------------------------------------------------------------ */
/* 情绪回顾                                                            */
/* ------------------------------------------------------------------ */

const EMOTION_REVIEW_SYSTEM_PROMPT = `
你负责为一段私人数字陪伴关系整理"情绪回顾"。下面是一段时间里零散记下的情绪痕迹，按从旧到新排列，每条带有归属、强度、正负向和标签（缺失的字段表示当时没有记录）。

你的职责：综合这些痕迹，看出这段时间里情绪的走向、反复出现的触发点，或者明显的转折，写成一条阶段性回顾。不要使用角色口吻，不要安慰，不要给建议，不要添加抒情语言。

规则：
1. 每条回顾必须建立在至少两条给定痕迹之上，不能编造，也不能只是复述其中一条。
2. subject 只能是 user（用户自己的情绪走向）、character（角色自己的情绪走向）或 relationship（两人之间情绪的互动与转折）。
3. 用户的情绪和角色的情绪要分开写，不要把用户的难过直接等同于角色的难过。
4. 强度和正负向只作为参考；缺失时直接忽略，不要自行猜测。
5. 不做诊断，不做医学或心理学判断，不评价谁对谁错。
6. 不要输出和"已有情绪回顾"里任意一条意思重复或高度相似的内容。
7. 最多输出 ${MAX_EMOTION_REVIEW_ITEMS} 条，没有值得写的新回顾就输出空数组，不要为了凑数硬写。
8. 每条必须给出 sourceMemoryIndexes：引用的是"情绪痕迹"列表里的序号（从 1 开始），不能编造不存在的序号。
9. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "reviews": [
    {
      "title": "不超过 30 字",
      "content": "一到三句话，克制、客观地写出这段时间的情绪走向或转折",
      "subject": "user | character | relationship",
      "importance": 3,
      "sourceMemoryIndexes": [1, 3]
    }
  ]
}
`;

const getEmotionSubjectText = (value) => ({
  user: '用户',
  character: '角色',
  shared: '两人之间'
}[value] || '未标明归属');

const getValenceText = (value) => ({
  positive: '偏正向',
  negative: '偏负向',
  mixed: '悲喜交加',
  neutral: '中性'
}[value] || '');

const buildEmotionTraceLine = (memory, index) => {
  const parts = [getEmotionSubjectText(memory.emotionSubject)];

  const intensity = Number(memory.emotionIntensity);

  if (
    memory.emotionIntensity !== null &&
    memory.emotionIntensity !== undefined &&
    Number.isFinite(intensity)
  ) {
    parts.push(`强度 ${Math.round(intensity * 100)}/100`);
  }

  const valenceText = getValenceText(memory.emotionValence);

  if (valenceText) {
    parts.push(valenceText);
  }

  if (memory.emotionTag) {
    parts.push(`标签 ${memory.emotionTag}`);
  }

  const dateText = memory.createdAt
    ? String(memory.createdAt).slice(0, 10)
    : '';

  return `${index + 1}. ${dateText ? `${dateText} ` : ''}[${parts.join('，')}] ${memory.title || ''}：${memory.content}`;
};

const buildEmotionReviewUserPrompt = ({
  emotionMemories,
  existingReviews
}) => {
  const traceLines = emotionMemories
    .map(buildEmotionTraceLine)
    .join('\n');

  const reviewLines = existingReviews
    .map((memory) => `- ${memory.title || ''}：${memory.content}`)
    .join('\n');

  return `
情绪痕迹（从旧到新）：
${traceLines}

已有情绪回顾（不要输出和这些重复的内容）：
${reviewLines || '无'}
`;
};

const normalizeReviewSubject = (value) => {
  if (
    value === MEMORY_SUBJECTS.USER ||
    value === MEMORY_SUBJECTS.CHARACTER ||
    value === MEMORY_SUBJECTS.RELATIONSHIP
  ) {
    return value;
  }

  return MEMORY_SUBJECTS.RELATIONSHIP;
};

const normalizeReviewItem = (item, emotionMemories) => {
  const validIndexes = new Set(
    emotionMemories.map((_, index) => index + 1)
  );

  const sourceMemoryIndexes = Array.isArray(item?.sourceMemoryIndexes)
    ? [...new Set(
        item.sourceMemoryIndexes
          .map(Number)
          .filter((index) => validIndexes.has(index))
      )]
    : [];

  return {
    title: normalizeText(item?.title).slice(0, 60),
    content: normalizeText(item?.content).slice(0, 400),
    subject: normalizeReviewSubject(item?.subject),
    importance: normalizeImportance(item?.importance),
    sourceMemoryIds: sourceMemoryIndexes
      .map((index) => emotionMemories[index - 1]?.memoryId)
      .filter(Boolean)
  };
};

/*
 * 输入：一批情绪记忆（emotionMemories，已按从旧到新排好）、
 * 已有的情绪回顾（existingReviews，用于避免重复）。
 * 输出：0 到 2 条规范化好的回顾条目，调用方负责真正落库。
 */
export const generateEmotionReview = async ({
  emotionMemories = [],
  existingReviews = []
}) => {
  if (emotionMemories.length < 2) {
    return [];
  }

  const result = await requestTidyCompletion({
    systemPrompt: EMOTION_REVIEW_SYSTEM_PROMPT,
    userPrompt: buildEmotionReviewUserPrompt({
      emotionMemories,
      existingReviews
    })
  });

  return Array.isArray(result?.reviews)
    ? result.reviews
      .map((item) => normalizeReviewItem(item, emotionMemories))
      .filter((item) => item.content && item.sourceMemoryIds.length >= 2)
      .slice(0, MAX_EMOTION_REVIEW_ITEMS)
    : [];
};