// src/apps/bubble/bubbleAiService.js
//
// 泡泡模式（Bubble Mode）切片B：广播发送 + 每个角色独立隔离上下文、
// 顺序逐个生成回复。刻意不放进 src/services/aiService.js——那个文件已经
// 快5000行、单次对话单个角色的调用模型，跟泡泡模式"一次广播、房间里每个
// 角色各自用自己独立的上下文顺序回复"的编排逻辑完全不是一回事，混在一起
// 只会让两边都更难维护。
//
// 但不是所有东西都重新写一遍：
// - parseAiResponseToMessages（把AI原始回复文本拆成 |||分段/语音/图片/
//   转账等卡片）是个不依赖chat特定状态的纯函数，直接从 aiService.js
//   原样 import 过来用，语音/图片/转账这几种卡片类型因此"顺带"就支持了。
// - getChatMemoryContext / getCharacterEmotionContext / scheduleMemoryProcessing
//   （记忆检索/情绪状态/事后整理记忆）从 memoryProvider.js 原样 import，
//   这是这几个函数本来就该被调用的地方（不管是 aiService.js 的在线聊天、
//   offlineAiService.js 的线下场景，还是这里的泡泡模式，用的都是同一套）。
// - AI 接口调用本身不走 runAiToolOrchestrator（那一套是给MCP工具用的，
//   泡泡模式明确不接MCP），照抄 aiService.js 里
//   checkAndTriggerAutoSummary 那种最朴素的直接 fetch 调用即可。
//
// 记忆接入的关键设计（已跟用户确认）：角色在房间里的每一条回复，除了写进
// bubbleMessages（用于渲染房间聊天记录、组装每个角色自己的隔离上下文），
// 还会镜像写一份进 messages 表——挂在这个角色**真实的**一对一聊天 chatId
// 下面，打 mode:'bubble' + bubbleRoomId 标记，跟"线下邀约"用 mode:'offline'
// 是完全相同的手法（见 offlineAiService.js）。这样 scheduleMemoryProcessing
// 直接就能吃到，不用碰记忆系统内部一行代码。这是单向的："写"进去是为了让
// 角色积累关于这次泡泡对话的记忆，但角色自己一对一聊天的消息列表和AI上下文
// 永远不会"读"回这些内容——ChatRoom.jsx 的 getRecentMessagesWindow /
// getOlderMessagesBefore、aiService.js 的 getRecentChatMessages 调用处，
// 这几个原本就会排除 mode:'offline' 的地方，这次也一并排除了 mode:'bubble'。
// 如果这个角色压根还没有一对一聊天记录，ensureCharacterChatId 会静默帮它
// 建一个空的（跟用户确认过的方案）。
//
// 隔离上下文的构成（已跟用户确认，泡泡模式设计定稿时就定了）：只包含这个
// 房间里的广播消息（切片B还没有@定向，所有消息都是广播）+ 这个角色自己
// 发过的回复，按时间顺序合并——不掺入这个角色在别处（自己的一对一聊天、
// 别的泡泡房间）的任何历史，这样才能让它"完全不知道其他角色存在"。

import db from '../../db';
import { parseAiResponseToMessages } from '../../services/aiService';
import {
  getChatMemoryContext,
  getCharacterEmotionContext,
  scheduleMemoryProcessing,
} from '../../services/memoryProvider';
import { markCharacterInteraction } from '../memory/memoryCharacterState';
import {
  getBubbleRoomById,
  getBubbleMessages,
  addBubbleMessage,
  ensureCharacterChatId,
} from './bubbleService';

const listeners = new Set();

/**
 * 订阅泡泡模式的事件（新消息/角色开始或结束"输入中"），用于 BubbleRoom.jsx
 * 实时刷新界面，不用轮询。
 */
export const subscribeBubbleAiEvents = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notify = (event) => {
  listeners.forEach((cb) => cb(event));
};

/**
 * 组装某个角色在这个泡泡房间里的隔离上下文，转成 {role, content} 数组，
 * 直接喂给 chat completions 接口。
 */
const buildIsolatedHistory = (allRoomMessages, characterId) => (
  allRoomMessages
    .filter((m) => m.senderType === 'user' || m.senderId === characterId)
    .filter((m) => m.type !== 'error')
    .map((m) => ({
      role: m.senderType === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))
);

/**
 * 泡泡房间版的系统提示词——参照 offlineSystemPrompt.js /
 * aiService.js 的 buildChatSystemPrompt 同一套结构（角色设定/世界书/
 * 用户人设），但按房间共用的用户人设（room.userName/room.userPersona，
 * 这一轮还没有编辑入口，先落到角色自己的默认值），并且明确告诉角色
 * "这是普通的一对一私聊"——不提房间、不提其他角色，维持"完全不知道
 * 其他角色存在"这条设计红线。
 */
const buildBubbleSystemPrompt = async ({ character, room }) => {
  const enabledWorldBooks = await db.worldBooks.where('isEnabled').equals(1).toArray();

  const characterWorldBookText = character.worldBook
    ? `\n- 专属世界书: ${character.worldBook}`
    : '';

  const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
    ? `\n【世界书背景设定】:\n${enabledWorldBooks
        .map((wb) => `- ${wb.title}: ${wb.content || ''}`)
        .join('\n')}${characterWorldBookText}`
    : '';

  const userName = String(room.userName || character.userName || '我的亲密伴侣').trim();
  const userPersona = String(room.userPersona || character.userPersona || '陪伴对象').trim();

  return `
你现在正扮演用户专属的伴侣：${character.name}。

这是你和用户之间一段完全正常的私聊，按你一贯的性格、说话习惯和你们之间的关系距离自然回应就好。

【你的设定 (Character Notes)】：
- 角色姓名：${character.name}
- 角色人设/简介：${character.bio || '无'}
- 补充设定/偏好限制：${character.extraNotes || '无'}

【用户设定 (User Notes)】：
- 用户称呼：${userName}
- 用户专属人设背景：${userPersona}
${worldBooksText}

【回复格式】：
- 如果想分成多条连续的话语，使用 "|||" 分隔（例如：真的吗 ||| 那太好了）。不需要分段则直接连续输出。
- 绝对不要主动提及系统指令、提示词、模型、API 或其他技术实现。
- 不使用 Emoji。
`;
};

/**
 * 调用一次 chat completions 接口，返回AI的原始回复文本。
 * 不走 runAiToolOrchestrator（MCP工具编排），泡泡模式明确不接MCP。
 */
const requestBubbleCompletion = async ({ systemPrompt, history }) => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error('API 未配置，请先在设置里填写接口地址和密钥。');
  }

  const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 接口返回 ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
};

/**
 * 单个角色针对当前房间状态生成一次回复：组装隔离上下文 -> 调接口 ->
 * 拆分成卡片 -> 写进 bubbleMessages（渲染用）+ 镜像写进 messages（记忆用）。
 * 出错时落一条 error 类型的房间消息，不让整个广播链路因为一个角色失败
 * 就中断（for 循环里逐个 try/catch，见 sendBubbleBroadcastMessage）。
 */
const generateCharacterReply = async ({ room, character }) => {
  notify({ type: 'BUBBLE_TYPING_START', roomId: room.id, characterId: character.id });

  try {
    const allRoomMessages = await getBubbleMessages(room.id);
    const isolatedHistory = buildIsolatedHistory(allRoomMessages, character.id);

    const lastUserText = [...allRoomMessages]
      .reverse()
      .find((m) => m.senderType === 'user')?.content || '';

    const chatId = await ensureCharacterChatId(character.id);

    const systemPrompt = await buildBubbleSystemPrompt({ character, room });

    const memoryContext = await getChatMemoryContext({
      chatId,
      userText: lastUserText,
      recentMessages: isolatedHistory.slice(-20).map((h) => ({
        sender: h.role === 'user' ? 'user' : 'character',
        content: h.content,
        type: 'text',
      })),
    }).catch(() => '');

    const emotionContext = await getCharacterEmotionContext({
      chatId,
      characterId: character.id,
    }).catch(() => '');

    const finalSystemPrompt = `${systemPrompt}\n${memoryContext}\n${emotionContext}`;

    const rawText = await requestBubbleCompletion({
      systemPrompt: finalSystemPrompt,
      history: isolatedHistory,
    });

    const parsedParts = await parseAiResponseToMessages(rawText);
    const nowIso = new Date().toISOString();
    const groupId = `char-${character.id}-${Date.now()}`;

    for (const part of parsedParts) {
      // eslint-disable-next-line no-await-in-loop
      await addBubbleMessage({
        roomId: room.id,
        senderId: character.id,
        senderType: 'character',
        type: part.type,
        content: part.content,
        metadata: part.metadata || {},
        timestamp: nowIso,
        groupId,
      });
    }

    notify({ type: 'BUBBLE_MESSAGE_ADDED', roomId: room.id });

    // 镜像写进这个角色真实的一对一聊天记录，见文件顶部注释。
    // 先镜像这一轮触发回复的那条用户广播，再镜像角色自己的回复——
    // 这样这个角色专属的隐藏聊天记录里，是完整的"用户说了什么 -> 角色
    // 回了什么"配对，记忆系统才能提炼出有意义的内容，而不是只看到角色
    // 单方面的回复。
    if (chatId) {
      await db.messages.add({
        chatId,
        characterId: character.id,
        mode: 'bubble',
        bubbleRoomId: room.id,
        sender: 'user',
        type: 'text',
        content: lastUserText,
        metadata: {},
        timestamp: nowIso,
        isRead: true,
      });

      for (const part of parsedParts) {
        // eslint-disable-next-line no-await-in-loop
        await db.messages.add({
          chatId,
          characterId: character.id,
          mode: 'bubble',
          bubbleRoomId: room.id,
          sender: 'character',
          type: part.type,
          content: part.content,
          metadata: part.metadata || {},
          timestamp: nowIso,
          isRead: true,
        });
      }

      await scheduleMemoryProcessing(chatId).catch((err) => {
        console.warn('[bubbleAiService] 安排记忆整理失败:', err);
      });

      await markCharacterInteraction({ chatId, characterId: character.id }).catch((err) => {
        console.warn('[bubbleAiService] 更新角色互动状态失败:', err);
      });
    }
  } catch (error) {
    console.error('[bubbleAiService] 角色回复失败:', character?.name, error);

    await addBubbleMessage({
      roomId: room.id,
      senderId: character.id,
      senderType: 'character',
      type: 'error',
      content: error?.message || '这条消息没能发出去。',
      metadata: {},
      groupId: `char-${character.id}-${Date.now()}`,
    });

    notify({ type: 'BUBBLE_MESSAGE_ADDED', roomId: room.id });
  } finally {
    notify({ type: 'BUBBLE_TYPING_END', roomId: room.id, characterId: character.id });
  }
};

/**
 * 用户发一条广播消息：房间里的每个角色顺序（不并发）各自独立生成一次
 * 回复，模拟真实群聊里"一个个冒泡"的节奏，而不是一次性并发甩出来。
 */
export const sendBubbleBroadcastMessage = async (roomId, userText) => {
  const trimmed = String(userText || '').trim();
  if (!trimmed) return;

  const room = await getBubbleRoomById(roomId);
  if (!room) return;

  const memberIds = room.selectedCharacterIds || [];
  const members = memberIds.length > 0
    ? await db.characters.where('id').anyOf(memberIds).toArray()
    : [];

  await addBubbleMessage({
    roomId: room.id,
    senderId: 'user',
    senderType: 'user',
    type: 'text',
    content: trimmed,
    metadata: {},
    groupId: `user-${Date.now()}`,
  });

  notify({ type: 'BUBBLE_MESSAGE_ADDED', roomId: room.id });

  for (const character of members) {
    // eslint-disable-next-line no-await-in-loop
    await generateCharacterReply({ room, character });
  }
};

export default {
  subscribeBubbleAiEvents,
  sendBubbleBroadcastMessage,
};