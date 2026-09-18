// src/apps/archive/archiveScheduler.js
//
// 全局自动归档调度器，写法照抄项目里现成的 snapshotGlobalScheduler.js：
// 独立文件、独立 setInterval，在 App.jsx 里跟其他全局调度器一起启停。
//
// 实际是否归档、归档多少天以前的内容，由 archiveService.js 的
// runAutoArchiveForAllChats() 决定（它自己会检查 archiveSettings 里的
// autoArchiveEnabled 开关，关闭时直接跳过，不会遍历聊天）。
// 这里只负责"每隔多久检查一次"。

import { runAutoArchiveForAllChats } from './archiveService';

// 归档阈值以天为单位，不需要分钟级精度，每小时检查一次足够，
// 也比照 snapshotGlobalScheduler 的做法不会太频繁地扫全部聊天。
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let schedulerTimer = null;
let isRunningCheck = false;

const runCheck = async () => {
  if (isRunningCheck) {
    return;
  }

  isRunningCheck = true;

  try {
    await runAutoArchiveForAllChats();
  } catch (error) {
    console.warn('[Archive] 自动归档巡检失败：', error);
  } finally {
    isRunningCheck = false;
  }
};

export const startArchiveScheduler = () => {
  if (schedulerTimer) return;

  void runCheck();

  schedulerTimer = setInterval(() => {
    void runCheck();
  }, CHECK_INTERVAL_MS);
};

export const stopArchiveScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};