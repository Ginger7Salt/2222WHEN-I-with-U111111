// src/apps/hub/EditableAppGrid.jsx
//
// 首页应用区的「编辑模式」：长按进入之后，原本左右翻页的 2 列网格
// 换成一个不分页、纵向排列的连续 2 列网格，所有卡片同时轻轻抖动，
// 可以按住任意一张自由拖到网格里的任意格子，其余卡片会自动让开。
//
// 拖拽用的是项目里已经装了但还没用到的 motion（Framer Motion 的
// 继任包）：
//   - 每张卡片套一层 <motion.div layout drag>，drag 让它能跟着手指
//     自由移动（不受 CSS Grid 本身只能整格摆放的限制），layout 让
//     "没在被拖的那些卡片" 在数组顺序变化、被挤到新格子时自动播放
//     平滑的位移动画。
//   - 松手时新的顺序已经在拖拽过程中实时算好了，直接原地定住即可。
//
// 网格本身还是交给浏览器原生的 CSS Grid 自动排布（不用显式指定每一
// 项的行列），跟 paginateGridItems.js/AppSwiper.jsx 用的是同一套
// 排布规则；拖拽时"手指现在悬停在第几行第几列"这一步的换算逻辑在
// gridLayout.js 里，两边保持一致。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { computeGridLayout, findInsertionIndex, pointToCell } from './gridLayout';

const COLUMNS = 2;
const GAP_REM = 1; // 对应 Tailwind 的 gap-4
const ROW_HEIGHT_REM = 7.5; // 跟 AppSwiper.jsx 里的 ROW_HEIGHT_REM 保持一致
const JIGGLE_DEGREES = 1.4;

const COL_SPAN_CLASS = {
  1: 'col-span-1',
  2: 'col-span-2',
};

const remToPx = (rem) => {
  if (typeof window === 'undefined') return rem * 16;
  const rootFontSizePx =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return rem * rootFontSizePx;
};

const sameOrder = (a, b) =>
  a.length === b.length && a.every((item, index) => item.id === b[index].id);

export const EditableAppGrid = ({
  items,
  onReorder,
  onExit,
  onRemoveItem,
  onRequestAddWidget,
}) => {
  const [localItems, setLocalItems] = useState(items);
  const [draggingId, setDraggingId] = useState(null);
  const containerRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 编辑模式期间，如果通过"+"添加或删除了小组件，items 这个 prop
  // 会跟着变，但正常拖拽过程中的实时排序（localItems）不应该被这个
  // 同步打断。这里只在"items 里到底有哪些 id"这件事真正变化时才
  // 去合并——用户手动拖出来的顺序会保留，新增的追加在最后，被删掉的
  // 直接摘掉。纯粹的顺序变化（比如刚拖完一次、父组件把新顺序传回来）
  // 不会触发这里，因为下面的 key 是排过序后比较的，只关心"集合"变了
  // 没有。
  const itemIdsKey = useMemo(
    () => items.map((item) => item.id).sort().join('|'),
    [items]
  );

  useEffect(() => {
    const latestItems = itemsRef.current;

    setLocalItems((current) => {
      const currentIds = new Set(current.map((item) => item.id));
      const nextIds = new Set(latestItems.map((item) => item.id));
      const itemsById = new Map(latestItems.map((item) => [item.id, item]));

      const kept = current
        .filter((item) => nextIds.has(item.id))
        .map((item) => itemsById.get(item.id) || item);

      const added = latestItems.filter((item) => !currentIds.has(item.id));

      return [...kept, ...added];
    });
    // itemIdsKey 变了才需要重新合并，latestItems 通过 ref 拿最新值即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey]);

  // 每张卡片一个固定的抖动延迟，让所有卡片不是同步抖动，看起来更自然
  const jiggleDelays = useMemo(() => {
    const map = new Map();
    items.forEach((item, index) => {
      map.set(item.id, (index % 5) * 0.05);
    });
    return map;
  }, [items]);

  const handleDragStart = useCallback((itemId) => {
    setDraggingId(itemId);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  }, []);

  const handleDrag = useCallback(
    (event, itemId) => {
      const containerNode = containerRef.current;
      if (!containerNode || typeof event.clientX !== 'number') return;

      const containerRect = containerNode.getBoundingClientRect();
      const gapPx = remToPx(GAP_REM);
      const rowHeightPx = remToPx(ROW_HEIGHT_REM);
      const colWidthPx = (containerRect.width - gapPx) / COLUMNS;

      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top;

      const targetCell = pointToCell({
        x,
        y,
        columns: COLUMNS,
        colWidth: colWidthPx,
        rowHeight: rowHeightPx,
        gap: gapPx,
      });

      setLocalItems((current) => {
        const draggedItem = current.find((item) => item.id === itemId);
        if (!draggedItem) return current;

        const withoutDragged = current.filter((item) => item.id !== itemId);
        const layoutWithoutDragged = computeGridLayout(withoutDragged, COLUMNS);
        const insertIndex = findInsertionIndex(
          layoutWithoutDragged,
          targetCell,
          COLUMNS
        );

        const next = [...withoutDragged];
        next.splice(insertIndex, 0, draggedItem);

        return sameOrder(next, current) ? current : next;
      });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setLocalItems((current) => {
      onReorder(current);
      return current;
    });
  }, [onReorder]);

  const handleBackgroundClick = useCallback(
    (event) => {
      if (event.target === containerRef.current) {
        onExit();
      }
    },
    [onExit]
  );

  return (
    <div
      ref={containerRef}
      onClick={handleBackgroundClick}
      className="grid grid-cols-2 gap-4"
      style={{ gridAutoRows: `${ROW_HEIGHT_REM}rem` }}
    >
      {localItems.map((item) => {
        const isDragging = draggingId === item.id;
        const jiggleDelay = jiggleDelays.get(item.id) || 0;

        return (
          <motion.div
            key={item.id}
            layout={!isDragging}
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => handleDragStart(item.id)}
            onDrag={(event) => handleDrag(event, item.id)}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 1.06 }}
            animate={
              isDragging || prefersReducedMotion
                ? { rotate: 0 }
                : { rotate: [-JIGGLE_DEGREES, JIGGLE_DEGREES, -JIGGLE_DEGREES] }
            }
            transition={
              isDragging || prefersReducedMotion
                ? { layout: { duration: 0.2, ease: 'easeOut' }, rotate: { duration: 0.15 } }
                : {
                    layout: { duration: 0.22, ease: 'easeOut' },
                    rotate: {
                      repeat: Infinity,
                      duration: 0.26,
                      ease: 'easeInOut',
                      delay: jiggleDelay,
                    },
                  }
            }
            className={COL_SPAN_CLASS[item.colSpan] || 'col-span-1'}
            style={{
              touchAction: 'none',
              zIndex: isDragging ? 30 : 1,
              boxShadow: isDragging
                ? '0 18px 30px -12px rgba(0, 0, 0, 0.35)'
                : 'none',
              borderRadius: '2rem',
            }}
          >
            <div className="relative h-full">
              {/* 这一层专门吞掉点击，防止编辑模式下点到卡片本体触发跳转；
                  删除角标是它的兄弟节点、不在这层里面，点击不会被一起吞掉 */}
              <div
                onClickCapture={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className="h-full"
              >
                {item.content}
              </div>

              {item.removable && (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveItem?.(item.id);
                  }}
                  aria-label="移除这个小组件"
                  className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md"
                  style={{
                    backgroundColor: 'var(--text-main)',
                    color: 'var(--card-bg, #fff)',
                  }}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* 编辑模式末尾固定的"+"添加小组件入口，不参与拖拽排序 */}
      <button
        type="button"
        onClick={onRequestAddWidget}
        className="col-span-1 flex h-full flex-col items-center justify-center gap-1.5 rounded-[2rem] border border-dashed opacity-60 transition-opacity active:scale-[0.98] hover:opacity-100"
        style={{ borderColor: 'var(--text-muted, var(--card-border))' }}
      >
        <Plus className="h-5 w-5" style={{ color: 'var(--text-main)' }} />
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          添加小组件
        </span>
      </button>
    </div>
  );
};

export default EditableAppGrid;