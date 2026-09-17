import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Edit3,
  MapPin,
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

const getMapPoint = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(
    place?.longitude
    ?? place?.lng
    ?? place?.lon,
  );

  if (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
  ) {
    return {
      x: 120 + ((longitude + 180) / 360) * 760,
      y: 80 + ((90 - latitude) / 180) * 460,
    };
  }

  const seed = hashString(place?.id || place?.name || index);

  return {
    x: 115 + ((seed * 37 + index * 113) % 770),
    y: 90 + ((seed * 19 + index * 71) % 390),
  };
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
      setActiveIndex((previous) => (
        Math.min(previous, Math.max(list.length - 1, 0))
      ));
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
    setIsEditing(true);
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

  const handleRowKeyDown = (event, index) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectPlace(index);
    }
  };

  const mapPlaces = places.map((place, index) => ({
    place,
    index,
    point: getMapPoint(place, index),
  }));

  const activePoint = mapPlaces[activeIndex]?.point || {
    x: 500,
    y: 310,
  };

  const mapOffsetX = 500 - activePoint.x * 1.34;
  const mapOffsetY = 310 - activePoint.y * 1.34;

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

  const canSave = Boolean(String(draftName || '').trim()) && !isSaving;

  return (
    <div
      className="place-booklet fixed inset-0 z-50 flex h-[100dvh] w-full flex-col"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
      }}
    >
      <style>{`
        .place-booklet {
          --map-ink: #17181d;
          --map-muted: #777982;
          --map-road: #ffffff;
          --map-line: rgba(20,22,28,.13);
          --map-accent: var(--accent-color);
          overflow: hidden;
        }
        .place-booklet-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
          padding: 20px 22px 14px;
        }
        .place-booklet-header::after {
          content: "";
          position: absolute;
          right: 22px;
          bottom: 0;
          left: 22px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--map-line), transparent);
        }
        .place-back {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 0;
          padding: 6px 0;
          background: transparent;
          color: var(--text-main);
          font-size: 12px;
          font-weight: 600;
          opacity: .58;
          cursor: pointer;
          transition: opacity .25s ease, transform .25s ease;
        }
        .place-back:hover {
          opacity: 1;
          transform: translateX(-3px);
        }
        .place-title {
          min-width: 0;
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -.4px;
        }
        .place-title small {
          display: block;
          margin-top: 3px;
          color: var(--text-main);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.5px;
          opacity: .38;
          text-transform: uppercase;
        }
        .place-scroll {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding: 18px 22px 90px;
          scrollbar-width: none;
        }
        .place-scroll::-webkit-scrollbar {
          display: none;
        }
        .map-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin: 5px 0 10px;
        }
        .map-heading-label {
          color: var(--text-main);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          opacity: .45;
          text-transform: uppercase;
        }
        .map-heading-place {
          max-width: 55%;
          overflow: hidden;
          color: var(--text-main);
          font-family: Georgia, serif;
          font-size: 12px;
          font-style: italic;
          opacity: .62;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .map-frame {
          position: relative;
          height: min(58vw, 390px);
          min-height: 285px;
          overflow: hidden;
          background: #d8e3e2;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.45),
            0 24px 50px -32px rgba(0,0,0,.42);
          isolation: isolate;
        }
        .map-frame::before {
          content: "";
          position: absolute;
          z-index: 3;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 60px rgba(25,28,30,.18);
        }
        .map-frame::after {
          content: "";
          position: absolute;
          z-index: 2;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,.12),
            transparent 42%,
            rgba(18,28,30,.08)
          );
          mix-blend-mode: multiply;
        }
        .map-svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .map-world {
          transform-origin: 0 0;
          transform: translate(
            var(--map-offset-x),
            var(--map-offset-y)
          ) scale(1.34);
          transition: transform .9s cubic-bezier(.16,1,.3,1);
        }
        .map-image {
          display: block;
          width: 1000px;
          height: 620px;
          opacity: .94;
        }
        .map-grid {
          opacity: .16;
        }
        .map-marker {
          cursor: pointer;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .55s cubic-bezier(.16,1,.3,1);
        }
        .map-marker:hover {
          transform: scale(1.18);
        }
        .map-marker.active {
          transform: scale(1.55);
        }
        .map-marker-pulse {
          animation: mapPulse 2.5s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes mapPulse {
          0% {
            opacity: .55;
            transform: scale(.65);
          }
          70%, 100% {
            opacity: 0;
            transform: scale(1.8);
          }
        }
        .map-location-label {
          pointer-events: none;
          fill: var(--map-ink);
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -.2px;
        }
        .map-scale {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--map-ink);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .8px;
          opacity: .48;
        }
        .map-scale::before {
          content: "";
          display: block;
          width: 34px;
          height: 5px;
          border-top: 1px solid currentColor;
          border-right: 1px solid currentColor;
          border-left: 1px solid currentColor;
        }
        .map-compass {
          position: absolute;
          top: 14px;
          right: 15px;
          display: flex;
          width: 31px;
          height: 31px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(20,22,28,.18);
          border-radius: 50%;
          color: var(--map-ink);
          font-family: Georgia, serif;
          font-size: 11px;
          font-weight: bold;
          opacity: .65;
        }
        .map-compass::after {
          content: "";
          position: absolute;
          width: 1px;
          height: 12px;
          background: var(--map-ink);
          transform: rotate(42deg);
        }
        .map-empty {
          display: flex;
          min-height: 285px;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          opacity: .3;
        }
        .place-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 25px 0 5px;
        }
        .place-list-heading span:first-child {
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -.35px;
        }
        .place-list-heading span:last-child {
          font-size: 10px;
          opacity: .38;
        }
        .place-list {
          display: flex;
          flex-direction: column;
        }
        .place-row {
          position: relative;
          display: flex;
          width: 100%;
          align-items: center;
          gap: 13px;
          padding: 14px 2px;
          border: 0;
          border-bottom: 1px solid var(--map-line);
          background: transparent;
          color: var(--text-main);
          text-align: left;
          cursor: pointer;
          transition: padding .45s cubic-bezier(.16,1,.3,1), transform .35s ease;
        }
        .place-row::before {
          content: "";
          position: absolute;
          top: 10px;
          bottom: 10px;
          left: -22px;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: var(--map-accent);
          opacity: 0;
          transform: scaleY(.4);
          transition: opacity .35s ease, transform .35s ease;
        }
        .place-row:hover {
          transform: translateX(3px);
        }
        .place-row:focus-visible {
          outline: 2px solid var(--accent-color);
          outline-offset: 3px;
        }
        .place-row.active {
          padding-top: 18px;
          padding-bottom: 18px;
        }
        .place-row.active::before {
          opacity: 1;
          transform: scaleY(1);
        }
        .place-row-marker {
          display: flex;
          width: 35px;
          height: 35px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(0,0,0,.055);
          color: var(--text-main);
          transition: background .35s ease, color .35s ease, transform .4s ease;
        }
        .place-row.active .place-row-marker {
          background: var(--accent-color);
          color: var(--accent-foreground);
          box-shadow: 0 8px 22px -9px var(--accent-color);
          transform: scale(1.12);
        }
        .place-row-info {
          min-width: 0;
          flex: 1;
        }
        .place-row-name {
          overflow: hidden;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -.2px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-row-meta {
          margin-top: 4px;
          overflow: hidden;
          font-size: 10px;
          opacity: .46;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-row-note {
          max-width: 90%;
          margin-top: 4px;
          overflow: hidden;
          font-family: Georgia, serif;
          font-size: 10px;
          font-style: italic;
          opacity: .5;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-delete {
          display: flex;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--text-main);
          opacity: .23;
          cursor: pointer;
          transition: opacity .25s ease, color .25s ease, background .25s ease;
        }
        .place-delete:hover {
          background: rgba(170,45,45,.1);
          color: #a52e36;
          opacity: 1;
        }
        .place-delete:focus-visible {
          outline: 2px solid #a52e36;
          outline-offset: 2px;
          opacity: 1;
        }
        .place-empty-state {
          display: flex;
          min-height: 60vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          opacity: .4;
        }
        .place-footer {
          position: relative;
          z-index: 5;
          flex-shrink: 0;
          padding: 14px 22px 23px;
          background: linear-gradient(180deg, transparent, var(--bg-main) 30%);
        }
        .place-footer::before {
          content: "";
          display: block;
          width: 34px;
          height: 2px;
          margin-bottom: 10px;
          border-radius: 2px;
          background: var(--accent-color);
          opacity: .7;
        }
        .place-footer p {
          font-family: Georgia, serif;
          font-size: 10px;
          font-style: italic;
          opacity: .48;
        }
        .place-footer-display {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }
        .place-footer-summary {
          min-width: 0;
          flex: 1;
        }
        .place-footer-note {
          max-width: 100%;
          margin-top: 6px;
          overflow: hidden;
          color: var(--text-main);
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
          line-height: 1.55;
          opacity: .58;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-edit-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          border: 0;
          padding: 5px 0;
          background: transparent;
          color: var(--text-main);
          font-size: 11px;
          font-weight: 650;
          opacity: .52;
          cursor: pointer;
          transition: color .25s ease, opacity .25s ease;
        }
        .place-edit-button:hover {
          color: var(--accent-color);
          opacity: 1;
        }
        .place-edit-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .place-edit-label {
          display: block;
          color: var(--text-main);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.2px;
          opacity: .44;
          text-transform: uppercase;
        }
        .place-edit-input,
        .place-edit-textarea {
          display: block;
          width: 100%;
          border: 0;
          border-bottom: 1px solid var(--map-line);
          outline: 0;
          background: transparent;
          color: var(--text-main);
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
          transition: border-color .25s ease;
        }
        .place-edit-input {
          padding: 5px 0 7px;
          font-weight: 700;
        }
        .place-edit-textarea {
          min-height: 42px;
          resize: vertical;
          padding: 5px 0 7px;
          font-family: Georgia, serif;
          font-size: 12px;
        }
        .place-edit-input:focus,
        .place-edit-textarea:focus {
          border-bottom-color: var(--accent-color);
        }
        .place-edit-input::placeholder,
        .place-edit-textarea::placeholder {
          color: var(--text-main);
          opacity: .32;
        }
        .place-edit-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 14px;
          padding-top: 2px;
        }
        .place-edit-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 0;
          padding: 5px 0;
          background: transparent;
          color: var(--text-main);
          font-size: 11px;
          font-weight: 650;
          opacity: .58;
          cursor: pointer;
          transition: color .25s ease, opacity .25s ease;
        }
        .place-edit-action:hover {
          opacity: 1;
        }
        .place-edit-action.save {
          color: var(--accent-color);
          opacity: 1;
        }
        .place-edit-action.save:disabled {
          cursor: not-allowed;
          opacity: .3;
        }
      `}</style>

      <header className="place-booklet-header">
        <button
          type="button"
          onClick={onBack}
          className="place-back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </button>

        <div className="place-title">
          {character?.name || '伴侣'} 认识的地方
          <small>Memory Atlas</small>
        </div>
      </header>

      <section className="place-scroll">
        {isLoading && (
          <p className="py-16 text-center text-xs opacity-40">
            正在翻找记忆里的地点...
          </p>
        )}

        {!isLoading && places.length === 0 && (
          <div className="place-empty-state">
            <MapPin className="h-7 w-7" />
            <p className="font-serif text-xs italic">
              还没有留下足迹，等你们一起走过更多地方吧。
            </p>
          </div>
        )}

        {!isLoading && places.length > 0 && (
          <>
            <div className="map-heading">
              <span className="map-heading-label">Places / Map</span>
              <span className="map-heading-place">
                {activePlace?.name || '记忆地图'}
              </span>
            </div>

            <div className="map-frame">
              <svg
                className="map-svg"
                viewBox="0 0 1000 620"
                preserveAspectRatio="xMidYMid slice"
                style={{
                  '--map-offset-x': `${mapOffsetX}px`,
                  '--map-offset-y': `${mapOffsetY}px`,
                }}
                aria-label="地点记忆地图"
                role="img"
              >
                <defs>
                  <pattern
                    id="mapGrid"
                    width="48"
                    height="48"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 48 0 L 0 0 0 48"
                      fill="none"
                      stroke="#8e948e"
                      strokeWidth="1"
                    />
                  </pattern>

                  <filter id="markerShadow">
                    <feDropShadow
                      dx="0"
                      dy="5"
                      stdDeviation="5"
                      floodColor="#172027"
                      floodOpacity=".28"
                    />
                  </filter>
                </defs>

                <g className="map-world">
                  <image
                    className="map-image"
                    href={MAP_IMAGE_URL}
                    x="0"
                    y="0"
                    width="1000"
                    height="620"
                    preserveAspectRatio="xMidYMid slice"
                    aria-label="记忆地图底图"
                  />

                  <rect
                    className="map-grid"
                    x="0"
                    y="0"
                    width="1000"
                    height="620"
                    fill="url(#mapGrid)"
                  />

                  {routePoints && (
                    <polyline
                      points={routePoints}
                      fill="none"
                      stroke="var(--accent-color)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="10 9"
                      opacity=".78"
                    />
                  )}

                  {mapPlaces.map(({ place, index, point }) => {
                    const isActive = index === activeIndex;

                    return (
                      <g
                        key={place.id}
                        className={`map-marker ${isActive ? 'active' : ''}`}
                        transform={`translate(${point.x} ${point.y})`}
                        onClick={() => selectPlace(index)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectPlace(index);
                          }
                        }}
                        role="button"
                        tabIndex="0"
                        aria-label={`选择地点：${place.name}`}
                      >
                        {isActive && (
                          <circle
                            className="map-marker-pulse"
                            r="27"
                            fill="var(--accent-color)"
                            opacity=".35"
                          />
                        )}

                        <circle
                          r={isActive ? 18 : 13}
                          fill="var(--accent-color)"
                          opacity=".2"
                        />

                        <path
                          d="M0 -17 C-10 -17 -17 -9 -17 1 C-17 12 0 26 0 26 S17 12 17 1 C17 -9 10 -17 0 -17Z"
                          fill="var(--accent-color)"
                          stroke="#fff"
                          strokeWidth="3"
                          filter="url(#markerShadow)"
                        />

                        <circle
                          cy="1"
                          r="5"
                          fill="var(--accent-foreground)"
                        />

                        {isActive && (
                          <text
                            className="map-location-label"
                            x="25"
                            y="-19"
                          >
                            {place.name}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              <div className="map-compass">N</div>
              <div className="map-scale">500 M</div>
            </div>

            <div className="place-list-heading">
              <span>足迹地点</span>
              <span>{places.length} LOCATIONS</span>
            </div>

            <div className="place-list">
              {places.map((place, index) => (
                <div
                  key={place.id}
                  className={`place-row ${
                    index === activeIndex ? 'active' : ''
                  }`}
                  onClick={() => selectPlace(index)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  role="button"
                  tabIndex="0"
                  aria-pressed={index === activeIndex}
                >
                  <div className="place-row-marker">
                    <MapPin className="h-4 w-4" />
                  </div>

                  <div className="place-row-info">
                    <p className="place-row-name">
                      {place.name || '未命名地点'}
                    </p>

                    <p className="place-row-meta">
                      到访 {place.visitCount || 1} 次 · 最近一次{' '}
                      {formatDate(place.lastVisitAt)}
                    </p>

                    {place.note && (
                      <p className="place-row-note">
                        {place.note}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(place.id);
                    }}
                    className="place-delete"
                    title="忘记这个地方"
                    aria-label={`删除地点：${place.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {activePlace && (
        <footer className="place-footer">
          {isEditing ? (
            <div className="place-edit-panel">
              <label
                className="place-edit-label"
                htmlFor="place-name-input"
              >
                地点名称
              </label>

              <input
                id="place-name-input"
                className="place-edit-input"
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="给这个地方取个名字"
                maxLength={100}
                autoFocus
              />

              <label
                className="place-edit-label"
                htmlFor="place-note-input"
              >
                共同备注
              </label>

              <textarea
                id="place-note-input"
                className="place-edit-textarea"
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                placeholder="留一句只有你们知道的话..."
                maxLength={1000}
                rows={2}
              />

              <div className="place-edit-actions">
                <button
                  type="button"
                  className="place-edit-action"
                  onClick={handleCancelEditing}
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>取消</span>
                </button>

                <button
                  type="button"
                  className="place-edit-action save"
                  onClick={() => void handleSave()}
                  disabled={!canSave}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isSaving ? '保存中...' : '保存'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="place-footer-display">
              <div className="place-footer-summary">
                <p>
                  初次到访：
                  {formatDate(activePlace.firstVisitAt)}
                </p>

                {activePlace.note && (
                  <div className="place-footer-note">
                    {activePlace.note}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="place-edit-button"
                onClick={handleStartEditing}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>编辑</span>
              </button>
            </div>
          )}
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;

