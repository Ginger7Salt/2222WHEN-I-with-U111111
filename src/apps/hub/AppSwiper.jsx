// src/apps/hub/AppSwiper.jsx
//
// 首页「各种 app」区域的滑块：把 appGridItems 里大小不一的拼图块分页拼进
// 固定尺寸的网格画布，横向 scroll-snap 分页展示，可以左右滑动查看，底部
// 用小圆点显示当前在第几页。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildPages } from './paginateGridItems';
import { useLongPress } from './useLongPress';

const COLUMNS = 2;
const ROWS_PER_PAGE = 4;
// 每一行的固定高度：方形小卡和横幅大卡都用 h-full 撑满这一行，
// 保证不管当页拼的是什么卡片，整页的高度都完全一致。
const ROW_HEIGHT_REM = 7.5;

const COL_SPAN_CLASS = {
  1: 'col-span-1',
  2: 'col-span-2',
};

export const AppSwiper = ({ items, onLongPressApp }) => {
  const scrollerRef = useRef(null);
  const [activePage, setActivePage] = useState(0);
  const isProgrammaticScroll = useRef(false);

  // 长按任意一张卡片超过阈值，进入首页应用区的拖动排序编辑模式。
  // 只在这里调用一次，同一组事件处理函数绑定到每一张卡片上（详见
  // useLongPress.js 里的说明）。
  const longPress = useLongPress(() => {
    if (onLongPressApp) onLongPressApp();
  });

  const pages = useMemo(
    () =>
      buildPages(items, {
        columns: COLUMNS,
        rowsPerPage: ROWS_PER_PAGE,
      }),
    [items]
  );

  useEffect(() => {
    // 应用列表变化（比如切换语言展示模式）时，页数可能变化，
    // 保证当前页索引仍然落在有效范围内。
    setActivePage((previous) =>
      Math.min(previous, Math.max(pages.length - 1, 0))
    );
  }, [pages.length]);

  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;

    const node = scrollerRef.current;
    if (!node || node.clientWidth === 0) return;

    const index = Math.round(node.scrollLeft / node.clientWidth);
    setActivePage((previous) => (previous === index ? previous : index));
  };

  const goToPage = (index) => {
    const node = scrollerRef.current;
    if (!node) return;

    isProgrammaticScroll.current = true;
    node.scrollTo({ left: index * node.clientWidth, behavior: 'smooth' });
    setActivePage(index);

    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 400);
  };

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{
          scrollbarWidth: 'none',
        }}
      >
        {pages.map((pageItems, pageIndex) => (
          <div
            key={pageIndex}
            className="grid w-full shrink-0 snap-start grid-cols-2 gap-4"
            style={{
              gridTemplateRows: `repeat(${ROWS_PER_PAGE}, ${ROW_HEIGHT_REM}rem)`,
            }}
          >
            {pageItems.map((item) => (
              <div
                key={item.id}
                className={COL_SPAN_CLASS[item.colSpan] || 'col-span-1'}
                {...(onLongPressApp ? longPress : null)}
              >
                {item.content}
              </div>
            ))}
          </div>
        ))}
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {pages.map((_, pageIndex) => (
            <button
              key={pageIndex}
              type="button"
              aria-label={`第 ${pageIndex + 1} 页`}
              onClick={() => goToPage(pageIndex)}
              className="rounded-full transition-all duration-200"
              style={{
                width: pageIndex === activePage ? '1.1rem' : '0.4rem',
                height: '0.4rem',
                backgroundColor:
                  pageIndex === activePage
                    ? 'var(--text-main)'
                    : 'var(--card-border)',
                opacity: pageIndex === activePage ? 0.7 : 0.5,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AppSwiper;