import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Compass,
  Crosshair,
  Edit3,
  MapPin,
  Navigation,
  Trash2,
  X,
} from 'lucide-react';

import {
  deletePlace,
  listPlaces,
  renamePlace,
  updatePlaceNote,
} from './placeService';

const MAP_IMAGE_URL = 'https://u2.fukit.cn/yYmWOHrYc';

const hashString = (value) => {
  let hash = 0;
  String(value || '').split('').forEach((char) => {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  });
  return Math.abs(hash);
};

// 坐标映射：在 1000 x 620 的地图安全区域内映射点位
const getMapPoint = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(place?.longitude ?? place?.lng ?? place?.lon);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      x: 100 + ((longitude + 180) / 360) * 800,
      y: 70 + ((90 - latitude) / 180) * 480,
    };
  }

  const seed = hashString(place?.id || place?.name || index);
  return {
    x: 130 + ((seed * 47 + index * 137) % 740),
    y: 90 + ((seed * 29 + index * 89) % 430),
  };
};

// 格式化经纬度坐标文字（用于坐标美化展示）
const formatCoordinates = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(place?.longitude ?? place?.lng ?? place?.lon);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lonDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(2)}° ${latDir}, ${Math.abs(longitude).toFixed(2)}° ${lonDir}`;
  }

  const seed = hashString(place?.id || place?.name || index);
  const pseudoLat = (22 + (seed % 300) / 10).toFixed(2);
  const pseudoLon = (105 + ((seed * 7) % 240) / 10).toFixed(2);
  return `${pseudoLat}° N, ${pseudoLon}° E`;
};

const formatDate = (value) => {
  if (!value) return '未知日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知日期';
  return date.toLocaleDateString('zh-CN');
};

const PlaceBooklet = ({ chatId, character, onBack }) => {
  const [places, setPlaces] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const reload = async () => {
    try {
      const list = await listPlaces(chatId);
      setPlaces(list);
      setActiveIndex((previous) =>
        Math.min(previous, Math.max(list.length - 1, 0)),
      );
    } catch (error) {
      console.warn('[Location] Failed to load places:', error);
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const activePlace = places[activeIndex];

  useEffect(() => {
    if (!activePlace) {
      setDraftName('');
      setDraftNote('');
      setIsEditing(false);
      return;
    }
    setDraftName(activePlace.name || '');
    setDraftNote(activePlace.note || '');
    setIsEditing(false);
  }, [activePlace?.id]);

  const selectPlace = (index) => {
    const place = places[index];
    if (!place) return;
    setActiveIndex(index);
    setDraftName(place.name || '');
    setDraftNote(place.note || '');
  };

  const handleStartEditing = () => {
    if (!activePlace) return;
    setDraftName(activePlace.name || '');
    setDraftNote(activePlace.note || '');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (!activePlace) return;
    setDraftName(activePlace.name || '');
    setDraftNote(activePlace.note || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!activePlace || isSaving) return;
    const trimmedName = String(draftName || '').trim();
    if (!trimmedName) return;

    setIsSaving(true);
    try {
      await renamePlace(activePlace.id, trimmedName);
      await updatePlaceNote(activePlace.id, draftNote);
      await reload();
      setIsEditing(false);
    } catch (error) {
      console.warn('[Location] Failed to save place:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (placeId) => {
    try {
      await deletePlace(chatId, placeId);
      setIsEditing(false);
      await reload();
    } catch (error) {
      console.warn('[Location] Failed to delete place:', error);
    }
  };

  const mapPlaces = places.map((place, index) => ({
    place,
    index,
    point: getMapPoint(place, index),
    coordsText: formatCoordinates(place, index),
  }));

  const activeMapItem = mapPlaces[activeIndex] || mapPlaces[0];

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

  const canSave = Boolean(String(draftName || '').trim()) && !isSaving;

  return (
    <div className="place-booklet-root fixed inset-0 z-[999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#fbfbf8] text-[#11110f] select-none">
      <style>{`
        /* 根部样式保证绝对填满全屏 */
        .place-booklet-root {
          --place-ink: #11110f;
          --place-black: #0c0c0b;
          --place-white: #ffffff;
          --place-muted: #77766f;
          --place-line: rgba(17,17,15,.1);
          --place-ease: cubic-bezier(.16,1,.3,1);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* 强制修复按钮字体过大、未吃到美化的问题 */
        .place-booklet-root button {
          border: 0;
          outline: none;
          cursor: pointer;
        }

        .place-booklet-root .place-btn-pill {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          line-height: 1 !important;
          letter-spacing: 0.3px !important;
          box-sizing: border-box !important;
        }

        .place-booklet-root .place-btn-pill span {
          font-size: 12px !important;
          font-weight: 600 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        /* 地图外框：保证严格填满留给地图的区域并有柔和质感 */
        .map-frame-box {
          position: relative;
          width: 100%;
          height: min(60vw, 380px);
          min-height: 280px;
          border-radius: 18px;
          overflow: hidden;
          background: #e6e7e2;
          box-shadow: 
            0 16px 36px -12px rgba(17,17,15,0.18),
            0 0 0 1px rgba(17,17,15,0.08);
        }

        /* 满铺地图底图 */
        .map-bg-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: grayscale(1) contrast(0.92) brightness(1.04);
          opacity: 0.95;
          pointer-events: none;
        }

        /* 坐标脉冲波纹动画 */
        @keyframes markerPulse {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          70% {
            transform: scale(2.6);
            opacity: 0;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }

        .anim-pulse-ring {
          animation: markerPulse 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          transform-origin: center;
          transform-box: fill-box;
        }

        .anim-pulse-ring-delayed {
          animation: markerPulse 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          animation-delay: 0.8s;
          transform-origin: center;
          transform-box: fill-box;
        }

        /* 路线流动发光效果 */
        @keyframes routeFlow {
          from {
            stroke-dashoffset: 60;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        .anim-route-flow {
          animation: routeFlow 2.5s linear infinite;
        }

        /* 滚动条隐藏 */
        .place-scroll-content::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* 顶部悬浮返回按钮（强制精致小胶囊美化） */}
      <button
        type="button"
        onClick={onBack}
        className="place-btn-pill absolute z-30 flex items-center gap-1.5 rounded-full bg-[#0c0c0b] px-3.5 py-2.5 text-white shadow-lg transition-all duration-300 hover:bg-[#252522] hover:-translate-y-0.5 active:scale-95"
        style={{
          top: 'max(16px, env(safe-area-inset-top))',
          left: '20px',
        }}
        aria-label="返回上一页"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>返回</span>
      </button>

      {/* 主滚动区：内部用 max-w-2xl 居中在大屏上展示，外部全屏填满 */}
      <main className="place-scroll-content flex-1 overflow-y-auto overflow-x-hidden px-5 pt-20 pb-12">
        <div className="mx-auto w-full max-w-2xl">
          {/* 抬头小节 */}
          <div className="relative mb-6 pt-2">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-[#77766f] uppercase">
              <span className="inline-block h-[1px] w-6 bg-[#11110f]/40" />
              <span>FIELD NOTES · MEMORY ATLAS</span>
            </div>

            <h1 className="mt-2 text-4xl font-serif tracking-tight text-[#11110f] sm:text-5xl">
              <span>一起走过的</span>
              <em className="pl-3 font-serif italic">地方。</em>
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#77766f]">
              <span className="font-semibold text-[#11110f]">
                和 {character?.name || '伴侣'}
              </span>
              <span className="h-1 w-1 rounded-full bg-[#11110f]/30" />
              <span>{places.length} 个记忆足迹</span>
              <span className="h-1 w-1 rounded-full bg-[#11110f]/30" />
              <span className="text-[10px] tracking-wider uppercase opacity-70">
                PLACES WE KEPT
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="flex min-h-[300px] items-center justify-center text-xs text-[#77766f]">
              正在翻阅足迹地图...
            </div>
          )}

          {!isLoading && places.length === 0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-[#77766f]">
              <MapPin className="h-8 w-8 stroke-1 opacity-60" />
              <p className="font-serif text-xs italic">
                还没有留下足迹，等你们一起走过更多地方吧。
              </p>
            </div>
          )}

          {!isLoading && places.length > 0 && (
            <>
              {/* 地图标题与坐标指示栏 */}
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[#77766f] uppercase">
                  <Compass className="h-3.5 w-3.5 text-[#11110f]" />
                  <span>Places Atlas</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#77766f]">
                  <span className="font-mono text-[10px] text-[#11110f]/70">
                    {activeMapItem?.coordsText}
                  </span>
                  <span className="italic font-serif text-[#11110f] max-w-[120px] truncate">
                    {activePlace?.name}
                  </span>
                </div>
              </div>

              {/* 地图画框：严格充满整个区域，配合大地测量坐标美化 */}
              <div className="map-frame-box">
                {/* 1. 满铺地图底图（解决底图只显示一半的问题） */}
                <img
                  src={MAP_IMAGE_URL}
                  alt="地图底图"
                  className="map-bg-image"
                />

                {/* 2. 质感网格与暗角覆盖 */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(17,17,15,0.22)_100%)]" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:36px_36px]" />

                {/* 3. 四角测量十字准星美化 */}
                <div className="pointer-events-none absolute top-3 left-3 text-[#11110f]/40 font-mono text-[10px] leading-none">
                  + 31°N
                </div>
                <div className="pointer-events-none absolute top-3 right-3 text-[#11110f]/40 font-mono text-[10px] leading-none">
                  + 121°E
                </div>
                <div className="pointer-events-none absolute bottom-3 left-3 text-[#11110f]/40 font-mono text-[10px] leading-none">
                  L/01
                </div>

                {/* 4. 坐标和路线 SVG 图层 */}
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 1000 620"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <defs>
                    <filter
                      id="pinShadow"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="4"
                        stdDeviation="4"
                        floodColor="#000000"
                        floodOpacity="0.35"
                      />
                    </filter>
                  </defs>

                  {/* 路线虚线 */}
                  {routePoints && (
                    <polyline
                      points={routePoints}
                      fill="none"
                      stroke="#11110f"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 6"
                      className="anim-route-flow opacity-60"
                    />
                  )}

                  {/* 地点图钉与大地测量坐标美化 */}
                  {mapPlaces.map(({ place, index, point, coordsText }) => {
                    const isActive = index === activeIndex;

                    return (
                      <g
                        key={place.id}
                        transform={`translate(${point.x}, ${point.y})`}
                        onClick={() => selectPlace(index)}
                        className="cursor-pointer transition-transform duration-300"
                        role="button"
                        tabIndex={0}
                      >
                        {/* 激活状态：双层扩散雷达涟漪波纹 */}
                        {isActive && (
                          <>
                            <circle
                              r="32"
                              fill="none"
                              stroke="#11110f"
                              strokeWidth="1.5"
                              className="anim-pulse-ring"
                            />
                            <circle
                              r="32"
                              fill="none"
                              stroke="#11110f"
                              strokeWidth="1"
                              className="anim-pulse-ring-delayed"
                            />
                            {/* 瞄准准星刻度 */}
                            <circle
                              r="15"
                              fill="none"
                              stroke="#11110f"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                              opacity="0.6"
                            />
                          </>
                        )}

                        {/* 未激活点：精致微型坐标靶心 */}
                        {!isActive && (
                          <>
                            <circle
                              r="9"
                              fill="#ffffff"
                              stroke="#11110f"
                              strokeWidth="2"
                              filter="url(#pinShadow)"
                              className="hover:scale-125 transition-transform"
                            />
                            <circle r="3" fill="#11110f" />
                          </>
                        )}

                        {/* 激活点：精致黑色大地 Pin 针标 */}
                        {isActive && (
                          <g filter="url(#pinShadow)">
                            <path
                              d="M0 -22 C-10 -22 -17 -15 -17 -5 C-17 7 0 22 0 22 S17 7 17 -5 C17 -15 10 -22 0 -22 Z"
                              fill="#11110f"
                              stroke="#ffffff"
                              strokeWidth="2.5"
                            />
                            <circle cy="-5" r="4.5" fill="#ffffff" />

                            {/* 悬浮在 Pin 头顶的精致坐标 HUD 气泡卡片 */}
                            <g transform="translate(0, -32)">
                              <rect
                                x="-60"
                                y="-26"
                                width="120"
                                height="25"
                                rx="12.5"
                                fill="#0c0c0b"
                                fillOpacity="0.9"
                              />
                              <text
                                x="0"
                                y="-15"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="9"
                                fontWeight="700"
                                letterSpacing="0.2"
                              >
                                {place.name?.slice(0, 8) || '足迹点'}
                              </text>
                              <text
                                x="0"
                                y="-6"
                                textAnchor="middle"
                                fill="#a5a59d"
                                fontSize="7"
                                fontFamily="monospace"
                              >
                                {coordsText}
                              </text>
                              {/* 气泡小箭头 */}
                              <polygon
                                points="0,0 -4,-4 4,-4"
                                fill="#0c0c0b"
                                fillOpacity="0.9"
                              />
                            </g>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* 底部信息条与坐标计数 */}
                <div className="absolute right-3.5 bottom-3 left-3.5 flex items-center justify-between text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none">
                  <div className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase">
                    <Crosshair className="h-3 w-3" />
                    <span>LOC {String(activeIndex + 1).padStart(2, '0')}</span>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest opacity-80">
                    {String(activeIndex + 1).padStart(2, '0')} / {String(places.length).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* 地点列表小标题 */}
              <div className="mt-8 mb-2 flex items-center justify-between px-1">
                <span className="font-serif text-xl text-[#11110f]">
                  足迹列表
                </span>
                <span className="text-[10px] font-bold tracking-widest text-[#77766f]">
                  {places.length} LOCATIONS
                </span>
              </div>

              {/* 足迹列表项 */}
              <div className="divide-y divide-[#11110f]/10 border-t border-b border-[#11110f]/10">
                {places.map((place, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={place.id}
                      onClick={() => selectPlace(index)}
                      className={`group flex items-center justify-between py-3.5 px-2 transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-[#11110f]/[0.04]'
                          : 'hover:bg-[#11110f]/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                            isActive
                              ? 'bg-[#0c0c0b] text-white shadow-md'
                              : 'bg-[#f0f0ea] text-[#77766f]'
                          }`}
                        >
                          <Navigation className="h-3.5 w-3.5 rotate-45" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-base font-normal text-[#11110f]">
                            {place.name || '未命名地点'}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-[#77766f]">
                            {formatCoordinates(place, index)} · 到访{' '}
                            {place.visitCount || 1} 次 ·{' '}
                            {formatDate(place.lastVisitAt)}
                          </p>
                          {place.note && (
                            <p className="mt-1 truncate font-serif text-xs italic text-[#55544d]">
                              "{place.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(place.id);
                        }}
                        className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#77766f]/50 hover:bg-[#a83232] hover:text-white transition-colors"
                        title="删除该足迹"
                        aria-label={`删除地点：${place.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* 底部固定操作面板（强制精致胶囊美化） */}
      {activePlace && (
        <footer className="shrink-0 border-t border-[#11110f]/10 bg-[#fbfbf8] px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(0,0,0,0.03)]">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
            {isEditing ? (
              <div className="flex w-full flex-col gap-2.5 rounded-2xl bg-[#0c0c0b] p-3.5 text-white shadow-xl">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="地点名称..."
                  className="w-full border-b border-white/20 bg-transparent py-1 text-sm font-semibold text-white outline-none focus:border-white"
                  maxLength={60}
                  autoFocus
                />
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="留下一句关于这里的回忆..."
                  rows={2}
                  className="w-full resize-none border-b border-white/20 bg-transparent py-1 font-serif text-xs italic text-white/90 outline-none focus:border-white"
                  maxLength={200}
                />
                <div className="mt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                    className="place-btn-pill flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-white/80 transition-colors hover:bg-white/20"
                  >
                    <X className="h-3 w-3" />
                    <span>取消</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    className="place-btn-pill flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[#0c0c0b] font-bold transition-transform hover:bg-white/90 active:scale-95 disabled:opacity-40"
                  >
                    <Check className="h-3 w-3" />
                    <span>{isSaving ? '保存中...' : '保存'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-serif text-base font-medium text-[#11110f]">
                      {activePlace.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-[#77766f]">
                      初访: {formatDate(activePlace.firstVisitAt)}
                    </span>
                  </div>
                  {activePlace.note ? (
                    <p className="mt-0.5 truncate font-serif text-xs italic text-[#66655e]">
                      "{activePlace.note}"
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-[#aaa8a0]">
                      暂无备注回忆，点击右侧编辑添加
                    </p>
                  )}
                </div>

                {/* 编辑按钮：彻底修复字体大小、小巧紧凑 */}
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="place-btn-pill flex shrink-0 items-center gap-1.5 rounded-full bg-[#0c0c0b] px-4 py-2 text-white shadow-md transition-all hover:bg-[#272724] active:scale-95"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>编辑</span>
                </button>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;
