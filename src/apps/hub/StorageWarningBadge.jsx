// src/apps/hub/StorageWarningBadge.jsx
//
// 首页角标：本地存储占用超过阈值时，在首页显示一个小提醒，
// 点击跳转到"设置 - 数据与本地存储"查看详情（那边已经有占用条 + 刷新按钮，
// 这里不重复造轮子）。
//
// 2026-09 范围明确：只做"检测 + 提醒"，不做任何自动清理。
// 真要做自动清理是以后单独一轮的事，而且已经确认过方向——
// 只清语音消息的音频本体，绝不整条删除消息或连文字一起清掉。
// 这里只负责让用户注意到"该去归档里手动整理一下了"。

import React, { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import {
  getStorageUsageBytes,
  formatBytes,
  STORAGE_WARNING_THRESHOLD_BYTES,
} from '../../db/storageUtils';

export const StorageWarningBadge = ({ onOpenSettings }) => {
  const [usageBytes, setUsageBytes] = useState(0);
  const [isOverThreshold, setIsOverThreshold] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkUsage = async () => {
      const { supported, usage } = await getStorageUsageBytes();

      if (cancelled || !supported) return;

      setUsageBytes(usage);
      setIsOverThreshold(usage > STORAGE_WARNING_THRESHOLD_BYTES);
    };

    checkUsage();

    return () => {
      cancelled = true;
    };
    // 首页每次挂载（也就是每次切回首页）重新测一次即可，
    // 不需要额外起一个定时器常驻轮询——那正是我们想避免的模式。
  }, []);

  if (!isOverThreshold) return null;

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className="fixed left-1/2 top-3 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-lg backdrop-blur-md transition-transform active:scale-95"
      style={{
        color: 'var(--accent-foreground)',
        backgroundColor: 'var(--accent-color)',
        borderColor: 'var(--card-border)',
      }}
      aria-label="本地存储空间占用较大，点击查看详情"
      title="点击查看本地存储详情"
    >
      <HardDrive className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />

      <span className="truncate">
        {`本地存储已占 ${formatBytes(usageBytes)}，建议去"归档"里整理一下（语音消息通常占用最大）`}
      </span>
    </button>
  );
};

export default StorageWarningBadge;