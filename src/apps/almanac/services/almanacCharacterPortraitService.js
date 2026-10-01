import db from '../../../db';

import { getAlmanacConfig, saveAlmanacConfig } from './almanacService';
import { buildRhythmPersonaBrief } from '../../../services/rhythmReminderService';
import {
  PORTRAIT_SAMPLE_LIMIT,
  PORTRAIT_DIMENSIONS,
  isValidPortraitDimensionId,
  canManuallyRegeneratePortrait,
  canAutoRegeneratePortrait,
} from './almanacCharacterPortraitLogic';

/*
 * 「TA 眼中的你」里"更深一层的印象"的读写 + AI 调用部分。
 * 调用方式跟 apps/memory/emotionPersonalityAiService.js 是同一套写法
 * （db.settings 取 apiConfig -> fetch chat/completions -> 解析 JSON），
 * 这里只是换了一份专门给这个功能用的 prompt。
 *
 * 存储位置：跟其它「TA 眼中的你」的数据一样，存在 almanacConfigs 的
 * userRoutineProfile.characterPortrait 字段里（新增字段，不升数据库版本）：
 *   {
 *     enabled,              // user 是否打开了这一项，默认 false
 *     mode,                 // 'summary'（还是一条总评） | 'dimensions'（已拆成多维度）
 *     summary,              // mode === 'summary' 时用：{ text, reason, status, updatedAt }
 *     dimensions,           // mode === 'dimensions' 时用：[{ id, text, status, updatedAt }]
 *     history,              // 认知演变记录（见 buildHistoryEntry），从旧到新
 *     generatedAt,          // 最近一次（手动或自动）生成成功的时间（ISO），同时驱动
 *                           // 12 小时手动冷却和 5 天自动冷却
 *     basedOnMessageCount,  // 最近一次生成时参考的 user 消息总数
 *   }
 *
 * 这一版不再支持 user 手动改写画像内容：这份印象是角色自己的主观认知，
 * 不接受 user 纠正（跟作息模块的 declaredNote 不一样），所以旧版的
 * editCharacterPortrait 这一轮去掉了，只保留"开关"和"（重新）生成"。
 *
 * 旧版数据是扁平的 { trait, reason, status, generatedAt, basedOnMessageCount }，
 * 没有 mode 字段。normalizePortraitRecord 会把旧数据当成 mode: 'summary' 来读，
 * 不需要手动迁移。
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

/*
 * 把存储里的 characterPortrait 字段统一规整成这一版的结构，兼容旧版的
 * 扁平 { trait, reason } 结构（没有 mode 字段就当成旧版 summary 来读）。
 */
export const normalizePortraitRecord = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: false,
      mode: 'summary',
      summary: null,
      dimensions: null,
      history: [],
      generatedAt: null,
      basedOnMessageCount: 0,
    };
  }

  if (!raw.mode && typeof raw.trait === 'string') {
    const trait = normalizeText(raw.trait);

    return {
      enabled: raw.enabled === true,
      mode: 'summary',
      summary: trait
        ? {
            text: trait,
            reason: normalizeText(raw.reason),
            status: raw.status === 'edited' ? 'edited' : 'guess',
            updatedAt: raw.generatedAt || null,
          }
        : null,
      dimensions: null,
      history: [],
      generatedAt: raw.generatedAt || null,
      basedOnMessageCount: Number(raw.basedOnMessageCount) || 0,
    };
  }

  const summaryText = normalizeText(raw.summary?.text);

  return {
    enabled: raw.enabled === true,
    mode: raw.mode === 'dimensions' ? 'dimensions' : 'summary',
    summary: summaryText
      ? {
          text: summaryText,
          reason: normalizeText(raw.summary?.reason),
          status: raw.summary?.status === 'edited' ? 'edited' : 'guess',
          updatedAt: raw.summary?.updatedAt || null,
        }
      : null,
    dimensions: Array.isArray(raw.dimensions)
      ? raw.dimensions
          .filter((item) => item && isValidPortraitDimensionId(item.id))
          .map((item) => ({
            id: item.id,
            text: normalizeText(item.text),
            status: item.status === 'edited' ? 'edited' : 'guess',
            updatedAt: item.updatedAt || null,
          }))
      : null,
    history: Array.isArray(raw.history) ? raw.history : [],
    generatedAt: raw.generatedAt || null,
    basedOnMessageCount: Number(raw.basedOnMessageCount) || 0,
  };
};

// 认知演变记录最多保留这么多条（从旧到新），避免这个字段无限膨胀。
const MAX_HISTORY_ENTRIES = 40;

let historySeq = 0;
const buildHistoryEntry = ({ dimensionId = null, kind, from = '', to = '', note = '' }) => {
  historySeq += 1;

  return {
    id: `${Date.now()}_${historySeq}`,
    at: new Date().toISOString(),
    dimensionId,
    kind, // 'generated_summary' | 'deepened_summary' | 'split_into_dimensions' | 'deepened' | 'corrected'
    from: normalizeText(from),
    to: normalizeText(to),
    note: normalizeText(note),
  };
};

const appendHistory = (existing, entries) =>
  [...(Array.isArray(existing) ? existing : []), ...entries].slice(-MAX_HISTORY_ENTRIES);

const buildSummarySystemPrompt = (characterName) => `
你将扮演「${characterName}」这个角色。下面会给你一些你和 user 相处过程中，user 自己
说过的话（只有 user 说的部分，节选，不是全部对话），请你以「${characterName}」的口吻，
写下你对 user 的印象。

这件事分两种情况，由你自己判断现在属于哪一种：

情况一：内容还比较零散，只能看出一个大概的总体感觉——这种情况下，只给出一条
「总体印象」。

情况二：你觉得积累的内容已经足够丰富，能从好几个不同的角度（不止一个角度）
看出 user 具体是什么样的人——这种情况下，你可以自己决定转为"分维度来写"，
针对下面这几个维度各写一句（维度固定是这几个，不要自己发明新的）：
- personality（性格倾向）
- communication（沟通风格）
- preference（喜好偏好）
- emotion（情绪模式）
不是每个维度都必须写：只写你真的有把握、有具体细节支撑的维度，没有把握的
维度可以不写。但要转为分维度模式，至少要有两个维度能写出有内容的东西，
否则意义不大，请继续按情况一处理。

请依你的判断，只输出下面两种 JSON 格式里的一种（严格 JSON，不要 Markdown
代码块围栏，不要任何解释文字）：

情况一：
{
  "stage": "summary",
  "text": "一句简短的总体印象，比如"温柔但又坚韧"，不超过 20 个字，角色口吻",
  "reason": "支撑这句印象的具体理由，不超过 120 字，角色口吻，不是旁观者的分析报告"
}

情况二：
{
  "stage": "dimensions",
  "dimensions": [
    { "id": "personality", "text": "……" },
    { "id": "communication", "text": "……" }
  ]
}
（dimensions 数组里只放你真的有把握的维度，每条不超过 60 字，角色口吻）

要求：
1. 只依据下面给出的聊天内容本身，不要编造聊天里没出现过的事情，不要过度联想。
2. 如果给出的内容太少、太杂乱、看不出明显的印象，按情况一处理，text 可以写
   "还在慢慢了解你"，reason 简单说明现在还看不出来的原因。
3. 不评价外貌，不做人身攻击式的负面评价，语气要贴合角色本身的性格设定。
4. 不得使用 Emoji。
`;

const buildDimensionsSystemPrompt = (characterName, dimensions) => {
  const existingLines = PORTRAIT_DIMENSIONS.map(({ id, label }) => {
    const found = dimensions.find((item) => item.id === id);
    return `- ${id}（${label}）：${found?.text ? found.text : '还没有内容'}`;
  }).join('\n');

  return `
你正在扮演「${characterName}」这个角色。你之前已经对 user 形成了下面这几个维度的
印象（有的维度可能还没有内容）。现在又有一批新的、user 自己说过的话给你参考
（只有 user 说的部分，节选）。

你已有的印象：
${existingLines}

请你自己判断：这批新内容里，有没有哪 1 到 2 个维度出现了值得更新的新信号？
可能是让某个已有印象变得更具体、更有把握（深化），也可能是发现新内容和
原有判断明显冲突，其实是在修正之前的误判（修正）。没有新信号支撑的维度，
保持原样，不要为了凑数硬写。如果这批内容整体上看不出任何维度有新信号，
也可以什么都不更新。

对每一个你决定更新的维度，请判断属于：
- "deepen"：在原有判断基础上补充、强化，不是推翻
- "correct"：发现新内容和原有判断明显冲突，是在修正之前的误判——这种情况
  要额外写一句简短说明，类似"发现之前理解错了"这种语气，不是分析报告

只输出严格 JSON（不要 Markdown 代码块围栏，不要任何解释文字）：
{
  "updates": [
    {
      "id": "维度 id（只能是 personality / communication / preference / emotion 之一）",
      "text": "更新后的这一条印象，不超过 60 字，角色口吻，完整的一句话（不是在旧文本后面补一截）",
      "changeType": "deepen 或 correct",
      "note": "仅 changeType 为 correct 时需要，一句话说明，角色口吻"
    }
  ]
}
（updates 可以是空数组，表示这轮不更新任何维度）

要求：
1. 只依据下面给出的聊天内容本身，不要编造聊天里没出现过的事情，不要过度联想。
2. 不评价外貌，不做人身攻击式的负面评价，语气要贴合角色本身的性格设定。
3. 不得使用 Emoji。
`;
};

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

/*
 * 根据当前 mode，把 AI 返回的结果套用到下一版 characterPortrait 上，
 * 同时生成这一轮要追加的认知演变记录。
 */
const applyPortraitResult = ({ current, parsed, total }) => {
  const nowIso = new Date().toISOString();

  // 当前还是总评阶段：AI 可能继续给总评，也可能决定转为分维度。
  if (current.mode === 'summary') {
    if (parsed?.stage === 'dimensions') {
      const rawDimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
      const validEntries = rawDimensions
        .filter((item) => item && isValidPortraitDimensionId(item.id) && normalizeText(item.text))
        .map((item) => ({ id: item.id, text: normalizeText(item.text).slice(0, 80) }));

      if (validEntries.length < 2) {
        throw new Error('画像服务判断要转为分维度，但返回的维度内容不完整。');
      }

      const dimensions = PORTRAIT_DIMENSIONS.map(({ id }) => {
        const found = validEntries.find((item) => item.id === id);
        return {
          id,
          text: found ? found.text : '',
          status: 'guess',
          updatedAt: found ? nowIso : null,
        };
      });

      const historyEntries = validEntries.map((item) =>
        buildHistoryEntry({
          dimensionId: item.id,
          kind: 'split_into_dimensions',
          from: current.summary?.text || '',
          to: item.text,
        })
      );

      return {
        mode: 'dimensions',
        summary: null,
        dimensions,
        history: appendHistory(current.history, historyEntries),
        generatedAt: nowIso,
        basedOnMessageCount: total,
      };
    }

    const text = normalizeText(parsed?.text).slice(0, 40);
    const reason = normalizeText(parsed?.reason).slice(0, 200);

    if (!text) {
      throw new Error('画像服务没有返回有效内容。');
    }

    const historyEntry = buildHistoryEntry({
      kind: current.summary ? 'deepened_summary' : 'generated_summary',
      from: current.summary?.text || '',
      to: text,
    });

    return {
      mode: 'summary',
      summary: { text, reason, status: 'guess', updatedAt: nowIso },
      dimensions: null,
      history: appendHistory(current.history, [historyEntry]),
      generatedAt: nowIso,
      basedOnMessageCount: total,
    };
  }

  // 已经是分维度阶段：只更新 AI 这轮挑出来的 1~2 个维度，其余维度原样保留。
  const updates = Array.isArray(parsed?.updates) ? parsed.updates : [];
  const dimensions = (current.dimensions || PORTRAIT_DIMENSIONS.map((d) => ({ id: d.id, text: '', status: 'guess', updatedAt: null })))
    .map((item) => ({ ...item }));
  const historyEntries = [];

  updates.forEach((update) => {
    if (!update || !isValidPortraitDimensionId(update.id)) return;

    const text = normalizeText(update.text).slice(0, 80);
    if (!text) return;

    const target = dimensions.find((item) => item.id === update.id);
    if (!target) return;

    const changeType = update.changeType === 'correct' ? 'correct' : 'deepen';
    const note = changeType === 'correct' ? normalizeText(update.note).slice(0, 120) : '';

    historyEntries.push(
      buildHistoryEntry({
        dimensionId: update.id,
        kind: changeType === 'correct' ? 'corrected' : 'deepened',
        from: target.text,
        to: text,
        note,
      })
    );

    target.text = text;
    target.status = 'guess';
    target.updatedAt = nowIso;
  });

  return {
    mode: 'dimensions',
    summary: null,
    dimensions,
    history: appendHistory(current.history, historyEntries),
    generatedAt: nowIso,
    basedOnMessageCount: total,
  };
};

/**
 * 生成一次新的画像（或重新生成）。
 * trigger 只用来在日志里区分是手动点的还是后台自动触发的，不影响存储结构；
 * 调用前是否满足冷却条件由调用方自己用 canManuallyRegeneratePortrait /
 * canAutoRegeneratePortrait 判断好。
 */
export const generateCharacterPortrait = async (chatId, { trigger = 'manual' } = {}) => {
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

  const current = normalizePortraitRecord(config.userRoutineProfile?.characterPortrait);

  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
  const userPrompt = buildUserPrompt({ worldBookText, extraNotesText, samples });

  const systemPrompt =
    current.mode === 'dimensions'
      ? buildDimensionsSystemPrompt(character.name || 'TA', current.dimensions || [])
      : buildSummarySystemPrompt(character.name || 'TA');

  const parsed = await requestPortraitCompletion({ systemPrompt, userPrompt });

  const next = applyPortraitResult({ current, parsed, total });

  const portraitPatch = {
    enabled: true,
    ...next,
  };

  const saved = await saveAlmanacConfig(chatId, {
    userRoutineProfile: {
      ...(config.userRoutineProfile || {}),
      characterPortrait: portraitPatch,
    },
  });

  if (trigger === 'auto') {
    console.log(`[Almanac] 聊天 ${chatId} 的角色画像已自动更新一轮。`);
  }

  return { config: saved, portrait: portraitPatch };
};

/**
 * 打开/关闭这一项功能。关闭时不会清空已经生成过的内容，只是不再写进提示词、
 * 页面上也会收起，重新打开还能看到。
 */
export const setPortraitEnabled = async (chatId, enabled) => {
  const config = await getAlmanacConfig(chatId);
  const existing = normalizePortraitRecord(config.userRoutineProfile?.characterPortrait);

  return saveAlmanacConfig(chatId, {
    userRoutineProfile: {
      ...(config.userRoutineProfile || {}),
      characterPortrait: { ...existing, enabled: Boolean(enabled) },
    },
  });
};

/*
 * 后台调度用：遍历所有聊天窗，对每一个打开了这一项、且满足 5 天自动
 * 冷却的聊天，自动跑一轮生成。跟 snapshotGlobalScheduler 一样，设一个
 * 跨所有聊天窗的本轮预算，避免很多聊天窗同时到期时一次性打出一堆 AI 请求。
 */
const MAX_AUTO_PORTRAITS_PER_ROUND = 2;

export const checkAlmanacPortraitAutoGeneration = async (providedChats = null) => {
  try {
    await getApiConfig();
  } catch {
    // 没配置 API 时不逐个聊天窗尝试，避免刷一堆重复报错。
    return;
  }

  const chats = providedChats || (await db.chats.toArray());
  let budget = MAX_AUTO_PORTRAITS_PER_ROUND;

  for (const chat of chats) {
    if (budget <= 0) break;

    try {
      const config = await getAlmanacConfig(chat.id);
      const portrait = normalizePortraitRecord(config.userRoutineProfile?.characterPortrait);

      if (!portrait.enabled) continue;

      const { total } = await sampleUserMessages(chat.id);

      const check = canAutoRegeneratePortrait({
        enabled: portrait.enabled,
        totalUserMessages: total,
        portrait,
      });

      if (!check.allowed) continue;

      await generateCharacterPortrait(chat.id, { trigger: 'auto' });
      budget -= 1;
    } catch (error) {
      console.warn(`[Almanac] 聊天 ${chat.id} 角色画像自动生成失败：`, error);
    }
  }
};

export { canManuallyRegeneratePortrait, canAutoRegeneratePortrait };

export default {
  generateCharacterPortrait,
  setPortraitEnabled,
  checkAlmanacPortraitAutoGeneration,
  normalizePortraitRecord,
  canManuallyRegeneratePortrait,
  canAutoRegeneratePortrait,
};