// src/apps/textgames/skull/skullLinesService.js
//
// 角色专属骷髅牌台词：第一次和某个角色玩之前，按 TA 的人设让大模型生成一
// 套台词并缓存在 character.skullLines（不需要升数据库版本，是 characters
// 表上新增的无索引字段），之后不再调用。做法和 unoLinesService 一致。
// NPC（没有数据库 id、也没有人设）直接跳过。任何一步失败都静默退回
// skullLines.js 里的通用兜底句子，不影响开局。

import { db } from '../../../db';

import {
  buildSkullLinesPrompt,
  hasCompleteSkullLines,
  parseSkullLines,
} from './skullLinesParse';

// 单次请求最长等多久才放弃。骷髅牌要一次生成八种场合的台词，比较长，
// 慢一点的模型（尤其是带思考的）经常超过 12 秒，所以放宽到 60 秒。
const REQUEST_TIMEOUT_MS = 60000;
// 开局前最多等这么久：超过就先用通用台词开局，请求不会被掐断，继续在后台
// 跑，成功后照样缓存进 character.skullLines，下一局就能用上。
export const TABLE_MAX_WAIT_MS = 15000;

// 返回带上 skullLines 的角色对象（失败时原样返回）。
export const ensureSkullLines = async (character) => {
  if (!character || character.isNpc) return character;
  if (hasCompleteSkullLines(character)) return character;

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
        // 只发一条 role:'system' 消息，在某些网关/代理（把 messages 转译成
        // Gemini 的 contents 字段那种）下会被判定成“contents is not
        // specified”直接 400。所以沿用 unoLinesService 的写法：标准的
        // system + user 两条。
        messages: [
          { role: 'system', content: '你是一个游戏内容生成助手，严格按用户给出的要求输出。' },
          { role: 'user', content: buildSkullLinesPrompt(character) },
        ],
        temperature: 0.9,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      console.warn(
        `[SkullLines] 接口返回非 200（状态码 ${response.status}），先用通用台词。`,
        bodyText.slice(0, 300)
      );
      return character;
    }

    const data = await response.json();
    const parsed = parseSkullLines(data?.choices?.[0]?.message?.content || '');
    if (!parsed) return character;

    if (character.id) {
      await db.characters.update(character.id, { skullLines: parsed.lines });
    }
    return { ...character, skullLines: parsed.lines };
  } catch (error) {
    console.warn('[SkullLines] 台词生成失败，先用通用台词。', error);
    return character;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// 几位真人角色一起准备，互不拖累。NPC 原样返回。最多等 maxWaitMs：超时的
// 角色这一局先用通用台词，它的请求会在后台继续，下一局就能用上专属台词。
export const ensureSkullLinesForTable = async (
  characters,
  { maxWaitMs = TABLE_MAX_WAIT_MS } = {}
) =>
  Promise.all(
    (characters || []).map((character) => {
      let timer = null;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
          if (!hasCompleteSkullLines(character) && !character?.isNpc) {
            console.info('[SkullLines] 台词还没生成完，这一局先用通用台词，生成会在后台继续。');
          }
          resolve(character);
        }, maxWaitMs);
      });
      // ensureSkullLines 内部已经 try/catch，不会 reject。
      return Promise.race([ensureSkullLines(character), timeout]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    })
  );