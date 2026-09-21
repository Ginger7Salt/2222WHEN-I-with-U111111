import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  getOutfit,
  getTodayDateStr,
  summarizeParts,
} from '../../../services/outfitService';

// 完整页面只在用户点开时才加载，不增加 Rhythm 自身的体积和内存。
const OutfitPage = lazy(() => import('./OutfitPage'));

/**
 * Rhythm 里的"今日穿搭"入口。
 * 样式沿用"今日安排"卡片的纸质感；完整页面通过 portal 渲染在 body 上，
 * 避开 .rhythm-shell 对字号和字体的强制规则。
 */
export default function OutfitEntryCard({ chatId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);

  const loadToday = useCallback(async () => {
    if (!chatId) {
      setTodayRecord(null);
      return;
    }

    const record = await getOutfit(chatId, getTodayDateStr(), 'user');

    setTodayRecord(record);
  }, [chatId]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    void loadToday();
  }, [loadToday]);

  if (!chatId) {
    return null;
  }

  const summary = todayRecord
    ? summarizeParts(todayRecord.parts) || todayRecord.note || ''
    : '';

  return (
    <>
      <style>{`
        .outfit-entry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 14px 16px;
          text-align: left;
          color: var(--text-main);
          background: var(--control-soft-bg);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          animation: rhythm-rise .5s var(--rhythm-spring) both;
          transition: transform .25s var(--rhythm-spring);
        }

        .outfit-entry:active {
          transform: scale(.985);
        }

        .outfit-entry__text {
          min-width: 0;
          flex: 1;
        }

        .outfit-entry__eyebrow {
          display: block;
          margin-bottom: 2px;
          font-size: 11px;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: var(--text-sub);
        }

        .outfit-entry__title {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main);
        }

        .outfit-entry__summary {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          font-size: 11.5px;
          color: var(--text-sub);
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .outfit-entry__chevron {
          flex: none;
          color: var(--text-sub);
        }

        @media (prefers-reduced-motion: reduce) {
          .outfit-entry {
            animation: none;
            transition: none;
          }
        }
      `}</style>

      <button
        type="button"
        className="outfit-entry mb-5"
        onClick={() => setIsOpen(true)}
      >
        <span className="outfit-entry__text">
          <span className="outfit-entry__eyebrow font-mono">Wardrobe</span>
          <span className="outfit-entry__title font-serif">今日穿搭</span>
          <span className="outfit-entry__summary">
            {summary || '记录今天穿了什么'}
          </span>
        </span>

        <ChevronRight
          className="outfit-entry__chevron h-4 w-4"
          strokeWidth={1.7}
        />
      </button>

      {isOpen && (
        <Suspense fallback={null}>
          <OutfitPage chatId={chatId} onClose={handleClose} />
        </Suspense>
      )}
    </>
  );
}