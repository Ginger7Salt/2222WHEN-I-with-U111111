// src/apps/bubble/bubbleAiService.js
//
// 泡泡模式（Bubble Mode）的消息编排：广播/定向发送 + 每个角色独立隔离
// 上下文、顺序逐个生成回复。刻意不放进 src/services/aiService.js——那个
// 文件已经快5000行、单次对话单个角色的调用模型，跟泡泡模式"一次广播、
// 房间里每个角色各自用自己独立的上下文顺序回复"的编排逻辑完全不是一回
// 事，混在一起只会让两边都更难维护。
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
// 房间里"这个角色能看到的"用户消息（广播消息人人可见；@定向消息只有被
// @的那一个角色可见，见下面 buildIsolatedHistory）+ 这个角色自己发过的
// 回复，按时间顺序合并——不掺入这个角色在别处（自己的一对一聊天、别的
// 泡泡房间）的任何历史，这样才能让它"完全不知道其他角色存在"。
//
// composer 的"+"菜单（发语音/图片/转账），发送侧不再只有纯文本——
// sendBubbleBroadcastMessage 现在接收一个 { type, content, metadata }
// 消息体，而不是一段纯文本。非文本类型喂给AI时怎么描述（"[发送了语音: ...]"
// 这种）直接复用 aiService.js 的 formatMsgContentForPrompt——这本来就是个
// 不依赖chat特定状态的纯函数（只看 msg.type/content/metadata），跟
// parseAiResponseToMessages 一样的复用逻辑，不重新写一遍格式化规则。
//
// 切片C：@定向可见度。跟用户确认过——广播和定向消息共用同一张
// bubbleMessages 表，不是分两张表；每条用户消息多一个 targetCharacterId
// 字段（bubbleService.js 的 addBubbleMessage 本来就是通用透传，不用改），
// 空/null 表示广播（人人可见），有值表示只有那个角色能看到、会回复，其余
// 角色完全不知情——这条红线体现在两处：buildIsolatedHistory 按
// targetCharacterId 过滤这个角色能看到哪些用户消息；
// sendBubbleBroadcastMessage 只把回复请求派给被@的那一个角色，不是像广播
// 那样发给全员。@ 的解析（"@角色名 " 前缀）在 BubbleRoom.jsx 里做，这里
// 只管接收已经解析好的 targetCharacterId，不关心UI怎么输入的。

import db from '../../db';
import { parseAiResponseToMessages, formatMsgContentForPrompt } from '../../services/aiService';
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
 *
 * 非文本类型（语音/图片/转账等）不能把 content 原样喂给AI——那只是用户
 * 填的"描述/留言"，AI需要知道这是一条语音/图片/转账消息本身。用
 * formatMsgContentForPrompt 统一转成"[发送了语音: ...]"这种描述性文本，
 * 跟 aiService.js 在线聊天里的处理方式完全一致。
 *
 * 用户消息的可见性：没有 targetCharacterId（广播）的，人人可见；有
 * targetCharacterId 的，只有那一个角色能看到——这就是"完全不知道其他角色
 * 存在"这条设计红线在定向消息上的体现，跟广播消息用的是同一个过滤思路，
 * 只是多判断一个字段。角色自己发过的回复（不管是回广播还是回定向消息）
 * 对它自己永远可见，不需要按 target 过滤——那是它自己说过的话。
 */
const buildIsolatedHistory = (allRoomMessages, characterId) => (
  allRoomMessages
    .filter((m) => {
      if (m.senderType === 'user') {
        return !m.targetCharacterId || m.targetCharacterId === characterId;
      }
      return m.senderId === characterId;
    })
    .filter((m) => m.type !== 'error')
    .map((m) => ({
      role: m.senderType === 'user' ? 'user' : 'assistant',
      content: formatMsgContentForPrompt(m),
    }))
    .filter((m) => m.content)
);

/**
 * 泡泡房间版的系统提示词——参照 offlineSystemPrompt.js /
 * aiService.js 的 buildChatSystemPrompt 同一套结构（角色设定/世界书/
 * 用户人设），但按房间共用的用户人设（room.userName/room.userPersona，
 * 在 BubbleRoomSettingsModal.jsx 的"房间人设"面板编辑，房间没填就退回
 * 角色自己的默认人设），并且明确告诉角色"这是普通的一对一私聊"——不提
 * 房间、不提其他角色，维持"完全不知道其他角色存在"这条设计红线。
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

    // 这一轮触发回复的那条用户广播——保留完整消息对象（不只是 content），
    // 因为非文本类型（语音/图片/转账）镜像进一对一聊天记录时需要带上
    // 正确的 type/metadata，而不是全部拍扁成纯文本。
    const lastUserMessage = [...allRoomMessages]
      .reverse()
      .find((m) => m.senderType === 'user') || null;

    const lastUserText = lastUserMessage
      ? formatMsgContentForPrompt(lastUserMessage)
      : '';

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
        // 镜像用户这条广播/定向消息真实的类型/内容/附加信息（语音/图片/
        // 转账等），不拍扁成纯文本——记忆系统读到的应该是"用户转账了多少
        // 钱"，而不是转账留言那几个字。bubbleTargetCharacterId 只是留个
        // 信息标记（这条当初是不是定向发的），不影响记忆系统怎么处理它——
        // 反正镜像到这里的时候已经确定是"发给这个角色"的了。
        type: lastUserMessage?.type || 'text',
        content: lastUserMessage?.content || lastUserText,
        metadata: lastUserMessage?.metadata || {},
        bubbleTargetCharacterId: lastUserMessage?.targetCharacterId || null,
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
 * 用户发一条消息（广播或定向）：广播时房间里的每个角色顺序（不并发）各自
 * 独立生成一次回复，模拟真实群聊里"一个个冒泡"的节奏；定向（@了某个角色）
 * 时只有被@的那一个角色会生成回复，其余角色不会被调用、也永远不会在自己
 * 的隔离上下文里看到这条消息（见 buildIsolatedHistory）。
 *
 * message 支持两种传法：一个字符串（纯文本、必为广播，旧调用方式，向后
 * 兼容），或者一个 { type, content, metadata, targetCharacterId } 对象——
 * composer 的"+"菜单（发语音/图片/转账）和 @ 定向用的就是后者，
 * type/content/metadata 的字段形状跟 messages/ChatRoom.jsx 发送非文本消息
 * 时保持一致；targetCharacterId 留空/null 就是广播。
 */
export const sendBubbleBroadcastMessage = async (roomId, message) => {
  const isPlainText = typeof message === 'string';
  const type = isPlainText ? 'text' : (message?.type || 'text');
  const content = String((isPlainText ? message : message?.content) || '').trim();
  const metadata = (!isPlainText && message?.metadata) || {};
  const targetCharacterId = (!isPlainText && message?.targetCharacterId) || null;

  // 纯文本模式下，空内容不发；非文本类型（比如只填了转账金额没留言）允许
  // content 为空，跟 ChatRoom.jsx 的 handleSendMessage 同样的宽容度。
  if (type === 'text' && !content) return;

  const room = await getBubbleRoomById(roomId);
  if (!room) return;

  const memberIds = room.selectedCharacterIds || [];
  const allMembers = memberIds.length > 0
    ? await db.characters.where('id').anyOf(memberIds).toArray()
    : [];

  // 定向消息只把回复请求派给被@的那一个角色（如果它确实还是房间成员）；
  // 广播（没有 targetCharacterId）照旧发给全员。
  const respondingMembers = targetCharacterId
    ? allMembers.filter((m) => m.id === targetCharacterId)
    : allMembers;

  await addBubbleMessage({
    roomId: room.id,
    senderId: 'user',
    senderType: 'user',
    type,
    content,
    metadata,
    targetCharacterId,
    groupId: `user-${Date.now()}`,
  });

  notify({ type: 'BUBBLE_MESSAGE_ADDED', roomId: room.id });

  for (const character of respondingMembers) {
    // eslint-disable-next-line no-await-in-loop
    await generateCharacterReply({ room, character });
  }
};

export default {
  subscribeBubbleAiEvents,
  sendBubbleBroadcastMessage,
};