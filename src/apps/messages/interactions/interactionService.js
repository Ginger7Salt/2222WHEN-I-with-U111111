import db from '../../../db';
import {
  INTERACTION_TYPES,
  getCoinResult,
  getDiceResult,
  getRandomRpsChoice,
  getRpsOutcome,
  getLotteryResult,
  getIntimacyQuestion,
  getRandomTruthOrDarePrompt,
  getInteractionSummary,
} from './interactionRules';
import { generateInteractionReaction, generateTruthOrDareAnswer } from './interactionAiService';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const getInitialContent = (interactionType) => {
  switch (interactionType) {
    case INTERACTION_TYPES.COIN:
      return '抛出一枚旧硬币';
    case INTERACTION_TYPES.DICE:
      return '掷下一枚六面骰';
    case INTERACTION_TYPES.RPS:
      return '发起了一次猜拳';
    case INTERACTION_TYPES.LOTTERY:
      return '摇了一支剧场签';
    case INTERACTION_TYPES.INTIMACY_QA:
      return '抽了一张亲密问答卡';
    default:
      return '留下了一次互动';
  }
};

export const createInteractionMessage = async ({
  chatId,
  characterId,
  interactionType,
}) => {
  if (!chatId || !characterId || !interactionType) {
    return null;
  }

  const timestamp = new Date().toISOString();

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'interaction',
    content: getInitialContent(interactionType),
    metadata: {
      interactionType,
      status: 'pending',
      result: null,
      createdAt: timestamp,
      resolvedAt: null,
    },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
  });

  dispatchLocalMessageEvent(chatId);

  return messageId;
};

const getResolvedResult = ({ interactionType, userChoice }) => {
  if (interactionType === INTERACTION_TYPES.COIN) {
    return {
      side: getCoinResult(),
    };
  }

  if (interactionType === INTERACTION_TYPES.DICE) {
    return {
      value: getDiceResult(),
    };
  }

  if (interactionType === INTERACTION_TYPES.RPS) {
    const characterChoice = getRandomRpsChoice();

    return {
      userChoice,
      characterChoice,
      outcome: getRpsOutcome(userChoice, characterChoice),
    };
  }

  if (interactionType === INTERACTION_TYPES.LOTTERY) {
    return {
      scenario: getLotteryResult(),
    };
  }

  if (interactionType === INTERACTION_TYPES.INTIMACY_QA) {
    return {
      question: getIntimacyQuestion(),
    };
  }

  return null;
};

export const resolveInteractionMessage = async ({
  messageId,
  userChoice = null,
}) => {
  if (!messageId) return null;

  let resolvedMetadata = null;
  let shouldGenerateReaction = false;
  let chatId = null;

  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);

    if (
      !message ||
      message.type !== 'interaction' ||
      !message.metadata?.interactionType
    ) {
      return;
    }

    chatId = message.chatId;

    if (message.metadata.status === 'resolved') {
      resolvedMetadata = message.metadata;
      return;
    }

    const interactionType = message.metadata.interactionType;

    if (
      interactionType === INTERACTION_TYPES.RPS &&
      !['剪刀', '石头', '布'].includes(userChoice)
    ) {
      return;
    }

    const result = getResolvedResult({
      interactionType,
      userChoice,
    });

    if (!result) return;

    const resolvedAt = new Date().toISOString();

    resolvedMetadata = {
      ...message.metadata,
      status: 'resolved',
      result,
      resolvedAt,
    };

    // 抽到/掷出的具体内容（问题原文、情景原文等）只落在 metadata.result 里，
    // AI 的常规聊天历史和记忆系统都只读 message.content，之前这里从创建时的
    // 占位文案（"抽了一张亲密问答卡"之类）就再没更新过，导致 AI 后续完全不
    // 知道具体抽到了什么。这里把 content 同步改写成含具体内容的描述，
    // getInteractionSummary 生成的文案本身就是给 AI 读的，直接复用。
    await db.messages.update(messageId, {
      content: getInteractionSummary(resolvedMetadata),
      metadata: resolvedMetadata,
    });

    shouldGenerateReaction = true;
  });

  if (!resolvedMetadata || !chatId) {
    return null;
  }

  dispatchLocalMessageEvent(chatId);

  if (shouldGenerateReaction) {
    void generateInteractionReaction({
      chatId,
      interactionMetadata: resolvedMetadata,
    });
  }

  return resolvedMetadata;
};

/*
 * 真心话大冒险走的是一套单独的流程，跟上面"先 pending 再 resolve"的
 * 通用两步走不一样：
 * - 这一局"出题人"是谁（角色还是用户）由 chat.truthOrDareTurn 记着，
 *   每完成一局就翻转一次，下一次点开就轮到另一方出题。
 * - 出题人=角色（也就是角色向用户发起）：题目当场随机抽好，直接以
 *   "已完成"状态插入一条互动消息，用户看着题目，自己手动打字回应，
 *   不需要再触发 AI——这条走向本来就是"角色抛问题，用户正常聊天回"。
 * - 出题人=用户（用户向角色发起）：同样当场抽题插入互动消息，但接下来
 *   需要真的让角色认真回答/执行这道真心话或大冒险，所以会调用
 *   generateTruthOrDareAnswer 生成一条角色的正式回应消息。
 */
export const createTruthOrDareMessage = async ({ chatId, characterId }) => {
  if (!chatId || !characterId) return null;

  const chat = await db.chats.get(chatId);
  const asker = chat?.truthOrDareTurn === 'user' ? 'user' : 'character';
  const nextTurn = asker === 'character' ? 'user' : 'character';

  const { mode, prompt } = getRandomTruthOrDarePrompt();
  const timestamp = new Date().toISOString();
  const modeText = mode === 'dare' ? '大冒险' : '真心话';
  // 出题人是谁决定了这句描述的方向：asker==='user' 时是用户抛题给角色
  // （对应 generateTruthOrDareAnswer 会去认真回答/执行）；asker==='character'
  // 时反过来是角色抛题给用户，接下来该用户自己手动打字回应。content 需要
  // 如实写清楚方向，不能不管是谁出题都写成同一句话，否则AI以后看历史会
  // 搞反谁问的谁——同时把题目原文写进去，这样AI以后才知道具体问的是什么。
  const content = asker === 'user'
    ? `用户向你发起了一局「${modeText}」，题目是：${prompt}`
    : `你向用户发起了一局「${modeText}」，题目是：${prompt}`;

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'interaction',
    content,
    metadata: {
      interactionType: INTERACTION_TYPES.TRUTH_OR_DARE,
      status: 'resolved',
      asker,
      result: { mode, prompt },
      createdAt: timestamp,
      resolvedAt: timestamp,
    },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
    truthOrDareTurn: nextTurn,
  });

  dispatchLocalMessageEvent(chatId);

  // 用户是出题人时，需要角色真的认真答/做这道题；角色是出题人时，
  // 该由用户自己手动打字回应，不需要额外触发 AI。
  if (asker === 'user') {
    void generateTruthOrDareAnswer({
      chatId,
      mode,
      prompt,
    });
  }

  return { messageId, asker, mode, prompt };
};