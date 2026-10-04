// src/apps/textgames/twentyQuestions/twentyQuestionsAiService.js
//
// "20个问题"需要一个会判断是非题的裁判，这局游戏天生离不开AI（不像
// 女巫的毒药，角色当猜测方时完全可以靠纯随机凑合）。复用
// interactionAiService.js 里已有的 getGenerationContext/requestAiText
// 这两个辅助函数（取角色+接口配置、直接 fetch 聊天补全接口，一次性的
// 纯 system prompt，不带历史消息），不走 aiService.js 的主回复管线——
// 这些都是游戏内部状态判断，不是真的要发进聊天记录的角色台词。
//
// 两个方向共用同一套工具函数：
// - 角色出题，用户猜（默认方向）：generateSecretWord 先让AI悄悄想一个
//   词，之后每次用户提问都靠 judgeYesNoAnswer 用这个固定的词来回答，
//   保证前后一致（不会因为AI"忘了自己想的是什么"而答案跑偏）；
//   judgeFinalGuess 判断用户的最终猜测是否命中。
// - 用户出题，角色猜：用户自己悄悄想好、全程只存在用户自己的浏览器里，
//   从来不会发给AI——角色侧完全靠 generateCharacterQuestion 根据"已经
//   问过什么、得到什么回答"这段历史自己想下一步（提问或者直接报出最终
//   猜测），用户用自己脑子里的答案手动判断是/不是/不确定。

import {
  getGenerationContext,
  requestAiText,
} from '../../messages/interactions/interactionAiService';

// 分类池，防止AI每次都想到差不多的东西（老是"苹果"之类）。
const CATEGORY_HINTS = [
  '常见动物',
  '日常用品',
  '食物',
  '地点/场所',
  '职业',
  '自然现象',
  '交通工具',
  '身体部位',
  '家具',
  '虚构/童话角色',
];

const stripQuotesAndPunct = (text = '') =>
  String(text)
    .replace(/["'“”‘’。.!！\s]/g, '')
    .trim();

export const generateSecretWord = async (chatId) => {
  const context = await getGenerationContext(chatId);
  if (!context) return null;

  const { apiConfig } = context;
  const category = CATEGORY_HINTS[Math.floor(Math.random() * CATEGORY_HINTS.length)];

  const systemPrompt = `你在心里想一个具体的词，用来玩"20个问题"猜谜游戏——对方会通过问是非题来猜这是什么东西。

要求：
- 这个词属于这个范围："${category}"；
- 必须是一个具体、常见、大多数人都认识的名词（不要生僻、不要抽象概念、不要专有名词/人名）；
- 只输出这个词本身，不要输出任何其他文字、标点、引号或解释。`;

  const raw = await requestAiText({ apiConfig, systemPrompt });
  const word = stripQuotesAndPunct(raw);
  return word || null;
};

// character 只用来让回答带一点人设语气，真正的判断依据是 secretWord
// 本身的客观事实，不受角色性格影响（不然"是不是"会判断不准）。
export const judgeYesNoAnswer = async ({ chatId, character, secretWord, question }) => {
  const context = await getGenerationContext(chatId);
  if (!context) return '不确定——裁判好像不在线。';

  const { apiConfig } = context;

  const systemPrompt = `你正在扮演角色：${character?.name || 'TA'}。

角色设定：
${character?.bio || '无'}

你和用户正在玩"20个问题"：你心里的秘密是"${secretWord}"，用户不知道这个词，只能通过问是非题来猜。
用户刚问了："${question}"

请只根据"${secretWord}"这个词本身的真实情况，判断这个问题的答案，并以角色第一人称的语气给出一句简短回应。

严格要求：
- 开头必须是"是"、"不是"或"不一定"三者之一；
- 整句话不超过20个汉字；
- 可以带一点点角色性格和俏皮感，但绝对不能透露或暗示秘密词具体是什么；
- 不使用 Emoji；
- 不要输出引号、解释、前言。`;

  const content = await requestAiText({ apiConfig, systemPrompt });
  return content || '不确定——裁判好像不在线。';
};

export const judgeFinalGuess = async ({ chatId, secretWord, guess }) => {
  const context = await getGenerationContext(chatId);
  if (!context) return false;

  const { apiConfig } = context;

  const systemPrompt = `秘密词是"${secretWord}"，用户猜的是"${guess}"。
这两个是不是在说同一个具体事物（允许同义词、近义说法、更精确或更笼统一点的说法，只要本质上是同一样东西，就算命中）？
只回答"是"或"不是"，不要任何其他文字。`;

  const content = await requestAiText({ apiConfig, systemPrompt });
  return /^是/.test(String(content || '').trim());
};

// 反方向：用户自己想好秘密（从不发给AI），角色要根据历史 Q&A 自己想
// 下一步——提一个新问题，或者在有把握时直接给出最终猜测。这里用纯文本
// 的"问题：.../猜测：..."两选一格式做本地解析，不是项目里"方括号标签"
// 那套走 aiService.js 共享解析器的机制（见项目笔记：这类游戏内部状态
// 判断不走那条共享管线），纯粹是这个文件自己的本地约定。
export const generateCharacterQuestion = async ({
  chatId,
  character,
  history,
  questionsLeft,
}) => {
  const fallback = { type: 'question', text: '这个东西是活的吗？' };

  const context = await getGenerationContext(chatId);
  // 没配置好AI接口：之前这里直接默默返回兜底问题，USER_SETS方向下
  // 每一轮都会再调用一次、每次又因为同样的原因拿到同一句兜底文案，
  // 用户会看到TA一直重复问同一个"这个东西是活的吗？"、20问很快被
  // 耗光，而且没有任何提示说明是AI没配置好——现在带上 aiUnavailable
  // 标记，让 TwentyQuestionsGame.jsx 能识别出这不是一次正常的提问，
  // 从而提前停下来显示跟 CHARACTER_SETS 方向一致的"未配置AI接口"提示。
  if (!context) return { ...fallback, aiUnavailable: true };

  const { apiConfig } = context;

  const historyText = history.length
    ? history
        .map((item, index) => `${index + 1}. 问：${item.question} 答：${item.answer}`)
        .join('\n')
    : '（还没有问过任何问题）';

  const systemPrompt = `你正在扮演角色：${character?.name || 'TA'}。

角色设定：
${character?.bio || '无'}

你正在和用户玩"20个问题"：用户心里想了一个具体的东西，你需要通过问是非题来猜出它是什么，你一共有20次提问机会，现在还剩${questionsLeft}次。

已经问过的问题和用户的回答：
${historyText}

请给出你的下一步行动：
- 如果你还没有足够把握，提一个新的是非题（能帮你有效缩小范围的问题）；
- 如果你已经有十足把握，直接给出最终猜测（具体的名词，不要含糊）。

严格按下面格式输出，只能二选一，不要输出其他任何内容：
问题：<你的是非题>
或者
猜测：<你认为的具体答案>`;

  const content = (await requestAiText({ apiConfig, systemPrompt })) || '';

  const guessMatch = content.match(/猜测[：:]\s*(.+)/);
  if (guessMatch) {
    return { type: 'guess', text: guessMatch[1].trim() };
  }

  const questionMatch = content.match(/问题[：:]\s*(.+)/);
  if (questionMatch) {
    return { type: 'question', text: questionMatch[1].trim() };
  }

  // 两种格式都没解析出来就退回一个保底问题，不让整局卡住。
  return content.trim() ? { type: 'question', text: content.trim() } : fallback;
};