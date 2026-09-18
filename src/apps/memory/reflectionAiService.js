import db from '../../db';

import {
  MEMORY_CONFIDENCES,
  MEMORY_SUBJECTS
} from './memoryConstants';

/*
 * 反思机制的 AI 调用层，风格上跟 memoryAiService.js 保持一致
 * （同一套本地 fetch + JSON 解析写法，不共用一个全局 aiService，
 * 这是这个项目里“记忆相关的每个子功能自带一份轻量 AI 调用代码”的既有写法）。
 *
 * 和 memoryAiService 不同的是：这里的输入不是原始对话消息，
 * 而是已经提炼好的一批 memories——对应斯坦福 Generative Agents 论文里
 * “从具体记忆里综合出更高层认知”的思路，只做整合，不重新读聊天记录。
 */

const MAX_REFLECTION_ITEMS = 3;

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
    throw new Error('反思生成服务返回了空内容。');
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('反思生成服务没有返回 JSON 对象。');
    }

    return parsed;
  } catch (initialError) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('反思生成服务没有返回有效 JSON。');
    }

    try {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('反思生成服务没有返回 JSON 对象。');
      }

      return parsed;
    } catch {
      throw new Error('反思生成服务没有返回有效 JSON。');
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

const requestReflectionCompletion = async ({ systemPrompt, userPrompt }) => {
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
      temperature: 0.4,
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
    throw new Error('反思生成服务返回了空内容。');
  }

  return parseJsonObject(content);
};

const buildSystemPrompt = () => `
你负责在一段私人数字陪伴关系里，把已经积累的一批具体记忆综合成更高层的阶段性反思。

你的职责不是复述细节，也不是写聊天回复。不要使用角色口吻，不要安慰用户，不要添加抒情语言。
你要做的是"综合"：从多条具体记忆里看出一个还没被明确写下来的规律、理解或阶段性认知。

规则：
1. 每条反思必须建立在至少两条给定的具体记忆之上，不能凭空编造，也不能只是复述其中一条记忆的原话。
2. subject 只能是 user（关于用户的更深理解）、character（角色对自己当前状态的觉察）或 relationship（关于这段关系本身的理解）。
3. 不要输出和"已有反思"里任意一条意思重复或高度相似的内容。
4. 最多输出 ${MAX_REFLECTION_ITEMS} 条，没有值得写的新反思就输出空数组，不要为了凑数硬写。
5. 每条反思必须给出 sourceMemoryIndexes：引用的是"具体记忆"列表里的序号（从 1 开始），不能编造不存在的序号。
6. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "reflections": [
    {
      "title": "不超过 30 字",
      "content": "一到两句话，克制、客观地写出这条阶段性认知",
      "subject": "user | character | relationship",
      "importance": 1,
      "sourceMemoryIndexes": [1, 3]
    }
  ]
}
`;

const buildUserPrompt = ({ sourceMemories, existingReflections }) => {
  const memoryLines = sourceMemories
    .map((memory, index) => (
      `${index + 1}. [${memory.type}] ${memory.title || ''}：${memory.content}`
    ))
    .join('\n');

  const reflectionLines = existingReflections
    .map((memory) => `- ${memory.title || ''}：${memory.content}`)
    .join('\n');

  return `
具体记忆（从旧到新，供你综合参考）：
${memoryLines}

已有反思（不要输出和这些重复的内容）：
${reflectionLines || '无'}
`;
};

const normalizeSubject = (value) => {
  if (Object.values(MEMORY_SUBJECTS).includes(value)) {
    return value === MEMORY_SUBJECTS.SHARED
      ? MEMORY_SUBJECTS.RELATIONSHIP
      : value;
  }

  return MEMORY_SUBJECTS.RELATIONSHIP;
};

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(numberValue)));
};

const normalizeReflectionItem = (item, sourceMemories) => {
  const validIndexes = new Set(sourceMemories.map((_, index) => index + 1));

  const sourceMemoryIndexes = Array.isArray(item?.sourceMemoryIndexes)
    ? [...new Set(
        item.sourceMemoryIndexes
          .map(Number)
          .filter((index) => validIndexes.has(index))
      )]
    : [];

  const sourceMemoryIds = sourceMemoryIndexes
    .map((index) => sourceMemories[index - 1]?.memoryId)
    .filter(Boolean);

  return {
    title: normalizeText(item?.title).slice(0, 60),
    content: normalizeText(item?.content).slice(0, 400),
    subject: normalizeSubject(item?.subject),
    importance: normalizeImportance(item?.importance),
    confidence: MEMORY_CONFIDENCES.INFERRED,
    sourceMemoryIds
  };
};

/*
 * 输入：这个聊天里已经生效的一批具体记忆（sourceMemories，
 * 由调用方按"最近 + 重要"挑好，不在这里读表），以及已有的反思记忆
 * （existingReflections，用于避免重复）。
 * 输出：0~3 条规范化好的反思条目，调用方负责真正写入 memories 表。
 */
export const generateReflections = async ({
  sourceMemories = [],
  existingReflections = []
}) => {
  if (sourceMemories.length < 2) {
    return [];
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ sourceMemories, existingReflections });

  const result = await requestReflectionCompletion({
    systemPrompt,
    userPrompt
  });

  const reflections = Array.isArray(result?.reflections)
    ? result.reflections
      .map((item) => normalizeReflectionItem(item, sourceMemories))
      .filter((item) => item.content && item.sourceMemoryIds.length >= 2)
      .slice(0, MAX_REFLECTION_ITEMS)
    : [];

  return reflections;
};