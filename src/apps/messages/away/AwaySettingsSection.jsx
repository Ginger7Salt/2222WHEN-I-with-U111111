import React, { useState } from 'react';
import db from '../../../db';
import { checkAndSendDueScheduledMessages } from '../scheduledMessageService';
import { endAwayNow } from './awayService';
import {
  formatAwayUntil,
  getAwayState,
  isAwayAllowed,
} from './awayState';

/**
 * 聊天设置里的"暂时不在线"（每个聊天窗单独一份）。
 *
 * 只有一个开关：允许角色自己决定离线。默认关闭。
 * 开启后，角色偶尔会在聊天中自己决定去忙一会儿，离线多久由程序随机取，
 * 没有固定时间表。是否离线由 awayState.js 现算，这里不需要任何定时器。
 */
export const AwaySettingsSection = ({ chat, character, onUpdated }) => {
  const [isBusy, setIsBusy] = useState(false);

  const allowed = isAwayAllowed(chat);
  const awayState = getAwayState(chat);
  const characterName = character?.name || '角色';

  const notifyUpdated = () => {
    if (onUpdated) onUpdated();
  };

  // 结束离线后，让调度器立刻处理"上线后回复"（如果离线期间用户发过消息）。
  const finishAway = async () => {
    const { ended } = await endAwayNow(chat.id);

    if (ended) {
      void checkAndSendDueScheduledMessages();
    }
  };

  const handleToggle = async () => {
    if (!chat?.id || isBusy) return;

    setIsBusy(true);

    try {
      // 整个对象替换掉，顺便清掉旧版本留下的时段设置。
      await db.chats.update(chat.id, { awaySettings: { allowCharacterAway: !allowed } });

      // 关掉开关时，正在离线的角色立刻回来。
      if (allowed && awayState.away) {
        await finishAway();
      }

      notifyUpdated();
    } finally {
      setIsBusy(false);
    }
  };

  const handleReturnNow = async () => {
    if (!chat?.id || isBusy) return;

    setIsBusy(true);

    try {
      await finishAway();
      notifyUpdated();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="space-y-3 rounded-2xl border p-3"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium">暂时不在线</p>
          <p
            className="mt-1 text-[10px] leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            开启后，{characterName} 偶尔会在聊天中自己决定去忙一会儿，不是固定时间，也不会经常发生。
            离线期间：你发消息会收到一条自动回复，打电话会显示对方暂时无法接听，TA 也不会主动来电；
            结束后 TA 会自己回复你。开启了这个功能的多个聊天窗，同一时间不会全部离线。
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label="允许角色自己离线"
          disabled={isBusy}
          onClick={handleToggle}
          className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
          style={{
            background: allowed ? 'var(--accent-color)' : 'var(--divider)',
          }}
        >
          <span
            className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
            style={{
              background: 'var(--bg-main)',
              transform: allowed ? 'translateX(20px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {awayState.away && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>
            {characterName} 现在离线中，约 {formatAwayUntil(awayState.until)} 恢复在线。
          </p>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleReturnNow}
            className="shrink-0 rounded-full border px-3 py-1.5 text-[10px] transition-transform active:scale-95"
            style={{
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)',
              background: 'var(--card-bg)',
            }}
          >
            让 TA 现在回来
          </button>
        </div>
      )}
    </div>
  );
};

export default AwaySettingsSection;