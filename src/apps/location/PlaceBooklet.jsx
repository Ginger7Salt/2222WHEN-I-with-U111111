import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Trash2, Navigation, LocateFixed } from 'lucide-react';

import { listPlaces, deletePlace } from './placeService';

const MAP_POINTS = [
  { x: 72, y: 78 },
  { x: 148, y: 142 },
  { x: 236, y: 82 },
  { x: 326, y: 158 },
  { x: 390, y: 66 },
  { x: 468, y: 132 },
  { x: 548, y: 82 },
  { x: 630, y: 172 },
];

const PlaceBooklet = ({ chatId, character, onBack }) => {
  const [places, setPlaces] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const reload = async () => {
    const list = await listPlaces(chatId);
    setPlaces(list);
    setActiveIndex((previous) => Math.min(previous, Math.max(list.length - 1, 0)));
    setIsLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const activePlace = places[activeIndex];

  const handleDelete = async (placeId) => {
    await deletePlace(chatId, placeId);
    await reload();
  };

  const points = useMemo(
    () =>
      places.map((place, index) => ({
        ...MAP_POINTS[index % MAP_POINTS.length],
        place,
        index,
      })),
    [places],
  );

  const activePoint = points[activeIndex] || { x: 320, y: 120 };

  const mapTransform = `
    translate(${260 - activePoint.x * 1.18}px, ${145 - activePoint.y * 1.18}px)
    scale(1.18)
  `;

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
          --map-ink: #24262a;
          --map-muted: #8a8d91;
          --map-paper: #e9e8e2;
          --map-water: #c8d5d6;
          --map-road: #fffdf8;
          --map-accent: var(--accent-color);
          overflow: hidden;
          isolation: isolate;
        }
        .place-booklet-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px 21px 14px;
        }
        .place-booklet-header::after {
          content: "";
          position: absolute;
          right: 21px;
          bottom: 0;
          left: 21px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,.14), transparent);
        }
        .place-back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          border: 0;
          border-radius: 50%;
          background: rgba(0,0,0,.06);
          color: var(--text-main);
          cursor: pointer;
          transition: transform .3s cubic-bezier(.16,1,.3,1), background .3s ease;
        }
        .place-back:hover {
          background: rgba(0,0,0,.12);
          transform: translateX(-3px);
        }
        .place-heading {
          min-width: 0;
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -.35px;
        }
        .place-heading-sub {
          margin-top: 3px;
          color: var(--text-main);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.4px;
          opacity: .38;
          text-transform: uppercase;
        }
        .place-map-wrap {
          position: relative;
          z-index: 1;
          margin: 18px 16px 0;
          height: 310px;
          overflow: hidden;
          border-radius: 25px;
          background: var(--map-paper);
          box-shadow:
            0 22px 45px -26px rgba(0,0,0,.38),
            inset 0 0 0 1px rgba(255,255,255,.65);
        }
        .place-map-wrap::before {
          content: "";
          position: absolute;
          z-index: 2;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(120deg, rgba(255,255,255,.25), transparent 38%),
            radial-gradient(circle at 86% 18%, rgba(255,255,255,.6), transparent 28%);
          mix-blend-mode: screen;
        }
        .place-map-svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        .map-moving-layer {
          transform-origin: 260px 145px;
          transition: transform .85s cubic-bezier(.16,1,.3,1);
        }
        .map-place-pin {
          cursor: pointer;
          transform-box: fill-box;
          transform-origin: center;
          transition: opacity .35s ease, transform .5s cubic-bezier(.16,1,.3,1);
        }
        .map-place-pin:hover {
          transform: scale(1.15);
        }
        .map-place-pin.active {
          transform: scale(1.65);
        }
        .map-pin-pulse {
          animation: mapPulse 2.2s ease-out infinite;
        }
        @keyframes mapPulse {
          0% { opacity: .55; transform: scale(.7); }
          70%,100% { opacity: 0; transform: scale(1.7); }
        }
        .map-controls {
          position: absolute;
          z-index: 4;
          top: 14px;
          right: 14px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .map-control {
          display: flex;
          width: 31px;
          height: 31px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: rgba(255,255,255,.7);
          color: var(--map-ink);
          box-shadow: 0 5px 16px -8px rgba(0,0,0,.35);
          backdrop-filter: blur(10px);
          cursor: pointer;
        }
        .map-label {
          position: absolute;
          z-index: 4;
          bottom: 14px;
          left: 15px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border-radius: 15px;
          background: rgba(255,255,255,.68);
          color: var(--map-ink);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .2px;
          box-shadow: 0 7px 18px -10px rgba(0,0,0,.4);
          backdrop-filter: blur(12px);
        }
        .map-label-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--map-accent);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--map-accent) 20%, transparent);
        }
        .place-content {
          position: relative;
          z-index: 3;
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding: 18px 21px 110px;
          scrollbar-width: none;
        }
        .place-content::-webkit-scrollbar {
          display: none;
        }
        .place-section-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .place-section-title {
          font-size: 12px;
          font-weight: 750;
          letter-spacing: -.1px;
        }
        .place-section-count {
          color: var(--text-main);
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
          gap: 12px;
          padding: 13px 0;
          border: 0;
          border-bottom: 1px solid rgba(0,0,0,.08);
          background: transparent;
          color: var(--text-main);
          text-align: left;
          cursor: pointer;
          transition: padding .45s cubic-bezier(.16,1,.3,1), opacity .3s ease;
        }
        .place-row::before {
          content: "";
          position: absolute;
          left: -21px;
          width: 3px;
          height: 25px;
          border-radius: 0 4px 4px 0;
          background: var(--map-accent);
          opacity: 0;
          transform: scaleY(.45);
          transition: opacity .35s ease, transform .35s ease;
        }
        .place-row.active {
          padding-top: 17px;
          padding-bottom: 17px;
        }
        .place-row.active::before {
          opacity: 1;
          transform: scaleY(1);
        }
        .place-row-marker {
          display: flex;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(0,0,0,.06);
          color: var(--text-main);
          transition: background .35s ease, color .35s ease, transform .35s ease;
        }
        .place-row.active .place-row-marker {
          background: var(--map-accent);
          color: var(--accent-foreground);
          transform: scale(1.12);
        }
        .place-row-info {
          min-width: 0;
          flex: 1;
        }
        .place-row-name {
          overflow: hidden;
          font-size: 12px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-row-meta {
          margin-top: 4px;
          overflow: hidden;
          font-size: 10px;
          opacity: .45;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-delete {
          display: flex;
          width: 27px;
          height: 27px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--text-main);
          opacity: .22;
          cursor: pointer;
          transition: opacity .25s ease, background .25s ease, color .25s ease;
        }
        .place-delete:hover {
          background: rgba(180,40,40,.1);
          color: #a32f37;
          opacity: 1;
        }
        .place-empty {
          display: flex;
          min-height: 50vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 11px;
          text-align: center;
          opacity: .42;
        }
        .place-footer {
          position: relative;
          z-index: 5;
          flex-shrink: 0;
          padding: 14px 21px 22px;
          background: linear-gradient(180deg, transparent, var(--bg-main) 32%);
        }
        .place-footer::before {
          content: "";
          display: block;
          width: 32px;
          height: 2px;
          margin-bottom: 10px;
          border-radius: 2px;
          background: var(--map-accent);
          opacity: .7;
        }
        .place-footer p {
          font-size: 10px;
          font-style: italic;
          opacity: .48;
        }
      `}</style>

      <header className="place-booklet-header">
        <button type="button" onClick={onBack} className="place-back">
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="place-heading">
          {character?.name || '伴侣'} 认识的地方
          <div className="place-heading-sub">Memory Atlas</div>
        </div>
      </header>

      {!isLoading && places.length > 0 && (
        <div className="place-map-wrap">
          <svg
            className="place-map-svg"
            viewBox="0 0 520 290"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="mapGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" stroke="#9DA3A3" strokeWidth=".5" opacity=".22" />
              </pattern>

              <filter id="mapShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".22" />
              </filter>

              <linearGradient id="terrain" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#deded6" />
                <stop offset="1" stopColor="#cdd0c7" />
              </linearGradient>

              <linearGradient id="river" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d7d8" />
                <stop offset="1" stopColor="#b6cccf" />
              </linearGradient>
            </defs>

            <rect width="520" height="290" fill="url(#terrain)" />
            <rect width="520" height="290" fill="url(#mapGrid)" />

            <path
              d="M-30 42C62 10 108 72 174 53C245 32 271 8 350 42C419 71 462 37 550 25V-10H-30V42Z"
              fill="#e7e5dc"
            />
            <path
              d="M-30 236C59 194 103 227 165 208C231 187 264 232 331 210C409 184 461 228 550 195V320H-30V236Z"
              fill="#d9dbd2"
            />

            <path
              d="M-25 184C39 160 76 178 121 143C169 105 187 78 241 96C302 116 314 176 368 161C424 146 454 88 553 103"
              stroke="url(#river)"
              strokeWidth="30"
              strokeLinecap="round"
              opacity=".95"
            />
            <path
              d="M-25 184C39 160 76 178 121 143C169 105 187 78 241 96C302 116 314 176 368 161C424 146 454 88 553 103"
              stroke="#edf4f0"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              opacity=".75"
            />

            <g stroke="#ffffff" strokeLinecap="round" opacity=".95">
              <path d="M-20 84L118 122L242 74L395 112L550 72" strokeWidth="5" />
              <path d="M15 260L110 190L196 202L307 164L520 226" strokeWidth="4" />
              <path d="M92 -10L111 68L98 152L144 310" strokeWidth="5" />
              <path d="M275 -10L254 69L292 142L275 310" strokeWidth="4" />
              <path d="M438 -10L401 70L427 155L408 310" strokeWidth="5" />
            </g>

            <g stroke="#b5b7af" strokeWidth="1.2" opacity=".7">
              <path d="M23 28L82 61L142 31L194 55L235 23" />
              <path d="M316 38L356 74L391 38L451 62L505 40" />
              <path d="M33 222L75 188L130 225L178 184L226 213" />
              <path d="M337 218L376 180L425 211L472 176L527 204" />
              <path d="M42 113L74 93L105 112L136 87L170 107" />
              <path d="M337 118L370 91L408 114L448 84L490 107" />
            </g>

            <g className="map-moving-layer" style={{ transform: mapTransform }}>
              <path
                d={points
                  .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
                  .join(' ')}
                stroke="#25272a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="7 6"
                opacity=".75"
              />

              {points.map(({ x, y, place, index }) => {
                const isActive = index === activeIndex;

                return (
                  <g
                    key={place.id}
                    className={`map-place-pin${isActive ? ' active' : ''}`}
                    onClick={() => setActiveIndex(index)}
                  >
                    {isActive && (
                      <circle
                        className="map-pin-pulse"
                        cx={x}
                        cy={y}
                        r="12"
                        fill="none"
                        stroke="var(--map-accent)"
                        strokeWidth="2"
                      />
                    )}

                    <circle
                      cx={x}
                      cy={y}
                      r={isActive ? 8 : 5}
                      fill={isActive ? 'var(--map-accent)' : '#282a2d'}
                      stroke="#fff"
                      strokeWidth="2.5"
                      filter="url(#mapShadow)"
                    />

                    {isActive && (
                      <path
                        d={`M${x - 4} ${y + 5}L${x} ${y + 13}L${x + 4} ${y + 5}`}
                        fill="var(--map-accent)"
                      />
                    )}

                    <text
                      x={x + 10}
                      y={y - 10}
                      fill="#313337"
                      fontSize="8"
                      fontWeight={isActive ? "700" : "500"}
                      opacity={isActive ? "1" : ".62"}
                    >
                      {place.name?.length > 13
                        ? `${place.name.slice(0, 13)}…`
                        : place.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="map-controls">
            <button
              type="button"
              className="map-control"
              title="定位当前地点"
              onClick={() => setActiveIndex(activeIndex)}
            >
              <LocateFixed className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="map-control"
              title="路线"
              onClick={() => setActiveIndex((activeIndex + 1) % places.length)}
            >
              <Navigation className="h-4 w-4" />
            </button>
          </div>

          <div className="map-label">
            <span className="map-label-dot" />
            <span>{activePlace?.name || '记忆地图'}</span>
          </div>
        </div>
      )}

      <section className="place-content">
        {isLoading && (
          <p className="py-16 text-center text-xs opacity-40">
            正在翻找记忆里的地点...
          </p>
        )}

        {!isLoading && places.length === 0 && (
          <div className="place-empty">
            <MapPin className="h-7 w-7" />
            <p className="font-serif text-xs italic">
              还没有留下足迹，等你们一起走过更多地方吧。
            </p>
          </div>
        )}

        {!isLoading && places.length > 0 && (
          <>
            <div className="place-section-heading">
              <span className="place-section-title">地点足迹</span>
              <span className="place-section-count">
                {places.length} PLACES
              </span>
            </div>

            <div className="place-list">
              {places.map((place, index) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`place-row${index === activeIndex ? ' active' : ''}`}
                >
                  <div className="place-row-marker">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>

                  <div className="place-row-info">
                    <p className="place-row-name">{place.name}</p>
                    <p className="place-row-meta">
                      到访 {place.visitCount || 1} 次 · 最近一次{' '}
                      {new Date(place.lastVisitAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>

                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(place.id);
                    }}
                    className="place-delete"
                    title="忘记这个地方"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {activePlace && (
        <footer className="place-footer">
          <p>
            初次到访：
            {new Date(activePlace.firstVisitAt).toLocaleDateString('zh-CN')}
          </p>
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;
