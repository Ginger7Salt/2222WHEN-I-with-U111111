import React, { useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';

import { getArchiveMemoryHighlights } from '../archiveService';
import '../archive.css';

const formatRecordedDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  });
};

const ArchiveMemoryDeck = ({ chatId }) => {
  const [cards, setCards] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);

  const loadCards = async () => {
    setIsLoading(true);

    try {
      const result = await getArchiveMemoryHighlights(chatId, 6);
      setCards(result);
      setActiveIndex(0);
    } catch (error) {
      console.error('[Archive] 读取记忆卡牌失败：', error);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (chatId) {
      void loadCards();
    } else {
      setCards([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // 当前卡牌与下一张待翻出的卡牌
  const activeCard = cards[activeIndex] || null;
  const nextIndex = cards.length > 0 ? (activeIndex + 1) % cards.length : 0;
  const nextCard = cards[nextIndex] || null;

  const ringDegrees = useMemo(() => (
    cards.length > 0
      ? Math.round(((activeIndex + 1) / cards.length) * 360)
      : 0
  ), [activeIndex, cards.length]);

  if (isLoading || cards.length === 0) {
    return null;
  }

  const handleAdvance = () => {
    if (isSwiping || cards.length <= 1) {
      if (cards.length > 1) {
        setActiveIndex((previous) => (previous + 1) % cards.length);
      }
      return;
    }

    // 触发手滑翻牌物理动画：顶层卡片飞甩，底层卡片浮起
    setIsSwiping(true);

    // 400ms 是经过动效调教后的黄金抛卡时间
    setTimeout(() => {
      setActiveIndex((previous) => (previous + 1) % cards.length);
      setIsSwiping(false);
    }, 380);
  };

  return (
    <div className="archive-memory-deck">
      {/* 顶部指示条：极简弥散黑白 HUD */}
      <div className="archive-memory-deck-hud">
        <div className="archive-memory-deck-counter">
          <span
            className="archive-memory-deck-ring"
            style={{
              background: `conic-gradient(#ffffff ${ringDegrees}deg, rgba(255, 255, 255, 0.12) 0deg)`
            }}
          />
          <span className="deck-counter-text">
            {activeIndex + 1} <span className="deck-counter-divider">/</span> {cards.length}
          </span>
        </div>

        <button
          type="button"
          className="archive-memory-deck-shuffle"
          onClick={(e) => {
            e.stopPropagation();
            void loadCards();
          }}
          title="换一批记忆"
          aria-label="换一批记忆"
        >
          <Shuffle className="h-3 w-3" />
        </button>
      </div>

      {/* 3D 实体手感卡牌堆栈 */}
      <div
        className="archive-memory-deck-stage"
        onClick={handleAdvance}
        role="button"
        tabIndex={0}
      >
        {/* 第 3 层：最底部的卡片阴影虚边 */}
        <div className="deck-card-layer deck-card-bottom" />

        {/* 第 2 层：下一张卡片（随着前一张甩走，它将无缝放大浮起到顶层） */}
        {cards.length > 1 && nextCard && (
          <div
            className={[
              'deck-card-layer deck-card-next',
              isSwiping ? 'is-promoting' : ''
            ].join(' ')}
          >
            <div className="deck-card-inner">
              <span className="archive-memory-deck-tag">
                {nextCard.typeLabel || '记忆'}
              </span>
              <p className="archive-memory-deck-content">
                {nextCard.content || nextCard.title}
              </p>
              {nextCard.recordedAt && (
                <span className="archive-memory-deck-date">
                  {formatRecordedDate(nextCard.recordedAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 第 1 层：当前卡片（点击时呈现向左翻飞划走的物理甩出动画） */}
        {activeCard && (
          <div
            className={[
              'deck-card-layer deck-card-active',
              isSwiping ? 'is-swiping-away' : ''
            ].join(' ')}
          >
            <div className="deck-card-inner">
              <div className="deck-card-header">
                <span className="archive-memory-deck-tag">
                  {activeCard.typeLabel || '记忆'}
                </span>
                <span className="deck-card-glint" />
              </div>

              <p className="archive-memory-deck-content">
                {activeCard.content || activeCard.title}
              </p>

              {activeCard.recordedAt && (
                <span className="archive-memory-deck-date">
                  记录于 {formatRecordedDate(activeCard.recordedAt)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="archive-memory-deck-hint">轻触卡片 · 翻看下一张片段</p>
    </div>
  );
};

export default ArchiveMemoryDeck;