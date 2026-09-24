import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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

import './memoryGrowth.css';

const COLLAPSE_STORAGE_KEY = 'memory-growth-collapsed';

// 整体是否收起：只是这台设备上的显示偏好，读写失败就按"收起"处理。
const readCollapsed = () => {
  try {
    const value = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);

    return value === null ? true : value === '1';
  } catch {
    return true;
  }
};

const writeCollapsed = (collapsed) => {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // 记不住也没关系。
  }
};

const describeStrength = (strength) => {
  if (strength < 0.35) return '隐约';
  if (strength < 0.65) return '比较明显';

  return '很明显';
};

/*
 * 一个分组（待确认 / 正在生效）：标题行可以单独收起，
 * 展开后是一条可以左右滑动的栏，桌面上也可以用两侧的箭头翻页。
 */
const GrowthGroup = ({
  eyebrow,
  title,
  items,
  renderItem
}) => {
  const [open, setOpen] = useState(true);
  const railRef = useRef(null);

  const scrollRail = (direction) => {
    const rail = railRef.current;

    if (!rail) return;

    rail.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: 'smooth'
    });
  };

  return (
    <div className="memory-growth-group">
      <div className="memory-growth-group-head">
        <button
          type="button"
          className="memory-growth-group-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="memory-growth-group-eyebrow">{eyebrow}</span>
          <span className="memory-growth-group-title">{title}</span>
          <span className="memory-growth-group-count">{items.length}</span>
        </button>

        <div className="memory-growth-group-tools">
          {open && items.length > 1 && (
            <>
              <button
                type="button"
                className="memory-growth-arrow"
                aria-label="向左翻"
                onClick={() => scrollRail(-1)}
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                className="memory-growth-arrow"
                aria-label="向右翻"
                onClick={() => scrollRail(1)}
              >
                <ChevronRight />
              </button>
            </>
          )}

          <button
            type="button"
            className="memory-growth-arrow"
            aria-label={open ? '收起这一组' : '展开这一组'}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={[
                'memory-growth-group-chevron',
                open ? 'memory-growth-group-chevron-open' : ''
              ].join(' ')}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="memory-growth-rail" ref={railRef}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
};

/**
 * 「记忆」App 里的角色成长：
 *   - 角色因为共同经历（重大事件、长期没化解的情绪）慢慢形成的变化，叠加在人设之上；
 *   - 新出现的成长先等你确认（或者在"角色直接整理"开启后直接生效并提醒你）；
 *   - 生效中的成长可以随时回退，之后遇到同样的事还可能再长出来。
 * 每个消息框各有一份。整体和每一组都可以收起，条目横向滑动，避免页面越拉越长。
 */
export const MemoryGrowthSection = ({ chatId = null }) => {
  const [state, setState] = useState(() => normalizeGrowthState(null));
  const [busyId, setBusyId] = useState(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);

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

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      writeCollapsed(!value);

      return !value;
    });
  };

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

  const summaryParts = [];

  if (activeItems.length > 0) summaryParts.push(`${activeItems.length} 条生效`);
  if (pendingItems.length > 0) summaryParts.push(`${pendingItems.length} 条待确认`);
  if (fadedCount > 0) summaryParts.push(`${fadedCount} 条已回落`);

  const summary = summaryParts.length > 0
    ? summaryParts.join(' / ')
    : '还没有形成成长变化';

  const renderItem = (item, index, list) => {
    const isPending = item.status === GROWTH_STATUSES.PENDING;

    return (
      <article
        key={item.id}
        className={[
          'memory-growth-slip',
          isPending ? 'memory-growth-slip-pending' : ''
        ].filter(Boolean).join(' ')}
      >
        <div className="memory-growth-slip-top">
          <span className="memory-growth-slip-dimension">
            {GROWTH_DIMENSION_LABELS[item.dimension] || item.dimension}
          </span>

          <span>
            {item.unseen
              ? 'NEW'
              : `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`}
          </span>
        </div>

        <p className="memory-growth-slip-text">{item.text}</p>

        <span className="memory-growth-meter" aria-hidden="true">
          <i style={{ width: `${Math.round(item.strength * 100)}%` }} />
        </span>

        <div className="memory-growth-slip-meta">
          <span>{isPending ? '确认前不影响角色' : describeStrength(item.strength)}</span>
        </div>

        <div className="memory-growth-slip-actions">
          {isPending && (
            <>
              <button
                type="button"
                className="memory-inline-button"
                disabled={busyId === item.id}
                onClick={() => runAction(item.id, confirmGrowth)}
              >
                确认
              </button>
              <button
                type="button"
                className="memory-candidate-dismiss-button"
                disabled={busyId === item.id}
                onClick={() => runAction(item.id, dismissGrowth)}
              >
                忽略
              </button>
            </>
          )}

          {item.status === GROWTH_STATUSES.ACTIVE && (
            <button
              type="button"
              className="memory-candidate-dismiss-button"
              disabled={busyId === item.id}
              onClick={() => runAction(item.id, revertGrowth)}
            >
              回退
            </button>
          )}
        </div>
      </article>
    );
  };

  const needsAttention = hasUnseen || pendingItems.length > 0;

  return (
    <section className="memory-chat-section memory-growth-section">
      <div className="memory-section-label">
        <span>角色的成长</span>
        <span className="memory-section-line" />
      </div>

      <button
        type="button"
        className="memory-growth-toggle"
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        <div className="memory-growth-toggle-copy">
          <span className="memory-growth-kicker">
            GROWTH NOTES
            {needsAttention && collapsed && (
              <span className="memory-growth-new-mark">
                {pendingItems.length > 0 ? '待确认' : 'NEW'}
              </span>
            )}
          </span>

          <strong className="memory-growth-title">
            随共同经历慢慢长出来的样子
          </strong>

          <span className="memory-growth-summary">{summary}</span>
        </div>

        <ChevronDown
          className={[
            'memory-growth-chevron',
            collapsed ? '' : 'memory-growth-chevron-open'
          ].join(' ')}
        />
      </button>

      {!collapsed && (
        <div className="memory-growth-body">
          <p className="memory-growth-note">
            叠加在人设之上，不改动人设原文。新的经历可以让它增强，也可以把它推回去；
            回退或回落之后，遇到同样的事还可能再长出来。
          </p>

          {hasUnseen && (
            <div className="memory-growth-notice">
              <span>角色有了新的变化，标着 NEW 的是新出现或刚回落的。</span>

              <button
                type="button"
                className="memory-growth-text-button"
                onClick={async () => {
                  await acknowledgeGrowth(chatId);
                  await load();
                }}
              >
                知道了
              </button>
            </div>
          )}

          {pendingItems.length > 0 && (
            <GrowthGroup
              eyebrow="PENDING"
              title="等你确认"
              items={pendingItems}
              renderItem={renderItem}
            />
          )}

          {activeItems.length > 0 && (
            <GrowthGroup
              eyebrow="ACTIVE"
              title="正在生效"
              items={activeItems}
              renderItem={renderItem}
            />
          )}

          {pendingItems.length === 0 && activeItems.length === 0 && (
            <p className="memory-growth-empty">
              出现重大的关系事件，或者难受的情绪持续很多天之后，才会判断一次。
            </p>
          )}

          {fadedCount > 0 && (
            <p className="memory-growth-faded">
              已回落 {fadedCount} 条，不再生效
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default MemoryGrowthSection;