// src/apps/offline/offlineCountdownLockscreenScheduler.js
//
// 每 90 秒检查一次要不要把锁屏媒体卡片文字换成线下邀约倒计时。
// 和其它全局调度器（snapshot / workflow 等）用的是同一套 setInterval 写法，
// 一起在 App.jsx 里统一启动/停止。
import { refreshOfflineCountdownLockscreen } from './offlineCountdownLockscreenService';

const CHECK_INTERVAL_MS = 90 * 1000;

let intervalId = null;

export const startOfflineCountdownLockscreenScheduler = () => {
  if (intervalId) return;

  void refreshOfflineCountdownLockscreen();

  intervalId = setInterval(() => {
    void refreshOfflineCountdownLockscreen();
  }, CHECK_INTERVAL_MS);
};

export const stopOfflineCountdownLockscreenScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};