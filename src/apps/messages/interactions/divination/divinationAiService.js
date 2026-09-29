// src/apps/messages/interactions/divination/divinationAiService.js
//
// 占卜解读：角色用第一人称，结合抽到的牌面回答用户的问题。
// 复用 interactionAiService.js 里已有的三个辅助函数（取角色与接口配置、
// 直接 fetch 聊天补全接口、插入一条角色文字消息），不走 aiService.js 的
// 主回复管线；失败时只是安静地没有这条解读，牌面本身已经保留。

import { INTERACTION_TYPES } from '../interactionRules';
import {
  getGenerationContext,
  requestAiText,
  insertCharacterTextMessage,
} from '../interactionAiService';
import { DIVINATION_DECKS, getCardById } from './divinationDecks';
import { getSpread, SPREAD_IDS } from './divinationSpreads';

const describeCardForPrompt = (drawn, supportsReversed) => {
  const card = getCardById(drawn.cardId);
  const orientation = supportsReversed
    ? (drawn.reversed ? '逆位' : '正位')
    : '';

  const head = `【${drawn.positionLabel}】${drawn.name}${orientation}`;

  if (!card) return head;

  // 塔罗有正逆位两套释义；自创牌只有一套牌义。
  if ('upright' in card) {
    const keywords = drawn.reversed ? card.reversedKeywords : card.keywords;
    const meaning = drawn.reversed ? card.reversed : card.upright;

    return `${head}\n关键词：${keywords.join('、')}\n牌义：${meaning}`;
  }

  return `${head}\n关键词：${card.keywords.join('、')}\n牌义：${card.meaning}`;
};

// 不同牌阵的位置含义补充说明，帮助角色把位置读对。
const getSpreadGuide = (spreadId) => {
  if (spreadId === SPREAD_IDS.PAST_PRESENT_FUTURE) {
    return '这是一个"过去 / 现在 / 未来"的三张牌阵，按时间顺序把三张牌连成一条线来解读。';
  }

  if (spreadId === SPREAD_IDS.RELATIONSHIP) {
    return '这是一个双人关系阵："你的心意"指提问的用户，"对方的心意"指用户问题里所问的那个人（如果问题是关于你自己的，就是你自己），"关系走向"指两人之间接下来的趋势。';
  }

  if (spreadId === SPREAD_IDS.DECISION) {
    return '这是一个抉择阵："选项A"和"选项B"对应用户问题里的两个选择（如果问题里没有写得很清楚，就按两个不同方向自然地理解），"内心指引"是给出选择时可以参考的内心方向。';
  }

  return '这是只抽一张牌的无牌阵，直接用这张牌来回答问题。';
};

const buildDivinationSystemPrompt = ({ character, result }) => {
  const deck = DIVINATION_DECKS[result.deckId];
  const spread = getSpread(result.spreadId);
  const isSingle = result.cards.length === 1;

  const cardBlock = result.cards
    .map((drawn) => describeCardForPrompt(drawn, Boolean(deck?.supportsReversed)))
    .join('\n\n');

  const lengthRule = isSingle
    ? '长度控制在 40 到 150 个汉字之间'
    : '长度控制在 100 到 320 个汉字之间，把每张牌都照顾到，最后自然收束回问题本身';

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

用户刚刚在聊天里用「${deck?.label || '占卜牌'}」占卜了一个问题：
${result.question}

牌阵：${spread.label}
${getSpreadGuide(spread.id)}

抽到的牌：
${cardBlock}

请以角色第一人称，结合抽到的牌面，认真地解读并回应用户的这个问题。
这不是在演戏，也不是在评论牌，而是像一个认真的人自然地跟对方聊这张牌
说明了什么，语气要符合你的性格。把牌面当作一面镜子和一个参考，可以
给出看法和建议，但不要下绝对的断言。

严格要求：
- 只输出一条可直接发送的聊天消息；
- ${lengthRule}；
- 不使用 Emoji；
- 不要输出标题、Markdown、列表、括号说明或额外前言；
- 可以自然地提到牌名，但不要逐条复述关键词和牌义原文；
- 不要提及 AI、系统、接口、算法、抽牌程序、游戏组件或技术实现。`;
};

export const generateDivinationReading = async ({
  chatId,
  divinationMetadata,
}) => {
  const result = divinationMetadata?.result;

  if (!chatId || !result || !Array.isArray(result.cards) || !result.question) {
    return null;
  }

  try {
    const context = await getGenerationContext(chatId);
    if (!context) return null;

    const { character, apiConfig } = context;

    const systemPrompt = buildDivinationSystemPrompt({ character, result });

    const content = await requestAiText({ apiConfig, systemPrompt });
    if (!content) return null;

    return await insertCharacterTextMessage({
      chatId,
      character,
      content,
      metadataExtra: {
        interactionType: INTERACTION_TYPES.DIVINATION,
        deckId: result.deckId,
        spreadId: result.spreadId,
      },
    });
  } catch (error) {
    console.warn(
      '[DivinationAiService] 占卜解读未能生成，牌面已正常保留。',
      error
    );

    return null;
  }
};