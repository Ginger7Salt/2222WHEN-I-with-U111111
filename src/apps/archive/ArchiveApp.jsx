import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { ArrowLeft, Settings } from 'lucide-react';

import { getChatsArchiveOverview } from './archiveService';
import ArchiveCabinetView from './components/ArchiveCabinetView';
import ArchiveSettingsPanel from './components/ArchiveSettingsPanel';
import './archive.css';

const ArchiveApp = ({ onBackHub }) => {
  const [overview, setOverview] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const trackRef = useRef(null);
  const cardRefs = useRef([]);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await getChatsArchiveOverview();
      setOverview(result);
    } catch (error) {
      console.error('[Archive] 读取存档室概览失败：', error);
      setOverview([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const selectedOverview = useMemo(
    () => overview.find((item) => item.chatId === selectedChatId) || null,
    [overview, selectedChatId]
  );

  const scrollToIndex = (index) => {
    const card = cardRefs.current[index];

    if (card) {
      card.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  };

  const handleTrackScroll = () => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const trackCenter = track.scrollLeft + track.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    cardRefs.current.forEach((card, index) => {
      if (!card) {
        return;
      }

      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - trackCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  if (selectedChatId && selectedOverview) {
    return (
      <ArchiveCabinetView
        chatOverview={selectedOverview}
        onBack={() => setSelectedChatId(null)}
        onStatsChanged={loadOverview}
      />
    );
  }

  return (
    <div className="archive-app">
      <div className="archive-hud">
        <button
          type="button"
          className="archive-hud-back"
          onClick={onBackHub}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回主页
        </button>

        <span className="archive-hud-title">存档室</span>

        <button
          type="button"
          className="archive-hud-settings-btn"
          onClick={() => setShowSettings(true)}
          title="自动归档设置"
          aria-label="自动归档设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {showSettings && (
        <ArchiveSettingsPanel onClose={() => setShowSettings(false)} />
      )}

      <div className="archive-carousel-wrap">
        {isLoading && (
          <div className="archive-carousel-empty">
            正在打开存档室的门。
          </div>
        )}

        {!isLoading && overview.length === 0 && (
          <div className="archive-carousel-empty">
            还没有可以整理的聊天记录。
          </div>
        )}

        {!isLoading && overview.length > 0 && (
          <>
            <div
              className="archive-carousel-track"
              ref={trackRef}
              onScroll={handleTrackScroll}
            >
              {overview.map((item, index) => (
                <article
                  key={item.chatId}
                  ref={(node) => { cardRefs.current[index] = node; }}
                  className={[
                    'archive-card',
                    index === activeIndex ? 'is-active' : ''
                  ].join(' ')}
                  onClick={() => {
                    if (index !== activeIndex) {
                      setActiveIndex(index);
                      scrollToIndex(index);
                      return;
                    }

                    setSelectedChatId(item.chatId);
                  }}
                >
                  <div
                    className="archive-card-art"
                    style={
                      item.bgImage || item.characterAvatar
                        ? {
                            backgroundImage: `url(${item.bgImage || item.characterAvatar})`
                          }
                        : undefined
                    }
                  >
                    {!item.bgImage && !item.characterAvatar && (
                      <span className="archive-card-art-fallback">
                        {(item.characterName || '?').slice(0, 1)}
                      </span>
                    )}

                    <span className="archive-card-disc" />
                  </div>

                  <div className="archive-card-body">
                    <div>
                      <div className="archive-card-name">
                        {item.characterName}
                      </div>
                      <div className="archive-card-sub">
                        WITH {item.userName}
                      </div>
                    </div>

                    <div className="archive-card-stats">
                      <div className="archive-card-stat">
                        <span className="archive-card-stat-num">
                          {item.chattedDays}
                        </span>
                        <span className="archive-card-stat-label">
                          已聊天(天)
                        </span>
                      </div>

                      <div className="archive-card-stat">
                        <span className="archive-card-stat-num">
                          {item.totalMessages}
                        </span>
                        <span className="archive-card-stat-label">
                          总消息
                        </span>
                      </div>

                      <div className="archive-card-stat">
                        <span className="archive-card-stat-num">
                          {item.totalArchivedDays}
                        </span>
                        <span className="archive-card-stat-label">
                          已归档(天)
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="archive-carousel-dots">
              {overview.map((item, index) => (
                <button
                  type="button"
                  key={item.chatId}
                  className={[
                    'archive-carousel-dot',
                    index === activeIndex ? 'is-active' : ''
                  ].join(' ')}
                  onClick={() => {
                    setActiveIndex(index);
                    scrollToIndex(index);
                  }}
                  aria-label={`查看${item.characterName}`}
                />
              ))}
            </div>

            <p className="archive-carousel-hint">
              左右滑动选择消息框，点击进入档案柜
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ArchiveApp;