import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { ArrowLeft, Pencil, Settings } from 'lucide-react';

import {
  getArchiveNarrativeLine,
  getChatsArchiveOverview,
  setChatDiscImage
} from './archiveService';
import ArchiveCabinetView from './components/ArchiveCabinetView';
import ArchiveMemoryDeck from './components/ArchiveMemoryDeck';
import ArchiveSettingsPanel from './components/ArchiveSettingsPanel';
import './archive.css';

const ArchiveApp = ({ onBackHub }) => {
  const [overview, setOverview] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [enteredChatId, setEnteredChatId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const trackRef = useRef(null);
  const discRefs = useRef([]);
  const discImageInputRef = useRef(null);

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

  const activeItem = overview[activeIndex] || null;

  const enteredOverview = useMemo(
    () => overview.find((item) => item.chatId === enteredChatId) || null,
    [overview, enteredChatId]
  );

  const scrollToIndex = (index) => {
    const disc = discRefs.current[index];

    if (disc) {
      disc.scrollIntoView({
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

    discRefs.current.forEach((disc, index) => {
      if (!disc) {
        return;
      }

      const discCenter = disc.offsetLeft + disc.offsetWidth / 2;
      const distance = Math.abs(discCenter - trackCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  const handlePickDiscImage = () => {
    discImageInputRef.current?.click();
  };

  const handleDiscImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !activeItem) {
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await setChatDiscImage(activeItem.chatId, dataUrl);
    await loadOverview();
  };

  if (enteredChatId && enteredOverview) {
    return (
      <ArchiveCabinetView
        chatOverview={enteredOverview}
        onBack={() => setEnteredChatId(null)}
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

      <div className="archive-page-title">
        <h1>存档室</h1>
        <p>封存的时光，静静存放在这里</p>
      </div>

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
          <div className="archive-carousel-scroll">
            {activeItem && (
              <h2 className="archive-section-heading">
                {activeItem.characterName}
              </h2>
            )}

            <div
              className="archive-disc-track"
              ref={trackRef}
              onScroll={handleTrackScroll}
            >
              {overview.map((item, index) => {
                const coverImage = item.discImage || item.characterAvatar || item.bgImage;
                const isActive = index === activeIndex;

                return (
                  <div
                    key={item.chatId}
                    ref={(node) => { discRefs.current[index] = node; }}
                    className={[
                      'archive-disc-case',
                      isActive ? 'is-active' : ''
                    ].join(' ')}
                    onClick={() => {
                      setActiveIndex(index);
                      scrollToIndex(index);
                    }}
                  >
                    <span className="archive-disc-case-label">
                      {item.characterName}
                    </span>

                    <div
                      className="archive-disc"
                      style={
                        coverImage
                          ? { backgroundImage: `url(${coverImage})` }
                          : undefined
                      }
                    >
                      {!coverImage && (
                        <span className="archive-disc-fallback">
                          {(item.characterName || '?').slice(0, 1)}
                        </span>
                      )}
                    </div>

                    <span className="archive-disc-case-meta">
                      与 {item.userName} · {item.totalMessages} 条
                    </span>

                    {isActive && (
                      <button
                        type="button"
                        className="archive-disc-edit-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePickDiscImage();
                        }}
                        title="更换唱片封面"
                        aria-label="更换唱片封面"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <input
              type="file"
              accept="image/*"
              ref={discImageInputRef}
              style={{ display: 'none' }}
              onChange={handleDiscImageChange}
            />

            {activeItem && (
              <ArchiveMemoryDeck chatId={activeItem.chatId} />
            )}

            {activeItem && (
              <div className="archive-summary-row">
                <div className="archive-summary-narrative">
                  {getArchiveNarrativeLine({
                    chattedDays: activeItem.chattedDays,
                    totalArchivedDays: activeItem.totalArchivedDays,
                    characterName: activeItem.characterName
                  })}
                </div>

                <button
                  type="button"
                  className="archive-detail-enter-btn"
                  onClick={() => setEnteredChatId(activeItem.chatId)}
                >
                  进入档案柜
                </button>
              </div>
            )}

            <p className="archive-carousel-hint">
              左右滑动挑一张唱片，点击查看这段关系的记忆片段
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveApp;