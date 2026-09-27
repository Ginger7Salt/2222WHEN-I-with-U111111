// src/apps/hub/StorageWarningBadge.jsx
//
// 首页角标：本地存储占用超过阈值时，在首页显示一个小提醒，
// 点主体跳转到"设置 - 数据与本地存储"查看详情，点 X 可以关掉。
//
// 2026-09 范围明确：只做"检测 + 提醒"，不做任何自动清理。
// 真要做自动清理是以后单独一轮的事，而且已经确认过方向——
// 只清语音消息的音频本体，绝不整条删除消息或连文字一起清掉。
// 这里只负责让用户注意到"该去归档里手动整理一下了"。
//
// 关闭行为（2026-09 确认）：点 X 不是永久哑掉，而是"记住当时的占用量，
// 之后占用量比这个数继续明显涨了（见 STORAGE_WARNING_SNOOZE_INCREMENT_BYTES）
// 才会再出现"——不想管的用户能眼不见为净，但如果情况真的继续恶化，
// 还是会重新提醒，不会被无限期错过。

import React, { useEffect, useState } from 'react';
import { HardDrive, X } from 'lucide-react';
import db from '../../db';
import {
  getStorageUsageBytes,
  formatBytes,
  STORAGE_WARNING_THRESHOLD_BYTES,
  STORAGE_WARNING_SNOOZE_INCREMENT_BYTES,
} from '../../db/storageUtils';

const DISMISS_SETTINGS_KEY = 'storage_warning_dismissed_at_usage_bytes';

export const StorageWarningBadge = ({ onOpenSettings }) => {
  const [usageBytes, setUsageBytes] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkUsage = async () => {
      const { supported, usage } = await getStorageUsageBytes();

      if (cancelled || !supported) return;

      if (usage <= STORAGE_WARNING_THRESHOLD_BYTES) {
        setUsageBytes(usage);
        setIsVisible(false);
        return;
      }

      let dismissedAtUsage = 0;

      try {
        const saved = await db.settings.get(DISMISS_SETTINGS_KEY);
        dismissedAtUsage = Number(saved?.value) || 0;
      } catch (error) {
        console.warn('[StorageWarningBadge] 读取关闭记录失败：', error);
      }

      if (cancelled) return;

      const shouldShow = (
        dismissedAtUsage <= 0
        || usage > dismissedAtUsage + STORAGE_WARNING_SNOOZE_INCREMENT_BYTES
      );

      setUsageBytes(usage);
      setIsVisible(shouldShow);
    };

    checkUsage();

    return () => {
      cancelled = true;
    };
    // 首页每次挂载（也就是每次切回首页）重新测一次即可，
    // 不需要额外起一个定时器常驻轮询——那正是我们想避免的模式。
  }, []);

  const handleDismiss = async (event) => {
    event.stopPropagation();
    setIsVisible(false);

    try {
      await db.settings.put({
        key: DISMISS_SETTINGS_KEY,
        value: usageBytes,
      });
    } catch (error) {
      console.warn('[StorageWarningBadge] 保存关闭记录失败：', error);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed left-1/2 top-3 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1 rounded-full border py-1.5 pl-3 pr-1.5 text-[11px] font-medium shadow-lg backdrop-blur-md"
      style={{
        color: 'var(--accent-foreground)',
        backgroundColor: 'var(--accent-color)',
        borderColor: 'var(--card-border)',
      }}
    >
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex min-w-0 items-center gap-2 text-left"
        aria-label="本地存储空间占用较大，点击查看详情"
        title="点击查看本地存储详情"
      >
        <HardDrive className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />

        <span className="truncate">
          {`本地存储已占 ${formatBytes(usageBytes)}，建议去"归档"里整理一下（语音消息通常占用最大）`}
        </span>
      </button>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-1 opacity-80 transition-opacity hover:opacity-100"
        aria-label="关闭这个提醒"
        title="关闭（占用量继续明显增长后会再提醒）"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
};

export default StorageWarningBadge;