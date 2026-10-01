// src/services/userInterestKeywordService.js
//
// 角色主动分享"用户感兴趣的事"时用的素材来源：从这个聊天里积累的
// PREFERENCE（偏好与习惯）用户记忆里，找出反复出现、能算作一个稳定兴趣
// 方向的内容，让 AI 提炼成一个可以拿去搜资讯的关键词。跟
// characterNewsKeywordService 是同一个思路，区别是素材来自用户记忆，
// 不是角色人设。
//
// 结果缓存在 almanac 的「TA 眼中的你」画像（userRoutineProfile）同一个
// 配置对象里，新加一个 userInterestProfile 字段，隔几天刷新一次——理由
// 跟 characterNewsKeywordService 一样：避免角色"记得的兴趣"一成不变，
// 也避免每次都多调用一次 AI。
//
// 直连 chat/completions，不走 aiService.js 的 generateResponse——理由也
// 跟 characterNewsKeywordService 一样：dailyLifeTopicPicker.js 会被
// aiService.js 的 buildChatSystemPrompt 引用，这个文件又会被
// dailyLifeTopicPicker.js 引用，如果反过来 import aiService.js 就会
// 形成循环依赖。
import db from '../db';
import { getChatMemory } from '../apps/memory/memoryService';
import {
  MEMORY_TYPES,
  MEMORY_SUBJECTS,
  RECALLABLE_MEMORY_STATUSES,
} from '../apps/memory/memoryConstants';
import { getAlmanacConfig, saveAlmanacConfig } from '../apps/almanac/services/almanacService';

const KEYWORD_REFRESH_MS = 5 * 24 * 60 * 60 * 1000; // 5 天，跟角色新闻关键词保持一致
const MIN_PREFERENCE_MEMORIES = 2; // 至少攒够这么多条用户偏好记忆，才值得问一次 AI 有没有稳定兴趣

export const ensureUserInterestKeyword = async (chatId) => {
  if (!chatId) return '';

  const config = await getAlmanacConfig(chatId);
  const cached = config.userInterestProfile || {};
  const updatedAt = cached.updatedAt ? new Date(cached.updatedAt).getTime() : 0;
  const isFresh = updatedAt > 0 && (Date.now() - updatedAt) < KEYWORD_REFRESH_MS;
  const cachedKeyword = typeof cached.keyword === 'string' ? cached.keyword.trim() : '';

  // 缓存还在有效期内：哪怕是空字符串（代表上次问过 AI，没找出明确的稳定
  // 兴趣方向），也直接用，不在刷新窗口内重复调用 AI。
  if (isFresh) {
    return cachedKeyword;
  }

  try {
    const memories = await getChatMemory(chatId);
    const preferenceTexts = memories
      .filter((memory) => (
        memory.type === MEMORY_TYPES.PREFERENCE
        && memory.subject === MEMORY_SUBJECTS.USER
        && RECALLABLE_MEMORY_STATUSES.includes(memory.status)
        && memory.content
      ))
      .map((memory) => memory.content);

    // 偏好记忆太少，不够判断是不是"稳定的兴趣"，先不提炼，也不写入缓存
    // （不刷新 updatedAt），等攒够了下次自然会再检查一次。
    if (preferenceTexts.length < MIN_PREFERENCE_MEMORIES) {
      return cachedKeyword;
    }

    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return cachedKeyword;
    }

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const systemPrompt = `以下是从跟用户的聊天里零散记下的几条"用户的偏好/习惯"记忆：
${preferenceTexts.map((text, index) => `${index + 1}. ${text}`).join('\n')}

请判断这些记忆里有没有反复出现、能算作用户一个稳定兴趣爱好的方向（必须被至少两条不同的记忆印证，不要只凭一条孤立的记忆下判断）。
如果有，提炼出一个最能代表这个兴趣方向的搜索关键词，用来帮用户搜索这个领域的最新资讯（例如多条记忆都提到用户喜欢摄影，就给"摄影"）。

严格要求：
- 只输出这一个关键词或短语本身，2 到 8 个汉字（或对应长度的英文词组）；
- 如果看不出任何反复出现、足够稳定的兴趣方向，只输出：无；
- 不要输出任何标点、引号、解释或其他文字。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      return cachedKeyword;
    }

    const data = await response.json();
    const rawText = (data?.choices?.[0]?.message?.content || '').trim();
    const keyword = (!rawText || rawText === '无' || rawText.length > 30)
      ? ''
      : rawText;

    await saveAlmanacConfig(chatId, {
      userInterestProfile: {
        ...cached,
        keyword,
        updatedAt: new Date().toISOString(),
      },
    });

    return keyword;
  } catch (error) {
    console.warn(
      '[userInterestKeywordService] 提炼用户兴趣关键词失败，先用旧缓存顶上。',
      error
    );

    return cachedKeyword;
  }
};

export default {
  ensureUserInterestKeyword,
};