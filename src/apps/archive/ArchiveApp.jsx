import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { ArrowLeft, Camera, Settings, Sparkles } from 'lucide-react';

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
      {/* 顶部黑白弥散流光 */}
      <div className="archive-diffused-light" aria-hidden="true" />

      {/* 顶部 HUD 导航栏 */}
      <header className="archive-hud">
        <button
          type="button"
          className="archive-hud-back"
          onClick={onBackHub}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回</span>
        </button>

        <div className="archive-hud-tag">
          <Sparkles className="h-3 w-3" />
          <span>TIME CAPSULE</span>
        </div>

        <button
          type="button"
          className="archive-hud-settings-btn"
          onClick={() => setShowSettings(true)}
          title="自动归档设置"
          aria-label="自动归档设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      {showSettings && (
        <ArchiveSettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* 紧凑精致的标题区 */}
      <div className="archive-page-title">
        <h1>存档室</h1>
        <p>封存的时光 · 静静存放在这里</p>
      </div>

      <main className="archive-carousel-wrap">
        {isLoading && (
          <div className="archive-carousel-empty">
            <div className="archive-loading-disc" />
            <p>正在打开唱片柜...</p>
          </div>
        )}

        {!isLoading && overview.length === 0 && (
          <div className="archive-carousel-empty">
            还没有可以整理的聊天记录。
          </div>
        )}

        {!isLoading && overview.length > 0 && (
          <div className="archive-carousel-scroll">
            {/* 唱片展示滚动轨 */}
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
                    {/* ===== P2 参考图同款：实体亚克力 CD 包装盒结构 ===== */}
                    <div className="jewel-case-spine">
                      <span className="spine-text">THE ARCHIVE MINI ALBUM</span>
                      <span className="spine-title">{item.characterName}</span>
                    </div>

                    <div className="jewel-case-tray">
                      {/* CD 光盘主体 */}
                      <div
                        className="archive-disc"
                        style={
                          coverImage
                            ? { '--custom-cover': `url(${coverImage})` }
                            : undefined
                        }
                      >
                        {/* 自定义封面沉浸底图 */}
                        {coverImage && (
                          <div
                            className="disc-artwork-layer"
                            style={{ backgroundImage: `url(${coverImage})` }}
                          />
                        )}

                        {/* 盘面印刷排版（还原 P2 现代粗体与同心微缩文字） */}
                        <div className="disc-typography-layer">
                          <div className="disc-curved-title">
                            {item.characterName}
                          </div>
                          <div className="disc-center-meta">
                            <span>LP-ROM 48kHz / 24-BIT</span>
                            <span className="disc-dot-matrix">···· ··· ·· ·</span>
                          </div>
                        </div>

                        {/* CD 中心透明卡圈与金属主轴孔 */}
                        <div className="disc-spindle-hole">
                          <div className="disc-spindle-inner" />
                        </div>

                        {/* CD 环形反光与同心细纹 */}
                        <div className="disc-grooves" />
                        <div className="disc-specular-light" />
                      </div>
                    </div>

                    {/* 右侧 OBI 纸质侧封（仿 P2 右侧信息贴纸） */}
                    <div className="jewel-case-obi">
                      <div className="obi-header">
                        <span className="obi-badge">RECORD</span>
                        <span className="obi-code">CMCC-01</span>
                      </div>
                      <div className="obi-body">
                        <div className="obi-name">{item.characterName}</div>
                        <div className="obi-meta">
                          共 {item.totalMessages} 条回忆对话
                        </div>
                      </div>
                      <div className="obi-barcode" />
                    </div>

                    {/* 更换光盘封套按钮 */}
                    {isActive && (
                      <button
                        type="button"
                        className="archive-disc-edit-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePickDiscImage();
                        }}
                        title="自定义唱片封面"
                        aria-label="自定义唱片封面"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>换盘面</span>
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

            {/* 记忆卡片区域（配合 CSS 做成背单词卡片滑动质感） */}
            {activeItem && (
              <div className="archive-deck-wrapper">
                <ArchiveMemoryDeck chatId={activeItem.chatId} />
              </div>
            )}

            {/* 瘦身后紧凑现代的底部卡片信息栏 */}
            {activeItem && (
              <div className="archive-summary-row">
                <div className="archive-summary-narrative">
                  <div className="archive-summary-dot" />
                  <p>
                    {getArchiveNarrativeLine({
                      chattedDays: activeItem.chattedDays,
                      totalArchivedDays: activeItem.totalArchivedDays,
                      characterName: activeItem.characterName
                    })}
                  </p>
                </div>

                <button
                  type="button"
                  className="archive-detail-enter-btn"
                  onClick={() => setEnteredChatId(activeItem.chatId)}
                >
                  打开档案
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ArchiveApp;