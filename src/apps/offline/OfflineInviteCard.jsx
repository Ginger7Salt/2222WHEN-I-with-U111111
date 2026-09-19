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

// 黑白极简风格的邀约卡片外壳
const CardShell = ({ children, tone = 'default', accentBorder = false }) => (
  <div
    className="relative mx-auto my-3 flex w-full max-w-[310px] flex-col gap-2.5 overflow-hidden rounded-[1.5rem] p-4 text-xs leading-relaxed shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl"
    style={{
      background:
        tone === 'muted'
          ? 'var(--control-soft-bg)'
          : 'var(--card-bg-gradient)',
      color: 'var(--text-main)',
      border: `1px solid ${
        accentBorder ? 'var(--text-main)' : 'var(--card-border)'
      }`,
      opacity: tone === 'muted' ? 0.72 : 1,
    }}
  >
    <div
      className="pointer-events-none absolute inset-x-5 top-0 h-px"
      style={{
        background: accentBorder
          ? 'var(--text-main)'
          : 'var(--card-border)',
        opacity: accentBorder ? 0.7 : 0.5,
      }}
    />

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
        <div className="flex items-center gap-2 text-[11px] tracking-wide opacity-70">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-xl"
            style={{ background: 'var(--card-border)' }}
          >
            <Ticket className="h-3.5 w-3.5 animate-pulse" />
          </span>
          <span>等待对方回应你的邀约…</span>
        </div>

        <div className="text-[15px] font-semibold tracking-tight">
          {sceneLabel}
        </div>

        {scheduledForText && (
          <div className="flex items-center gap-1.5 text-[11px] opacity-60">
            <Clock className="h-3 w-3" />
            <span>{scheduledForText}</span>
          </div>
        )}
      </CardShell>
    );
  }

  if (status === 'pending_review' && proposedBy === 'character') {
    return (
      <CardShell accentBorder>
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--text-main)',
              color: 'var(--accent-foreground)',
            }}
          >
            <BookMarked className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[15px] font-semibold tracking-tight">
              {sceneLabel}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] opacity-45">
              Invitation
            </div>
          </div>
        </div>

        {sceneDescription && (
          <div
            className="rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed opacity-80"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            {sceneDescription}
          </div>
        )}

        {scheduledForText && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] opacity-75"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{scheduledForText}</span>
          </div>
        )}

        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isResponding}
            onClick={handleAccept}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'var(--text-main)',
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
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl font-medium transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'transparent',
              color: 'var(--text-main)',
              border: '1px solid var(--card-border)',
            }}
          >
            <X className="h-3.5 w-3.5" />
            改天吧
          </button>
        </div>
      </CardShell>
    );
  }

  if (status === 'scheduled') {
    return (
      <CardShell accentBorder>
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--text-main)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Ticket className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[15px] font-semibold tracking-tight">
              {sceneLabel}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] opacity-45">
              Scheduled
            </div>
          </div>
        </div>

        {scheduledForText && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] opacity-75"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{scheduledForText}</span>
          </div>
        )}

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium"
          style={{
            background: 'var(--text-main)',
            color: 'var(--accent-foreground)',
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: 'currentColor' }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: 'currentColor' }}
            />
          </span>

          <Clock className="h-3.5 w-3.5" />
          <span>{countdownText}</span>
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
          className="flex items-center justify-between gap-3 text-left transition-opacity active:opacity-70"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--text-main)',
                color: 'var(--accent-foreground)',
              }}
            >
              <BookMarked className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight">
                {sceneLabel}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] opacity-45">
                Now available
              </div>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
        </button>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium"
          style={{
            background: 'var(--text-main)',
            color: 'var(--accent-foreground)',
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: 'currentColor' }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: 'currentColor' }}
            />
          </span>

          <span>时间到了，点这里赴约</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-70" />
        </div>
      </CardShell>
    );
  }

  if (status === 'declined' || status === 'cancelled') {
    return (
      <CardShell tone="muted">
        <div className="flex items-start gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl opacity-60"
            style={{ background: 'var(--card-border)' }}
          >
            <X className="h-3.5 w-3.5" />
          </span>

          <div className="min-w-0 pt-0.5">
            <div className="text-[14px] font-semibold tracking-tight opacity-65">
              {sceneLabel}
            </div>
            <div className="mt-1 text-[11px] opacity-50">
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
          className="flex items-center justify-between gap-3 text-left opacity-75 transition-opacity active:opacity-50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--card-border)' }}
            >
              <BookMarked className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold tracking-tight">
                {sceneLabel}
              </div>
              <div className="mt-1 text-[11px] opacity-50">
                已结束的一次见面 · 点击回看
              </div>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </CardShell>
    );
  }

  return null;
};

export default OfflineInviteCard;
