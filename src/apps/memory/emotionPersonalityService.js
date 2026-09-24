import db from '../../db';

import { generateEmotionPersonality } from './emotionPersonalityAiService';
import { applyGrowthNudge } from './memoryGrowth';

/*
 * 角色情绪人格画像的读取与刷新入口，缓存在 characters 表的 emotionPersonality
 * 字段上（附加字段，不需要 db 版本升级）。
 *
 * 分成"纯读取"和"按需刷新"两部分，这条界限很重要：
 * - getEmotionPersonality 只读 characters 表里已经缓存好的参数，不产生任何网络
 *   请求，memoryCharacterState.js（角色状态的纯读写层）可以放心在每次读状态时
 *   调用它，就跟 characterAbsenceService.js 顶部注释里说的"纯状态读写"原则
 *   一致——这里没有引入 AI 调用，只是多读了 characters 表一次。
 * - ensureEmotionPersonalityFresh 才会在必要时真正调用 AI 重新生成，只应该从
 *   后台的记忆调度器（memoryScheduler.js）里调用，不要放进发消息的主流程，
 *   避免让一次刷新画像的请求拖慢正常聊天。
 */

const DEFAULT_PERSONALITY = {
  decaySpeed: 0.5,
  settleSpeed: 0.5,
  sensitivity: 0.5
};

// 刷新失败后，同一份人设文本至少间隔这么久才重试，避免 API 未配置时
// 每次记忆调度都重新报错请求一次。
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

const normalizeText = (value) => String(value || '').trim();

const clamp01 = (value, fallback = 0.5) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numberValue));
};

const buildSourceSignature = (character) => (
  `${normalizeText(character?.bio)}${normalizeText(character?.extraNotes)}`
);

export const normalizeEmotionPersonality = (value) => ({
  decaySpeed: clamp01(value?.decaySpeed),
  settleSpeed: clamp01(value?.settleSpeed),
   sensitivity: clamp01(value?.sensitivity)
});

const getBasePersonality = async (characterId) => {
  if (!characterId) {
    return DEFAULT_PERSONALITY;
  }

  const character = await db.characters.get(characterId);

  if (!character?.emotionPersonality) {
    return DEFAULT_PERSONALITY;
   }

  return normalizeEmotionPersonality(character.emotionPersonality);
};

/*
 * 传了 chatId 时，会在人设生成的原始参数上叠加这个聊天里角色的"成长"带来的
 * 微调（memoryGrowth.js）。原始参数本身不会被改写；成长回落后，读到的就又是原样。
 * 不传 chatId 时行为跟以前完全一样。读成长失败时也退回原始参数。
 */
export const getEmotionPersonality = async (characterId, chatId = null) => {
  const base = await getBasePersonality(characterId);

  if (chatId === null || chatId === undefined || chatId === '') {
    return base;
  }

  try {
    const job = await db.memoryJobs
      .where('chatId')
      .equals(chatId)
      .first();

    const items = job?.growth?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return base;
    }

    return applyGrowthNudge(base, items);
  } catch (error) {
    console.warn('[EmotionPersonality] 读取成长微调失败，使用原始参数：', error);

    return base;
  }
};

/*
 * 人设文本（bio / extraNotes）没有变化时直接跳过，不重复调用 AI。
 * 同一份文本上一次刷新失败时，一小时内也不重试。
 * 调用方（memoryScheduler.js）需要自己 try/catch 之外再兜底一层，
 * 但这里本身也不会向上抛错——刷新失败只应该悄悄跳过，不能影响
 * 记忆提炼或角色状态的正常读写。
 */
export const ensureEmotionPersonalityFresh = async (characterId) => {
  if (!characterId) {
    return null;
  }

  try {
    const character = await db.characters.get(characterId);

    if (!character) {
      return null;
    }

    const signature = buildSourceSignature(character);
    const cached = character.emotionPersonality || null;

    // 已经是这份人设文本生成出来的结果，不用重新生成。
    if (cached?.sourceSignature === signature) {
      return null;
    }

    // 上一次针对同一份人设文本的尝试刚失败不久，先不重试。
    if (
      cached?.lastAttemptedSignature === signature &&
      cached?.lastError &&
      Date.now() - new Date(cached.lastAttemptAt || 0).getTime()
        < RETRY_AFTER_FAILURE_MS
    ) {
      return null;
    }

    const nowIso = new Date().toISOString();

    try {
      const generated = await generateEmotionPersonality({
        bio: character.bio,
        extraNotes: character.extraNotes
      });

      const nextProfile = {
        ...normalizeEmotionPersonality(generated),
        sourceSignature: signature,
        lastAttemptedSignature: signature,
        lastAttemptAt: nowIso,
        lastError: ''
      };

      await db.characters.update(characterId, {
        emotionPersonality: nextProfile
      });

      return nextProfile;
    } catch (error) {
      console.warn(
        '[EmotionPersonality] 生成角色情绪人格画像失败：',
        error
      );

      // 生成失败时保留上一次成功的参数（如果有），只更新尝试记录，
      // 这样角色状态计算仍然能用到最近一次有效的画像，而不是被清空回默认值。
      await db.characters.update(characterId, {
        emotionPersonality: {
          ...normalizeEmotionPersonality(cached),
          sourceSignature: cached?.sourceSignature || '',
          lastAttemptedSignature: signature,
          lastAttemptAt: nowIso,
          lastError: error?.message || '未知错误'
        }
      });

      return null;
    }
  } catch (error) {
    console.warn(
      '[EmotionPersonality] 刷新角色情绪人格画像时出错：',
      error
    );

    return null;
  }
};