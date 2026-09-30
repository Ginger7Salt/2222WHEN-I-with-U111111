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
// - AI 接口调用本身不走 runAiToolOrchestrator（那一套是给MCP工具用的，
//   泡泡模式明确不接MCP），照抄 aiService.js 里
//   checkAndTriggerAutoSummary 那种最朴素的直接 fetch 调用即可。
//
// 2026-09 记忆接入回退：早期版本这里把角色在房间里的每条回复镜像写进它
// 真实的一对一聊天 chatId（mode:'bubble' 标记），再调用
// scheduleMemoryProcessing/markCharacterInteraction，让共享记忆系统（成长
// /情绪状态/反思等）吃到泡泡对话——写的时候是"单向"的（不读回一对一聊天
// 自己的消息列表/AI上下文），但生成出来的记忆记录本身，跟角色私聊攒下的
// 记忆物理上是同一个 chatId、同一张 memories 表，逻辑上分不开。用户反馈
// 不希望泡泡房间里的事情"计入"角色一对一聊天的记忆——排查过想把两者物理
// 分开需要新建专属聊天记录，而全项目有 20 多处"读取全部 db.chats、完全
// 不看 mode"的功能点（通话/韵律/平行轨道/雪花全局调度器、云端推送同步、
// 日记生成、黄历、归档、通话记录、快照、内心世界、转发选择器……），新建
// 记录会被这些地方一起读到，要逐个排除风险和工作量都不小。所以这一轮先
// 整个回退：泡泡模式暂时完全不碰共享记忆系统（不写、也不读取角色已有的
// 记忆/情绪状态注入到系统提示词里），只靠 bubbleMessages 本身撑起房间内
// 的隔离上下文。以后如果要给泡泡模式做长期记忆，应该是一套完全独立、跟
// 共享记忆系统物理隔离的新系统，不是回到这个镜像写入的老路子。
//
// 2026-09 新增：滚动总结（跟上面共享记忆系统完全无关，是解决另一个更
// 基础的问题——buildIsolatedHistory 原来对"这个角色能看到的历史"没有做
// 任何截断，房间聊得越久，每次生成回复喂给AI的历史就越长，迟早会顶到
// 上下文上限/token成本失控，这个问题不管接不接共享记忆系统都存在）。
// 照抄 RP 模式 rpAiService.js 的思路：每隔 BUBBLE_SUMMARY_INTERVAL_TURNS
// 轮自动生成一次总结，追加成独立条目（不覆盖），历史本身则截断到只保留
// 最近 BUBBLE_CONTEXT_WINDOW_SIZE 条。跟RP不同的地方：泡泡房间一个角色
// 看到的历史是从共享的 bubbleMessages 表按可见性过滤出来的"隔离视图"，
// 不是它自己独占的一张表，所以总结也必须按"角色"分开存（跟用户确认过），
// 存在 room.memberSummaries[characterId] 下面（见 bubbleService.js）。
//
// 隔离上下文的构成（已跟用户确认，泡泡模式设计定稿时就定了）：只包含这个
// 房间里"这个角色能看到的"用户消息（广播消息人人可见；@定向消息只有被
// @的那一个角色可见，见下面 filterIsolatedMessages）+ 这个角色自己发过的
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
// 角色完全不知情——这条红线体现在两处：filterIsolatedMessages 按
// targetCharacterId 过滤这个角色能看到哪些用户消息；
// sendBubbleBroadcastMessage 只把回复请求派给被@的那一个角色，不是像广播
// 那样发给全员。@ 的解析（"@角色名 " 前缀）在 BubbleRoom.jsx 里做，这里
// 只管接收已经解析好的 targetCharacterId，不关心UI怎么输入的。

import db from '../../db';
import { parseAiResponseToMessages, formatMsgContentForPrompt } from '../../services/aiService';
import {
  getBubbleRoomById,
  getBubbleMessages,
  addBubbleMessage,
  getBubbleMemberSummaryEntries,
  addBubbleMemberSummaryEntry,
} from './bubbleService';

// 房间自己的滚动总结每隔多少"轮"自动生成一次（1轮 = 1条用户可见消息 +
// 这个角色的1次回复），跟 RP 模式 session.summaryIntervalTurns 的默认值
// 保持一致，先给个固定常量，等真有"泡泡房间也要能在设置面板里调这个数"
// 的需求再改成可配置字段，不提前做。
const BUBBLE_SUMMARY_INTERVAL_TURNS = 50;

// 实际喂给AI的原始历史只保留最近这么多条（超出的部分只能靠上面的滚动
// 总结去"记得"），同样先给固定常量，跟 RP 的 contextWindowSize 默认值
// 保持一致。
const BUBBLE_CONTEXT_WINDOW_SIZE = 60;

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
 * 过滤出某个角色在这个泡泡房间里"能看到的"原始消息（保留 id/timestamp
 * 等完整字段，不拍扁），用户消息的可见性：没有 targetCharacterId（广播）
 * 的，人人可见；有 targetCharacterId 的，只有那一个角色能看到——这就是
 * "完全不知道其他角色存在"这条设计红线在定向消息上的体现，跟广播消息
 * 用的是同一个过滤思路，只是多判断一个字段。角色自己发过的回复（不管是
 * 回广播还是回定向消息）对它自己永远可见，不需要按 target 过滤——那是它
 * 自己说过的话。
 *
 * 之所以拆成"先过滤出原始消息、再单独格式化成 {role,content}"两步（原来
 * 是一步到位的 buildIsolatedHistory），是因为滚动总结需要原始消息的 id
 * （用来记录"总结到哪条消息为止"）和 senderType（总结提示词里要区分是
 * 用户说的还是角色说的），格式化成 {role,content} 之后这些信息就丢了。
 */
const filterIsolatedMessages = (allRoomMessages, characterId) => (
  allRoomMessages
    .filter((m) => {
      if (m.senderType === 'user') {
        return !m.targetCharacterId || m.targetCharacterId === characterId;
      }
      return m.senderId === characterId;
    })
    .filter((m) => m.type !== 'error')
);

/**
 * 把过滤好的原始消息数组转成 {role, content} 数组，直接喂给 chat
 * completions 接口。非文本类型（语音/图片/转账等）不能把 content 原样
 * 喂给AI——那只是用户填的"描述/留言"，AI需要知道这是一条语音/图片/转账
 * 消息本身。用 formatMsgContentForPrompt 统一转成"[发送了语音: ...]"这种
 * 描述性文本，跟 aiService.js 在线聊天里的处理方式完全一致。
 */
const formatMessagesForPrompt = (messages) => (
  messages
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
 *
 * summaryText：这个角色在这个房间里的滚动总结拼接文本（见文件顶部注释），
 * 没有总结条目时是空字符串，不额外显示这一节。
 */
const buildBubbleSystemPrompt = async ({ character, room, summaryText }) => {
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

  const summarySection = summaryText
    ? `\n【之前发生过的事（摘要）】:\n${summaryText}\n`
    : '';

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
${summarySection}
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
 * 拼一段"总结这一批新剧情"的请求文本，跟 RP 模式 rpAiService.js 的
 * buildSummaryPrompt 是同一个思路——只让AI输出摘要正文本身，不要标题、
 * 不要客套话，这段文本会作为一个独立条目追加进
 * room.memberSummaries[characterId]，不跟这个角色已有的总结条目融合
 * （每次总结各自独立成条，可以单独编辑/删除）。
 */
const buildBubbleSummaryPrompt = (batchText) => `你是一个私聊对话的记忆整理模块。下面是最近新发生的一段对话。

请把这段对话总结成一份简短的摘要——保留对之后对话有用的关键事件、提到的偏好、约定，去掉无关的寒暄和重复细节，尽量精炼。只输出摘要正文本身，不要加"总结："这类标题，不要加任何解释或客套话，也不需要提及这是第几次总结。

【这一段的对话】
${batchText}`;

/**
 * 检查这个角色在这个房间里是否该自动生成一次新的总结条目了，够数就真的
 * 发一次AI请求。isolatedMessages 必须是这个角色当前完整的隔离视图（未
 * 截断的全量，不是喂给正常回复那个已经按 BUBBLE_CONTEXT_WINDOW_SIZE
 * 截窗口之后的版本——总结要看到的是"窗口之外、还没被总结过"的那一段）。
 *
 * 总结失败只是静默记一条 warning，不影响这一轮正常收发——见 RP 模式的
 * 同名机制，下次这个角色再触发回复、条件仍然满足时会自动重试。
 */
const maybeGenerateBubbleSummary = async ({ room, character, isolatedMessages }) => {
  const existingEntries = getBubbleMemberSummaryEntries(room, character.id);
  const turnsThresholdMessages = BUBBLE_SUMMARY_INTERVAL_TURNS * 2;
  const coveredThroughId = existingEntries.length
    ? existingEntries[existingEntries.length - 1].coveredThroughMessageId || 0
    : 0;
  const newMessages = isolatedMessages.filter((m) => m.id > coveredThroughId);

  if (newMessages.length < turnsThresholdMessages) return;

  try {
    const batchText = newMessages
      .map((m) => {
        const speaker = m.senderType === 'user' ? (room.userName || '用户') : (character?.name || 'TA');
        return `${speaker}: ${formatMsgContentForPrompt(m)}`;
      })
      .join('\n');

    const prompt = buildBubbleSummaryPrompt(batchText);
    const newSummary = await requestBubbleCompletion({
      systemPrompt: '你是一个私聊对话的记忆整理模块，只输出摘要正文。',
      history: [{ role: 'user', content: prompt }],
    });

    await addBubbleMemberSummaryEntry(room.id, character.id, {
      text: String(newSummary || '').trim(),
      coveredFromMessageId: newMessages[0].id,
      coveredThroughMessageId: newMessages[newMessages.length - 1].id,
    });

    notify({ type: 'BUBBLE_SUMMARY_UPDATED', roomId: room.id, characterId: character.id });
  } catch (error) {
    console.warn('[bubbleAiService] 自动总结失败，将在下次满足条件时重试:', error?.message || error);
  }
};

/**
 * 单个角色针对当前房间状态生成一次回复：组装隔离上下文 -> 调接口 ->
 * 拆分成卡片 -> 写进 bubbleMessages（渲染用）-> 检查是否该自动总结了。
 * 出错时落一条 error 类型的房间消息，不让整个广播链路因为一个角色失败
 * 就中断（for 循环里逐个 try/catch，见 sendBubbleBroadcastMessage）。
 */
const generateCharacterReply = async ({ room, character }) => {
  notify({ type: 'BUBBLE_TYPING_START', roomId: room.id, characterId: character.id });

  try {
    const allRoomMessages = await getBubbleMessages(room.id);
    const isolatedMessages = filterIsolatedMessages(allRoomMessages, character.id);
    const windowedMessages = isolatedMessages.length > BUBBLE_CONTEXT_WINDOW_SIZE
      ? isolatedMessages.slice(-BUBBLE_CONTEXT_WINDOW_SIZE)
      : isolatedMessages;
    const isolatedHistory = formatMessagesForPrompt(windowedMessages);

    const summaryEntries = getBubbleMemberSummaryEntries(room, character.id);
    const summaryText = summaryEntries.map((entry) => entry.text).join('\n\n');

    const systemPrompt = await buildBubbleSystemPrompt({ character, room, summaryText });

    const rawText = await requestBubbleCompletion({
      systemPrompt,
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

    // 总结要看到"包含刚写入的这条回复"的最新隔离视图，重新拉一次全量
    // 消息再过滤，而不是复用上面还没加上这次回复的 isolatedMessages。
    const updatedRoomMessages = await getBubbleMessages(room.id);
    const updatedIsolatedMessages = filterIsolatedMessages(updatedRoomMessages, character.id);
    await maybeGenerateBubbleSummary({ room, character, isolatedMessages: updatedIsolatedMessages });
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
 * 的隔离上下文里看到这条消息（见 filterIsolatedMessages）。
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