import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';

import { listPlaces, deletePlace } from './placeService';

const MAP_POINTS = [
  [58, 76],
  [142, 54],
  [224, 108],
  [310, 62],
  [352, 154],
  [278, 224],
  [174, 202],
  [78, 236],
  [126, 142],
  [238, 178],
];

const getMapPoint = (index) => {
  if (index < MAP_POINTS.length) return MAP_POINTS[index];

  const angle = index * 1.7;
  return [
    200 + Math.cos(angle) * 135,
    145 + Math.sin(angle) * 92,
  ];
};

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

  const mapPoints = useMemo(
    () => places.map((_, index) => getMapPoint(index)),
    [places],
  );

  const activePoint = mapPoints[activeIndex] || [200, 145];
  const mapScale = 1.34;
  const mapTranslateX = 200 - activePoint[0] * mapScale;
  const mapTranslateY = 145 - activePoint[1] * mapScale;

  const routePath = mapPoints
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');

  return (
    <div
      className="place-booklet fixed inset-0 z-50 flex h-[100dvh] w-full flex-col animate-fade-in-up"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
      }}
    >
      <style>{`
        .place-booklet {
          --map-ink: var(--text-main);
          --map-muted: rgba(100,100,110,.36);
          --map-line: rgba(100,100,110,.14);
          --map-glow: var(--accent-color);
          overflow: hidden;
        }
        .place-booklet-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px 22px 15px;
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
        .place-back-button {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 0;
          padding: 5px 0;
          background: transparent;
          color: var(--text-main);
          opacity: .58;
          cursor: pointer;
          transition: opacity .25s ease, transform .25s ease;
        }
        .place-back-button:hover {
          opacity: 1;
          transform: translateX(-3px);
        }
        .place-booklet-title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -.35px;
        }
        .place-booklet-title small {
          display: block;
          margin-top: 4px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.8px;
          opacity: .34;
          text-transform: uppercase;
        }
        .place-booklet-content {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding: 13px 22px 110px;
          scrollbar-width: none;
        }
        .place-booklet-content::-webkit-scrollbar {
          display: none;
        }
        .virtual-map {
          position: relative;
          height: 310px;
          margin: 0 -22px 25px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 48%, rgba(255,255,255,.6), transparent 60%),
            linear-gradient(145deg, rgba(0,0,0,.025), rgba(255,255,255,.18));
          mask-image: linear-gradient(180deg, transparent 0, #000 10%, #000 88%, transparent 100%);
        }
        .map-caption {
          position: absolute;
          top: 25px;
          left: 23px;
          z-index: 3;
          pointer-events: none;
        }
        .map-caption-label {
          color: var(--text-main);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 2px;
          opacity: .34;
          text-transform: uppercase;
        }
        .map-caption-title {
          margin-top: 5px;
          color: var(--text-main);
          font-family: Georgia, serif;
          font-size: 21px;
          font-style: italic;
          letter-spacing: -.7px;
          opacity: .8;
        }
        .map-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .map-world {
          transition: transform .85s cubic-bezier(.16,1,.3,1);
          transform-origin: 200px 145px;
        }
        .map-grid {
          stroke: var(--map-line);
          stroke-width: .8;
          fill: none;
        }
        .map-contour {
          stroke: var(--map-muted);
          stroke-width: 1;
          fill: none;
          opacity: .68;
        }
        .map-river {
          stroke: rgba(100,125,145,.26);
          stroke-width: 10;
          fill: none;
          stroke-linecap: round;
        }
        .map-river-inner {
          stroke: rgba(255,255,255,.55);
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
        }
        .map-route-shadow {
          stroke: var(--map-glow);
          stroke-width: 5;
          opacity: .12;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .map-route {
          stroke: var(--map-ink);
          stroke-width: 1.8;
          stroke-dasharray: 3 5;
          fill: none;
          opacity: .7;
          stroke-linecap: round;
          stroke-linejoin: round;
          animation: mapRouteFlow 18s linear infinite;
        }
        @keyframes mapRouteFlow {
          to {
            stroke-dashoffset: -160;
          }
        }
        .map-marker {
          cursor: pointer;
          transition: opacity .3s ease;
        }
        .map-marker-core {
          fill: var(--text-main);
          stroke: var(--bg-main);
          stroke-width: 2;
          transition: fill .45s ease, transform .45s cubic-bezier(.16,1,.3,1);
          transform-box: fill-box;
          transform-origin: center;
        }
        .map-marker-ring {
          fill: none;
          stroke: var(--text-main);
          stroke-width: 1;
          opacity: .22;
          transition: opacity .4s ease, stroke .4s ease, transform .5s ease;
          transform-box: fill-box;
          transform-origin: center;
        }
        .map-marker-active .map-marker-core {
          fill: var(--map-glow);
          transform: scale(1.7);
        }
        .map-marker-active .map-marker-ring {
          stroke: var(--map-glow);
          opacity: .8;
          animation: markerPulse 1.8s ease-out infinite;
        }
        .map-marker-active .map-marker-label {
          opacity: 1;
          transform: translateY(-3px);
        }
        @keyframes markerPulse {
          0% {
            transform: scale(.8);
            opacity: .9;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .map-marker-label {
          fill: var(--text-main);
          font-size: 8px;
          font-weight: 700;
          opacity: .38;
          transform-box: fill-box;
          transform-origin: center;
          transition: opacity .4s ease, transform .4s ease;
        }
        .map-compass {
          position: absolute;
          right: 24px;
          bottom: 30px;
          display: flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--map-line);
          border-radius: 50%;
          color: var(--text-main);
          font-size: 9px;
          opacity: .42;
        }
        .map-compass::after {
          content: "";
          position: absolute;
          width: 1px;
          height: 10px;
          background: var(--text-main);
          transform: translateY(-7px);
        }
        .place-section-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .place-section-heading h2 {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .2px;
        }
        .place-section-heading span {
          font-size: 10px;
          opacity: .35;
        }
        .place-list {
          display: flex;
          flex-direction: column;
        }
        .place-entry {
          position: relative;
          display: flex;
          width: 100%;
          align-items: center;
          gap: 13px;
          border: 0;
          border-bottom: 1px solid var(--map-line);
          padding: 14px 0;
          background: transparent;
          color: var(--text-main);
          text-align: left;
          cursor: pointer;
          transition: opacity .3s ease, transform .35s ease;
        }
        .place-entry:hover {
          transform: translateX(4px);
        }
        .place-entry::before {
          content: "";
          position: absolute;
          left: -22px;
          width: 3px;
          height: 24px;
          border-radius: 0 4px 4px 0;
          background: var(--accent-color);
          opacity: 0;
          transform: scaleY(.4);
          transition: opacity .35s ease, transform .35s ease;
        }
        .place-entry[data-active="true"]::before {
          opacity: 1;
          transform: scaleY(1);
        }
        .place-entry-mark {
          display: flex;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(0,0,0,.045);
          color: var(--text-main);
          transition: background .4s ease, color .4s ease, transform .4s ease;
        }
        .place-entry[data-active="true"] .place-entry-mark {
          background: var(--accent-color);
          color: var(--accent-foreground);
          transform: scale(1.12);
          box-shadow: 0 8px 24px -9px var(--accent-color);
        }
        .place-entry-info {
          min-width: 0;
          flex: 1;
        }
        .place-entry-name {
          overflow: hidden;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -.2px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-entry-meta {
          margin-top: 4px;
          overflow: hidden;
          font-size: 10px;
          opacity: .43;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-delete-button {
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
          opacity: .24;
          cursor: pointer;
          transition: color .25s ease, background .25s ease, opacity .25s ease;
        }
        .place-delete-button:hover {
          background: rgba(180,45,45,.1);
          color: #a52e36;
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
        .place-empty-state p {
          max-width: 240px;
          line-height: 1.7;
        }
        .place-booklet-footer {
          position: relative;
          z-index: 4;
          flex-shrink: 0;
          padding: 13px 22px 22px;
          background: linear-gradient(180deg, transparent, var(--bg-main) 32%);
        }
        .place-booklet-footer::before {
          content: "";
          display: block;
          width: 30px;
          height: 2px;
          margin-bottom: 9px;
          border-radius: 2px;
          background: var(--accent-color);
          opacity: .7;
        }
        .place-booklet-footer p {
          font-size: 10px;
          font-style: italic;
          opacity: .45;
        }
      `}</style>

      <header className="place-booklet-header shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="place-back-button text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </button>

        <div className="place-booklet-title">
          {character?.name || '伴侣'} 认识的地方
          <small>Places remembered together</small>
        </div>
      </header>

      <section className="place-booklet-content">
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
            <div className="virtual-map">
              <div className="map-caption">
                <div className="map-caption-label">Memory Atlas</div>
                <div className="map-caption-title">
                  {activePlace?.name || 'Places'}
                </div>
              </div>

              <svg
                className="map-svg"
                viewBox="0 0 400 290"
                fill="none"
                preserveAspectRatio="xMidYMid meet"
              >
                <g
                  className="map-world"
                  transform={`translate(${mapTranslateX} ${mapTranslateY}) scale(${mapScale})`}
                >
                  <path
                    className="map-grid"
                    d="M18 36C82 12 122 62 188 38S304 18 382 48
                       M8 112C76 87 124 142 194 116S316 92 392 128
                       M14 188C80 160 132 216 204 188S314 170 386 204
                       M48 12C36 76 78 124 54 274
                       M132 5C116 76 158 126 138 286
                       M228 5C208 76 256 138 232 286
                       M322 4C298 70 350 142 326 286"
                  />

                  <path
                    className="map-contour"
                    d="M24 76C74 51 114 80 156 70S248 38 302 67S354 88 388 72"
                  />
                  <path
                    className="map-contour"
                    d="M18 154C74 130 112 165 164 151S258 123 306 148S352 170 389 151"
                  />
                  <path
                    className="map-contour"
                    d="M34 242C87 215 132 250 186 234S278 207 334 235S365 252 390 244"
                  />

                  <path
                    className="map-river"
                    d="M-15 240C62 210 76 148 130 143S188 181 232 143S292 53 421 76"
                  />
                  <path
                    className="map-river-inner"
                    d="M-15 240C62 210 76 148 130 143S188 181 232 143S292 53 421 76"
                  />

                  {mapPoints.length > 1 && (
                    <>
                      <path className="map-route-shadow" d={routePath} />
                      <path className="map-route" d={routePath} />
                    </>
                  )}

                  {places.map((place, index) => {
                    const [x, y] = mapPoints[index];
                    const isActive = index === activeIndex;

                    return (
                      <g
                        key={place.id}
                        className={`map-marker ${isActive ? 'map-marker-active' : ''}`}
                        onClick={() => setActiveIndex(index)}
                        transform={`translate(${x} ${y})`}
                      >
                        <circle className="map-marker-ring" r="8" />
                        <circle className="map-marker-core" r="3.4" />
                        <text
                          className="map-marker-label"
                          x="0"
                          y="-11"
                          textAnchor="middle"
                        >
                          {place.name?.length > 10
                            ? `${place.name.slice(0, 10)}…`
                            : place.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              <div className="map-compass">N</div>
            </div>

            <div className="place-section-heading">
              <h2>已留下的地点</h2>
              <span>{places.length} PLACES</span>
            </div>

            <div className="place-list">
              {places.map((place, index) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="place-entry"
                  data-active={index === activeIndex}
                >
                  <div className="place-entry-mark">
                    <MapPin className="h-[16px] w-[16px]" />
                  </div>

                  <div className="place-entry-info">
                    <p className="place-entry-name">{place.name}</p>
                    <p className="place-entry-meta">
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
                    className="place-delete-button"
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
        <footer className="place-booklet-footer">
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
