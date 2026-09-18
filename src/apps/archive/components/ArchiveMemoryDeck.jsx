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

/*
 * 存档室主界面中间的"记忆卡牌"，填补选中唱片下面原本空荡荡的区域，
 * 同时增加一点可以点着玩的互动性。内容来自这个聊天已有的记忆
 * （memories 表），不是编出来的占位文案；一条记忆都没有时整块不渲染。
 */
const ArchiveMemoryDeck = ({ chatId }) => {
  const [cards, setCards] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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

  const activeCard = cards[activeIndex] || null;

  const ringDegrees = useMemo(() => (
    cards.length > 0
      ? Math.round(((activeIndex + 1) / cards.length) * 360)
      : 0
  ), [activeIndex, cards.length]);

  if (isLoading || cards.length === 0) {
    return null;
  }

  const handleAdvance = () => {
    setActiveIndex((previous) => (previous + 1) % cards.length);
  };

  return (
    <div className="archive-memory-deck">
      <div className="archive-memory-deck-hud">
        <div className="archive-memory-deck-counter">
          <span
            className="archive-memory-deck-ring"
            style={{
              background: `conic-gradient(var(--accent-color) ${ringDegrees}deg, var(--divider) 0deg)`
            }}
          />
          <span>
            {activeIndex + 1} / {cards.length}
          </span>
        </div>

        <button
          type="button"
          className="archive-memory-deck-shuffle"
          onClick={() => void loadCards()}
          title="换一批记忆"
          aria-label="换一批记忆"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="archive-memory-deck-stack"
        onClick={handleAdvance}
      >
        <div className="archive-memory-deck-shadow archive-memory-deck-shadow-2" />
        <div className="archive-memory-deck-shadow archive-memory-deck-shadow-1" />

        <div className="archive-memory-deck-card" key={activeCard?.id}>
          <span className="archive-memory-deck-tag">
            {activeCard?.typeLabel}
          </span>

          <p className="archive-memory-deck-content">
            {activeCard?.content || activeCard?.title}
          </p>

          {activeCard?.recordedAt && (
            <span className="archive-memory-deck-date">
              记录于 {formatRecordedDate(activeCard.recordedAt)}
            </span>
          )}
        </div>
      </div>

      <p className="archive-memory-deck-hint">点击卡片翻看下一条</p>
    </div>
  );
};

export default ArchiveMemoryDeck;