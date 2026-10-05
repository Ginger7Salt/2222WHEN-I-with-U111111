// src/apps/textgames/uno/unoLinesService.js
//
// 角色专属 UNO 台词：第一次和某个角色玩之前，按 TA 的人设让大模型生成一套
// 台词并缓存在 character.unoLines（不需要升数据库版本，是 characters 表上
// 新增的无索引字段），之后不再调用。做法和戳一戳的 ensurePokeReplies 一致。
// 任何一步失败都静默退回 unoLines.js 里的通用兜底句子，不影响开局。

import { db } from '../../../db';

import {
  buildUnoLinesPrompt,
  hasCompleteUnoLines,
  parseUnoLines,
} from './unoLinesParse';

const REQUEST_TIMEOUT_MS = 12000;

// 返回带上 unoLines 的角色对象（失败时原样返回）。
export const ensureUnoLines = async (character) => {
  if (!character) return character;
  if (hasCompleteUnoLines(character)) return character;

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
        // system+user 两条，跟 undercoverAiService.js 排查到的同一个
        // 问题、同一种修法。
        messages: [
          { role: 'system', content: '你是一个游戏内容生成助手，严格按用户给出的要求输出。' },
          { role: 'user', content: buildUnoLinesPrompt(character) },
        ],
        temperature: 0.9,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      console.warn(
        `[UnoLines] 接口返回非 200（状态码 ${response.status}），先用通用台词。`,
        bodyText.slice(0, 300)
      );
      return character;
    }

    const data = await response.json();
    const parsed = parseUnoLines(data?.choices?.[0]?.message?.content || '');
    if (!parsed) return character;

    if (character.id) {
      await db.characters.update(character.id, { unoLines: parsed.lines });
    }
    return { ...character, unoLines: parsed.lines };
  } catch (error) {
    console.warn('[UnoLines] 台词生成失败，先用通用台词。', error);
    return character;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// 两位同桌一起准备，互不拖累。
export const ensureUnoLinesForTable = async (characters) =>
  Promise.all((characters || []).map((c) => ensureUnoLines(c)));