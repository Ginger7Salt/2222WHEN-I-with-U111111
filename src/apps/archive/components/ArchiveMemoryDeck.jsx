import React, { useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';

import { getArchiveMemoryHighlights } from '../archiveService';

import '../archive.css';
import '../archive-visual.css';

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
  const [isFlipping, setIsFlipping] = useState(false);

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
    if (isFlipping || cards.length <= 1) {
      setActiveIndex((previous) => (
        (previous + 1) % Math.max(cards.length, 1)
      ));

      return;
    }

    setIsFlipping(true);

    setTimeout(() => {
      setActiveIndex((previous) => (
        (previous + 1) % cards.length
      ));

      setIsFlipping(false);
    }, 190);
  };

  return (
    <section className="archive-memory-deck">
      <div className="archive-memory-deck-heading">
        <div>
          <span className="archive-memory-deck-kicker">
            MEMORY FRAGMENTS
          </span>

          <h3>记忆片段</h3>
        </div>

        <div className="archive-memory-deck-counter">
          <span
            className="archive-memory-deck-ring"
            style={{
              background: `
                conic-gradient(
                  var(--archive-ink)
                  ${ringDegrees}deg,
                  var(--archive-divider)
                  0deg
                )
              `
            }}
          />

          <span>
            {String(activeIndex + 1).padStart(2, '0')}
            <i>/</i>
            {String(cards.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="archive-memory-deck-toolbar">
        <span>来自这段关系的真实记录</span>

        <button
          type="button"
          className="archive-memory-deck-shuffle"
          onClick={() => void loadCards()}
          title="换一批记忆"
          aria-label="换一批记忆"
        >
          <Shuffle className="archive-icon archive-icon-shuffle" />
          <span>换一批</span>
        </button>
      </div>

      <div
        className="archive-memory-deck-stack"
        onClick={handleAdvance}
      >
        <div className="archive-memory-deck-shadow archive-memory-deck-shadow-2" />
        <div className="archive-memory-deck-shadow archive-memory-deck-shadow-1" />

        <article
          className={[
            'archive-memory-deck-card',
            isFlipping ? 'is-flipping-out' : ''
          ].join(' ')}
          key={activeCard?.id}
        >
          <div className="archive-memory-deck-card-top">
            <span className="archive-memory-deck-tag">
              {activeCard?.typeLabel}
            </span>

            <span className="archive-memory-deck-card-index">
              {String(activeIndex + 1).padStart(2, '0')}
            </span>
          </div>

          <p className="archive-memory-deck-content">
            {activeCard?.content || activeCard?.title}
          </p>

          <div className="archive-memory-deck-card-bottom">
            {activeCard?.recordedAt ? (
              <span>
                记录于 {formatRecordedDate(activeCard.recordedAt)}
              </span>
            ) : (
              <span>ARCHIVE MEMORY</span>
            )}

            <span className="archive-memory-deck-card-arrow">
              点击翻阅 →
            </span>
          </div>
        </article>
      </div>

      <p className="archive-memory-deck-hint">
        点击卡牌，让这一段记忆退到后面
      </p>
    </section>
  );
};

export default ArchiveMemoryDeck;
