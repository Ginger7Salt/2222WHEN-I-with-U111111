// 角色"暂时不在线"的数据库部分：自动回复、上线后回复的任务、任务到点后的执行。
//
// 设计约束（防卡顿）：
// - 不新增任何定时器或事件监听。"上线后回复"只是预约表（db.scheduledMessages）里的一行，
//   由 scheduledMessageService 里已有的调度器（每 60 秒 + 切回前台时）顺带处理。
// - 只有"离线期间用户真的发了消息"才会写入这一行，每个离线时段最多一行。
// - 是否离线是纯计算（见 awayState.js），不轮询。

import Dexie from 'dexie';
import db from '../../../db';
import {
  AWAY_RETURN_SYSTEM_NOTE,
  AWAY_RETURN_TYPE,
  getAutoReplyText,
  getAwayState,
} from './awayState';

// 上线后并不是恰好到点就回复，随机晚 1 到 3 分钟，更像真人。
const RETURN_DELAY_MIN_MS = 60 * 1000;
const RETURN_DELAY_SPREAD_MS = 2 * 60 * 1000;

// 判断"有没有没回的消息"时最多回看多少条。
const UNANSWERED_LOOKBACK = 30;

/**
 * 写入一行"上线后回复"任务。同一个聊天窗同时只保留一行；
 * 已经有一行时，只在结束时间变了（用户改过时段）的情况下更新它。
 * 固定使用 keep 策略：用户之后再发消息也不会取消它，其他类别的预约也不会顶掉它。
 */
export const ensureAwayReturnTask = async ({ chatId, characterId, until }) => {
  if (!chatId || !characterId || !(until instanceof Date)) return null;

  const untilIso = until.toISOString();
  const dueIso = new Date(
    until.getTime() + RETURN_DELAY_MIN_MS + Math.floor(Math.random() * RETURN_DELAY_SPREAD_MS),
  ).toISOString();
  const nowIso = new Date().toISOString();

  let taskId = null;

  await db.transaction('rw', db.scheduledMessages, async () => {
    const existing = await db.scheduledMessages
      .where('chatId')
      .equals(chatId)
      .and((item) => item.status === 'pending' && item.scheduleType === AWAY_RETURN_TYPE)
      .first();

    if (existing) {
      taskId = existing.id;

      if (existing.awayUntil !== untilIso) {
        await db.scheduledMessages.update(existing.id, {
          scheduledFor: dueIso,
          awayUntil: untilIso,
          updatedAt: nowIso,
        });
      }

      return;
    }

    taskId = await db.scheduledMessages.add({
      chatId,
      characterId,
      scheduleType: AWAY_RETURN_TYPE,
      cancelPolicy: 'keep',
      intent: '',
      scheduledFor: dueIso,
      awayUntil: untilIso,
      status: 'pending',
      attemptCount: 0,
      sentMessageId: null,
      cancelledReason: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  return taskId;
};

/**
 * 用户在角色离线期间"有动静"（发消息、发表情、点回复按钮……）时调用。
 * - 不在离线时段：什么都不做，直接返回 { away: false }。
 * - 在离线时段：本时段第一次出一条自动回复（不调用 AI），并确保有一行"上线后回复"任务。
 * 可以重复调用，同一个离线时段内不会重复出自动回复，也不会重复建任务。
 */
export const handleUserActivityWhileAway = async ({ chatId, chat: chatArg = null }) => {
  const chat = chatArg || await db.chats.get(chatId);

  if (!chat) return { away: false, autoReplied: false, state: null };

  const state = getAwayState(chat);

  if (!state.away) return { away: false, autoReplied: false, state };

  const periodKey = state.until.toISOString();
  let autoReplied = false;

  // 放进同一个事务里，连续快速发送两条消息也只会出一条自动回复。
  await db.transaction('rw', db.chats, db.messages, async () => {
    const fresh = await db.chats.get(chat.id);

    if (!fresh || fresh.awayLastAutoReplyFor === periodKey) return;

    const nowIso = new Date().toISOString();

    await db.messages.add({
      chatId: chat.id,
      characterId: chat.characterId,
      sender: 'character',
      type: 'text',
      content: getAutoReplyText(fresh.awaySettings),
      metadata: { autoReply: true, awayUntil: periodKey },
      currentVersionIndex: 0,
      isRead: true,
      timestamp: nowIso,
    });

    await db.chats.update(chat.id, {
      awayLastAutoReplyFor: periodKey,
      updatedAt: nowIso,
    });

    autoReplied = true;
  });

  await ensureAwayReturnTask({
    chatId: chat.id,
    characterId: chat.characterId,
    until: state.until,
  });

  return { away: true, autoReplied, state };
};

// 用户最后一条"真正的消息"之后，角色有没有真正回复过。
// 自动回复、出错消息、通话记录、线下场景的消息都不算。
const hasUnansweredUserMessage = async (chatId) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(UNANSWERED_LOOKBACK)
    .toArray();

  for (const message of rows) {
    if (!message) continue;
    if (message.type === 'error' || message.type === 'call') continue;
    if (message.mode === 'offline') continue;
    if (message.sender === 'character' && message.metadata?.autoReply) continue;

    return message.sender === 'user';
  }

  return false;
};

/**
 * 任务到点后由 scheduledMessageService 调用。只做判断和触发，不写任务状态，
 * 状态更新（sent / cancelled / 顺延）由调用方按返回值处理。
 * 返回：
 *   { status: 'sent' }
 *   { status: 'cancelled', reason }
 *   { status: 'defer', until }   —— 现在仍在离线（用户改过时段），顺延到新的结束时间
 */
export const executeAwayReturn = async (task) => {
  const chat = await db.chats.get(task.chatId);

  if (!chat) return { status: 'cancelled', reason: 'chat_missing' };

  const state = getAwayState(chat);

  if (state.away) return { status: 'defer', until: state.until };

  if (!(await hasUnansweredUserMessage(task.chatId))) {
    return { status: 'cancelled', reason: 'nothing_to_answer' };
  }

  // aiService 反过来也会引入本文件（发送前的离线检查），这里用动态引入避免循环依赖。
  const { triggerAiResponse } = await import('../../../services/aiService');

  await triggerAiResponse(task.chatId, {
    ignoreAway: true,
    extraSystemNote: AWAY_RETURN_SYSTEM_NOTE,
  });

  return { status: 'sent' };
};