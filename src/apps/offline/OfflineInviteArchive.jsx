// src/apps/offline/OfflineInviteArchive.jsx
//
// 全屏版邀约收纳室（替换掉之前的抽屉列表版）。
// 三个 tab：进行中（待回应/倒计时/可进入）、已完成、未成行（拒绝/取消）。
// 每张卡片是「标题 + 时间」的头部，下面一排小胶囊标签展示状态/消息数/发起人，
// 有心情或天气快照的话也会带出来（复用 offlineSceneStatusService 写的字段）。
//
// 数据来源仍然是 offlineSessionService.js 里的 getAllOfflineSessionsForChat(chatId)，
// 额外查了一次每个 session 的线下消息条数用来做「💬 N」标签，
// 不新增数据表，只读不写。
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Timer,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';

import db from '../../db';
import { getAllOfflineSessionsForChat } from './offlineSessionService';

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('zh-CN', {
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

const STATUS_META = {
  pending_review: { label: '等待回应', icon: Clock, tint: 'var(--text-muted)' },
  scheduled: { label: '倒计时中', icon: Timer, tint: 'var(--accent-color)' },
  active: { label: '可以进入', icon: Sparkles, tint: 'var(--accent-color)' },
  completed: { label: '已完成', icon: CheckCircle2, tint: 'var(--text-muted)' },
  declined: { label: '被拒绝了', icon: XCircle, tint: '#ef4444' },
  cancelled: { label: '已取消', icon: XCircle, tint: '#ef4444' },
};

const TABS = [
  { key: 'ongoing', label: '进行中', statuses: ['pending_review', 'scheduled', 'active'] },
  { key: 'completed', label: '已完成', statuses: ['completed'] },
  { key: 'inactive', label: '未成行', statuses: ['declined', 'cancelled'] },
];

const getDateLabel = (session) => {
  if (session.status === 'completed') {
    return session.completedAt ? `${formatDateTime(session.completedAt)} 结束` : '已经结束';
  }
  if (session.status === 'declined' || session.status === 'cancelled') {
    return session.updatedAt ? formatDateTime(session.updatedAt) : '';
  }
  return session.scheduledFor ? formatDateTime(session.scheduledFor) : '时间待定';
};

const Tile = ({ label, tint }) => (
  <span
    className="rounded-full px-2 py-0.5 text-[9.5px] font-medium"
    style={{ background: 'var(--control-soft-bg)', color: tint || 'var(--text-main)' }}
  >
    {label}
  </span>
);

const InviteCard = ({ session, onEnterScene }) => {
  const meta = STATUS_META[session.status] || { label: session.status, icon: Clock, tint: 'var(--text-muted)' };
  const StatusIcon = meta.icon;

  const isEnterable = session.status === 'active' || session.status === 'completed';
  const isMuted = session.status === 'declined' || session.status === 'cancelled';

  const handleClick = () => {
    if (!isEnterable) return;
    onEnterScene?.(session.id);
  };

  const hasSceneStatus = Boolean(session.sceneMood || session.sceneWeather);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isEnterable}
      className="relative w-full overflow-hidden rounded-3xl p-4 text-left shadow-lg transition-transform active:scale-[0.98] disabled:cursor-default disabled:active:scale-100"
      style={{
        background: 'var(--card-bg-gradient)',
        border: `1px solid ${isEnterable ? 'var(--accent-color)' : 'var(--card-border)'}`,
        opacity: isMuted ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--control-soft-bg)', color: meta.tint }}
          >
            <StatusIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{session.sceneLabel}</div>
            <div className="truncate text-[10px] opacity-60">{getDateLabel(session)}</div>
          </div>
        </div>

        {isEnterable && <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Tile label={meta.label} tint={meta.tint} />

        {typeof session.messageCount === 'number' && session.messageCount > 0 && (
          <Tile label={`💬 ${session.messageCount}`} />
        )}

        {hasSceneStatus && session.sceneWeather && <Tile label={session.sceneWeather} />}
        {hasSceneStatus && session.sceneMood && <Tile label={session.sceneMood} />}

        <Tile label={session.proposedBy === 'user' ? '你发起的' : '对方发起的'} />
      </div>
    </button>
  );
};

const OfflineInviteArchive = ({ chatId, onClose, onEnterScene }) => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ongoing');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const list = await getAllOfflineSessionsForChat(chatId);

        const withCounts = await Promise.all(
          list.map(async (session) => {
            const messageCount = await db.messages
              .where('offlineSessionId')
              .equals(session.id)
              .count();
            return { ...session, messageCount };
          })
        );

        if (!cancelled) setSessions(withCounts);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const tabCounts = useMemo(() => {
    const counts = {};
    TABS.forEach((tab) => {
      counts[tab.key] = sessions.filter((s) => tab.statuses.includes(s.status)).length;
    });
    return counts;
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (!tab) return [];
    return sessions.filter((s) => tab.statuses.includes(s.status));
  }, [sessions, activeTab]);

  return (
    <div
      className="fixed inset-0 z-[70] flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <header className="z-20 shrink-0 px-4 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-full p-2 opacity-85 shadow-sm transition-transform hover:opacity-100 active:scale-90"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
            aria-label="关闭"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <span className="text-xs font-semibold">线下邀约</span>

          <div className="w-9" />
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-all active:scale-95"
                style={{
                  background: isActive ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                  color: isActive ? 'var(--accent-foreground)' : 'var(--text-main)',
                  opacity: isActive ? 1 : 0.8,
                }}
              >
                <span>{tab.label}</span>
                {tabCounts[tab.key] > 0 && (
                  <span
                    className="rounded-full px-1.5 text-[9.5px]"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--card-bg-gradient)',
                    }}
                  >
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
        {isLoading && (
          <p className="py-10 text-center text-xs opacity-50">正在加载…</p>
        )}

        {!isLoading && visibleSessions.length === 0 && (
          <p className="py-10 text-center text-xs opacity-50">
            {activeTab === 'ongoing' && '还没有进行中的邀约'}
            {activeTab === 'completed' && '还没有完成过的线下见面'}
            {activeTab === 'inactive' && '没有被拒绝或取消的邀约'}
          </p>
        )}

        {!isLoading && visibleSessions.length > 0 && (
          <div className="space-y-3 pb-4">
            {visibleSessions.map((session) => (
              <InviteCard key={session.id} session={session} onEnterScene={onEnterScene} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default OfflineInviteArchive;