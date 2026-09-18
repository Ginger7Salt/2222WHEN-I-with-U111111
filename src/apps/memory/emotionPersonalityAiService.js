import db from '../../db';

/*
 * 角色情绪人格画像的 AI 调用层，风格与 memoryAiService.js / reflectionAiService.js
 * 保持一致（同一套本地 fetch + JSON 解析写法，记忆相关的每个子功能自带一份轻量
 * AI 调用代码，不共用一个全局 aiService）。
 *
 * 输入只是角色的人设文本（bio + extraNotes），输出是三个 0~1 的情绪性格参数，
 * 供 memoryCharacterState.js 和 characterAbsenceService.js 用来让"情绪衰退快慢、
 * 互动后安定快慢、对被冷落的敏感度"这些数值按角色性格区分，而不是全体角色
 * 共用同一套写死的速度。
 */

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
    throw new Error('情绪人格画像服务返回了空内容。');
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('情绪人格画像服务没有返回 JSON 对象。');
    }

    return parsed;
  } catch (initialError) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('情绪人格画像服务没有返回有效 JSON。');
    }

    try {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('情绪人格画像服务没有返回 JSON 对象。');
      }

      return parsed;
    } catch {
      throw new Error('情绪人格画像服务没有返回有效 JSON。');
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

const requestEmotionPersonalityCompletion = async ({ systemPrompt, userPrompt }) => {
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
    throw new Error('情绪人格画像服务返回了空内容。');
  }

  return parseJsonObject(content);
};

const buildSystemPrompt = () => `
你负责阅读一个虚拟角色的人设文本，从中判断这个角色在"情绪反应"上的性格倾向，
输出三个 0 到 1 之间的数值参数，供程序用来让角色的情绪衰退、平复速度按角色性格
区分，不再是所有角色共用同一套速度。

你不是在写角色的台词或设定简介，只输出参数评分，不要解释、不要客套。

三个参数的含义：
1. decaySpeed：角色的情绪（尤其是失落、想念这类负面情绪）随时间自然平复、
   回到平时状态的速度。数值越低代表这个角色一旦难过就会持续很久、不容易走出来；
   数值越高代表这个角色情绪来得快去得也快。
2. settleSpeed：用户重新出现、开始互动之后，角色情绪被"当下的陪伴"抚平的速度。
   数值越低代表角色需要一段时间的哄或陪伴才能真正好起来，哪怕用户已经回来了；
   数值越高代表角色一见到用户几乎立刻就没事了。
3. sensitivity：角色对"被冷落、用户很久没来"这类情况的敏感程度，以及角色情绪
   反应的整体强度。数值越低代表角色比较迟钝或大大咧咧，要很久才会有感觉、
   反应也比较轻；数值越高代表角色比较敏感细腻，很快就会想念或失落，反应也更
   强烈。

规则：
1. 0.5 代表"普通、不特别偏向任何一边"，仅在人设文本明确体现某种倾向时才远离
   0.5。
2. 人设文本信息不足、模糊或没有明显情绪倾向时，三个参数都应接近 0.5，不要
   臆测。
3. 三个参数互相独立，不必然相关；性格温柔不代表 decaySpeed 一定低。
4. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "decaySpeed": 0.5,
  "settleSpeed": 0.5,
  "sensitivity": 0.5
}
`;

const buildUserPrompt = ({ bio, extraNotes }) => `
角色简介（Bio）：
${bio || '无'}

角色补充设定（Extra Notes）：
${extraNotes || '无'}
`;

const clamp01 = (value, fallback = 0.5) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numberValue));
};

/*
 * 人设文本完全为空时不必调用 AI —— 没有任何依据，结果只会是三个 0.5，
 * 直接本地返回即可，省一次请求。
 */
export const generateEmotionPersonality = async ({ bio, extraNotes }) => {
  const normalizedBio = normalizeText(bio);
  const normalizedNotes = normalizeText(extraNotes);

  if (!normalizedBio && !normalizedNotes) {
    return { decaySpeed: 0.5, settleSpeed: 0.5, sensitivity: 0.5 };
  }

  const result = await requestEmotionPersonalityCompletion({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt({
      bio: normalizedBio,
      extraNotes: normalizedNotes
    })
  });

  return {
    decaySpeed: clamp01(result?.decaySpeed),
    settleSpeed: clamp01(result?.settleSpeed),
    sensitivity: clamp01(result?.sensitivity)
  };
};