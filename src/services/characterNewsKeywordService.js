// src/services/characterNewsKeywordService.js
//
// 角色自己聊新闻时要搜什么关键词：从角色的 bio/extraNotes 里让 AI
// 提炼一个能代表 TA 职业/主要兴趣的搜索关键词（比如纹身师就提炼出
// "纹身艺术"），缓存在角色资料的 newsSearchKeyword 字段上，隔几天
// 才让 AI 重新想一次——既避免角色的"兴趣"每条消息都在变，也避免
// 每次都要多调用一次 AI。
//
// 直连 chat/completions，不走 aiService.js 的 generateResponse——
// dailyLifeTopicPicker.js 以后会被 aiService.js 的 buildChatSystemPrompt
// 引用，如果这里反过来 import aiService.js，就会形成一个循环依赖
// （aiService → dailyLifeTopicPicker → 这个文件 → aiService）。做法
// 跟 pokeService.js 的 ensurePokeReplies 是同一个理由、同一套写法。
import db from '../db';

const KEYWORD_REFRESH_MS = 5 * 24 * 60 * 60 * 1000; // 5 天

export const ensureCharacterNewsKeyword = async (character) => {
  if (!character?.id) return '';

  const updatedAt = character.newsSearchKeywordUpdatedAt
    ? new Date(character.newsSearchKeywordUpdatedAt).getTime()
    : 0;
  const isFresh = updatedAt > 0 && (Date.now() - updatedAt) < KEYWORD_REFRESH_MS;
  const cachedKeyword = typeof character.newsSearchKeyword === 'string'
    ? character.newsSearchKeyword.trim()
    : '';

  // 缓存还在有效期内：哪怕缓存是空字符串（代表上次问过 AI，人设里确实
  // 没有明确的职业/兴趣），也直接用，不在刷新窗口内重复调用 AI。
  if (isFresh) {
    return cachedKeyword;
  }

  try {
    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return cachedKeyword;
    }

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const systemPrompt = `角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

请从这个角色的人设里，提炼一个最能代表TA职业或主要兴趣爱好的搜索关键词，
用来帮TA搜索这个领域的最新资讯（例如角色是纹身师，就给"纹身艺术"；
角色是程序员，就给"编程技术"）。

严格要求：
- 只输出这一个关键词或短语本身，2 到 8 个汉字（或对应长度的英文词组）；
- 如果人设里完全看不出任何具体职业或爱好，只输出：无；
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

    await db.characters.update(character.id, {
      newsSearchKeyword: keyword,
      newsSearchKeywordUpdatedAt: new Date().toISOString(),
    });

    return keyword;
  } catch (error) {
    console.warn(
      '[characterNewsKeywordService] 提炼角色新闻关键词失败，先用旧缓存顶上。',
      error
    );

    return cachedKeyword;
  }
};