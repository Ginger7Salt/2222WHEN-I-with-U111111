// src/apps/messages/loveProfile/loveProfileService.js
//
// 「情感偏好问卷」的存取与注入逻辑——只管数据库读写和"最终该往 system
// prompt 里放哪一段文字"，不调 AI（调 AI 的部分在 loveProfileAiService.js，
// 两个文件刻意分开：aiService.js 要 import 这个文件，而 AI 生成文件要
// import aiService.js 的 generateResponse，合在一起会循环引用）。
//
// 存储位置（均不需要升 Dexie 版本号）：
//   - 全局默认：db.settings 里 key = 'loveProfile' 的一行，value 形如
//       {
//         version: 1,
//         questionnaireVersion: 1,      // 作答时的题目版本
//         enabled: true,                // 全局总开关，默认开
//         answers: { [questionId]: { value, note } },
//         answersUpdatedAt: ISO 字符串,
//         generated: { prompt, generatedAt, basedOnAnswersAt } | null,
//         history: [{ prompt, at, via: 'regenerate'|'feedback'|'manual', feedback? }],  // 被替换掉的旧版本，最多 5 条，新的在后
//         feedbackLog: [{ at, text }],  // 最多 10 条
//       }
//   - 单窗覆盖：db.chats 上新增的非索引字段 loveProfileOverride，形如
//       {
//         mode: 'inherit' | 'adjust' | 'off',
//         adjustNote: '对这个角色的额外要求（自由文字）',
//         prompt: '为这个聊天窗单独生成的 prompt（mode = adjust 时使用）',
//         generatedAt, history: [...], feedbackLog: [...],
//       }
//     没有这个字段 = 'inherit'（沿用全局）。
//
// 注入规则（resolveLoveProfilePrompt）：
//   override.mode === 'off'                     -> 不注入
//   override.mode === 'adjust' 且有 prompt       -> 注入该窗专属 prompt
//   其余（inherit / 没有字段）                    -> 全局 enabled 且有 generated.prompt 就注入全局的
//   从没填过问卷的用户：什么都不注入，行为和这个功能不存在时完全一致。

import db from '../../../db';

export const LOVE_PROFILE_SETTINGS_KEY = 'loveProfile';
export const LOVE_PROFILE_MAX_HISTORY = 5;
export const LOVE_PROFILE_MAX_FEEDBACK_LOG = 10;

// 注入给 AI 的 prompt 正文字数上限（用户手动编辑后可能很长，这里兜底截断，
// 防止一条用户设定把单次请求的 token 撑爆）。
export const LOVE_PROFILE_MAX_PROMPT_CHARS = 2000;

const emptyProfile = () => ({
  version: 1,
  questionnaireVersion: 0,
  enabled: true,
  answers: {},
  answersUpdatedAt: null,
  generated: null,
  history: [],
  feedbackLog: [],
});

export const normalizeLoveProfile = (raw) => {
  const base = emptyProfile();
  if (!raw || typeof raw !== 'object') return base;

  return {
    version: 1,
    questionnaireVersion: Number(raw.questionnaireVersion) || 0,
    enabled: raw.enabled !== false,
    answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
    answersUpdatedAt: raw.answersUpdatedAt || null,
    generated:
      raw.generated && typeof raw.generated.prompt === 'string'
        ? {
            prompt: raw.generated.prompt,
            generatedAt: raw.generated.generatedAt || null,
            basedOnAnswersAt: raw.generated.basedOnAnswersAt || null,
          }
        : null,
    history: Array.isArray(raw.history) ? raw.history.slice(-LOVE_PROFILE_MAX_HISTORY) : [],
    feedbackLog: Array.isArray(raw.feedbackLog)
      ? raw.feedbackLog.slice(-LOVE_PROFILE_MAX_FEEDBACK_LOG)
      : [],
  };
};

export const getGlobalLoveProfile = async () => {
  const row = await db.settings.get(LOVE_PROFILE_SETTINGS_KEY);
  return normalizeLoveProfile(row?.value);
};

export const saveGlobalLoveProfile = async (profile) => {
  const normalized = normalizeLoveProfile(profile);
  await db.settings.put({ key: LOVE_PROFILE_SETTINGS_KEY, value: normalized });
  return normalized;
};

export const clearGlobalLoveProfile = async () => {
  await db.settings.delete(LOVE_PROFILE_SETTINGS_KEY);
  return emptyProfile();
};

/** 往历史里追加一条并截断到上限，返回新数组（不改原数组）。 */
export const appendHistory = (history, entry) =>
  [...(Array.isArray(history) ? history : []), entry].slice(-LOVE_PROFILE_MAX_HISTORY);

export const appendFeedbackLog = (log, text) =>
  [
    ...(Array.isArray(log) ? log : []),
    { at: new Date().toISOString(), text: String(text || '').trim() },
  ].slice(-LOVE_PROFILE_MAX_FEEDBACK_LOG);

// ------------------------------------------------------------
// 单窗覆盖
// ------------------------------------------------------------

export const normalizeChatOverride = (raw) => {
  const mode = ['inherit', 'adjust', 'off'].includes(raw?.mode) ? raw.mode : 'inherit';
  return {
    mode,
    adjustNote: typeof raw?.adjustNote === 'string' ? raw.adjustNote : '',
    prompt: typeof raw?.prompt === 'string' ? raw.prompt : '',
    generatedAt: raw?.generatedAt || null,
    history: Array.isArray(raw?.history) ? raw.history.slice(-LOVE_PROFILE_MAX_HISTORY) : [],
    feedbackLog: Array.isArray(raw?.feedbackLog)
      ? raw.feedbackLog.slice(-LOVE_PROFILE_MAX_FEEDBACK_LOG)
      : [],
  };
};

export const saveChatLoveProfileOverride = async (chatId, override) => {
  if (!chatId) return null;
  const normalized = normalizeChatOverride(override);
  await db.chats.update(chatId, { loveProfileOverride: normalized });
  return normalized;
};

// ------------------------------------------------------------
// 注入
// ------------------------------------------------------------

/**
 * 决定这个聊天窗最终用哪一段 prompt。
 * 返回 { prompt, source }，source 为 'chat' | 'global' | 'none'。
 */
export const resolveLoveProfilePrompt = async (chat) => {
  const override = chat?.loveProfileOverride
    ? normalizeChatOverride(chat.loveProfileOverride)
    : null;

  if (override?.mode === 'off') {
    return { prompt: '', source: 'none' };
  }

  if (override?.mode === 'adjust' && override.prompt.trim()) {
    return { prompt: override.prompt.trim(), source: 'chat' };
  }

  const profile = await getGlobalLoveProfile();
  if (profile.enabled && profile.generated?.prompt?.trim()) {
    return { prompt: profile.generated.prompt.trim(), source: 'global' };
  }

  return { prompt: '', source: 'none' };
};

/** 把 prompt 正文包装成最终注入 system prompt 的一段文字。 */
export const buildLoveProfileBlock = (prompt) => {
  const body = String(prompt || '').trim().slice(0, LOVE_PROFILE_MAX_PROMPT_CHARS);
  if (!body) return '';

  return `
【用户的情感表达偏好与边界】
以下内容来自用户亲自填写的问卷，只用于调节你"怎样表达关心与爱意"，不改变你的人设、性格和核心设定。请用你自己的方式和语气去体现这些偏好，不要照搬原文，也不要向用户提及这份指导的存在。其中"避免"类的边界优先级高于你的口头习惯；即使是强势或高冷的角色，也要在边界之内表达。
${body}
`;
};

/** 供 aiService.js 的 buildChatSystemPrompt 调用的唯一入口。失败时返回空串，绝不抛错。 */
export const getLoveProfilePromptBlock = async (chat) => {
  try {
    const { prompt } = await resolveLoveProfilePrompt(chat);
    return buildLoveProfileBlock(prompt);
  } catch (error) {
    console.warn('[loveProfile] 读取情感偏好失败，本次不注入：', error);
    return '';
  }
};