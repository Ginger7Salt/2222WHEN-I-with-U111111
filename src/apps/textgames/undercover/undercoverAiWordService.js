// src/apps/textgames/undercover/undercoverAiWordService.js
//
// "谁是卧底"的 AI 生成词对——用户在开局前可以选"内置词库"或"AI 现场生成"
// 两种来源之一（见设计确认）。AI 生成失败（没配接口/请求出错/解析不出
// 两个词）时安静退回内置词库的随机一对，不中断开局流程。
//
// 跟 witchsPoisonAiService.js 的直接 fetch 写法保持一致，不依赖某个
// chatId（这里没有单一绑定聊天的概念，开局前还没定哪个角色的聊天要用），
// 直接从 db.settings 读 apiConfig。

import db from '../../../db';
import { pickRandomWordPair } from './undercoverWordBank';

const REQUEST_TIMEOUT_MS = 12000;

const parseWordPair = (text) => {
  const civilianMatch = text.match(/平民词[：:]\s*(\S+)/);
  const undercoverMatch = text.match(/卧底词[：:]\s*(\S+)/);
  const civilian = civilianMatch?.[1]?.trim();
  const undercover = undercoverMatch?.[1]?.trim();
  if (!civilian || !undercover || civilian === undercover) return null;
  return { civilian, undercover };
};

// recentPairs：最近用过的词对（civilian 字段），让提示词里避开，减少
// AI 生成的新词对跟最近几局撞车的概率；不是强约束，AI 偶尔还是可能重复。
export const generateAiWordPair = async (recentPairs = []) => {
  const fallback = () => pickRandomWordPair(recentPairs);

  let timer = null;
  try {
    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) return fallback();

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const avoidLine = recentPairs?.length
      ? `请避开这些最近用过的平民词：${recentPairs.map((p) => p?.civilian).filter(Boolean).join('、')}。`
      : '';

    const systemPrompt = `请为"谁是卧底"这个游戏生成一对词语：一个"平民词"和一个"卧底词"。

要求：
- 两个词必须是同一类事物、意思相近，但有明显区别，适合用来描述辨认（比如"苹果"和"梨"、"咖啡"和"茶"）；
- 不要选太抽象、太生僻、或者容易混用的词；
- 不要包含任何 Emoji；
${avoidLine}

严格按下面格式输出，不要有其他内容：
平民词：<词>
卧底词：<词>`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 1.0,
      }),
    });
    if (!response.ok) return fallback();

    const data = await response.json();
    const parsed = parseWordPair(data?.choices?.[0]?.message?.content || '');
    return parsed || fallback();
  } catch (error) {
    console.warn('[UndercoverAiWordService] AI 生成词对失败，退回内置词库。', error);
    return fallback();
  } finally {
    if (timer) clearTimeout(timer);
  }
};