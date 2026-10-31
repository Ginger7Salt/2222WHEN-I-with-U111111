// src/apps/messages/interactions/drawGuess/drawGuessAiService.js
//
// 你画我猜：把用户画的画发给角色看，让角色猜画的是什么。
//
// 和占卜解读一样，不走 aiService.js 的主回复管线，而是复用
// interactionAiService.js 里已有的 getGenerationContext（取角色与接口配置）
// 和 insertCharacterTextMessage（插入一条角色文字消息）。
// 区别在于这里要发图片：沿用通话视频里 videoCameraService 的写法，
// 直接把 image_url 放进 OpenAI 兼容的多模态 content 数组，走主接口配置，
// 不经过独立的视觉 API 转述（那条路会把画先翻译成文字，角色就不是在"看画"了）。
//
// 失败时只是把这条消息标成 failed，卡片上会出现"重新让TA猜"，
// 画本身已经保存在消息里，不会丢。

import db from '../../../../db';
import { INTERACTION_TYPES } from '../interactionRules';
import {
  getGenerationContext,
  insertCharacterTextMessage,
} from '../interactionAiService';
import {
  DRAW_GUESS_STATUS,
  buildDrawGuessContent,
  isGuessCorrect,
} from './drawGuessRules';

// 同一条消息同时只允许一个猜测请求在途，避免连点"重新猜"产生两条回复。
const inFlightMessageIds = new Set();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

const buildGuessPrompt = ({ character, categoryLabel }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

用户刚刚在聊天里和你玩"你画我猜"：上面这张图是用户用手指在手机上随手画的简笔画，
线条可能很粗糙，请认真地看，猜它画的是什么。
题目的大致类别是：${categoryLabel || '不限'}。

请只输出一个 JSON 对象，格式如下，不要输出任何其他内容：
{"guess":"你猜的答案，一个 1 到 6 个字的名词或短语","say":"你以角色第一人称对用户说的话"}

要求：
- guess 必须是你真正给出的单一答案，不能写"不知道"或同时给出多个答案；
- say 是一条可直接发送的聊天消息，长度 20 到 80 个汉字，里面要自然地说出你猜的答案，
  并带上符合你性格的反应，可以对画技吐槽或夸奖，但不要刻薄；
- 如果画得看不太清，就坦白说你看到了什么、不太确定，然后仍然给出最接近的那个答案；
- 不使用 Emoji；
- 不要提及 AI、系统、接口、题库、类别、图片分析、游戏组件或技术实现；
- 不要说"这张图"，要像真的在看对方给你画的画。`;

/*
 * 解析模型返回。优先按 JSON 解析；模型没按格式输出时退一步：
 * 整段文字当作 say，guess 留空，由 isGuessCorrect 看整句里有没有题目。
 */
const parseGuessReply = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return null;

  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);

  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      const guess = removeEmoji(parsed?.guess || '');
      const say = removeEmoji(parsed?.say || parsed?.line || '');

      if (guess || say) {
        return { guess, say: say || guess };
      }
    } catch {
      // JSON 解析失败，走下面的兜底
    }
  }

  const fallback = removeEmoji(cleaned);
  return fallback ? { guess: '', say: fallback } : null;
};

const requestGuess = async ({ apiConfig, character, categoryLabel, image }) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

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
          content: '你是一个游戏里的角色扮演助手，严格按用户给出的要求生成内容。',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image, detail: 'low' } },
            { type: 'text', text: buildGuessPrompt({ character, categoryLabel }) },
          ],
        },
      ],
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    console.warn(
      `[DrawGuessAiService] 接口返回非 2xx（状态码 ${response.status}）。`,
      bodyText.slice(0, 300)
    );
    return null;
  }

  const data = await response.json();
  return parseGuessReply(data?.choices?.[0]?.message?.content || '');
};

const markMessageStatus = async (messageId, chatId, status) => {
  const message = await db.messages.get(messageId);
  if (!message?.metadata) return;

  const metadata = {
    ...message.metadata,
    status,
    ...(status === DRAW_GUESS_STATUS.GUESSING
      ? { guessStartedAt: new Date().toISOString() }
      : {}),
  };

  await db.messages.update(messageId, {
    content: buildDrawGuessContent(metadata),
    metadata,
  });

  dispatchLocalMessageEvent(chatId);
};

export const generateDrawGuess = async ({ chatId, messageId }) => {
  if (!chatId || !messageId) return null;
  if (inFlightMessageIds.has(messageId)) return null;

  inFlightMessageIds.add(messageId);

  try {
    const message = await db.messages.get(messageId);

    if (
      !message ||
      message.type !== 'interaction' ||
      message.metadata?.interactionType !== INTERACTION_TYPES.DRAW_GUESS ||
      message.metadata?.status === DRAW_GUESS_STATUS.RESOLVED
    ) {
      return null;
    }

    const result = message.metadata?.result;
    if (!result?.image || !result?.word) return null;

    await markMessageStatus(messageId, chatId, DRAW_GUESS_STATUS.GUESSING);

    const context = await getGenerationContext(chatId);

    if (!context) {
      await markMessageStatus(messageId, chatId, DRAW_GUESS_STATUS.FAILED);
      return null;
    }

    const { character, apiConfig } = context;

    const reply = await requestGuess({
      apiConfig,
      character,
      categoryLabel: result.categoryLabel,
      image: result.image,
    });

    if (!reply) {
      await markMessageStatus(messageId, chatId, DRAW_GUESS_STATUS.FAILED);
      return null;
    }

    // 请求期间用户可能已经手动改判或消息被删，重新取一次最新的再写回。
    const latest = await db.messages.get(messageId);
    if (!latest?.metadata) return null;

    const resolvedMetadata = {
      ...latest.metadata,
      status: DRAW_GUESS_STATUS.RESOLVED,
      resolvedAt: new Date().toISOString(),
      result: {
        ...latest.metadata.result,
        guess: reply.guess,
        isCorrect: isGuessCorrect(result.word, reply.guess, reply.say),
      },
    };

    await db.messages.update(messageId, {
      content: buildDrawGuessContent(resolvedMetadata),
      metadata: resolvedMetadata,
    });

    dispatchLocalMessageEvent(chatId);

    return await insertCharacterTextMessage({
      chatId,
      character,
      content: reply.say,
      metadataExtra: {
        interactionType: INTERACTION_TYPES.DRAW_GUESS,
        drawGuessMessageId: messageId,
      },
    });
  } catch (error) {
    console.warn(
      '[DrawGuessAiService] 角色猜画失败，画已正常保留，可以重新猜。',
      error
    );

    try {
      await markMessageStatus(messageId, chatId, DRAW_GUESS_STATUS.FAILED);
    } catch {
      // 标记失败本身也失败时保持静默，卡片仍会在超时后出现重试入口
    }

    return null;
  } finally {
    inFlightMessageIds.delete(messageId);
  }
};
