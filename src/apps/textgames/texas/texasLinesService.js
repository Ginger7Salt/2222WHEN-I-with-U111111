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
        // 2026-10 修复：只发一条 role:'system' 消息，在某些网关/代理
        // （把 messages 转译成 Gemini 的 contents 字段那种）下会被判定
        // 成"contents is not specified"直接 400——这类网关认定"只有
        // system、没有任何 user 消息"不是合法请求。改成标准的
        // system+user 两条，跟 unoLinesService.js/undercoverAiService.js
        // 排查到的同一个问题、同一种修法。
        messages: [
          { role: 'system', content: '你是一个游戏内容生成助手，严格按用户给出的要求输出。' },
          { role: 'user', content: buildTexasLinesPrompt(character) },
        ],
        temperature: 0.9,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      console.warn(
        `[TexasLines] 接口返回非 200（状态码 ${response.status}），先用通用台词。`,
        bodyText.slice(0, 300)
      );
      return character;
    }

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