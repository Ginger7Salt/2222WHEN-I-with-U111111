// src/apps/textgames/twoTruthsOneLie/twoTruthsOneLieAiService.js
//
// "两个真话，一个假话"需要AI做三件事，都走 interactionAiService.js 里已有
// 的 getGenerationContext/requestAiText（一次性的纯 system prompt，不走
// aiService.js 的主回复管线，这些都是游戏内部状态判断，不是真要发进聊天
// 记录的角色台词）：
//
// 1. generateCharacterStatements：角色说三句关于自己的话（两真一假）。
//    "哪句是假的"不让模型决定位置——模型只按"真话一/真话二/假话"的固定
//    格式输出，由这里用代码随机打乱顺序，避免模型总把假话放在同一个位置。
// 2. guessUserLie：用户写好的三句话发给角色，角色猜哪句是假的。用户标记
//    的假话位置从头到尾不会发给AI，角色只能凭对用户的了解来判断。
// 3. generateReaction：每一轮揭晓后，角色用一句话做出符合人设的反应。
//
// "真话"的取材：优先取自角色设定（bio/extraNotes）和最近的聊天记录。
// 聊天记录通过 db.messages 直接读最近若干条文本消息——读不到（比如
// chatId 没有索引）就安静退回只用设定，不影响游戏本身。

import db from '../../../db';
import {
  getGenerationContext,
  requestAiText,
} from '../../messages/interactions/interactionAiService';

const RECENT_MESSAGE_LIMIT = 40;
const MAX_MESSAGE_SNIPPET_LENGTH = 60;
const MAX_STATEMENT_LENGTH = 80;

const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const stripWrappingQuotes = (text = '') =>
  String(text)
    .trim()
    .replace(/^["'“”‘’「」]+/, '')
    .replace(/["'“”‘’「」]+$/, '')
    .trim();

const getRecentChatSnippet = async (chatId) => {
  try {
    const rows = await db.messages
      .where('chatId')
      .equals(chatId)
      .reverse()
      .limit(RECENT_MESSAGE_LIMIT)
      .toArray();

    return rows
      .reverse()
      .filter(
        (row) =>
          row &&
          row.type === 'text' &&
          typeof row.content === 'string' &&
          row.content.trim()
      )
      .map(
        (row) =>
          `${row.sender === 'user' ? '用户' : '你'}：${row.content
            .trim()
            .slice(0, MAX_MESSAGE_SNIPPET_LENGTH)}`
      )
      .join('\n');
  } catch (error) {
    console.warn('[TwoTruthsOneLie] 读取最近聊天记录失败，只用角色设定取材。', error);
    return '';
  }
};

const loadContext = async (chatId) => {
  try {
    const context = await getGenerationContext(chatId);
    if (!context) return null;

    const chatSnippet = await getRecentChatSnippet(chatId);
    return { ...context, chatSnippet };
  } catch (error) {
    console.warn('[TwoTruthsOneLie] 取生成上下文失败。', error);
    return null;
  }
};

const buildIdentityBlock = ({ character, chatSnippet }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你和用户最近的聊天记录（可以作为"关于你自己的真事"和"对用户的了解"的依据）：
${chatSnippet || '（暂无聊天记录）'}`;

const formatNumbered = (statements) =>
  statements.map((text, index) => `${index + 1}. ${text}`).join('\n');

// ===== 1. 角色出题 =====
// 返回 { ok: true, statements: [{ text, isLie }] }（已随机打乱顺序）
//   或 { ok: false, reason: 'unavailable' | 'parse' }
export const generateCharacterStatements = async ({ chatId }) => {
  try {
    const context = await loadContext(chatId);
    if (!context) return { ok: false, reason: 'unavailable' };

    const { character, apiConfig, chatSnippet } = context;

    const systemPrompt = `${buildIdentityBlock({ character, chatSnippet })}

你正在和用户玩"两个真话，一个假话"：你要说三句关于你自己的话，其中两句是真的，一句是你编的，用户要猜出哪一句是假的。

要求：
- 两句真话必须是关于你自己的事实，优先取自上面的角色设定或聊天记录里已有的内容；已有内容不够时，可以补充符合你人设、并且不跟已有设定冲突的小细节；
- 一句假话要编得像真的：风格、长度、具体程度都要和真话一致，不能有明显的夸张或破绽，也不能跟已有设定直接冲突到一眼就能看穿；
- 三句话都用第一人称，每句不超过30个汉字，不要都用同一种句式开头；
- 不使用 Emoji，不要提及 AI、系统、接口、游戏组件；
- 不要在句子里加任何提示或暗示。

严格按下面格式输出，不要输出任何其他内容：
真话一：<第一句真话>
真话二：<第二句真话>
假话：<那句编的话>`;

    const content = (await requestAiText({ apiConfig, systemPrompt })) || '';

    const truths = [...content.matchAll(/真话[^：:\n]*[：:]\s*(.+)/g)]
      .map((match) => stripWrappingQuotes(match[1]).slice(0, MAX_STATEMENT_LENGTH))
      .filter(Boolean);
    const lieMatch = content.match(/假话[：:]\s*(.+)/);
    const lie = lieMatch
      ? stripWrappingQuotes(lieMatch[1]).slice(0, MAX_STATEMENT_LENGTH)
      : '';

    if (truths.length < 2 || !lie) return { ok: false, reason: 'parse' };

    const statements = shuffle([
      { text: truths[0], isLie: false },
      { text: truths[1], isLie: false },
      { text: lie, isLie: true },
    ]);

    return { ok: true, statements };
  } catch (error) {
    console.warn('[TwoTruthsOneLie] 角色出题失败。', error);
    return { ok: false, reason: 'unavailable' };
  }
};

// ===== 2. 角色猜用户的假话 =====
// statements: 用户写的三句话（string[]）。用户标记了哪句是假的，不会传进来。
// 返回 { ok: true, pick: 0|1|2, reason: string } 或 { ok: false }
// 格式解析不出来时退回随机猜一句（reason 为空），不让整局卡住。
export const guessUserLie = async ({ chatId, statements }) => {
  try {
    const context = await loadContext(chatId);
    if (!context) return { ok: false };

    const { character, apiConfig, chatSnippet } = context;

    const systemPrompt = `${buildIdentityBlock({ character, chatSnippet })}

你正在和用户玩"两个真话，一个假话"：用户说了三句关于他自己的话，其中两句是真的，一句是他编的，你要猜出哪一句是假的。

用户说的三句话：
${formatNumbered(statements)}

请结合你对用户的了解（上面的聊天记录）、这三句话的可信度和措辞上的破绽来判断，然后用你的口吻说一句简短的理由。

严格按下面格式输出，不要输出任何其他内容：
判断：<1、2、3 中的一个数字>
理由：<一句话，不超过40个汉字，第一人称，符合你的性格，不使用 Emoji>`;

    const content = (await requestAiText({ apiConfig, systemPrompt })) || '';

    const pickMatch = content.match(/判断[：:]\s*([123一二三])/);
    const reasonMatch = content.match(/理由[：:]\s*(.+)/);

    const PICK_MAP = { 1: 0, 2: 1, 3: 2, 一: 0, 二: 1, 三: 2 };

    if (pickMatch) {
      return {
        ok: true,
        pick: PICK_MAP[pickMatch[1]],
        reason: reasonMatch ? reasonMatch[1].trim() : '',
      };
    }

    return {
      ok: true,
      pick: Math.floor(Math.random() * statements.length),
      reason: '',
    };
  } catch (error) {
    console.warn('[TwoTruthsOneLie] 角色猜测失败。', error);
    return { ok: false };
  }
};

// ===== 3. 揭晓后的角色反应 =====
// round 1：用户在猜角色的话——guesserCorrect 表示用户猜没猜对。
// round 2：角色在猜用户的话——guesserCorrect 表示角色猜没猜对。
// statements: 那一轮的三句话（string[]），lieIndex 是真正的假话位置，
// guessIndex 是猜的人选的位置。返回一句话字符串，失败返回空字符串。
export const generateReaction = async ({
  chatId,
  round,
  statements,
  lieIndex,
  guessIndex,
  guesserCorrect,
}) => {
  try {
    const context = await loadContext(chatId);
    if (!context) return '';

    const { character, apiConfig, chatSnippet } = context;

    const sceneText =
      round === 1
        ? `刚才你说了三句关于你自己的话：
${formatNumbered(statements)}
其中第${lieIndex + 1}句是你编的假话。用户猜的是第${guessIndex + 1}句，${
            guesserCorrect ? '猜对了，被他看穿了' : '猜错了，被你骗过去了'
          }。`
        : `刚才用户说了三句关于他自己的话：
${formatNumbered(statements)}
其中第${lieIndex + 1}句是用户编的假话。你猜的是第${guessIndex + 1}句，${
            guesserCorrect ? '你猜对了' : '你猜错了'
          }。`;

    const moodHint =
      round === 1
        ? guesserCorrect
          ? '被识破了，可以服气、不甘心或者好奇他是怎么看出来的，按你的性格来'
          : '成功骗过了他，可以得意、调侃，或者顺口交代一下那句编的话是怎么编出来的，按你的性格来'
        : guesserCorrect
          ? '你猜对了，可以得意，或者说说你是怎么看穿的，按你的性格来'
          : '你被他骗到了，可以懊恼、不服气或者夸他一句，按你的性格来';

    const systemPrompt = `${buildIdentityBlock({ character, chatSnippet })}

你和用户正在玩"两个真话，一个假话"。
${sceneText}

请以角色第一人称，对这个结果作出一句自然、私密、符合人设的即时反应。语气方向：${moodHint}。

严格要求：
- 只输出一条可直接发送的聊天消息；
- 长度控制在 15 到 70 个汉字之间；
- 不使用 Emoji；
- 不要输出标题、Markdown、括号说明或额外前言；
- 不要提及 AI、系统、接口、算法、游戏组件或技术实现；
- 不要复述完整规则，也不要把三句话原文再念一遍。`;

    return (await requestAiText({ apiConfig, systemPrompt })) || '';
  } catch (error) {
    console.warn('[TwoTruthsOneLie] 角色反应生成失败，不影响本局结果。', error);
    return '';
  }
};