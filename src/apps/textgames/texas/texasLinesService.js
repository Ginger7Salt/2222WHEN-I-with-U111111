// src/apps/textgames/texas/texasLinesService.js
//
// 角色专属德州扑克台词：第一次和某个角色同桌之前，按 TA 的人设让大模型
// 生成一套台词并缓存在 character.texasLines（不需要升数据库版本，是
// characters 表上新增的无索引字段），之后不再调用。做法跟 UNO 的
// ensureUnoLines 完全一致（见 uno/unoLinesService.js 开头注释）。任何
// 一步失败都静默退回 texasLines.js 里的通用兜底句子，不影响开局。

import { db } from '../../../db';

import {
  buildTexasLinesPrompt,
  hasCompleteTexasLines,
  parseTexasLines,
} from './texasLinesParse';

const REQUEST_TIMEOUT_MS = 12000;

export const ensureTexasLines = async (character) => {
  if (!character) return character;
  if (hasCompleteTexasLines(character)) return character;

  let timer = null;
  try {
    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) return character;

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: buildTexasLinesPrompt(character) }],
        temperature: 0.9,
      }),
    });
    if (!response.ok) return character;

    const data = await response.json();
    const parsed = parseTexasLines(data?.choices?.[0]?.message?.content || '');
    if (!parsed) return character;

    if (character.id) {
      await db.characters.update(character.id, { texasLines: parsed.lines });
    }
    return { ...character, texasLines: parsed.lines };
  } catch (error) {
    console.warn('[TexasLines] 台词生成失败，先用通用台词。', error);
    return character;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// 两位同桌一起准备，互不拖累。
export const ensureTexasLinesForTable = async (characters) =>
  Promise.all((characters || []).map((c) => ensureTexasLines(c)));