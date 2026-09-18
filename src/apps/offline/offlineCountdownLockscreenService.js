// src/apps/offline/offlineCountdownLockscreenService.js
//
// 把"线下邀约倒计时"接进已有的锁屏陪伴机制（services/lockscreenService.js）。
// 不新增开关、不新增音频/权限逻辑：只有用户本来就打开了"锁屏陪伴"、
// 且保活音频确实在播放时，才会把锁屏媒体卡片上的文字临时换成倒计时内容；
// 没有开、或者没有正在倒计时的邀约，什么都不做，让原来的随机台词轮播继续。
import db from '../../db';
import {
  getLockscreenCompanionEnabled,
  isLockscreenCompanionRunning,
  updateLockscreenMediaSession,
} from '../../services/lockscreenService';
import { generateResponse } from '../../services/aiService';
import { OFFLINE_SESSION_STATUSES } from './offlineSessionService';

// "角色正在准备什么"这句话最多每 90 分钟用 AI 重新生成一次，避免频繁调用。
const PREP_ACTIVITY_REFRESH_INTERVAL_MS = 90 * 60 * 1000;

const formatCountdownText = (scheduledFor) => {
  const remainingMs = new Date(scheduledFor).getTime() - Date.now();
  if (remainingMs <= 0) return '就快到了';

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (days === 0) parts.push(`${minutes}分钟`);

  return `${parts.join('')}后`;
};

const shouldRefreshPrepActivity = (session) => {
  if (!session.prepActivity || !session.prepActivityUpdatedAt) return true;
  const elapsed = Date.now() - new Date(session.prepActivityUpdatedAt).getTime();
  return elapsed >= PREP_ACTIVITY_REFRESH_INTERVAL_MS;
};

const generatePrepActivity = async (session, character) => {
  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) return '';

    const systemPrompt = `你正在扮演角色 [${character.name}]，还有一段时间就要和对方线下见面了。

【约定的场景】：${session.sceneLabel || '一次线下见面'}
【场景细节】：${session.sceneDescription || '无'}
【角色人设】：${character.bio || '无'}

请用第三人称，写一句此刻角色正在为这次见面做的准备，12个字以内，例如"在试第三套衣服"。
只输出这一句话本身，不要输出多余文字，不要输出引号，不要输出 Markdown 语法，不要使用任何 Emoji。`;

    const rawText = await generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请给出这一句准备内容。' },
    ]);

    return String(rawText || '').trim().replace(/^["'“”]|["'“”]$/g, '').slice(0, 16);
  } catch (error) {
    console.warn('[OfflineCountdownLockscreen] 生成准备内容失败（已忽略）:', error?.message);
    return '';
  }
};

/**
 * 找到全部聊天窗里最近的一场"倒计时中"的线下邀约（scheduledFor 还没到）。
 */
const findNearestScheduledSession = async () => {
  const sessions = await db.offlineSessions
    .where('status')
    .equals(OFFLINE_SESSION_STATUSES.SCHEDULED)
    .toArray();

  const nowMs = Date.now();

  const upcoming = sessions
    .filter((session) => session.scheduledFor && new Date(session.scheduledFor).getTime() > nowMs)
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

  return upcoming[0] || null;
};

/**
 * 供调度器定期调用：如果条件都满足，就把锁屏媒体卡片文字刷新成倒计时内容。
 * 条件不满足（没开锁屏陪伴 / 音频没在播 / 没有倒计时中的邀约）时什么都不做。
 */
export const refreshOfflineCountdownLockscreen = async () => {
  try {
    const enabled = await getLockscreenCompanionEnabled();
    if (!enabled || !isLockscreenCompanionRunning()) {
      return;
    }

    const session = await findNearestScheduledSession();
    if (!session) {
      return;
    }

    const [chat, character] = await Promise.all([
      db.chats.get(session.chatId),
      db.characters.get(session.characterId),
    ]);

    if (!chat || !character) {
      return;
    }

    let prepActivity = session.prepActivity || '';

    if (shouldRefreshPrepActivity(session)) {
      const generated = await generatePrepActivity(session, character);
      if (generated) {
        prepActivity = generated;
        await db.offlineSessions.update(session.id, {
          prepActivity: generated,
          prepActivityUpdatedAt: new Date().toISOString(),
        });
      }
    }

    const countdownText = formatCountdownText(session.scheduledFor);
    const quoteText = prepActivity
      ? `还有${countdownText}见面 · 对方正在${prepActivity}`
      : `还有${countdownText}见面`;

    updateLockscreenMediaSession(character.name, quoteText, character.avatar);
  } catch (error) {
    console.warn('[OfflineCountdownLockscreen] 刷新锁屏倒计时失败（已忽略）:', error?.message);
  }
};