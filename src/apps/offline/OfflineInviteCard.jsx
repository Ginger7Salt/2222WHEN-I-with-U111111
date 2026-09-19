import React, { useState, useEffect } from 'react';
import { BookMarked, Ticket, Check, X, Clock, ChevronRight } from 'lucide-react';

import {
  acceptOfflineSessionProposal,
  declineOfflineSessionProposal,
} from './offlineSessionService';

const formatScheduledFor = (scheduledFor) => {
  try {
    return new Date(scheduledFor).toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
  } catch {
    return '';
  }
};

// 无条件调用：是否真正计时由 isActive 决定，满足 Hooks 规则。
const useCountdownText = (scheduledFor, isActive) => {
  const [remainingMs, setRemainingMs] = useState(() => (
    scheduledFor ? new Date(scheduledFor).getTime() - Date.now() : 0
  ));

  useEffect(() => {
    if (!isActive || !scheduledFor) return undefined;

    setRemainingMs(new Date(scheduledFor).getTime() - Date.now());

    const timer = setInterval(() => {
      setRemainingMs(new Date(scheduledFor).getTime() - Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [scheduledFor, isActive]);

  if (!isActive || !scheduledFor) return '';
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

// 黑白为主体，accent 仅作为状态强调色。
const CardShell = ({ children, tone = 'default', accentBorder = false }) => (
  <div
    className={[
      'mx-auto my-3 flex w-[calc(100%-1rem)] max-w-[340px] flex-col gap-3',
      'overflow-hidden rounded-[1.75rem] p-4',
      'text-[13px] leading-relaxed tracking-[0.01em]',
      'backdrop-blur-xl transition-all duration-200',
    ].join(' ')}
    style={{
      background:
        tone === 'muted'
          ? 'var(--control-soft-bg)'
          : 'var(--card-bg-gradient)',
      color: 'var(--text-main)',
      border: `1px solid ${
        accentBorder ? 'var(--accent-color)' : 'var(--card-border)'
      }`,
      opacity: tone === 'muted' ? 0.68 : 1,
      boxShadow: accentBorder
        ? '0 12px 32px rgba(0, 0, 0, 0.12)'
        : '0 8px 24px rgba(0, 0, 0, 0.08)',
    }}
  >
    {children}
  </div>
);

const OfflineInviteCard = ({ message, onEnterScene, onRefresh }) => {
  const {
    offlineSessionId,
    sceneLabel,
    sceneDescription,
    scheduledFor,
    proposedBy,
    status,
  } = message.metadata || {};

  const [isResponding, setIsResponding] = useState(false);

  const scheduledForText = formatScheduledFor(scheduledFor);
  const countdownText = useCountdownText(scheduledFor, status === 'scheduled');

  const handleAccept = async () => {
    setIsResponding(true);
    try {
      await acceptOfflineSessionProposal(offlineSessionId);
      onRefresh?.();
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = async () => {
    setIsResponding(true);
    try {
      await declineOfflineSessionProposal(offlineSessionId);
      onRefresh?.();
    } finally {
      setIsResponding(false);
    }
  };

  if (status === 'pending_review' && proposedBy === 'user') {
    return (
      <CardShell tone="muted">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              borderColor: 'var(--card-border)',
              background: 'var(--card-bg-gradient)',
            }}
          >
            <Ticket className="h-4 w-4 animate-pulse opacity-70" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-medium opacity-70">
              等待对方回应你的邀约…
            </div>

            <div className="mt-1.5 truncate text-[14px] font-semibold">
              {sceneLabel}
            </div>

            {scheduledForText && (
              <div className="mt-1 text-[12px] opacity-60">
                {scheduledForText}
              </div>
            )}
          </div>
        </div>
      </CardShell>
    );
  }

  if (status === 'pending_review' && proposedBy === 'character') {
    return (
      <CardShell accentBorder>
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--accent-color)',
            }}
          >
            <BookMarked className="h-[18px] w-[18px]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">
              {sceneLabel}
            </div>

            <div className="mt-0.5 text-[12px] opacity-55">
              邀请你赴约
            </div>
          </div>
        </div>

        {sceneDescription && (
          <div
            className="rounded-2xl border px-3 py-2.5 text-[12px] opacity-75"
            style={{
              borderColor: 'var(--card-border)',
              background: 'var(--control-soft-bg)',
            }}
          >
            {sceneDescription}
          </div>
        )}

        {scheduledForText && (
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12px] opacity-75"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{scheduledForText}</span>
          </div>
        )}

        <div className="mt-0.5 flex gap-2">
          <button
            type="button"
            disabled={isResponding}
            onClick={handleAccept}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Check className="h-3.5 w-3.5" />
            好呀
          </button>

          <button
            type="button"
            disabled={isResponding}
            onClick={handleDecline}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl font-medium transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
            }}
          >
            <X className="h-3.5 w-3.5 opacity-70" />
            改天吧
          </button>
        </div>
      </CardShell>
    );
  }

  if (status === 'scheduled') {
    return (
      <CardShell accentBorder>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--accent-color)',
            }}
          >
            <Ticket className="h-[18px] w-[18px]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">
              {sceneLabel}
            </div>

            <div className="mt-0.5 text-[12px] opacity-55">
              已确认的邀约
            </div>
          </div>
        </div>

        {scheduledForText && (
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12px] opacity-75"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{scheduledForText}</span>
          </div>
        )}

        <div
          className="flex items-center justify-between rounded-2xl px-3 py-2.5 font-mono text-[11px]"
          style={{
            background: 'var(--text-main)',
            color: 'var(--accent-foreground)',
          }}
        >
          <span className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            距离赴约
          </span>

          <span className="font-semibold">
            {countdownText}
          </span>
        </div>
      </CardShell>
    );
  }

  if (status === 'active') {
    return (
      <CardShell accentBorder>
        <button
          type="button"
          onClick={() => onEnterScene?.(offlineSessionId)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl text-left transition-opacity active:opacity-70"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--accent-color)',
              }}
            >
              <BookMarked className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">
                {sceneLabel}
              </div>

              <div
                className="mt-0.5 flex items-center gap-1.5 text-[12px]"
                style={{ color: 'var(--accent-color)' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ background: 'var(--accent-color)' }}
                  />
                  <span
                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--accent-color)' }}
                  />
                </span>
                时间到了，点这里赴约
              </div>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
        </button>
      </CardShell>
    );
  }

  if (status === 'declined' || status === 'cancelled') {
    return (
      <CardShell tone="muted">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              borderColor: 'var(--card-border)',
              background: 'var(--card-bg-gradient)',
            }}
          >
            <X className="h-4 w-4 opacity-60" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold opacity-60">
              {sceneLabel}
            </div>

            <div className="mt-0.5 text-[12px] opacity-50">
              {status === 'declined' ? '这次没能约成' : '邀约已取消'}
            </div>
          </div>
        </div>
      </CardShell>
    );
  }

  if (status === 'completed') {
    return (
      <CardShell tone="muted">
        <button
          type="button"
          onClick={() => onEnterScene?.(offlineSessionId, { readonly: true })}
          className="flex w-full items-center justify-between gap-3 text-left opacity-75 transition-opacity active:opacity-50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                borderColor: 'var(--card-border)',
                background: 'var(--card-bg-gradient)',
              }}
            >
              <BookMarked className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">
                {sceneLabel}
              </div>

              <div className="mt-0.5 text-[12px] opacity-50">
                已经结束的一次见面 · 点击回看
              </div>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 shrink-0 opacity-40" />
        </button>
      </CardShell>
    );
  }

  return null;
};

export default OfflineInviteCard;
