import db from '../../db';
import { activateOfflineSession } from './offlineSessionService';
import { triggerSystemNotification } from '../../services/aiService';

let schedulerTimer = null;
const CHECK_INTERVAL_MS = 30 * 1000;

const checkAndActivateDueSessions = async () => {
  try {
    const scheduledSessions = await db.offlineSessions
      .where('status')
      .equals('scheduled')
      .toArray();

    const now = Date.now();

    for (const session of scheduledSessions) {
      const scheduledTime = new Date(session.scheduledFor).getTime();
      if (!Number.isFinite(scheduledTime) || scheduledTime > now) continue;

      await activateOfflineSession(session.id);

      const character = await db.characters.get(session.characterId);

      void triggerSystemNotification(
        `${character?.name || '伴侣'} 在等你`,
        `约定的时间到了：${session.sceneLabel}`,
        character?.avatar,
      );
    }
  } catch (error) {
    console.warn('[OfflineSessionScheduler] 检查失败，跳过本轮：', error);
  }
};

export const startOfflineSessionScheduler = () => {
  if (schedulerTimer) return;

  void checkAndActivateDueSessions();

  schedulerTimer = setInterval(() => {
    void checkAndActivateDueSessions();
  }, CHECK_INTERVAL_MS);
};

export const stopOfflineSessionScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};