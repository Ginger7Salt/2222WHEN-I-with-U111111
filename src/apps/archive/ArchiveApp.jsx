import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Settings
} from 'lucide-react';

import {
  getArchiveNarrativeLine,
  getChatsArchiveOverview,
  setChatDiscImage
} from './archiveService';

import ArchiveCabinetView from './components/ArchiveCabinetView';
import ArchiveMemoryDeck from './components/ArchiveMemoryDeck';
import ArchiveSettingsPanel from './components/ArchiveSettingsPanel';

import './archive.css';
import './archive-visual.css';

const getMonogram = (name = '?') => {
  const text = String(name).trim();

  if (!text) {
    return '?';
  }

  if (/^[a-zA-Z\s]+$/.test(text)) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  return text.slice(0, 2);
};

const getArchiveIndex = (index) => (
  String(index + 1).padStart(2, '0')
);

const getNumericValue = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

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
    const safeIndex = Math.max(0, Math.min(index, overview.length - 1));
    const disc = discRefs.current[safeIndex];

    setActiveIndex(safeIndex);

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

  const handlePrevious = () => {
    if (overview.length <= 1) {
      return;
    }

    const nextIndex = (
      activeIndex - 1 + overview.length
    ) % overview.length;

    scrollToIndex(nextIndex);
  };

  const handleNext = () => {
    if (overview.length <= 1) {
      return;
    }

    const nextIndex = (activeIndex + 1) % overview.length;

    scrollToIndex(nextIndex);
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

  const archiveNumber = String(Math.max(overview.length, 0)).padStart(2, '0');

  return (
    <main className="archive-app">
      <div className="archive-ambient archive-ambient-one" />
      <div className="archive-ambient archive-ambient-two" />
      <div className="archive-ambient archive-ambient-three" />

      <div className="archive-inner">
        <header className="archive-hud">
          <button
            type="button"
            className="archive-hud-back"
            onClick={onBackHub}
          >
            <ArrowLeft className="archive-icon archive-icon-small" />
            <span>返回主页</span>
          </button>

          <div className="archive-hud-status">
            <span className="archive-hud-status-dot" />
            <span>PRIVATE ARCHIVE</span>
          </div>

          <button
            type="button"
            className="archive-hud-settings-btn"
            onClick={() => setShowSettings(true)}
            title="自动归档设置"
            aria-label="自动归档设置"
          >
            <Settings className="archive-icon archive-icon-setting" />
          </button>
        </header>

        {showSettings && (
          <ArchiveSettingsPanel onClose={() => setShowSettings(false)} />
        )}

        <section className="archive-page-title">
          <div className="archive-title-eyebrow">
            PERSONAL ARCHIVE / {archiveNumber}
          </div>

          <div className="archive-title-layout">
            <div>
              <h1>存档室</h1>
              <p>封存的时光，静静存放在这里</p>
            </div>

            <div className="archive-title-index">
              <span>ARCHIVE</span>
              <strong>{archiveNumber}</strong>
            </div>
          </div>
        </section>

        <section className="archive-carousel-wrap">
          {isLoading && (
            <div className="archive-carousel-empty">
              <span className="archive-loading-orbit" />
              <span>正在打开存档室的门。</span>
            </div>
          )}

          {!isLoading && overview.length === 0 && (
            <div className="archive-carousel-empty">
              <span className="archive-empty-mark">—</span>
              <span>还没有可以整理的聊天记录。</span>
            </div>
          )}

          {!isLoading && overview.length > 0 && (
            <div className="archive-carousel-scroll">
              <div className="archive-section-heading-row">
                <div>
                  <span className="archive-section-kicker">
                    SELECTED RELATIONSHIP
                  </span>

                  {activeItem && (
                    <h2 className="archive-section-heading">
                      {activeItem.characterName}
                    </h2>
                  )}
                </div>

                <div className="archive-section-count">
                  <strong>{getArchiveIndex(activeIndex)}</strong>
                  <span>/ {String(overview.length).padStart(2, '0')}</span>
                </div>
              </div>

              <div className="archive-carousel-stage">
                <button
                  type="button"
                  className="archive-carousel-control archive-carousel-control-prev"
                  onClick={handlePrevious}
                  disabled={overview.length <= 1}
                  aria-label="上一张唱片"
                >
                  <ChevronLeft className="archive-icon archive-icon-control" />
                </button>

                <div
                  className="archive-disc-track"
                  ref={trackRef}
                  onScroll={handleTrackScroll}
                >
                  {overview.map((item, index) => {
                    const coverImage = (
                      item.discImage ||
                      item.characterAvatar ||
                      item.bgImage
                    );

                    const isActive = index === activeIndex;
                    const totalMessages = getNumericValue(
                      item.totalMessages
                    );

                    const totalDays = getNumericValue(
                      item.totalArchivedDays ?? item.chattedDays
                    );

                    return (
                      <article
                        key={item.chatId}
                        ref={(node) => {
                          discRefs.current[index] = node;
                        }}
                        className={[
                          'archive-disc-case',
                          isActive ? 'is-active' : ''
                        ].join(' ')}
                        onClick={() => {
                          setActiveIndex(index);
                          scrollToIndex(index);
                        }}
                      >
                        <div className="archive-album-case">
                          <div className="archive-album-sheen" />

                          <div className="archive-album-spine">
                            <span>
                              ARCHIVE {getArchiveIndex(index)}
                            </span>
                          </div>

                          <div className="archive-album-paper">
                            <strong>
                              {getMonogram(item.characterName)}
                            </strong>

                            <small>RELATIONSHIP RECORD</small>

                            <div className="archive-album-paper-line" />

                            <div className="archive-album-paper-list">
                              <span>
                                {String(totalMessages).padStart(3, '0')} MESSAGES
                              </span>

                              <span>
                                {String(totalDays).padStart(2, '0')} DAYS
                              </span>

                              <span>
                                PRIVATE SESSION
                              </span>

                              <span>
                                ARCHIVE / {getArchiveIndex(index)}
                              </span>
                            </div>

                            <div className="archive-album-paper-barcode" />
                          </div>

                          <div
                            className={[
                              'archive-disc',
                              coverImage ? 'has-cover' : ''
                            ].join(' ')}
                            style={
                              coverImage
                                ? {
                                    backgroundImage: `url("${coverImage}")`
                                  }
                                : undefined
                            }
                          >
                            {!coverImage && (
                              <span className="archive-disc-fallback">
                                {getMonogram(item.characterName)}
                              </span>
                            )}

                            <div className="archive-disc-label">
                              <strong>
                                {getMonogram(item.characterName)}
                              </strong>

                              <span>
                                ARCHIVE {getArchiveIndex(index)}
                              </span>
                            </div>

                            <div className="archive-disc-caption">
                              <strong>
                                {item.characterName}
                              </strong>

                              <span>
                                {totalMessages} MESSAGES · {totalDays} DAYS
                              </span>
                            </div>
                          </div>

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
                              <Pencil className="archive-icon archive-icon-edit" />
                            </button>
                          )}
                        </div>

                        <div className="archive-disc-case-meta">
                          <span>
                            与 {item.userName}
                          </span>

                          <i />

                          <span>
                            {totalMessages} 条消息
                          </span>

                          <i />

                          <span>
                            记录 {totalDays} 天
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="archive-carousel-control archive-carousel-control-next"
                  onClick={handleNext}
                  disabled={overview.length <= 1}
                  aria-label="下一张唱片"
                >
                  <ChevronRight className="archive-icon archive-icon-control" />
                </button>
              </div>

              <input
                type="file"
                accept="image/*"
                ref={discImageInputRef}
                className="archive-hidden-input"
                onChange={handleDiscImageChange}
              />

              <div className="archive-carousel-tools">
                <div className="archive-carousel-dots">
                  {overview.map((item, index) => (
                    <button
                      key={item.chatId}
                      type="button"
                      className={[
                        'archive-carousel-dot',
                        index === activeIndex ? 'is-active' : ''
                      ].join(' ')}
                      onClick={() => scrollToIndex(index)}
                      aria-label={`查看第 ${index + 1} 张唱片`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="archive-cover-upload"
                  onClick={handlePickDiscImage}
                >
                  <Pencil className="archive-icon archive-icon-upload" />
                  <span>更换当前唱片封面</span>
                </button>
              </div>

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
                    <span>进入档案柜</span>
                    <span className="archive-enter-arrow">↗</span>
                  </button>
                </div>
              )}

              <p className="archive-carousel-hint">
                左右滑动挑一张唱片，点击查看这段关系的记忆片段
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default ArchiveApp;
