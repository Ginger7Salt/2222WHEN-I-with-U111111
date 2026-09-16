// src/services/cloudPushService.js
import Dexie from 'dexie';
import db from '../db';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 动态获取用户在应用内配置的推送服务器地址
 * 严禁任何硬编码域名兜底
 */
export async function getEffectiveServerUrl(explicitUrl) {
  if (explicitUrl && typeof explicitUrl === 'string') {
    return explicitUrl.trim().replace(/\/$/, '');
  }

  const cloudPushSetting = await db.settings.get('cloudPushConfig');
  const savedUrl = cloudPushSetting?.value?.serverUrl;
  if (savedUrl && typeof savedUrl === 'string') {
    return savedUrl.trim().replace(/\/$/, '');
  }

  return '';
}

const MAX_CONTEXT_MESSAGES = 8;

function getMessageText(message) {
  if (Array.isArray(message?.versions) && message.versions.length > 0) {
    const index = Number.isInteger(message.currentVersionIndex)
      ? message.currentVersionIndex
      : 0;

    return (
      message.versions[index]?.content ||
      message.versions[index]?.text ||
      message.content ||
      ''
    );
  }

  return message?.content || '';
}

function getTimestampMs(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

function toIsoTimestamp(value) {
  const time = getTimestampMs(value);
  return time > 0 ? new Date(time).toISOString() : '';
}

function formatContextMessages(messages, { characterName, userName } = {}) {
  const safeCharacterName = characterName || '伴侣';
  const safeUserName = userName || '你';

  return messages
    .slice()
    .sort(
      (a, b) =>
        getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp),
    )
    .map((message) => {
      const text = getMessageText(message).trim();
      if (!text) return '';

      const tag =
        message.sender === 'user'
          ? safeUserName
          : safeCharacterName;

      return `${tag}: ${text}`;
    })
    .filter(Boolean)
    .slice(-MAX_CONTEXT_MESSAGES)
    .join('；');
}

async function readRecentChatContext(chat, charObj = {}) {
  const chatId = Number(chat.id);

  const characterName =
    charObj.name ||
    chat.title ||
    '伴侣';

  const userName =
    chat.userName ||
    charObj.userName ||
    '你';

  let recentMessages = [];

  try {
    recentMessages = await db.messages
      .where('[chatId+timestamp]')
      .between(
        [chatId, Dexie.minKey],
        [chatId, Dexie.maxKey],
      )
      .reverse()
      .limit(MAX_CONTEXT_MESSAGES)
      .toArray();
  } catch (error) {
    // 降级时不要直接 reverse 主键索引，读取后按 timestamp 倒排截取
    const allMessages = await db.messages
      .where('chatId')
      .equals(chatId)
      .toArray();

    recentMessages = allMessages
      .sort(
        (a, b) =>
          getTimestampMs(b.timestamp) -
          getTimestampMs(a.timestamp),
      )
      .slice(0, MAX_CONTEXT_MESSAGES);
  }

  const orderedMessages = recentMessages
    .slice()
    .sort(
      (a, b) =>
        getTimestampMs(a.timestamp) -
        getTimestampMs(b.timestamp),
    );

  const latestMessageAt =
    orderedMessages.length > 0
      ? toIsoTimestamp(
          orderedMessages[orderedMessages.length - 1].timestamp,
        )
      : '';

  return {
    recentContext: formatContextMessages(orderedMessages, {
      characterName,
      userName,
    }),
    latestMessageAt,
  };
}

/**
 * 🛠️ 开屏/切回前台对齐兜底（全聊天框通用）
 * 从 cloudPushConfig.serverUrl 拉取未写入本地的消息，不使用任何硬编码服务器兜底
 */
export async function syncPendingPushMessages() {
  try {
    const cleanServerUrl = await getEffectiveServerUrl();

    if (!cleanServerUrl) {
      return; // 用户未配置推送服务器，静默退出
    }

    const res = await fetch(`${cleanServerUrl}/api/fetch-pending-messages`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;

    const data = await res.json();

    const messages = Array.isArray(data.messages)
      ? data.messages
      : [];

    const syncedIds = [];

    for (const msg of messages) {
      const targetChatId = Number(msg.chatId || 1);
      
      // 1. 严格标准化为 ISO 8601 字符串
      const nowIso =
        typeof msg.timestamp === 'string' && msg.timestamp.includes('T')
          ? msg.timestamp
          : new Date(msg.timestamp || Date.now()).toISOString();

      const contentText = msg.content || '';

      // 2. 基于 [chatId+timestamp] 查重（兼容降级到内容比对）
      let exists = false;
      try {
        exists = await db.messages
          .where('[chatId+timestamp]')
          .equals([targetChatId, nowIso])
          .first();
      } catch (err) {
        exists = await db.messages
          .where('chatId')
          .equals(targetChatId)
          .filter(
            (m) =>
              m.timestamp === nowIso ||
              (m.content === contentText &&
                Math.abs(new Date(m.timestamp).getTime() - new Date(nowIso).getTime()) < 3000),
          )
          .first();
      }

      if (!exists) {
        // 彻底剥离可能存在的外部 id，确保 messages 表的自增生效
        const { id, ...recordToSave } = msg;

        // 3. 严格对齐前端真实的数据模型
        const messageRecord = {
          chatId: targetChatId,
          characterId: Number(recordToSave.characterId || 1),
          sender: 'character', // ⚠️ 核心：绝不能是 assistant，必须是 character
          type: 'text',
          content: contentText,
          metadata: {
            isOfflinePush: true,
            source: 'cloud-pending-sync',
            ...(recordToSave.metadata || {}),
          },
          quotedMessageId: recordToSave.quotedMessageId ?? null,
          isRead: false,       // ⚠️ 核心：布尔值 false
          timestamp: nowIso,   // ⚠️ 核心：ISO 字符串
          // ⚠️ 核心：versions 内部结构必须是 type, content, timestamp
          versions: [
            {
              type: 'text',
              content: contentText,
              timestamp: nowIso,
              metadata: {
                isOfflinePush: true,
                model: recordToSave.metadata?.model || 'cloud-push-ai',
              },
            },
          ],
          currentVersionIndex: 0,
        };

        // 4. 写入数据库
        const newMsgId = await db.messages.add(messageRecord);

        // 5. 联动更新 chats 列表（更新时间和最后一条摘要）
        await db.chats.where('id').equals(targetChatId).modify({
          updatedAt: nowIso,
          summary: contentText.slice(0, 30),
        });

        // 6. 广播本地事件，通知 React 界面立刻弹出气泡
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('new-local-message-inserted', {
              detail: {
                chatId: targetChatId,
                messageId: newMsgId,
              },
            }),
          );
          window.dispatchEvent(
            new CustomEvent('local-chat-updated', {
              detail: {
                chatId: targetChatId,
              },
            }),
          );
        }
      }

      if (msg.id) {
        syncedIds.push(msg.id);
      }
    }

    // 回执确认，服务端清理已同步消息
    if (syncedIds.length > 0) {
      await fetch(`${cleanServerUrl}/api/ack-pending-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: syncedIds }),
      }).catch(() => {});
    }

    // pending 消息落库并完成回执后，立即重新同步全部聊天上下文完成闭环
    await syncAllChatContextsToCloud();

  } catch (e) {
    // 纯离线或网络波动时静默跳过
  }
}

/**
 * 获取本地下一条尚未到期的预约任务。
 *
 * 这里使用安全探测：
 * - 如果当前 Dexie 没有 scheduledMessages 表，直接返回 null
 * - 如果 status 没有索引，则退化为全表读取
 * - 只返回未来时间且状态为 pending 的最早任务
 */
async function getNextPendingScheduledTask() {
  try {
    const scheduledTable = db?.scheduledMessages;

    if (!scheduledTable) {
      return null;
    }

    let records = [];

    try {
      records = await scheduledTable
        .where('status')
        .equals('pending')
        .toArray();
    } catch (indexError) {
      records = await scheduledTable.toArray();
    }

    const now = Date.now();

    const pendingTasks = records
      .filter((task) => {
        if (!task || task.status && task.status !== 'pending') {
          return false;
        }

        if (!task.scheduledFor) {
          return false;
        }

        const scheduledTime =
          typeof task.scheduledFor === 'number'
            ? task.scheduledFor
            : new Date(task.scheduledFor).getTime();

        return Number.isFinite(scheduledTime) && scheduledTime > now;
      })
      .sort((a, b) => {
        const timeA =
          typeof a.scheduledFor === 'number'
            ? a.scheduledFor
            : new Date(a.scheduledFor).getTime();

        const timeB =
          typeof b.scheduledFor === 'number'
            ? b.scheduledFor
            : new Date(b.scheduledFor).getTime();

        return timeA - timeB;
      });

    return pendingTasks[0] || null;
  } catch (error) {
    // 预约表不存在、数据库升级中或读取失败时，不影响推送注册
    return null;
  }
}

/**
 * 注册并向云端同步推送配置
 * 收集用户存在/聊过的所有消息框，使其全部具备云端独立主动发信的能力
 */
export async function registerCloudPush({
  serverUrl,
  vapidPublicKey,
} = {}) {
  // 1. 优先从参数取，没传则从 db.settings 取，绝不硬编码
  let targetServerUrl = serverUrl;
  let targetVapidKey = vapidPublicKey;

  if (!targetServerUrl || !targetVapidKey) {
    const cloudPushSetting = await db.settings.get('cloudPushConfig');
    targetServerUrl = targetServerUrl || cloudPushSetting?.value?.serverUrl;
    targetVapidKey = targetVapidKey || cloudPushSetting?.value?.vapidPublicKey;
  }

  const cleanServerUrl = (targetServerUrl || '').trim().replace(/\/$/, '');
  const cleanVapidKey = (targetVapidKey || '').trim();

  if (!cleanServerUrl || !cleanVapidKey) {
    throw new Error('请完整配置推送服务器地址与 VAPID 公钥');
  }

  // 2. 跨平台 PWA 环境检测
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone =
    window.navigator.standalone ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    throw new Error(
      'iOS 设备必须通过 Safari【添加到主屏幕】并在桌面上打开本应用！',
    );
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('当前浏览器不支持 Web Push 推送功能');
  }

  // 3. 申请系统通知权限
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('系统通知权限被拒绝，无法开启主动推送');
  }

  // 4. 获取 APNs / FCM 订阅凭据
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cleanVapidKey),
      });
    } catch (subErr) {
      throw new Error(`申请系统推送凭证失败: ${subErr.message}`);
    }
  }

  // 5. 🎯 核心：遍历所有存在的消息框，全部具备主动发信能力
  const allChats = await db.chats.toArray();
  if (!allChats || allChats.length === 0) {
    throw new Error('本地尚未创建任何聊天框');
  }

  const allCharacters = await db.characters.toArray();
  const characterMap = new Map(allCharacters.map((c) => [c.id, c]));

  // 为每一个聊天框独立抽取专属的上下文与人设信息
  const chatTargets = [];

  for (const chat of allChats) {
    const chatId = Number(chat.id);
    const charId = Number(chat.characterId || 1);
    const charObj = characterMap.get(charId) || {};

    const {
      recentContext,
      latestMessageAt,
    } = await readRecentChatContext(chat, charObj);

    chatTargets.push({
      chatId: chatId,
      characterId: charId,
      characterName: charObj.name || chat.title || '伴侣',
      persona:
        charObj.bio ||
        charObj.persona ||
        charObj.extraNotes ||
        charObj.userPersona ||
        '',
      userName: chat.userName || charObj.userName || '你',
      recentContext,
      latestMessageAt,
      updatedAt: chat.updatedAt || new Date().toISOString(),
    });
  }

  // 6. 读取系统 API 设置
  const apiSettings = await db.settings.get('apiConfig');

  // 7. 读取本地尚未触发的下一条预约任务
  const nextScheduledTask = await getNextPendingScheduledTask();

  let pendingTargetTime = null;
  let pendingIntent = '';
  let pendingChatId = null;

  if (nextScheduledTask) {
    pendingTargetTime =
      typeof nextScheduledTask.scheduledFor === 'number'
        ? nextScheduledTask.scheduledFor
        : new Date(nextScheduledTask.scheduledFor).getTime();

    pendingIntent =
      nextScheduledTask.intent ||
      nextScheduledTask.content ||
      '伴侣主动找你';

    pendingChatId =
      nextScheduledTask.chatId ??
      nextScheduledTask.targetChatId ??
      null;
  }

  // 8. 发送包含全部消息框与预约任务的配置数据包
  const payloadData = {
    subscription: subscription.toJSON(),
    apiConfig: apiSettings?.value || {},
    chatTargets: chatTargets,

    // 预约任务字段
    targetTime: pendingTargetTime,
    intent: pendingIntent,
    targetChatId:
      pendingChatId === null || pendingChatId === undefined
        ? undefined
        : Number(pendingChatId),

    // 兼容旧版服务端字段
    character: chatTargets[0]
      ? {
          id: chatTargets[0].characterId,
          chatId: chatTargets[0].chatId,
          name: chatTargets[0].characterName,
          persona: chatTargets[0].persona,
          userName: chatTargets[0].userName,
        }
      : {
          id: 1,
          chatId: 1,
          name: '伴侣',
          persona: '',
        },

    recentContext: chatTargets[0]?.recentContext || '',
  };

  let response;

  try {
    response = await fetch(`${cleanServerUrl}/api/sync-push-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payloadData),
    });
  } catch (networkErr) {
    throw new Error(
      `连接服务器网络失败: ${networkErr.message}（请检查域名证书或反向代理）`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `服务器拒绝接收 (状态码 ${response.status}): ${errorText}`,
    );
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `服务器保存失败: ${result.error || '未知错误'}`,
    );
  }

  // 注册成功后顺带执行一次开屏拉齐补漏
  void syncPendingPushMessages();

  return true;
}

// ==========================================================
// 🔍 手机真实状态体检探针（无任何硬编码地址）
// ==========================================================
export async function reportDiagnosticsToCloud() {
  const cleanServerUrl = await getEffectiveServerUrl();

  if (!cleanServerUrl) {
    const msg = '未找到已配置的推送服务器地址，请先在设置中保存服务器 URL';
    if (typeof window !== 'undefined') {
      window.alert(msg);
    }
    throw new Error(msg);
  }

  try {
    // 1. 获取手机本地所有实际存在的 IndexedDB 库名
    let actualDatabases = [];
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      try {
        actualDatabases = await indexedDB.databases();
      } catch (e) {
        actualDatabases = [{ error: e.message }];
      }
    }

    // 2. 采样一条最近由系统正常产生的真实消息实体
    let lastNormalMsg = null;
    try {
      lastNormalMsg = await db.messages.orderBy('timestamp').reverse().first();
    } catch (e) {
      lastNormalMsg = { queryError: e.message };
    }

    // 3. 采样当前活跃的 chats 结构
    let activeChats = [];
    try {
      const chats = await db.chats.toArray();
      activeChats = chats.map((c) => ({
        id: c.id,
        title: c.title,
        characterId: c.characterId,
        updatedAt: c.updatedAt,
      }));
    } catch (e) {
      activeChats = [{ queryError: e.message }];
    }

    // 4. 检查当前 sw 状态
    let swStatus = 'unsupported';
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      swStatus = reg
        ? {
            scope: reg.scope,
            active: Boolean(reg.active),
            waiting: Boolean(reg.waiting),
            installing: Boolean(reg.installing),
          }
        : 'not_registered';
    }

    const payload = {
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      actualDatabases,
      dbInstanceName: db?.name || 'unknown',
      dbVersion: db?.verno || 'unknown',
      lastNormalMsgSample: lastNormalMsg,
      activeChats,
      swStatus,
    };

    const res = await fetch(`${cleanServerUrl}/api/debug-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`服务器响应失败，状态码: ${res.status}`);
    }

    if (typeof window !== 'undefined') {
      window.alert('✅ 诊断数据已成功发往服务器终端！请去宝塔查看');
    }

    return true;
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.alert(`❌ 探针上报失败: ${err.message}`);
    }
    throw err;
  }
}

/**
 * 临时悬浮诊断按钮挂载器（可直接在 main.jsx 或 App.jsx 中调用一次）
 * 点击后立刻收集并上报当前 iPhone 内部的真实 Dexie 与消息结构
 */
export function mountTemporaryDebugButton() {
  if (typeof document === 'undefined') return;

  const EXISTING_ID = '__cloud_push_debug_btn__';
  if (document.getElementById(EXISTING_ID)) return;

  const btn = document.createElement('button');
  btn.id = EXISTING_ID;
  btn.innerText = '🩺 体检上报';
  btn.style.position = 'fixed';
  btn.style.right = '16px';
  btn.style.bottom = '88px';
  btn.style.zIndex = '999999';
  btn.style.padding = '8px 12px';
  btn.style.fontSize = '12px';
  btn.style.fontWeight = 'bold';
  btn.style.color = '#ffffff';
  btn.style.backgroundColor = 'rgba(20, 20, 25, 0.78)';
  btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  btn.style.borderRadius = '9999px';
  btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  btn.style.backdropFilter = 'blur(10px)';
  btn.style.webkitBackdropFilter = 'blur(10px)';
  btn.style.cursor = 'pointer';

  btn.onclick = async () => {
    btn.disabled = true;
    btn.innerText = '正在上报...';
    try {
      await reportDiagnosticsToCloud();
    } finally {
      btn.disabled = false;
      btn.innerText = '🩺 体检上报';
    }
  };

  document.body.appendChild(btn);
}

// 内存热快照缓存：专供锁屏/退后台瞬间 0 延迟发射 Beacon，绝不等待 IndexedDB 查询
let latestContextPayloadCache = null;
let cachedServerUrl = '';

export async function syncAllChatContextsToCloud({
  keepalive = false,
  useCacheFirst = false,
} = {}) {
  try {
    const cleanServerUrl = cachedServerUrl || (await getEffectiveServerUrl());
    if (!cleanServerUrl) return false;
    cachedServerUrl = cleanServerUrl;

    let payloadString = '';

    // 🚀 核心优化：如果是切后台触发且内存已有热缓存，直接 0 延迟发射，绝不在被杀前夕查 Dexie
    if (useCacheFirst && latestContextPayloadCache) {
      payloadString = latestContextPayloadCache;
    } else {
      const allChats = await db.chats.toArray();
      if (!allChats || allChats.length === 0) return false;

      let allCharacters = [];
      try {
        allCharacters = await db.characters.toArray();
      } catch (error) {
        allCharacters = [];
      }

      const characterMap = new Map(
        allCharacters.map((character) => [Number(character.id), character]),
      );

      const chatContextUpdates = [];

      for (const chat of allChats) {
        const charId = Number(chat.characterId || 1);
        const charObj = characterMap.get(charId) || {};

        const {
          recentContext,
          latestMessageAt,
        } = await readRecentChatContext(chat, charObj);

        chatContextUpdates.push({
          chatId: Number(chat.id),
          recentContext,
          latestMessageAt,
        });
      }

      payloadString = JSON.stringify({
        chatContextUpdates,
      });

      // 实时更新热快照
      latestContextPayloadCache = payloadString;
    }

    /*
     * pagehide / visibilitychange 场景优先使用 sendBeacon。
     * 这里使用 text/plain 而不是 application/json，防止触发跨域 preflight CORS 导致 WebKit 丢弃。
     */
    if (
      keepalive &&
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const beaconBlob = new Blob(
        [payloadString],
        {
          type: 'text/plain;charset=UTF-8',
        },
      );

      const accepted = navigator.sendBeacon(
        `${cleanServerUrl}/api/update-contexts`,
        beaconBlob,
      );

      if (accepted) {
        return true;
      }
    }

    /*
     * 普通场景或 Beacon 失败时降级走 keepalive fetch
     */
    const response = await fetch(
      `${cleanServerUrl}/api/update-contexts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payloadString,
        keepalive: Boolean(keepalive),
      },
    );

    return response.ok;
  } catch (error) {
    // 网络波动、页面被冻结时静默失败
    return false;
  }
}

let autoContextSyncCleanup = null;
let normalSyncTimer = null;
let lastLifecycleSyncAt = 0;

export function initAutoContextSync({
  debounceMs = 800,
} = {}) {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return () => {};
  }

  // 防止 App.jsx 和服务自身重复注册
  if (autoContextSyncCleanup) {
    return autoContextSyncCleanup;
  }

  const scheduleNormalSync = () => {
    window.clearTimeout(normalSyncTimer);

    normalSyncTimer = window.setTimeout(() => {
      void syncAllChatContextsToCloud();
    }, debounceMs);
  };

  const syncAtLifecycle = () => {
    const now = Date.now();

    // visibilitychange 和 pagehide 可能连续触发，避免重复发包
    if (now - lastLifecycleSyncAt < 1000) {
      return;
    }

    lastLifecycleSyncAt = now;

    // ⚠️ 传入 useCacheFirst: true，确保在 iOS 冻结线程前同步从内存取包立刻发 Beacon
    void syncAllChatContextsToCloud({
      keepalive: true,
      useCacheFirst: true,
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      syncAtLifecycle();
    } else if (document.visibilityState === 'visible') {
      // 回到前台时先拉取云端待取消息，并重新预热最新内存快照
      void syncPendingPushMessages();
      scheduleNormalSync();
    }
  };

  const handlePageHide = () => {
    syncAtLifecycle();
  };

  const handlePageShow = () => {
    void syncPendingPushMessages();
    scheduleNormalSync();
  };

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange,
  );

  window.addEventListener(
    'pagehide',
    handlePageHide,
    true,
  );

  window.addEventListener(
    'pageshow',
    handlePageShow,
  );

  // 初始化时预热缓存与执行一次防抖同步
  void getEffectiveServerUrl().then((url) => {
    if (url) cachedServerUrl = url;
  });
  scheduleNormalSync();

  const cleanup = () => {
    window.clearTimeout(normalSyncTimer);

    document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    window.removeEventListener(
      'pagehide',
      handlePageHide,
      true,
    );

    window.removeEventListener(
      'pageshow',
      handlePageShow,
    );

    autoContextSyncCleanup = null;
  };

  autoContextSyncCleanup = cleanup;

  return cleanup;
}

/**
 * ⏰ 预约任务离线托管：将前端产生的精确预约单同步到云端
 * 当手机息屏/划掉后台后，由云端服务器接管倒计时并准时推送到 iOS 锁屏
 * 
 * @param {Object} options
 * @param {number|string|Date} options.targetTime - 预约到期的时间戳或 ISO 字符串
 * @param {string} [options.intent] - 预约意图（如：提醒喝水、跟进刚才的话题）
 * @param {number|string} [options.chatId] - 该预约归属的具体消息框 ID
 */
export async function syncScheduledTaskToCloud({ targetTime, intent = '', chatId = null } = {}) {
  try {
    const cleanServerUrl = await getEffectiveServerUrl();
    if (!cleanServerUrl) {
      console.warn('[CloudPush] 未配置有效推送服务器地址，跳过云端托管');
      return false;
    }

    let targetTimestamp = 0;
    if (typeof targetTime === 'number') {
      targetTimestamp = targetTime;
    } else if (targetTime instanceof Date) {
      targetTimestamp = targetTime.getTime();
    } else if (typeof targetTime === 'string') {
      const numeric = Number(targetTime);
      targetTimestamp = Number.isFinite(numeric) && numeric > 0 ? numeric : new Date(targetTime).getTime();
    }

    if (!Number.isFinite(targetTimestamp) || targetTimestamp <= Date.now()) {
      console.warn('[CloudPush] 预约时间无效或已过期，放弃托管:', targetTime);
      return false;
    }

    // 🎯 核心解决“云端是否知道是哪个消息框”：
    // 同时注入 targetChatId 和 chatId，做双字段兜底兼容
    const parsedChatId = (chatId !== null && chatId !== undefined) ? Number(chatId) : undefined;
    
    const payload = {
      targetTime: targetTimestamp,
      intent: String(intent || '伴侣主动找你'),
      chatId: Number.isFinite(parsedChatId) ? parsedChatId : undefined,
      targetChatId: Number.isFinite(parsedChatId) ? parsedChatId : undefined
    };

    const res = await fetch(`${cleanServerUrl}/api/sync-push-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    console.log(`[CloudPush] 预约任务已精准托管至云端（会话框 ID: ${parsedChatId ?? '默认'}）：将于 ${new Date(targetTimestamp).toLocaleTimeString()} 准时触发`);
    return true;
  } catch (err) {
    console.warn('[CloudPush] 预约任务同步至云端失败:', err.message || err);
    return false;
  }
}

// 自动在客户端运行环境中初始化全局生命周期监听，无需额外侵入业务组件
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initAutoContextSync();
}

