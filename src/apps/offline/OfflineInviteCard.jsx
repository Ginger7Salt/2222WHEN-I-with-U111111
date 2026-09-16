import React, { useState, useEffect } from 'react';
import { BookMarked, Ticket, Check, X, Clock, ChevronRight } from 'lucide-react';

import {
  acceptOfflineSessionProposal,
  declineOfflineSessionProposal,
} from './offlineSessionService';

const formatScheduledFor = (scheduledFor) => {
  try {
    return new Date(scheduledFor).toLocaleString('zh-CN', {
      month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'short',
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

const CardShell = ({ children, tone = 'default' }) => (
  <div
    className="mx-auto my-2 flex max-w-[240px] flex-col gap-1 rounded-xl p-3 text-xs shadow-md"
    style={{
      background: tone === 'muted' ? 'var(--control-soft-bg)' : 'var(--card-bg-gradient)',
      color: 'var(--text-main)',
      border: '1px solid var(--card-border)',
      opacity: tone === 'muted' ? 0.65 : 1,
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
        <div className="flex items-center gap-1.5 opacity-70">
          <Ticket className="h-3.5 w-3.5 animate-pulse" />
          <span>等待对方回应你的邀约…</span>
        </div>
        <div className="font-semibold">{sceneLabel}</div>
        {scheduledForText && <div className="opacity-70">{scheduledForText}</div>}
      </CardShell>
    );
  }

  if (status === 'pending_review' && proposedBy === 'character') {
    return (
      <CardShell>
        <div className="flex items-center gap-1.5">
          <BookMarked className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
          <span className="font-semibold">{sceneLabel}</span>
        </div>
        {sceneDescription && <div className="opacity-75">{sceneDescription}</div>}
        {scheduledForText && (
          <div className="flex items-center gap-1 opacity-75">
            <Clock className="h-3 w-3" />
            <span>{scheduledForText}</span>
          </div>
        )}
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            disabled={isResponding}
            onClick={handleAccept}
            className="flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Check className="h-3 w-3" /> 好呀
          </button>
          <button
            type="button"
            disabled={isResponding}
            onClick={handleDecline}
            className="flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 disabled:opacity-50"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <X className="h-3 w-3" /> 改天吧
          </button>
        </div>
      </CardShell>
    );
  }

  if (status === 'scheduled') {
    return (
      <CardShell>
        <div className="flex items-center gap-1.5">
          <Ticket className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
          <span className="font-semibold">{sceneLabel}</span>
        </div>
        {scheduledForText && <div className="opacity-75">{scheduledForText}</div>}
        <div className="mt-1 flex items-center gap-1 font-mono text-[11px]" style={{ color: 'var(--accent-color)' }}>
          <Clock className="h-3 w-3" />
          <span>{countdownText}</span>
        </div>
      </CardShell>
    );
  }

  if (status === 'active') {
    return (
      <CardShell>
        <button
          type="button"
          onClick={() => onEnterScene?.(offlineSessionId)}
          className="flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-1.5">
            <BookMarked className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">{sceneLabel}</span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-60" />
        </button>
        <div className="opacity-70">时间到了，点这里赴约</div>
      </CardShell>
    );
  }

  if (status === 'declined' || status === 'cancelled') {
    return (
      <CardShell tone="muted">
        <div className="flex items-center gap-1.5 opacity-60">
          <X className="h-3.5 w-3.5" />
          <span>{sceneLabel}</span>
        </div>
        <div className="opacity-50">
          {status === 'declined' ? '这次没能约成' : '邀约已取消'}
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
          className="flex items-center justify-between gap-2 text-left opacity-75"
        >
          <div className="flex items-center gap-1.5">
            <BookMarked className="h-3.5 w-3.5" />
            <span>{sceneLabel}</span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-60" />
        </button>
        <div className="opacity-50">已经结束的一次见面 · 点击回看</div>
      </CardShell>
    );
  }

  return null;
};

export default OfflineInviteCard;