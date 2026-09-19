import db from '../db';
import { buildRhythmPersonaBrief } from './rhythmReminderService';

// AI 主动给用户消息点反应，是一个"不动声色的小动作"，不是每条消息
// 都要有，太频繁反而显得假。用冷却时间控制节奏，跟碎碎念是同一个
// 思路（characterDailyPlanService.js 里的 MURMUR_COOLDOWN_MS）。
const AI_REACTION_COOLDOWN_MS = 3 * 60 * 1000;

const REACTION_TYPE_IDS = ['heart', 'like', 'laugh', 'flame', 'sad'];

const fetchAiText = async (apiConfig, systemPrompt) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ],
      temperature: 0.4,
      max_tokens: 20
    })
  });

  if (!response.ok) {
    throw new Error(
      `API 请求失败：${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return String(data?.choices?.[0]?.message?.content || '').trim();
};

const buildReactionPrompt = ({
  character,
  worldBookText,
  extraNotesText,
  userMessageContent
}) => {
  return `你正在扮演角色「${character.name}」，正在看对方刚刚发来的这句话，
考虑要不要像"拍一拍/点反应"那样，不写文字、只不动声色地给这条消息
点一个反应（不是完整回复，只是一个态度，之后你可能还会另外正常回复）。

人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

对方刚刚发来的话：
"${userMessageContent}"

只在这句话确实明显值得表个态度时才选择反应（比如让你觉得窝心、好笑、
心疼、佩服、想撒娇式支持），如果只是日常寒暄、平淡的陈述句，
不要勉强凑一个反应，直接选 none 就好。

请只从下面这些类型里选一个，或者选择不反应：
heart（心动/被打动）
like（支持/赞同）
laugh（觉得好笑）
flame（觉得很棒/惊艳）
sad（心疼/难过）
none（不反应）

严格只输出这一个英文单词本身，不要输出任何其他文字、标点、引号或解释。`;
};

/**
 * 视情况让 AI 对用户刚发的这条消息点一个反应（心动/支持/好笑/绝了/心疼）。
 * 非阻塞式的轻量调用：调用方不需要 await 结果再继续，失败也不影响
 * 正常的发消息 / AI 回复流程。
 *
 * 只对纯文本消息生效，并受冷却时间限制，避免每条消息都点反应
 * 显得机械。
 */
export const maybeGenerateAiReaction = async (chatId, userMessage) => {
  if (!chatId || !userMessage?.id) {
    return { status: 'invalid' };
  }

  if (userMessage.type && userMessage.type !== 'text') {
    return { status: 'unsupported_type' };
  }

  const content = String(userMessage.content || '').trim();

  if (!content) {
    return { status: 'empty_content' };
  }

  try {
    const now = Date.now();
    const cooldownKey = `lastAiReactionTime_${chatId}`;
    const lastTimeSetting = await db.settings.get(cooldownKey);
    const lastTime = Number(lastTimeSetting?.value || 0);

    if (now - lastTime < AI_REACTION_COOLDOWN_MS) {
      return { status: 'cooldown' };
    }

    const chat = await db.chats.get(chatId);

    if (!chat) {
      return { status: 'no_chat' };
    }

    const character = await db.characters.get(chat.characterId);

    if (!character) {
      return { status: 'no_character' };
    }

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return { status: 'no_api_config' };
    }

    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

    const systemPrompt = buildReactionPrompt({
      character,
      worldBookText,
      extraNotesText,
      userMessageContent: content.slice(0, 300)
    });

    const rawResponse = await fetchAiText(apiConfig, systemPrompt);
    const typeId = rawResponse.toLowerCase().replace(/[^a-z]/g, '');

    if (!REACTION_TYPE_IDS.includes(typeId)) {
      return { status: 'no_reaction' };
    }

    const latestMessage = await db.messages.get(userMessage.id);

    if (!latestMessage) {
      return { status: 'message_gone' };
    }

    const existingReactions = Array.isArray(latestMessage.reactions)
      ? latestMessage.reactions
      : [];

    const nextReactions = [
      ...existingReactions.filter((reaction) => reaction.by !== 'ai'),
      { type: typeId, by: 'ai', at: new Date().toISOString() }
    ];

    await db.transaction('rw', db.messages, db.settings, async () => {
      await db.messages.update(userMessage.id, { reactions: nextReactions });

      await db.settings.put({
        key: cooldownKey,
        value: String(now)
      });
    });

    return { status: 'success', type: typeId };
  } catch (err) {
    console.error('[messageReactionService] 生成 AI 反应失败：', err);

    return {
      status: 'error',
      error: err?.message || 'unknown_error'
    };
  }
};