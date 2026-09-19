import db from '../db';
import { triggerRhythmActiveReminder } from './rhythmReminderService';

// 本地检查频率：3 分钟一次。
// 这是"多久醒来看一眼"的频率，不是"多久发一次消息"——
// 具体发不发，仍然由 rhythmReminderService.js 里的开关、冷却、
// 勿扰时段、是否正在聊天等规则决定，这里只负责按时把它叫醒。
//
// 已知限制：这是浏览器 setInterval，只有在这个页面/PWA 存活
// （前台，或系统还没把后台标签页/PWA 挂起）时才会继续走。
// 手机把它切到后台太久、或系统主动杀后台之后，本地定时器会停摆，
// 需要用户重新打开 App 才会继续检查。真正"App 完全关闭也能准时到"
// 需要云端（pwa-push-server）配合，这个后续单独做。
const SCHEDULER_INTERVAL_MS = 3 * 60 * 1000;

let rhythmSchedulerTimer = null;
let isRhythmChecking = false;

/**
 * 扫描所有开启了 rhythmEnabled 的聊天窗，逐个尝试触发一次寄语检查。
 *
 * 串行执行而不是 Promise.all：避免多个聊天窗同时请求 AI 接口，
 * 造成并发过高、被限流，或一次性消耗大量 Token。
 */
export const runRhythmScheduler = async () => {
  if (isRhythmChecking) {
    console.log('[rhythmScheduler] 上一次检查尚未结束，跳过本次。');
    return;
  }

  isRhythmChecking = true;

  try {
    const chats = await db.chats.toArray();

    const eligibleChats = chats.filter(
      (chat) =>
        chat?.id != null &&
        chat?.characterId != null &&
        chat?.rhythmEnabled !== false
    );

    if (eligibleChats.length === 0) {
      return;
    }

    for (const chat of eligibleChats) {
      try {
        const character = await db.characters.get(chat.characterId);

        if (!character) {
          continue;
        }

        const result = await triggerRhythmActiveReminder(
          chat.id,
          character,
          false
        );

        if (result?.status === 'success') {
          console.log(
            `[rhythmScheduler] chatId=${chat.id} 已生成寄语: "${result.text}"`
          );
        }
      } catch (err) {
        // 单个聊天窗失败不能终止其余聊天窗的检查。
        console.error(
          `[rhythmScheduler] chatId=${chat.id} 检查失败:`,
          err
        );
      }
    }
  } catch (err) {
    console.error('[rhythmScheduler] 调度检查失败：', err);
  } finally {
    isRhythmChecking = false;
  }
};

/**
 * 启动 Rhythm 独立调度器。
 *
 * 启动时立即检查一次（等价于原来"App 一打开就看一眼"的体验），
 * 之后每 SCHEDULER_INTERVAL_MS 检查一次，直到被 stopRhythmScheduler 停止。
 */
export const startRhythmScheduler = () => {
  if (rhythmSchedulerTimer) {
    console.log('[rhythmScheduler] 调度器已启动。');
    return;
  }

  console.log(
    `[rhythmScheduler] 已启动，每 ${SCHEDULER_INTERVAL_MS / 60000} 分钟检查一次。`
  );

  void runRhythmScheduler();

  rhythmSchedulerTimer = window.setInterval(() => {
    void runRhythmScheduler();
  }, SCHEDULER_INTERVAL_MS);
};

/**
 * 停止调度器，避免 App 卸载后残留定时器。
 */
export const stopRhythmScheduler = () => {
  if (!rhythmSchedulerTimer) {
    return;
  }

  window.clearInterval(rhythmSchedulerTimer);
  rhythmSchedulerTimer = null;
  isRhythmChecking = false;

  console.log('[rhythmScheduler] 已停止。');
};