// src/apps/messages/fandomCharacterService.js
//
// 同人角色的「原作设定/世界观」+「强提醒」一次性 AI 生成。单独的一次性
// 请求，不写进聊天记录，也不进聊天的总提示词本身——结果存进角色资料的
// character.fandom 字段，之后由 src/services/aiService.js 的
// buildChatSystemPrompt 在组装主聊天系统提示词时读取、拼进去（只覆盖
// 主聊天场景，RP/线下模式/戳一戳等暂不接入，是跟用户确认过的范围）。
//
// 跟 src/services/outfitAiService.js 一样用 generateResponse + 超时
// 包装；AI 输出按 src/apps/messages/interactions/pokeService.js 的
// 办法解析——剥掉代码块围栏再 JSON.parse。解析失败就直接把错误抛给
// 调用方展示，不用猜测兜底内容顶替：设定文本这种东西生成失败了应该
// 让用户知道，自己决定要不要重试或手写，不像戳一戳那种小反应可以
// 静默退回通用文案。
//
// character.fandom 的默认形状 + 拼进系统提示词的文本块被单独放在
// fandomCharacterPrompt.js（不 import 任何东西）——这个文件要 import
// generateResponse，如果把两边合并，aiService.js 反过来 import 这个
// 文件就会变成循环引用。这里原样转出那两个辅助函数，方便外部统一从
// 这一个文件取用。

import { generateResponse } from '../../services/aiService';
import {
  createDefaultFandomProfile,
  normalizeFandomProfile,
  buildFandomSystemPromptBlock,
} from './fandomCharacterPrompt';

export { createDefaultFandomProfile, normalizeFandomProfile, buildFandomSystemPromptBlock };

const REQUEST_TIMEOUT_MS = 60000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('请求超时，再试一次吧')), ms);
  }),
]);

const buildGenerationPrompt = ({ sourceWork, referenceMaterial }) => {
  const trimmedRef = String(referenceMaterial || '').trim();

  const materialBlock = trimmedRef
    ? `用户提供的参考资料：\n${trimmedRef}\n\n请基于这份参考资料整理归纳，不要编造资料中没有、也不符合原作的内容。`
    : `用户没有提供参考资料，请凭你自己对《${sourceWork}》这部作品的了解来写。如果你对这部作品不熟悉，也请给出合理、不夸张编造细节的概括性设定。`;

  return `你是一个资深的"同人设定资料员"，现在要为一个基于已有作品的同人角色整理背景设定。

作品名称：《${sourceWork}》

${materialBlock}

请严格只输出一个 JSON 对象，不要输出代码块围栏、编号或任何多余说明，格式如下：
{"setting": "原作设定/世界观正文，分段表述", "reminder": "一句话强提醒"}

要求：
- setting 字段：大致 200-500 字，涵盖这部作品的世界观背景，以及这个角色在原作中的身份、处境、关键人物关系，供后续 AI 对话时参考，不需要逐字复刻原文，只需准确传达设定。
- reminder 字段：不超过 40 字，核心是提醒 AI"这是《${sourceWork}》里的同人角色"这件事，可以参考"这是《${sourceWork}》里的角色，请始终记得ta的原作背景"这类写法，但不要逐字照抄这个例句。
- 全站零 Emoji。`;
};

const parseGenerationResult = (rawText) => {
  const cleaned = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI 返回的内容不是预期的格式，再试一次吧');
  }

  const setting = String(parsed?.setting || '').trim();
  const reminder = String(parsed?.reminder || '').trim();

  if (!setting) {
    throw new Error('生成结果里没有设定正文，再试一次吧');
  }

  return { setting, reminder };
};

// 生成一份「原作设定」+「强提醒」草稿。调用方负责把结果填进可编辑的
// 文本框，不在这里直接写回 db——用户可能要先看一眼、改一改，再点保存。
export const generateFandomDraft = async ({ sourceWork, referenceMaterial }) => {
  const trimmedWork = String(sourceWork || '').trim();

  if (!trimmedWork) {
    throw new Error('请先填写作品名称');
  }

  const prompt = buildGenerationPrompt({ sourceWork: trimmedWork, referenceMaterial });

  const rawText = await withTimeout(
    generateResponse([
      { role: 'system', content: prompt },
      { role: 'user', content: '请按要求的 JSON 格式输出。' },
    ]),
    REQUEST_TIMEOUT_MS,
  );

  return parseGenerationResult(rawText);
};