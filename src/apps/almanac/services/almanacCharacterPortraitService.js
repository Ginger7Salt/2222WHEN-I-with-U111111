import db from '../../../db';

import { getAlmanacConfig, saveAlmanacConfig } from './almanacService';
import { buildRhythmPersonaBrief } from '../../../services/rhythmReminderService';
import { PORTRAIT_SAMPLE_LIMIT, canManuallyRegeneratePortrait } from './almanacCharacterPortraitLogic';

/*
 * 「TA 眼中的你」里"更深一层的印象"的读写 + AI 调用部分。
 * 调用方式跟 apps/memory/emotionPersonalityAiService.js 是同一套写法
 * （db.settings 取 apiConfig -> fetch chat/completions -> 解析 JSON），
 * 这里只是换了一份专门给这个功能用的 prompt。
 *
 * 存储位置：跟其它「TA 眼中的你」的数据一样，存在 almanacConfigs 的
 * userRoutineProfile.characterPortrait 字段里（新增字段，不升数据库版本）：
 *   {
 *     enabled,             // user 是否打开了这一项，默认 false
 *     trait,               // 一句简短印象，比如"温柔但又坚韧"
 *     reason,              // 支撑这句印象的理由
 *     status,              // 'guess' AI 写的 | 'edited' user 自己改过
 *     generatedAt,         // 最近一次生成时间（ISO）
 *     basedOnMessageCount, // 生成时参考的 user 消息总数
 *   }
 */

const normalizeText = (value) => String(value || '').trim();

const stripJsonFence = (value) =>
  normalizeText(value)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const parseJsonObject = (content) => {
  const cleaned = stripJsonFence(content);

  if (!cleaned) {
    throw new Error('画像服务返回了空内容。');
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('画像服务没有返回 JSON 对象。');
    }

    return parsed;
  } catch (initialError) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('画像服务没有返回有效 JSON。');
    }

    try {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('画像服务没有返回 JSON 对象。');
      }

      return parsed;
    } catch {
      throw new Error('画像服务没有返回有效 JSON。');
    }
  }
};

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error('还没有配置可用的 API Base URL 或 API Key。');
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

const buildSystemPrompt = (characterName) => `
你将扮演「${characterName}」这个角色。下面会给你一些你和 user 相处过程中，user 自己
说过的话（只有 user 说的部分，节选，不是全部对话），请你以「${characterName}」的口吻，
写一句你眼里 user 是个什么样的人，并说明理由。

要求：
1. trait 是一句简短的印象，比如"温柔但又坚韧"，不超过 20 个字，用角色的语气来概括，
   不要用"数据显示""统计表明"这类分析式的措辞。
2. reason 是支撑这句印象的具体理由，要基于下面聊天内容里真实出现过的细节，
   不超过 120 字，同样是角色的口吻，不是旁观者的分析报告。
3. 只依据给出的聊天内容本身，不要编造聊天里没出现过的事情，不要过度联想。
4. 如果给出的内容太少、太杂乱、看不出明显的印象，trait 可以写"还在慢慢了解你"，
   reason 简单说明现在还看不出来的原因。
5. 不评价外貌，不做人身攻击式的负面评价，语气要贴合角色本身的性格设定。
6. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "trait": "……",
  "reason": "……"
}
`;

const buildUserPrompt = ({ worldBookText, extraNotesText, samples }) => `
【角色人设参考】${worldBookText}${extraNotesText}

【user 最近说过的一些话，按时间从早到晚排列，只是节选】
${samples.map((text, index) => `${index + 1}. ${text}`).join('\n')}
`;

const requestPortraitCompletion = async ({ systemPrompt, userPrompt }) => {
  const apiConfig = await getApiConfig();
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const detail = await getErrorDetail(response);
    throw new Error(`[API Error ${response.status}] ${detail}`);
  }

  const payload = await response.json();
  const content = normalizeText(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('画像服务返回了空内容。');
  }

  return parseJsonObject(content);
};

/*
 * 均匀地从 user 说过的话里挑一些出来给 AI 参考，而不是只看最近几条——
 * 印象应该来自整体相处，不是只看当下心情。贴纸、空内容不参与。
 */
const sampleUserMessages = async (chatId) => {
  let messages = [];

  try {
    messages = await db.messages.where('chatId').equals(chatId).toArray();
  } catch (error) {
    console.warn('[Almanac] 读取消息失败：', error);
    return { samples: [], total: 0 };
  }

  const usable = messages
    .filter(
      (message) =>
        message &&
        message.sender === 'user' &&
        message.type !== 'sticker' &&
        typeof message.content === 'string' &&
        message.content.trim()
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const total = usable.length;

  if (!total) return { samples: [], total: 0 };

  const limit = Math.min(PORTRAIT_SAMPLE_LIMIT, total);
  const step = total / limit;
  const picked = [];

  for (let i = 0; i < limit; i += 1) {
    const index = Math.min(total - 1, Math.floor(i * step));
    picked.push(usable[index]);
  }

  return {
    samples: picked.map((message) => normalizeText(message.content).slice(0, 200)),
    total,
  };
};

/**
 * 生成一次新的画像（或重新生成），直接覆盖已存的那份。
 * 只在 user 手动点按钮时调用，不在页面加载时自动触发。
 */
export const generateCharacterPortrait = async (chatId) => {
  if (!chatId) throw new Error('缺少聊天 ID。');

  const config = await getAlmanacConfig(chatId);
  const chat = await db.chats.get(chatId);

  if (!chat) throw new Error('没找到这个聊天。');

  const character = await db.characters.get(chat.characterId);

  if (!character) throw new Error('没找到对应的角色。');

  const { samples, total } = await sampleUserMessages(chatId);

  if (!samples.length) {
    throw new Error('还没有足够可参考的聊天内容。');
  }

  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

  const result = await requestPortraitCompletion({
    systemPrompt: buildSystemPrompt(character.name || 'TA'),
    userPrompt: buildUserPrompt({ worldBookText, extraNotesText, samples }),
  });

  const trait = normalizeText(result?.trait).slice(0, 40);
  const reason = normalizeText(result?.reason).slice(0, 200);

  if (!trait) {
    throw new Error('画像服务没有返回有效内容。');
  }

  const portraitPatch = {
    enabled: true,
    trait,
    reason,
    status: 'guess',
    generatedAt: new Date().toISOString(),
    basedOnMessageCount: total,
  };

  const saved = await saveAlmanacConfig(chatId, {
    userRoutineProfile: {
      ...(config.userRoutineProfile || {}),
      characterPortrait: portraitPatch,
    },
  });

  return { config: saved, portrait: portraitPatch };
};

/**
 * 打开/关闭这一项功能。关闭时不会清空已经生成过的内容，只是不再写进提示词、
 * 页面上也会收起，重新打开还能看到。
 */
export const setPortraitEnabled = async (chatId, enabled) => {
  const config = await getAlmanacConfig(chatId);
  const existing = config.userRoutineProfile?.characterPortrait || null;

  return saveAlmanacConfig(chatId, {
    userRoutineProfile: {
      ...(config.userRoutineProfile || {}),
      characterPortrait: existing
        ? { ...existing, enabled: Boolean(enabled) }
        : { enabled: Boolean(enabled), trait: '', reason: '' },
    },
  });
};

/**
 * user 自己改写画像内容，改过之后标记为 'edited'，往后不会被自动覆盖
 * （目前也没有自动覆盖的逻辑，但先按这个约定存好，方便以后加）。
 */
export const editCharacterPortrait = async (chatId, { trait, reason }) => {
  const config = await getAlmanacConfig(chatId);
  const existing = config.userRoutineProfile?.characterPortrait || {};

  return saveAlmanacConfig(chatId, {
    userRoutineProfile: {
      ...(config.userRoutineProfile || {}),
      characterPortrait: {
        ...existing,
        enabled: true,
        trait: normalizeText(trait).slice(0, 40),
        reason: normalizeText(reason).slice(0, 200),
        status: 'edited',
        updatedAt: new Date().toISOString(),
      },
    },
  });
};

export { canManuallyRegeneratePortrait };

export default {
  generateCharacterPortrait,
  setPortraitEnabled,
  editCharacterPortrait,
  canManuallyRegeneratePortrait,
};