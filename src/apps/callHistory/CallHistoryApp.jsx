// src/apps/callHistory/CallHistoryApp.jsx
//
// 待办 2：全局"通话记录"管理界面，2026-09 新增。
// 跨所有聊天窗汇总 call 类型消息，可以查看详情（复用现成的
// CallReviewModal）、单条/批量删除、把语音打包下载成一个 zip。
//
// 视觉/交互上参照 Apple 电话"通话记录"页的感觉：按日期分组、单条左滑
// 露出删除、顶部"全部/未接通/有语音留存"筛选标签；但质感统一套用
// 项目自己那套"弥散 + 杂志毛玻璃"的语言（backdrop-filter 弥散、
// 大写字距的小标签、archive.css 那种编辑感排版），不是照搬 iOS 原生
// 样式。批量删除/打包下载仍然保留"管理"多选模式，跟单条左滑删除
// 并存，互不冲突（选择模式下左滑手势关闭）。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  CheckSquare,
  Download,
  Loader2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Square,
  Trash2,
  Volume2
} from 'lucide-react';

import {
  deleteCallMessages,
  downloadCallMessagesAudioZip,
  getAllCallMessages,
  isMissedCall
} from './callHistoryService';
import CallReviewModal from '../messages/call/CallReviewModal';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import './callHistory.css';

const SWIPE_OPEN_X = -76;
const SWIPE_THRESHOLD_X = -38;
const SWIPE_LOCK_SLOP = 6;

const formatRowTime = (isoString) => {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/*
 * Apple 电话"今天/昨天/更早具体日期"的分组标签，配合杂志感的大写
 * 分组小标题展示。今年内的日期只显示月日，跨年才带上年份。
 */
const getDayGroupLabel = (isoString) => {
  if (!isoString) {
    return '更早';
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return '更早';
  }

  const now = new Date();
  const startOfDay = (value) => (
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  );

  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) {
    return '今天';
  }

  if (diffDays === 1) {
    return '昨天';
  }

  const sameYear = date.getFullYear() === now.getFullYear();

  return sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const buildDayGroups = (rows) => {
  const groups = [];
  let lastLabel = null;

  for (const item of rows) {
    const label = getDayGroupLabel(item.endedAt || item.timestamp);

    if (label !== lastLabel || groups.length === 0) {
      groups.push({ label, items: [] });
      lastLabel = label;
    }

    groups[groups.length - 1].items.push(item);
  }

  return groups;
};

const getRowStatusLabel = (item) => {
  if (item.status === 'ringing' || item.status === 'active') {
    return '通话进行中';
  }

  if (item.declined) {
    return item.unavailable ? '对方暂时无法接听' : '对方拒绝了通话';
  }

  if (item.status === 'ended' && !item.duration) {
    return '未接通';
  }

  return item.duration ? `通话时长 ${item.duration}` : '语音通话';
};

const getRowIcon = (item) => {
  if (item.status === 'ringing' || item.status === 'active') {
    return Phone;
  }

  if (item.declined) {
    return PhoneMissed;
  }

  return item.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
};

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'missed', label: '未接通' },
  { key: 'audio', label: '有语音留存' }
];

/*
 * 单条通话记录行：负责自己的左滑手势（Pointer Events，鼠标/触屏通用），
 * 但"当前是哪一条被滑开"这个状态交给父组件用 openSwipedId 统一管理，
 * 保证同一时间最多只有一条露出删除按钮——滑开另一条或点别的地方，
 * 上一条要自动收回去，这也是 Apple 电话那种列表的标准行为。
 */
const CallHistoryRow = ({
  item,
  isSelecting,
  isChecked,
  isSwiped,
  onSwipeOpen,
  onSwipeClose,
  onRowClick,
  onDeleteClick
}) => {
  const [dragX, setDragX] = useState(isSwiped ? SWIPE_OPEN_X : 0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, moved: false, locked: null });

  useEffect(() => {
    if (!dragRef.current.active) {
      setDragX(isSwiped ? SWIPE_OPEN_X : 0);
    }
  }, [isSwiped]);

  const handlePointerDown = (event) => {
    if (isSelecting) {
      return;
    }

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: isSwiped ? SWIPE_OPEN_X : 0,
      moved: false,
      locked: null
    };

    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    const state = dragRef.current;

    if (!state.active) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (state.locked === null) {
      if (Math.abs(deltaX) < SWIPE_LOCK_SLOP && Math.abs(deltaY) < SWIPE_LOCK_SLOP) {
        return;
      }

      state.locked = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (state.locked !== 'x') {
      return;
    }

    state.moved = true;
    const nextX = Math.min(0, Math.max(SWIPE_OPEN_X, state.baseX + deltaX));
    setDragX(nextX);
  };

  const finishDrag = () => {
    const state = dragRef.current;

    if (!state.active) {
      return;
    }

    state.active = false;
    setIsDragging(false);

    if (state.locked !== 'x') {
      return;
    }

    if (dragX <= SWIPE_THRESHOLD_X) {
      setDragX(SWIPE_OPEN_X);
      onSwipeOpen(item.messageId);
    } else {
      setDragX(0);
      onSwipeClose();
    }
  };

  const handleClick = () => {
    if (dragRef.current.moved) {
      return;
    }

    if (isSwiped) {
      setDragX(0);
      onSwipeClose();
      return;
    }

    onRowClick(item);
  };

  const RowIcon = getRowIcon(item);
  const missed = isMissedCall(item);

  return (
    <div className="cha-row-wrap">
      <button
        type="button"
        className="cha-row-delete-reveal"
        onClick={() => {
          setDragX(0);
          onSwipeClose();
          onDeleteClick(item);
        }}
        aria-label="删除这条通话记录"
      >
        <Trash2 className="h-4 w-4" />
        删除
      </button>

      <div
        className={['cha-row', isChecked ? 'is-selected' : ''].join(' ')}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={handleClick}
      >
        {isSelecting && (
          <div className="cha-row-checkbox">
            {isChecked ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </div>
        )}

        <div className="cha-row-avatar">
          {item.characterAvatar ? (
            <img src={item.characterAvatar} alt={item.characterName} draggable={false} />
          ) : (
            <span>{(item.characterName || '?').slice(0, 1)}</span>
          )}
        </div>

        <div className="cha-row-body">
          <div className="cha-row-top">
            <span className={['cha-row-name', missed ? 'is-missed' : ''].join(' ')}>
              {item.characterName}
            </span>
            <span className="cha-row-time">
              {formatRowTime(item.endedAt || item.timestamp)}
            </span>
          </div>

          <div className="cha-row-bottom">
            <RowIcon className={['h-3 w-3', missed ? 'is-missed' : ''].join(' ')} />
            <span>{getRowStatusLabel(item)}</span>
            {item.hasAudio && (
              <span className="cha-row-audio-badge">
                <Volume2 className="h-3 w-3" />
                {item.audioCount}
              </span>
            )}
          </div>

          {item.chatTitle && item.chatTitle !== item.characterName && (
            <div className="cha-row-chat">来自「{item.chatTitle}」</div>
          )}
        </div>
      </div>
    </div>
  );
};

const CallHistoryApp = ({ onBackHub }) => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activeFilter, setActiveFilter] = useState('all');
  const [openSwipedId, setOpenSwipedId] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const rows = await getAllCallMessages();
      setItems(rows);
    } catch (error) {
      console.error('[CallHistory] 读取通话记录失败：', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'missed') {
      return items.filter((item) => isMissedCall(item));
    }

    if (activeFilter === 'audio') {
      return items.filter((item) => item.hasAudio);
    }

    return items;
  }, [items, activeFilter]);

  const dayGroups = useMemo(
    () => buildDayGroups(filteredItems),
    [filteredItems]
  );

  const missedCount = useMemo(
    () => items.filter((item) => isMissedCall(item)).length,
    [items]
  );

  const audioCount = useMemo(
    () => items.filter((item) => item.hasAudio).length,
    [items]
  );

  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.has(item.messageId)),
    [filteredItems, selectedIds]
  );

  const selectedAudioCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + (item.audioCount || 0), 0),
    [selectedItems]
  );

  const handleToggleSelecting = () => {
    setIsSelecting((previous) => !previous);
    setSelectedIds(new Set());
    setOpenSwipedId(null);
  };

  const handleToggleSelectOne = (messageId) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((previous) => (
      previous.size === filteredItems.length
        ? new Set()
        : new Set(filteredItems.map((item) => item.messageId))
    ));
  };

  const handleRowClick = (item) => {
    if (isSelecting) {
      handleToggleSelectOne(item.messageId);
      return;
    }

    setReviewItem(item);
  };

  const handleChangeFilter = (key) => {
    setActiveFilter(key);
    setOpenSwipedId(null);
  };

  const handleDownloadSelected = async () => {
    const targets = selectedItems.length > 0 ? selectedItems : filteredItems;

    if (targets.length === 0) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await downloadCallMessagesAudioZip(targets);

      if (result.fileCount === 0) {
        triggerGlobalToast({
          title: '没有可下载的语音',
          content: '选中的通话记录里没有保留下来的语音片段。',
          iconType: 'bell'
        });
        return;
      }

      triggerGlobalToast({
        title: '打包下载已开始',
        content: `已打包 ${result.messageCount} 通通话、共 ${result.fileCount} 段语音。`,
        iconType: 'bell'
      });
    } catch (error) {
      console.error('[CallHistory] 打包下载语音失败：', error);
      triggerGlobalToast({
        title: '打包下载失败',
        content: '请稍后再试一次。',
        iconType: 'bell'
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRequestDeleteSelected = () => {
    if (selectedItems.length === 0) {
      return;
    }

    setConfirmDeleteIds(selectedItems.map((item) => item.messageId));
  };

  const handleRequestDeleteOne = (item) => {
    setConfirmDeleteIds([item.messageId]);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteIds || confirmDeleteIds.length === 0) {
      setConfirmDeleteIds(null);
      return;
    }

    setIsBusy(true);

    try {
      await deleteCallMessages(confirmDeleteIds);

      setItems((previous) => (
        previous.filter((item) => !confirmDeleteIds.includes(item.messageId))
      ));

      setSelectedIds((previous) => {
        const next = new Set(previous);
        confirmDeleteIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch (error) {
      console.error('[CallHistory] 删除通话记录失败：', error);
      triggerGlobalToast({
        title: '删除失败',
        content: '请稍后再试一次。',
        iconType: 'bell'
      });
    } finally {
      setIsBusy(false);
      setConfirmDeleteIds(null);
    }
  };

  return createPortal(
    <div className="call-history-app">
      <div className="call-history-hud">
        <button
          type="button"
          className="call-history-hud-back"
          onClick={onBackHub}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回主页
        </button>

        {items.length > 0 && (
          <button
            type="button"
            className="call-history-hud-select-btn"
            onClick={handleToggleSelecting}
          >
            {isSelecting ? '取消' : '管理'}
          </button>
        )}
      </div>

      <div className="call-history-page-title">
        <span className="call-history-page-kicker">RECENT CALLS</span>
        <h1>通话记录</h1>
        <p>所有聊天窗的语音通话，汇总在这里</p>
      </div>

      {!isSelecting && items.length > 0 && (
        <div className="call-history-filter-tabs">
          {FILTERS.map((filter) => {
            const count = filter.key === 'missed'
              ? missedCount
              : (filter.key === 'audio' ? audioCount : items.length);

            return (
              <button
                key={filter.key}
                type="button"
                className={[
                  'call-history-filter-tab',
                  activeFilter === filter.key ? 'is-active' : ''
                ].join(' ')}
                onClick={() => handleChangeFilter(filter.key)}
              >
                {filter.label}
                <span className="call-history-filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {isSelecting && items.length > 0 && (
        <div className="call-history-toolbar">
          <button
            type="button"
            className="call-history-toolbar-btn"
            onClick={handleToggleSelectAll}
          >
            {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            全选
          </button>

          <span className="call-history-toolbar-count">
            已选 {selectedIds.size} 条
            {selectedAudioCount > 0 ? `（${selectedAudioCount} 段语音）` : ''}
          </span>

          <div className="call-history-toolbar-actions">
            <button
              type="button"
              className="call-history-toolbar-btn"
              disabled={isBusy}
              onClick={handleDownloadSelected}
            >
              <Download className="h-3.5 w-3.5" />
              打包下载
            </button>

            <button
              type="button"
              className="call-history-toolbar-btn call-history-toolbar-btn-danger"
              disabled={isBusy || selectedIds.size === 0}
              onClick={handleRequestDeleteSelected}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>
      )}

      <div className="call-history-list-wrap">
        {isLoading && (
          <div className="call-history-empty">
            <Loader2 className="call-history-empty-icon h-6 w-6 animate-spin" />
            <p>正在读取通话记录。</p>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="call-history-empty">
            <Phone className="call-history-empty-icon h-6 w-6" />
            <p>还没有任何通话记录。</p>
          </div>
        )}

        {!isLoading && items.length > 0 && filteredItems.length === 0 && (
          <div className="call-history-empty">
            <Phone className="call-history-empty-icon h-6 w-6" />
            <p>这个筛选条件下没有记录。</p>
          </div>
        )}

        {!isLoading && dayGroups.map((group) => (
          <div className="cha-day-group" key={group.label + group.items[0]?.messageId}>
            <div className="cha-day-group-label">{group.label}</div>

            <div className="call-history-list">
              {group.items.map((item) => (
                <CallHistoryRow
                  key={item.messageId}
                  item={item}
                  isSelecting={isSelecting}
                  isChecked={selectedIds.has(item.messageId)}
                  isSwiped={openSwipedId === item.messageId}
                  onSwipeOpen={setOpenSwipedId}
                  onSwipeClose={() => setOpenSwipedId(null)}
                  onRowClick={handleRowClick}
                  onDeleteClick={handleRequestDeleteOne}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {isBusy && (
        <div className="call-history-busy-overlay">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {reviewItem && (
        <CallReviewModal
          message={reviewItem.message}
          character={{
            name: reviewItem.characterName,
            avatar: reviewItem.characterAvatar
          }}
          userName={reviewItem.userName}
          onClose={() => setReviewItem(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDeleteIds)}
        title="删除通话记录"
        message={
          confirmDeleteIds && confirmDeleteIds.length > 1
            ? `确定要删除选中的 ${confirmDeleteIds.length} 条通话记录吗？连同保留的语音一起删除，不可恢复。`
            : '确定要删除这条通话记录吗？连同保留的语音一起删除，不可恢复。'
        }
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteIds(null)}
      />
    </div>,
    document.body
  );
};

export default CallHistoryApp;