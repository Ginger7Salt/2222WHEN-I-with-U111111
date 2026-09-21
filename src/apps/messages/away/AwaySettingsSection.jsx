import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import db from '../../../db';
import {
  AWAY_MAX_WINDOWS,
  AWAY_TEXT_MAX_LENGTH,
  DEFAULT_AUTO_REPLY_TEXT,
  createEmptyAwayWindow,
  formatAwayUntil,
  getAwayState,
  parseHm,
} from './awayState';

// 星期按周一到周日显示；值沿用 JS getDay()：0 = 周日。
const DAY_OPTIONS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
];

const inputStyle = {
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
  borderColor: 'var(--card-border)',
  // 16px：避免 iOS 聚焦输入框时自动放大页面
  fontSize: '16px',
};

// 编辑界面保留用户正在输入的原始值（哪怕暂时无效），
// 读取时（awayState.js）会自己忽略无效的时段。
const toDraft = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};

  return {
    enabled: source.enabled === true,
    windows: (Array.isArray(source.windows) ? source.windows : []).slice(0, AWAY_MAX_WINDOWS),
    autoReplyText: String(source.autoReplyText || ''),
  };
};

const isWindowValid = (win) => {
  const start = parseHm(win?.start);
  const end = parseHm(win?.end);

  return (
    Array.isArray(win?.days)
    && win.days.length > 0
    && start !== null
    && end !== null
    && start !== end
  );
};

/**
 * 聊天设置里的"暂时不在线"（每个聊天窗单独一份，存在 chat.awaySettings）。
 * 只是读写设置；是否离线由 awayState.js 现算，不需要任何定时器。
 */
export const AwaySettingsSection = ({ chat, character, onUpdated }) => {
  const [settings, setSettings] = useState(() => toDraft(chat?.awaySettings));

  const persist = async (next) => {
    setSettings(next);

    if (!chat?.id) return;

    await db.chats.update(chat.id, { awaySettings: next });

    if (onUpdated) onUpdated();
  };

  const handleToggleEnabled = () => {
    void persist({ ...settings, enabled: !settings.enabled });
  };

  const handleAddWindow = () => {
    if (settings.windows.length >= AWAY_MAX_WINDOWS) return;

    void persist({
      ...settings,
      windows: [...settings.windows, createEmptyAwayWindow()],
    });
  };

  const handleRemoveWindow = (windowId) => {
    void persist({
      ...settings,
      windows: settings.windows.filter((win) => win.id !== windowId),
    });
  };

  const handleChangeWindow = (windowId, patch) => {
    void persist({
      ...settings,
      windows: settings.windows.map((win) => (
        win.id === windowId ? { ...win, ...patch } : win
      )),
    });
  };

  const handleToggleDay = (win, day) => {
    const currentDays = Array.isArray(win.days) ? win.days : [];
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((item) => item !== day)
      : [...currentDays, day];

    handleChangeWindow(win.id, { days: nextDays });
  };

  const handleReplyTextCommit = () => {
    void persist({
      ...settings,
      autoReplyText: settings.autoReplyText.trim().slice(0, AWAY_TEXT_MAX_LENGTH),
    });
  };

  const awayState = getAwayState({ awaySettings: settings });
  const characterName = character?.name || '角色';

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
            在设定的时段里，{characterName} 会暂时不在线：你发消息时会收到一条自动回复，
            打电话会显示对方暂时无法接听，TA 也不会主动来电。你仍然可以正常发消息，
            时段结束后 TA 会看到并自己回复。
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={handleToggleEnabled}
          className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
          style={{
            background: settings.enabled ? 'var(--accent-color)' : 'var(--divider)',
          }}
        >
          <span
            className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
            style={{
              background: 'var(--bg-main)',
              transform: settings.enabled ? 'translateX(20px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {settings.enabled && (
        <div className="space-y-3">
          {awayState.away && (
            <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>
              现在处于离线时段，约 {formatAwayUntil(awayState.until)} 恢复在线。
            </p>
          )}

          {settings.windows.map((win) => (
            <div
              key={win.id}
              className="space-y-2 rounded-xl border p-2.5"
              style={{
                background: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {DAY_OPTIONS.map((day) => {
                    const selected = Array.isArray(win.days) && win.days.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleToggleDay(win, day.value)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition-colors"
                        style={{
                          background: selected ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                          color: selected ? 'var(--accent-foreground)' : 'var(--text-sub)',
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveWindow(win.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="删除这个时段"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={win.start || ''}
                  onChange={(event) => handleChangeWindow(win.id, { start: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 outline-none"
                  style={inputStyle}
                />
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>到</span>
                <input
                  type="time"
                  value={win.end || ''}
                  onChange={(event) => handleChangeWindow(win.id, { end: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 outline-none"
                  style={inputStyle}
                />
              </div>

              {!isWindowValid(win) && (
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  需要至少选一天，并且开始和结束时间不同，这个时段才会生效。
                  结束时间早于开始时间表示跨到第二天。
                </p>
              )}
            </div>
          ))}

          {settings.windows.length < AWAY_MAX_WINDOWS && (
            <button
              type="button"
              onClick={handleAddWindow}
              className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] transition-transform active:scale-95"
              style={{
                borderColor: 'var(--card-border)',
                color: 'var(--text-sub)',
              }}
            >
              <Plus className="h-3 w-3" />
              添加时段
            </button>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>自动回复内容</p>
            <input
              type="text"
              value={settings.autoReplyText}
              maxLength={AWAY_TEXT_MAX_LENGTH}
              placeholder={DEFAULT_AUTO_REPLY_TEXT}
              onChange={(event) => setSettings({ ...settings, autoReplyText: event.target.value })}
              onBlur={handleReplyTextCommit}
              className="w-full rounded-lg border px-2.5 py-1.5 outline-none"
              style={inputStyle}
            />
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              留空则使用上面灰色的通用文案。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AwaySettingsSection;