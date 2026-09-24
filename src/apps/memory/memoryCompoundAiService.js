import db from '../../db';

import { MOOD_KEYS } from './memoryCharacterState';

/*
 * 复合情绪的 AI 调用层，跟其他记忆子功能一样自带一份轻量的本地 fetch + JSON 解析。
 * 只负责"问 AI、把结果规范化"，不读写 memories 表，落库在
 * memoryEmotionCompoundService.js。
 *
 * 两个用途：
 *   1. judgeCompoundResolution：这批新消息里，某份还没消解的复合情绪是不是被
 *      安慰、被解释、或者自己想通了。
 *   2. nameUnmatchedEmotions：本地合成表认不出的几条情绪，能不能合成一个名字。
 */

const MAX_NAMED_COMPOUNDS = 1;

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
    throw new Error('复合情绪服务返回了空内容。');
  }

  const tryParse = (text) => {
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('复合情绪服务没有返回 JSON 对象。');
    }

    return parsed;
  };

  try {
    return tryParse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('复合情绪服务没有返回有效 JSON。');
    }

    try {
      return tryParse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error('复合情绪服务没有返回有效 JSON。');
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

const requestCompletion = async ({ systemPrompt, userPrompt }) => {
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
      temperature: 0.2,
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
    throw new Error('复合情绪服务返回了空内容。');
  }

  return parseJsonObject(content);
};

const clamp = (value, min, max, fallback) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return Math.max(min, Math.min(max, numberValue));
};

/* ------------------------------------------------------------------ */
/* 判断复合情绪有没有被化解                                             */
/* ------------------------------------------------------------------ */

const RESOLUTION_SYSTEM_PROMPT = `
你负责判断一段私人数字陪伴关系里，某些积累下来的"复合情绪"在最新的对话里有没有被化解。
每份复合情绪有归属：角色（角色自己心里的情绪）或用户（用户近来的情绪）。

你的职责：只看最新对话，判断每份情绪是彻底化解了、有所缓和，还是没有变化。不要使用角色口吻，不要安慰，不要添加抒情语言。

规则：
1. 只有对话里出现了针对这份情绪成因的实质性回应，才算化解或缓和：对方温柔地安慰、说明原因、认真道歉并给出说法、给出明确的保证或陪伴；或者情绪的主人自己明确表示想通了、好多了、放下了。
2. 普通闲聊、转移话题、顺口一句"没事"或"哦"、敷衍的表情或应付，都不算化解，outcome 必须是 unchanged。
3. 归属是角色的情绪：看用户有没有安慰、解释或回应；或者角色自己有没有明确表示好点了。
4. 归属是用户的情绪：看角色有没有安慰、开解，且用户有没有表示好些、接受；用户没有任何好转迹象时，最多算 eased。
5. resolved 只用于明确、彻底地化解；有所缓和但还没完全过去用 eased，并给出 relief（0.2 到 0.6 的小数）；resolved 时 relief 给 1。
6. by 只能是 comfort（被安慰）、explanation（被解释清楚了）、self（自己想通了）、other（其他）之一。
7. 拿不准就选 unchanged。宁可多留一会儿，也不要凭空判定情绪消失了。
8. reason 用一句话说明依据，指出对话里的哪一句起了作用。
9. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "results": [
    {
      "index": 1,
      "outcome": "resolved | eased | unchanged",
      "by": "comfort | explanation | self | other",
      "relief": 1,
      "reason": "一句话"
    }
  ]
}
`;

const getSubjectText = (subject) => ({
  user: '用户',
  character: '角色',
  shared: '两人之间'
}[subject] || '未标明');

const getSenderText = (sender) => (
  sender === 'user' ? '用户' : '角色'
);

const buildResolutionUserPrompt = ({ compounds, messages }) => `
待判断的复合情绪：
${compounds
    .map((compound, index) => (
      `${index + 1}. 归属：${getSubjectText(compound.emotionSubject)}；${compound.title}：${compound.content}`
    ))
    .join('\n')}

最新对话（从旧到新）：
${messages
    .map((message) => `[${getSenderText(message.sender)}] ${normalizeText(message.content).slice(0, 400)}`)
    .join('\n')}
`;

const RESOLUTION_OUTCOMES = ['resolved', 'eased', 'unchanged'];
const RESOLUTION_BY = ['comfort', 'explanation', 'self', 'other'];

/*
 * 输入：复合情绪列表、这一批新消息（{ sender, content }）。
 * 输出：每份复合情绪一条结果 { compound, outcome, by, relief, reason }，
 * 没被 AI 提到的一律视为 unchanged。
 */
export const judgeCompoundResolution = async ({
  compounds = [],
  messages = []
}) => {
  if (!compounds.length || !messages.length) {
    return [];
  }

  const result = await requestCompletion({
    systemPrompt: RESOLUTION_SYSTEM_PROMPT,
    userPrompt: buildResolutionUserPrompt({ compounds, messages })
  });

  const byIndex = new Map();

  for (const item of Array.isArray(result?.results) ? result.results : []) {
    const index = Number(item?.index);

    if (Number.isInteger(index) && index >= 1 && index <= compounds.length) {
      byIndex.set(index, item);
    }
  }

  return compounds.map((compound, position) => {
    const item = byIndex.get(position + 1);

    const outcome = RESOLUTION_OUTCOMES.includes(item?.outcome)
      ? item.outcome
      : 'unchanged';

    return {
      compound,
      outcome,
      by: RESOLUTION_BY.includes(item?.by) ? item.by : 'other',
      relief: outcome === 'resolved'
        ? 1
        : outcome === 'eased'
          ? clamp(item?.relief, 0.15, 0.6, 0.3)
          : 0,
      reason: normalizeText(item?.reason).slice(0, 120)
    };
  });
};

/* ------------------------------------------------------------------ */
/* 给认不出的情绪命名                                                   */
/* ------------------------------------------------------------------ */

const NAMING_SYSTEM_PROMPT = `
你负责整理一段私人数字陪伴关系里零散的情绪痕迹。下面是同一个人近期的几条情绪，程序的固定规则没能把它们归类。

你的职责：判断它们能不能自然地合成一种更复杂的情绪，比如"又期待又害怕""愧疚而不安""如释重负"。不要使用角色口吻，不要安慰，不要添加抒情语言。

规则：
1. 只有当这几条情绪确实围绕同一件事或同一种处境、放在一起有更准确的说法时，才合成；只是碰巧同期出现的无关情绪，不要合成。
2. 最多输出 ${MAX_NAMED_COMPOUNDS} 条；没有值得合成的就输出空数组，不要凑数。
3. 每条必须引用至少两条痕迹的序号（sourceIndexes，从 1 开始），不能编造不存在的序号。
4. name 是 2 到 6 个字的情绪名称；content 用一句话客观说明这份情绪是怎么来的，不要使用"昨天、今天、最近"这类相对时间词。
5. valence 只能是 positive、negative、mixed、neutral 之一。
6. intensity 是 0 到 1 的小数，以痕迹里实际表现出来的程度为准。
7. 只有当情绪归属是角色时，才可以给 moodDelta，用来轻微推动角色心情，字段只能从这些里选：${MOOD_KEYS.join('、')}；每个值在 -0.3 到 0.3 之间。归属是用户时 moodDelta 必须为 null。
8. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "compounds": [
    {
      "name": "又期待又害怕",
      "content": "一句话",
      "valence": "mixed",
      "intensity": 0.6,
      "sourceIndexes": [1, 2],
      "moodDelta": null
    }
  ]
}
`;

const buildNamingUserPrompt = ({ emotions, subject }) => `
情绪归属：${getSubjectText(subject)}

情绪痕迹（从旧到新）：
${emotions
    .map((memory, index) => {
      const intensity = Number(memory.emotionIntensity);

      const intensityText = Number.isFinite(intensity)
        ? `，强度 ${Math.round(intensity * 100)}/100`
        : '';

      return `${index + 1}. [${memory.emotionTag || '无标签'}${intensityText}] ${memory.title || ''}：${memory.content}`;
    })
    .join('\n')}
`;

const VALENCES = ['positive', 'negative', 'mixed', 'neutral'];

const normalizeMoodDelta = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const result = {};

  for (const key of MOOD_KEYS) {
    if (value[key] === undefined) continue;

    const numberValue = Number(value[key]);

    if (Number.isFinite(numberValue)) {
      result[key] = Math.max(-0.3, Math.min(0.3, numberValue));
    }
  }

  return Object.keys(result).length ? result : null;
};

/*
 * 输入：同一归属下、本地规则认不出的几条情绪（从旧到新）。
 * 输出：0 到 1 条 { name, content, valence, intensity, sourceMemoryIds, moodDelta }。
 */
export const nameUnmatchedEmotions = async ({
  emotions = [],
  subject = 'user'
}) => {
  if (emotions.length < 2) {
    return [];
  }

  const result = await requestCompletion({
    systemPrompt: NAMING_SYSTEM_PROMPT,
    userPrompt: buildNamingUserPrompt({ emotions, subject })
  });

  const validIndexes = new Set(emotions.map((_, index) => index + 1));

  return (Array.isArray(result?.compounds) ? result.compounds : [])
    .map((item) => {
      const sourceIndexes = Array.isArray(item?.sourceIndexes)
        ? [...new Set(item.sourceIndexes.map(Number).filter((index) => validIndexes.has(index)))]
        : [];

      return {
        name: normalizeText(item?.name).slice(0, 12),
        content: normalizeText(item?.content).slice(0, 200),
        valence: VALENCES.includes(item?.valence) ? item.valence : 'mixed',
        intensity: clamp(item?.intensity, 0.3, 0.95, 0.5),
        sourceMemoryIds: sourceIndexes
          .map((index) => emotions[index - 1]?.memoryId)
          .filter(Boolean),
        moodDelta: subject === 'user' ? null : normalizeMoodDelta(item?.moodDelta)
      };
    })
    .filter((item) => item.name && item.content && item.sourceMemoryIds.length >= 2)
    .slice(0, MAX_NAMED_COMPOUNDS);
};