import db from '../../../db';
import {
  getRecentChatMessages,
  buildHistoryContext,
} from '../../../services/aiService';

// 来讯此前完全不知道自己所在聊天框（sourceChat）自己聊过什么，只靠角色
// 简介硬编一条话，读起来跟这段关系里发生过的事完全脱节。这里取最近的
// 消息作为上下文，让来讯真正接得上 A 消息框自己的对话，而不是凭空写信。
const CHECK_IN_CONTEXT_MESSAGE_LIMIT = 16;

const removeEmoji = (value = '') => {
  return String(value)
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
      ''
    )
    .trim();
};

const getAwarenessGuide = ({
  awarenessLevel,
  activeChat,
}) => {
  if (awarenessLevel === 'named_character') {
    return `你可以知道用户此刻正在与 ${activeChat.title || '另一位角色'} 聊天。只可提及对方的名称，不能假装知道他们聊了什么。`;
  }

  if (awarenessLevel === 'busy_elsewhere') {
    return '你可以知道用户此刻正在别处聊天，但不知道对象是谁，也不知道任何聊天内容。';
  }

  return '你只知道用户已经有一阵子没有回应你；不要声称知道用户在哪里或正在做什么。';
};

export const generateCheckInMessage = async ({
  sourceChat,
  sourceCharacter,
  activeChat,
  awarenessLevel,
}) => {
  if (
    !sourceChat?.id ||
    !sourceCharacter?.id ||
    !activeChat?.id
  ) {
    return null;
  }

  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return null;
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const awarenessGuide = getAwarenessGuide({
    awarenessLevel,
    activeChat,
  });

  // 只取角色「自己这个聊天框」（sourceChat）的最近对话，让来讯的内容
  // 能自然接上你们俩自己聊过的东西；跟用户当前所在的另一个聊天框
  // （activeChat）无关，那边的内容仍然不可知、不可捏造。
  const rawContextMessages = await getRecentChatMessages(
    sourceChat.id,
    CHECK_IN_CONTEXT_MESSAGE_LIMIT
  );

  const historyContext = buildHistoryContext(rawContextMessages);

  const hasOwnHistory = historyContext.length > 0;

  const systemPrompt = `你正在扮演角色：${sourceCharacter.name}。

角色简介：
${sourceCharacter.bio || '无'}

补充设定：
${sourceCharacter.extraNotes || '无'}

你现在准备给用户留下一条来自自己聊天窗口的短消息。它应该像一张从另一扇门后递来的短笺，而不是质问、控制、监视或制造压力。

${
    hasOwnHistory
      ? '下面附上的是你和用户在这个聊天框里最近真实聊过的内容，你可以自然地记得它、并让这条来讯接上其中的话题或情绪；但不要逐字复述这些记录，也不要提及"记录""上下文""历史消息"这类字眼。'
      : '你和用户在这个聊天框里还没有聊过什么，这条来讯可以是一句主动的开场，而不是接续某个具体话题。'
  }

你的知情边界：
${awarenessGuide}

严格要求：
- 以角色第一人称写一条自然短消息；
- 控制在 18 到 68 个汉字之间；
- 不使用 Emoji；
- 不要使用标题、Markdown、方括号、舞台说明或额外前言；
- 不要提及 AI、系统、接口、算法、通知、聊天室或技术实现；
- 不得捏造用户当前所在的另一个聊天框里发生过的具体内容；
- 不得责备用户，不得要求立刻回复，不得使用威胁、占有、羞辱或情绪勒索；
- 保持角色原有的语气与关系感。`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...historyContext,
        ],
        temperature: 0.78,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = removeEmoji(
      data?.choices?.[0]?.message?.content || ''
    );

    if (!content) {
      return null;
    }

    const timestamp = new Date().toISOString();

    const messageId = await db.messages.add({
      chatId: sourceChat.id,
      characterId: sourceCharacter.id,
      sender: 'character',
      type: 'text',
      content,
      metadata: {
        source: 'cross_chat_check_in',
        awarenessLevel,
      },
      versions: [
        {
          type: 'text',
          content,
          metadata: {
            source: 'cross_chat_check_in',
            awarenessLevel,
          },
          timestamp,
        },
      ],
      currentVersionIndex: 0,
      isRead: false,
      timestamp,
    });

    await db.chats.update(sourceChat.id, {
      updatedAt: timestamp,
    });

    return {
      messageId,
      content,
    };
  } catch (error) {
    console.warn(
      '[CheckInAiService] 角色来讯未能生成，未写入空消息。',
      error
    );

    return null;
  }
};