// 角色"暂时不在线"的数据库部分：
//   - 决定要不要把"可以离线"这个选项交给角色（getAwayOfferNote）
//   - 角色选择离线后，随机取时长并记录（applyAwayDirective / startCharacterAway）
//   - 离线期间的自动回复、上线后回复的任务、任务到点后的执行
//   - 用户手动让角色提前回来（endAwayNow）
//
// 设计约束（防卡顿）：
// - 不新增任何定时器或事件监听。"上线后回复"只是预约表（db.scheduledMessages）里的一行，
//   由 scheduledMessageService 里已有的调度器（每 60 秒 + 切回前台时）顺带处理。
// - 只有"离线期间用户真的发了消息"才会写入这一行，每个离线时段最多一行。
// - 是否离线是纯计算（见 awayState.js），不轮询。

import Dexie from 'dexie';
import db from '../../../db';
import {
  AWAY_OFFER_NOTE,
  AWAY_OFFER_PROBABILITY,
  AWAY_RETURN_SYSTEM_NOTE,
  AWAY_RETURN_TYPE,
  AWAY_TEXT_MAX_LENGTH,
  appendAwayLog,
  checkAwayLimits,
  extractAwayDirective,
  getAutoReplyText,
  getAwayState,
  isAwayAllowed,
  pickAwayMinutes,
} from './awayState';

// 上线后并不是恰好到点就回复，随机晚 1 到 3 分钟，更像真人。
const RETURN_DELAY_MIN_MS = 60 * 1000;
const RETURN_DELAY_SPREAD_MS = 2 * 60 * 1000;

// 判断"有没有没回的消息"时最多回看多少条。
const UNANSWERED_LOOKBACK = 30;

// 用户情绪低落时不让角色离线：只看最近这段时间里用户最近的几条消息。
const LOW_MOOD_WINDOW_MS = 6 * 60 * 60 * 1000;
const LOW_MOOD_LOOKBACK = 8;
const LOW_MOOD_PATTERN = new RegExp(
  '(难过|伤心|想哭|哭了|崩溃|撑不住|好累|很累|累死|害怕|焦虑|抑郁|绝望|心情不好|心情很差|睡不着|失眠|孤单|孤独|委屈|压力(好|很)大|不舒服|生病|难受|烦死|不想活|想不开)'
  + '|\\b(sad|crying|cry|depressed|anxious|panic|scared|lonely|sick|exhausted|upset|can\'t sleep|hurts?)\\b',
  'i',
);

/**
 * 最近用户有没有表现出情绪低落或身体不适。有的话，这个时候角色不该突然离线。
 */
export const hasLowMoodSignal = (messages = [], now = new Date()) => {
  const since = now.getTime() - LOW_MOOD_WINDOW_MS;

  const recentUserTexts = (Array.isArray(messages) ? messages : [])
    .filter((message) => (
      message
      && message.sender === 'user'
      && typeof message.content === 'string'
      && new Date(message.timestamp || 0).getTime() >= since
    ))
    .slice(-LOW_MOOD_LOOKBACK)
    .map((message) => message.content);

  return recentUserTexts.some((text) => LOW_MOOD_PATTERN.test(text));
};

// 只取"判断同一时间离线数量"需要的几个小字段，
// 避免把带大背景图的聊天记录整条留在内存里。
const loadAwayPeers = async () => {
  const peers = [];

  await db.chats.each((item) => {
    if (isAwayAllowed(item)) {
      peers.push({ id: item.id, awaySettings: item.awaySettings, awayUntil: item.awayUntil });
    }
  });

  return peers;
};

/**
 * 这一次回复要不要把"可以暂时离线"的说明交给角色。
 * 返回要追加到提示词里的文字；不该给的时候返回空字符串（一个字都不加）。
 * 检查顺序：先做不用读数据库的便宜判断，再按概率抽签，最后才读数据库。
 */
export const getAwayOfferNote = async ({
  chat,
  recentMessages = [],
  now = new Date(),
  random = Math.random,
}) => {
  if (!isAwayAllowed(chat)) return '';
  if (getAwayState(chat, now).away) return '';
  if (!checkAwayLimits({ chat, allChats: [], now }).ok) return '';
  if (random() >= AWAY_OFFER_PROBABILITY) return '';
  if (hasLowMoodSignal(recentMessages, now)) return '';

  const peers = await loadAwayPeers();

  return checkAwayLimits({ chat, allChats: peers, now }).ok ? AWAY_OFFER_NOTE : '';
};

/**
 * 角色选择了离线：再检查一次限制（可能有别的聊天窗刚刚离线了），
 * 通过的话随机取时长并写到聊天窗记录上。放在事务里，两个聊天窗同时选择离线也不会超额。
 * 返回 { started, until, minutes } 或 { started: false, reason }。
 */
export const startCharacterAway = async ({
  chatId,
  autoReplyText = '',
  now = new Date(),
  random = Math.random,
}) => {
  let result = { started: false, reason: 'unknown' };

  await db.transaction('rw', db.chats, async () => {
    const chat = await db.chats.get(chatId);

    if (!chat) {
      result = { started: false, reason: 'chat_missing' };
      return;
    }

    const peers = await loadAwayPeers();
    const limits = checkAwayLimits({ chat, allChats: peers, now });

    if (!limits.ok) {
      result = { started: false, reason: limits.reason };
      return;
    }

    const minutes = pickAwayMinutes(random);
    const until = new Date(now.getTime() + minutes * 60 * 1000);

    await db.chats.update(chatId, {
      awayUntil: until.toISOString(),
      awayAutoReplyText: String(autoReplyText || '').trim().slice(0, AWAY_TEXT_MAX_LENGTH),
      awayLog: appendAwayLog(chat.awayLog, now, until),
    });

    result = { started: true, until, minutes };
  });

  return result;
};

/**
 * 处理角色回复里的 [AWAY: ...] 标签：标签一律从正文里去掉；
 * 只有这次确实把选项交给了角色（offered）时，才会真的开始离线。
 * 返回去掉标签之后的正文。
 */
export const applyAwayDirective = async ({
  chatId,
  content,
  offered = false,
  now = new Date(),
  random = Math.random,
}) => {
  const { content: visibleContent, away } = extractAwayDirective(content);

  if (away && offered) {
    try {
      await startCharacterAway({ chatId, autoReplyText: away.autoReplyText, now, random });
    } catch (error) {
      console.warn('[Away] 记录角色离线失败：', error);
    }
  }

  return visibleContent;
};

/**
 * 用户手动让角色提前回来（或者关掉开关时结束离线）。
 * 会把这个聊天窗待执行的"上线后回复"任务改成立刻到点，由调用方接着
 * 触发一次 checkAndSendDueScheduledMessages()。
 */
export const endAwayNow = async (chatId, now = new Date()) => {
  let ended = false;

  await db.transaction('rw', db.chats, db.scheduledMessages, async () => {
    const chat = await db.chats.get(chatId);

    if (!chat || !getAwayState(chat, now).away) return;

    const log = Array.isArray(chat.awayLog) ? chat.awayLog.slice() : [];

    if (log.length > 0) {
      log[log.length - 1] = { ...log[log.length - 1], end: now.toISOString() };
    }

    await db.chats.update(chatId, {
      awayUntil: null,
      awayAutoReplyText: '',
      awayLog: log,
    });

    await db.scheduledMessages
      .where('chatId')
      .equals(chatId)
      .and((item) => item.status === 'pending' && item.scheduleType === AWAY_RETURN_TYPE)
      .modify({
        scheduledFor: new Date(now.getTime() - 1000).toISOString(),
        updatedAt: now.toISOString(),
      });

    ended = true;
  });

  return { ended };
};

/**
 * 写入一行"上线后回复"任务。同一个聊天窗同时只保留一行；
 * 已经有一行时，只在结束时间变了的情况下更新它。
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
 * - 在离线时段：这一次离线里第一次出一条自动回复（不调用 AI），并确保有一行"上线后回复"任务。
 * 可以重复调用，同一次离线内不会重复出自动回复，也不会重复建任务。
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
      content: getAutoReplyText(fresh),
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
 *   { status: 'defer', until }   —— 现在仍在离线，顺延到新的结束时间
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