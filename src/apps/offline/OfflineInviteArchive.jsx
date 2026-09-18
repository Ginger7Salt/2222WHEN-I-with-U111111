// src/apps/offline/OfflineInviteArchive.jsx
//
// 解决「邀约卡片被聊天记录刷上去、不好找」的问题：
// 这是一个独立于消息列表的抽屉，展示某个聊天窗【全部】线下邀约
// （待处理 / 倒计时中 / 可进入 / 已结束 / 被拒绝或取消），
// 不依赖滚动到具体某条消息去找卡片。
//
// 数据来源直接复用 offlineSessionService.js 里已经存在的
// getAllOfflineSessionsForChat(chatId)，不新增任何数据表/字段。
import React, { useEffect, useState } from 'react';
import { X, Ticket, BookMarked, Clock, ChevronRight, XCircle } from 'lucide-react';

import { getAllOfflineSessionsForChat } from './offlineSessionService';

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

const STATUS_META = {
  pending_review: { label: '等待回应', color: 'var(--text-muted)' },
  scheduled: { label: '倒计时中', color: 'var(--accent-color)' },
  active: { label: '可以进入', color: 'var(--accent-color)' },
  completed: { label: '已经结束', color: 'var(--text-muted)' },
  declined: { label: '没能约成', color: 'var(--text-muted)' },
  cancelled: { label: '已取消', color: 'var(--text-muted)' },
};

const SessionRow = ({ session, onEnterScene }) => {
  const meta = STATUS_META[session.status] || { label: session.status, color: 'var(--text-muted)' };
  const isEnterable = session.status === 'active' || session.status === 'completed';
  const isMuted = session.status === 'declined' || session.status === 'cancelled';

  const handleClick = () => {
    if (!isEnterable) return;
    onEnterScene?.(session.id, { readonly: session.status === 'completed' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isEnterable}
      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-opacity disabled:cursor-default"
      style={{
        background: 'var(--control-soft-bg)',
        opacity: isMuted ? 0.55 : 1,
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--card-bg-gradient)', color: meta.color }}
      >
        {isMuted ? <XCircle className="h-4 w-4" /> : <BookMarked className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold">{session.sceneLabel}</span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-70">
          <span style={{ color: meta.color }}>{meta.label}</span>
          {session.scheduledFor && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatScheduledFor(session.scheduledFor)}
            </span>
          )}
        </div>
      </div>

      {isEnterable && <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />}
    </button>
  );
};

const OfflineInviteArchive = ({ chatId, onClose, onEnterScene }) => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const list = await getAllOfflineSessionsForChat(chatId);
        if (!cancelled) setSessions(list);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const activeAndScheduled = sessions.filter((s) => (
    s.status === 'pending_review' || s.status === 'scheduled' || s.status === 'active'
  ));

  const history = sessions.filter((s) => (
    s.status === 'completed' || s.status === 'declined' || s.status === 'cancelled'
  ));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl p-4 text-xs"
        style={{ background: 'var(--card-bg-gradient)', color: 'var(--text-main)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <span className="flex items-center gap-1.5 font-semibold">
            <Ticket className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
            线下邀约
          </span>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto no-scrollbar">
          {isLoading && (
            <p className="py-6 text-center opacity-50">正在加载…</p>
          )}

          {!isLoading && sessions.length === 0 && (
            <p className="py-6 text-center opacity-50">还没有任何线下邀约</p>
          )}

          {!isLoading && activeAndScheduled.length > 0 && (
            <div className="space-y-2">
              <div className="px-1 font-mono text-[10px] opacity-50">进行中</div>
              {activeAndScheduled.map((session) => (
                <SessionRow key={session.id} session={session} onEnterScene={onEnterScene} />
              ))}
            </div>
          )}

          {!isLoading && history.length > 0 && (
            <div className="space-y-2">
              <div className="px-1 font-mono text-[10px] opacity-50">历史记录</div>
              {history.map((session) => (
                <SessionRow key={session.id} session={session} onEnterScene={onEnterScene} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineInviteArchive;