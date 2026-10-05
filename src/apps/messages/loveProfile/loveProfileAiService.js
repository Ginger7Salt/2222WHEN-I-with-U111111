// src/apps/messages/loveProfile/loveProfileAiService.js
//
// 「情感偏好问卷」的 AI 部分：把问卷答案交给 AI，让它分析用户的沟通/情感
// 倾向，生成一段给聊天角色看的 prompt；以及根据用户的反馈修改这段 prompt。
//
// 只做两件事，都是一次性的纯文本调用（复用 aiService.js 导出的
// generateResponse，不走在线聊天的括号标签解析，也不用 JSON 信封）：
//   - generateLoveProfilePrompt：答案 -> prompt
//   - reviseLoveProfilePrompt：旧 prompt + 用户反馈 -> 新 prompt
// 不读写数据库；存取在 loveProfileService.js，两个文件分开避免循环引用。
//
// 失败时 throw Error（message 可直接展示给用户），由界面捕获后提示。

import { generateResponse } from '../../../services/aiService';
import { formatAnswersForAi } from './loveProfileSchema';

const MAX_OUTPUT_CHARS = 1800;

const GENERATE_SYSTEM_PROMPT = `你是一位擅长理解人际沟通与亲密关系的分析者。用户填写了一份关于"希望被怎样表达爱与关心、哪些方式会让自己不舒服"的问卷。请你据此写出一段【给聊天陪伴角色阅读的行为指导】，让角色在不改变自身人设的前提下，更贴合这位用户的真实需要。

工作方式：
1. 先在心里综合分析：用户的沟通风格、情感需求、对距离感与节奏的偏好、情绪低落时更需要陪伴还是空间、依恋倾向等。可以参考 MBTI、依恋风格、爱的语言这类框架作为思考工具，但它们只是帮助你理解的假设，不是定论。
2. 然后只输出最终的行为指导，不输出你的分析过程。

输出要求：
- 用第二人称"你"直接对角色说话，写成可执行的行为倾向，而不是对用户的评价。
- 内容分成这几块，每块用一行小标题（用方括号，如【表达方式】）开头：【表达方式】【互动节奏与篇幅】【情绪低落或冲突时】【请避免】。没有依据的块可以省略。
- 问卷里标为"边界类"的回答，必须全部落实到【请避免】里，措辞具体、明确，不要软化或遗漏；"偏好类"的回答用"尽量""更适合"这类倾向性语气。
- 这只是调节"表达方式"，不要要求角色改变性格、身份或设定；不要让角色变得千篇一律。可以写"如果你本身是内敛的，可以用……的方式体现"这类兼容不同性格的说法。
- 不要在输出里出现 MBTI 类型、依恋类型、心理学标签或"根据问卷""分析显示"这类字样；不要对用户做诊断或下定论；不要编造问卷里没有的事实。
- 不要写出鼓励用户疏远现实中的朋友家人、情感勒索、把感情说成债务（如"算账""利息""还我"）、命令式口吻的内容。
- 全文使用中文，不使用任何 emoji，总长度控制在 600 字以内。
- 只输出这段行为指导本身，不要前言、解释、代码块或引号。`;

const REVISE_SYSTEM_PROMPT = `你是一位擅长理解人际沟通与亲密关系的分析者。下面是一段已经生成的、给聊天陪伴角色阅读的行为指导，以及用户对它的反馈。请根据反馈修改这段指导。

修改原则：
- 只改反馈涉及的部分，其余内容尽量保持原样和原有结构（小标题保留）。
- 用户反馈里明确放宽或取消的边界才可以删改；没提到的"请避免"内容必须保留。
- 仍然只调节"表达方式"，不改变角色的性格与设定；仍然用第二人称"你"对角色说话。
- 不出现心理学标签、"根据问卷/反馈"字样；不写鼓励疏远现实人际关系、情感勒索、债务式说法（算账、利息、还我）、命令式口吻的内容。
- 全文使用中文，不使用任何 emoji，总长度控制在 600 字以内。
- 只输出修改后的完整行为指导本身，不要前言、解释、代码块或引号。`;

const cleanOutput = (raw) => {
  let text = String(raw || '').trim();

  // 去掉可能包裹的代码块围栏。
  text = text.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

  // 去掉可能的"提示词：""指导："前缀。
  text = text.replace(/^(行为指导|提示词|指导|输出)\s*[:：]\s*/, '').trim();

  if (!text) {
    throw new Error('AI 没有返回有效内容，请稍后重试。');
  }

  return text.length > MAX_OUTPUT_CHARS ? text.slice(0, MAX_OUTPUT_CHARS) : text;
};

/**
 * 答案 -> 行为指导 prompt。
 * adjustNote：单窗覆盖时用户对这个角色的额外要求，可为空。
 */
export const generateLoveProfilePrompt = async ({ sections, answers, adjustNote = '' }) => {
  const answerText = formatAnswersForAi(sections, answers);

  if (!answerText) {
    throw new Error('还没有可用的问卷回答。');
  }

  const note = String(adjustNote || '').trim();
  const noteBlock = note
    ? `\n\n【用户对这个聊天对象的额外要求（优先级高于上面的一般性回答，但不得违反边界类回答）】\n${note}`
    : '';

  const raw = await generateResponse([
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    { role: 'user', content: `以下是用户的问卷回答：\n\n${answerText}${noteBlock}` },
  ]);

  return cleanOutput(raw);
};

/** 旧 prompt + 用户反馈 -> 新 prompt。sections/answers 用来给 AI 对照原始回答，可省略。 */
export const reviseLoveProfilePrompt = async ({
  currentPrompt,
  feedback,
  sections = null,
  answers = null,
}) => {
  const fb = String(feedback || '').trim();
  if (!fb) throw new Error('请先写下你想怎么调整。');

  const answerText = sections && answers ? formatAnswersForAi(sections, answers) : '';
  const answerBlock = answerText ? `\n\n【参考：用户当初的问卷回答】\n${answerText}` : '';

  const raw = await generateResponse([
    { role: 'system', content: REVISE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `【当前的行为指导】\n${String(currentPrompt || '').trim()}\n\n【用户的反馈】\n${fb}${answerBlock}`,
    },
  ]);

  return cleanOutput(raw);
};