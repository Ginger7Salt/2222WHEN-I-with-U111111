import db from '../../db';

export const OFFLINE_SESSION_STATUSES = {
  PENDING_REVIEW: 'pending_review', // 一方提议了时间，等待对方决定是否同意
  SCHEDULED: 'scheduled',           // 时间已确定，倒计时进行中
  ACTIVE: 'active',                 // 时间已到，可以进入线下场景对话
  COMPLETED: 'completed',           // 这次线下见面已经结束
  DECLINED: 'declined',             // 对方拒绝了提议的时间
  CANCELLED: 'cancelled',           // 邀约被取消（尚未到时间前，任意一方取消）
};

const nowIso = () => new Date().toISOString();

const assertChatId = (chatId) => {
  if (chatId === null || chatId === undefined || chatId === '') {
    throw new Error('缺少消息框标识，无法创建线下会话。');
  }
};

/**
 * 查询某个聊天窗当前"进行中/等待中"的线下会话（非 completed/declined/cancelled）。
 * 放在文件前面，供 propose* 函数在创建新邀约前做互斥检查，
 * 也供 ChatRoom 判断要不要显示"有一场线下邀约待处理"之类的提示。
 */
export const getPendingOfflineSession = async (chatId) => {
  assertChatId(chatId);

  const sessions = await db.offlineSessions
    .where('chatId')
    .equals(chatId)
    .toArray();

  return sessions.find((session) => (
    session.status === OFFLINE_SESSION_STATUSES.PENDING_REVIEW ||
    session.status === OFFLINE_SESSION_STATUSES.SCHEDULED ||
    session.status === OFFLINE_SESSION_STATUSES.ACTIVE
  )) || null;
};

/**
 * 角色主动发起邀约：现在也需要用户确认（对称设计），不再直接进入 SCHEDULED。
 * 会同时在 messages 表插入一张邀约卡片消息（mode 仍是 'online'，
 * 因为这张卡片本身出现在线上聊天室里）。
 */
export const proposeOfflineSessionByCharacter = async ({
  chatId,
  characterId,
  sceneLabel,
  sceneDescription = '',
  scheduledFor,
}) => {
  assertChatId(chatId);

  const existingSession = await getPendingOfflineSession(chatId);
  if (existingSession) {
    throw new Error('已经有一场进行中/待处理的线下邀约，不能重复发起。');
  }

  const now = nowIso();

  let sessionId;

  await db.transaction('rw', db.offlineSessions, db.messages, db.chats, async () => {
    sessionId = await db.offlineSessions.add({
      chatId,
      characterId,
      status: OFFLINE_SESSION_STATUSES.PENDING_REVIEW,
      proposedBy: 'character',
      sceneLabel,
      sceneDescription,
      scheduledFor,
      createdAt: now,
      updatedAt: now,
    });

    await db.messages.add({
      chatId,
      characterId,
      mode: 'online',
      sender: 'character',
      type: 'offline_invite',
      content: sceneLabel,
      metadata: {
        offlineSessionId: sessionId,
        sceneLabel,
        sceneDescription,
        scheduledFor,
        proposedBy: 'character',
        status: OFFLINE_SESSION_STATUSES.PENDING_REVIEW,
      },
      isRead: false,
      timestamp: now,
    });

    await db.chats.update(chatId, { updatedAt: now });
  });

  return sessionId;
};

/**
 * 用户主动发起邀约：进入"待角色审核"状态。
 * 角色是否同意这个时间，由后续一次独立的 AI 判断调用决定
 * （类似"心记"的回顾按钮模式，不在这里做判断，只负责状态存储）。
 */
export const proposeOfflineSessionByUser = async ({
  chatId,
  characterId,
  sceneLabel,
  sceneDescription = '',
  scheduledFor,
}) => {
  assertChatId(chatId);

  const existingSession = await getPendingOfflineSession(chatId);
  if (existingSession) {
    throw new Error('已经有一场进行中/待处理的线下邀约，不能重复发起。');
  }

  const now = nowIso();

  let sessionId;

  await db.transaction('rw', db.offlineSessions, db.messages, db.chats, async () => {
    sessionId = await db.offlineSessions.add({
      chatId,
      characterId,
      status: OFFLINE_SESSION_STATUSES.PENDING_REVIEW,
      proposedBy: 'user',
      sceneLabel,
      sceneDescription,
      scheduledFor,
      createdAt: now,
      updatedAt: now,
    });

    await db.messages.add({
      chatId,
      characterId,
      mode: 'online',
      sender: 'user',
      type: 'offline_invite',
      content: sceneLabel,
      metadata: {
        offlineSessionId: sessionId,
        sceneLabel,
        sceneDescription,
        scheduledFor,
        proposedBy: 'user',
        status: OFFLINE_SESSION_STATUSES.PENDING_REVIEW,
      },
      isRead: true,
      timestamp: now,
    });

    await db.chats.update(chatId, { updatedAt: now });
  });

  return sessionId;
};

const updateSessionAndCardStatus = async (sessionId, nextStatus, extraSessionFields = {}) => {
  const session = await db.offlineSessions.get(sessionId);
  if (!session) return null;

  const now = nowIso();

  await db.transaction('rw', db.offlineSessions, db.messages, async () => {
    await db.offlineSessions.update(sessionId, {
      status: nextStatus,
      updatedAt: now,
      ...extraSessionFields,
    });

    const cardMessage = await db.messages
      .where('type')
      .equals('offline_invite')
      .filter((m) => m.metadata?.offlineSessionId === sessionId)
      .first();

    if (cardMessage) {
      await db.messages.update(cardMessage.id, {
        metadata: {
          ...cardMessage.metadata,
          status: nextStatus,
          ...extraSessionFields,
        },
      });
    }
  });

  return db.offlineSessions.get(sessionId);
};

export const acceptOfflineSessionProposal = (sessionId) => (
  updateSessionAndCardStatus(sessionId, OFFLINE_SESSION_STATUSES.SCHEDULED)
);

export const declineOfflineSessionProposal = (sessionId) => (
  updateSessionAndCardStatus(sessionId, OFFLINE_SESSION_STATUSES.DECLINED)
);

export const activateOfflineSession = (sessionId) => (
  updateSessionAndCardStatus(sessionId, OFFLINE_SESSION_STATUSES.ACTIVE)
);

export const completeOfflineSession = (sessionId) => (
  updateSessionAndCardStatus(sessionId, OFFLINE_SESSION_STATUSES.COMPLETED, {
    completedAt: nowIso(),
  })
);

export const cancelOfflineSession = (sessionId) => (
  updateSessionAndCardStatus(sessionId, OFFLINE_SESSION_STATUSES.CANCELLED)
);

export const getOfflineSession = (sessionId) => (
  db.offlineSessions.get(sessionId)
);

/**
 * 供存档室/线下历史回看使用：某个聊天窗的全部线下会话（含已完成/已取消）。
 */
export const getAllOfflineSessionsForChat = async (chatId) => {
  assertChatId(chatId);

  const sessions = await db.offlineSessions
    .where('chatId')
    .equals(chatId)
    .toArray();

  return sessions.sort((a, b) => (
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));
};

// 线下见面结束后，这段时间内回到线上文字聊天，AI 应该"记得刚发生
// 过什么"；超过这个窗口就不再提醒——那之后交给长期记忆（回忆录）
// 去慢慢消化就够了，不需要一直在系统提示词里挂着一次几周前的见面。
const OFFLINE_AWARENESS_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 小时

/**
 * 供 aiService.js 在组装主聊天（线上）系统提示词时调用：如果这个
 * 聊天窗最近刚结束过一次线下见面，给 AI 一句处境提示 + 见面收尾
 * 那几句话，让它知道"我们刚线下见过"，不至于表现得像什么都没
 * 发生过——跟 callService.js 里 getActiveCallAwarenessNote 是
 * 同一个思路，只是这里对应的是"刚结束"而不是"正在进行"。
 */
export const getRecentOfflineAwarenessNote = async (chatId) => {
  if (!chatId) return '';

  const sessions = await db.offlineSessions
    .where('chatId')
    .equals(chatId)
    .toArray();

  const recentlyCompleted = sessions
    .filter((session) => (
      session.status === OFFLINE_SESSION_STATUSES.COMPLETED
      && session.completedAt
      && (Date.now() - new Date(session.completedAt).getTime()) < OFFLINE_AWARENESS_WINDOW_MS
    ))
    .sort((a, b) => (
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    ))[0];

  if (!recentlyCompleted) return '';

  const offlineMessages = await db.messages
    .where('offlineSessionId')
    .equals(recentlyCompleted.id)
    .sortBy('timestamp');

  const closingLines = offlineMessages
    .slice(-4)
    .map((message) => (
      `${message.sender === 'user' ? '用户' : '你'}：${String(message.content || '').slice(0, 60)}`
    ))
    .join('\n');

  return `

【线下见面刚刚结束】：你和用户不久前有过一次线下见面——「${recentlyCompleted.sceneLabel}」。这次见面已经结束，你们现在回到了手机文字聊天里。以下是那次见面收尾时的几句话，帮你记得刚发生过什么（完整经过已经在你们的共同记忆里，不需要复述这几行，只是提醒你别表现得像什么都没发生过）：
${closingLines || '（那次见面没有留下具体对话内容）'}`;
};