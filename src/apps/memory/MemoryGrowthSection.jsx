import React, { useCallback, useEffect, useState } from 'react';

import {
  GROWTH_DIMENSION_LABELS,
  GROWTH_STATUSES,
  getActiveItems,
  normalizeGrowthState
} from './memoryGrowth';

import {
  acknowledgeGrowth,
  confirmGrowth,
  dismissGrowth,
  getGrowthState,
  revertGrowth
} from './memoryGrowthService';

const describeStrength = (strength) => {
  if (strength < 0.35) return '隐约';
  if (strength < 0.65) return '比较明显';

  return '很明显';
};

const buttonStyle = {
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
  background: 'var(--card-bg)'
};

/**
 * 「记忆」App 里的角色成长：
 *   - 角色因为共同经历（重大事件、长期没化解的情绪）慢慢形成的变化，叠加在人设之上；
 *   - 新出现的成长先等你确认（或者在"角色直接整理"开启后直接生效并提醒你）；
 *   - 生效中的成长可以随时回退，之后遇到同样的事还可能再长出来。
 * 每个消息框各有一份。
 */
export const MemoryGrowthSection = ({ chatId = null }) => {
  const [state, setState] = useState(() => normalizeGrowthState(null));
  const [busyId, setBusyId] = useState(null);

  const hasChat = (
    chatId !== null &&
    chatId !== undefined &&
    chatId !== ''
  );

  const load = useCallback(async () => {
    if (!hasChat) {
      setState(normalizeGrowthState(null));
      return;
    }

    try {
      setState(await getGrowthState(chatId));
    } catch (error) {
      console.warn('[Growth] 读取成长失败：', error);
    }
  }, [chatId, hasChat]);

  useEffect(() => {
    load();

    const handleChanged = () => {
      load();
    };

    window.addEventListener('memory-growth-changed', handleChanged);

    return () => {
      window.removeEventListener('memory-growth-changed', handleChanged);
    };
  }, [load]);

  const runAction = async (itemId, action) => {
    if (busyId) return;

    setBusyId(itemId);

    try {
      await action(chatId, itemId);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (!hasChat) {
    return null;
  }

  const pendingItems = state.items.filter((item) => (
    item.status === GROWTH_STATUSES.PENDING
  ));

  const activeItems = getActiveItems(state.items)
    .sort((left, right) => right.strength - left.strength);

  const fadedCount = state.items.filter((item) => (
    item.status === GROWTH_STATUSES.FADED
  )).length;

  const hasUnseen = state.items.some((item) => item.unseen);

  const renderItem = (item) => (
    <div
      key={item.id}
      className="mt-2 rounded-xl border px-3 py-2"
      style={{
        borderColor: item.unseen ? 'var(--accent-color)' : 'var(--card-border)',
        background: 'var(--card-bg)'
      }}
    >
      <div
        className="flex items-center justify-between text-[10px]"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>{GROWTH_DIMENSION_LABELS[item.dimension] || item.dimension}</span>
        <span>
          {item.status === GROWTH_STATUSES.PENDING
            ? '待确认'
            : describeStrength(item.strength)}
        </span>
      </div>

      <p
        className="mt-1 text-[12px] leading-relaxed"
        style={{ color: 'var(--text-main)' }}
      >
        {item.text}
      </p>

      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--card-border)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(item.strength * 100)}%`,
            background: 'var(--accent-color)'
          }}
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        {item.status === GROWTH_STATUSES.PENDING && (
          <>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => runAction(item.id, dismissGrowth)}
              className="rounded-full border px-3 py-1 text-[11px]"
              style={buttonStyle}
            >
              忽略
            </button>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => runAction(item.id, confirmGrowth)}
              className="rounded-full border px-3 py-1 text-[11px]"
              style={{
                borderColor: 'var(--accent-color)',
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              确认
            </button>
          </>
        )}

        {item.status === GROWTH_STATUSES.ACTIVE && (
          <button
            type="button"
            disabled={busyId === item.id}
            onClick={() => runAction(item.id, revertGrowth)}
            className="rounded-full border px-3 py-1 text-[11px]"
            style={buttonStyle}
          >
            回退
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className="memory-chat-section">
      <div className="memory-section-label">
        <span>角色的成长</span>
        <span className="memory-section-line" />
      </div>

      <p
        className="mt-2 text-[11px] leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        角色因为共同经历慢慢形成的变化，叠加在人设之上，不会改动人设原文。
        新的经历可以让它增强，也可以把它推回去；回退或回落后，遇到同样的事还可能再长出来。
      </p>

      {hasUnseen && (
        <div
          className="mt-2 flex items-center justify-between rounded-xl border px-3 py-2 text-[11px]"
          style={{
            borderColor: 'var(--accent-color)',
            color: 'var(--text-main)',
            background: 'var(--card-bg)'
          }}
        >
          <span>角色有了新的变化，边框高亮的是新出现或刚回落的。</span>
          <button
            type="button"
            onClick={async () => {
              await acknowledgeGrowth(chatId);
              await load();
            }}
            className="ml-2 shrink-0 rounded-full border px-3 py-1 text-[11px]"
            style={buttonStyle}
          >
            知道了
          </button>
        </div>
      )}

      {pendingItems.length > 0 && (
        <>
          <p
            className="mt-3 text-[11px]"
            style={{ color: 'var(--text-sub)' }}
          >
            等你确认（确认前不会影响角色）
          </p>
          {pendingItems.map(renderItem)}
        </>
      )}

      {activeItems.length > 0 && (
        <>
          <p
            className="mt-3 text-[11px]"
            style={{ color: 'var(--text-sub)' }}
          >
            正在生效
          </p>
          {activeItems.map(renderItem)}
        </>
      )}

      {pendingItems.length === 0 && activeItems.length === 0 && (
        <p
          className="mt-3 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-sub)' }}
        >
          还没有形成成长变化。出现重大的关系事件，或者难受的情绪持续很多天之后，才会判断一次。
        </p>
      )}

      {fadedCount > 0 && (
        <p
          className="mt-3 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          已回落 {fadedCount} 条（不再生效，遇到同样的事还可能再长出来）
        </p>
      )}
    </section>
  );
};

export default MemoryGrowthSection;