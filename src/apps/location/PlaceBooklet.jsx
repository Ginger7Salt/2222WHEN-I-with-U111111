import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';

import { listPlaces, deletePlace } from './placeService';

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

  const mapPoints = useMemo(() => {
    const positions = [
      { x: 112, y: 156 },
      { x: 248, y: 92 },
      { x: 390, y: 196 },
      { x: 530, y: 128 },
      { x: 675, y: 224 },
      { x: 742, y: 108 },
      { x: 610, y: 358 },
      { x: 438, y: 326 },
      { x: 260, y: 378 },
      { x: 92, y: 324 },
    ];

    return places.map((place, index) => ({
      ...place,
      ...(positions[index % positions.length]),
    }));
  }, [places]);

  const activePoint = mapPoints[activeIndex];

  const mapTransform = activePoint
    ? `translate(${400 - activePoint.x * 1.42} ${240 - activePoint.y * 1.42}) scale(1.42)`
    : 'translate(0 0) scale(1)';

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
          --map-ink: rgba(30,32,38,.72);
          --map-muted: rgba(40,44,52,.34);
          --map-faint: rgba(40,44,52,.12);
          --map-accent: var(--accent-color);
          overflow: hidden;
        }
        .place-booklet-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 22px 13px;
        }
        .place-booklet-header::after {
          content: "";
          position: absolute;
          left: 22px;
          right: 22px;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--divider), transparent);
        }
        .place-back-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 0;
          border: 0;
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
        .place-title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -.35px;
        }
        .place-title-sub {
          margin-top: 3px;
          color: var(--text-main);
          font-size: 9px;
          letter-spacing: 1.2px;
          opacity: .35;
          text-transform: uppercase;
        }
        .place-content {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding: 18px 0 108px;
          scrollbar-width: none;
        }
        .place-content::-webkit-scrollbar {
          display: none;
        }
        .map-stage {
          position: relative;
          height: min(54vw, 330px);
          min-height: 245px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 45%, rgba(255,255,255,.4), transparent 65%),
            linear-gradient(135deg, rgba(0,0,0,.035), transparent 55%);
          border-top: 1px solid var(--map-faint);
          border-bottom: 1px solid var(--map-faint);
        }
        .map-stage::before,
        .map-stage::after {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 2;
        }
        .map-stage::before {
          inset: 0;
          background:
            linear-gradient(90deg, transparent 49.8%, var(--map-faint) 50%, transparent 50.2%),
            linear-gradient(0deg, transparent 49.8%, var(--map-faint) 50%, transparent 50.2%);
          opacity: .55;
        }
        .map-stage::after {
          left: 50%;
          top: 50%;
          width: 1px;
          height: 78%;
          background: linear-gradient(transparent, var(--map-muted), transparent);
          transform: translate(-50%, -50%);
          opacity: .35;
        }
        .virtual-map {
          width: 100%;
          height: 100%;
          display: block;
        }
        .map-world {
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .9s cubic-bezier(.16,1,.3,1);
        }
        .map-terrain {
          fill: none;
          stroke: var(--map-ink);
          stroke-width: 1.2;
          opacity: .16;
        }
        .map-terrain-light {
          fill: none;
          stroke: var(--map-ink);
          stroke-width: .8;
          opacity: .1;
        }
        .map-road {
          fill: none;
          stroke: rgba(255,255,255,.82);
          stroke-width: 7;
          stroke-linecap: round;
          opacity: .8;
        }
        .map-road-thin {
          fill: none;
          stroke: var(--map-muted);
          stroke-width: 1;
          stroke-dasharray: 3 7;
          opacity: .36;
        }
        .map-river {
          fill: none;
          stroke: var(--map-accent);
          stroke-width: 4;
          stroke-linecap: round;
          opacity: .28;
        }
        .map-route {
          fill: none;
          stroke: var(--map-ink);
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-dasharray: 7 8;
          animation: map-route-flow 18s linear infinite;
        }
        @keyframes map-route-flow {
          to {
            stroke-dashoffset: -300;
          }
        }
        .map-point {
          cursor: pointer;
        }
        .map-point-core {
          fill: var(--map-accent);
          stroke: var(--bg-main);
          stroke-width: 5;
          transition: r .45s cubic-bezier(.16,1,.3,1), stroke-width .45s ease;
        }
        .map-point-ring {
          fill: none;
          stroke: var(--map-accent);
          stroke-width: 1.5;
          opacity: .28;
          transition: r .5s cubic-bezier(.16,1,.3,1), opacity .4s ease;
        }
        .map-point[data-active="true"] .map-point-core {
          r: 10;
          stroke-width: 4;
        }
        .map-point[data-active="true"] .map-point-ring {
          r: 23;
          opacity: .65;
          animation: point-pulse 2s ease-out infinite;
        }
        @keyframes point-pulse {
          0% {
            opacity: .7;
            stroke-width: 2;
          }
          100% {
            opacity: 0;
            stroke-width: .5;
            r: 38;
          }
        }
        .map-point-label {
          pointer-events: none;
          fill: var(--text-main);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: -.2px;
          opacity: 0;
          transform: translateY(5px);
          transition: opacity .4s ease, transform .4s ease;
        }
        .map-point[data-active="true"] .map-point-label {
          opacity: .88;
          transform: translateY(0);
        }
        .map-heading {
          position: absolute;
          z-index: 3;
          top: 17px;
          left: 22px;
          color: var(--text-main);
          pointer-events: none;
        }
        .map-heading strong {
          display: block;
          font-size: 12px;
          letter-spacing: .2px;
        }
        .map-heading span {
          display: block;
          margin-top: 3px;
          font-size: 9px;
          letter-spacing: 1.3px;
          opacity: .38;
        }
        .map-route-caption {
          position: absolute;
          z-index: 3;
          right: 22px;
          bottom: 18px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-main);
          font-size: 10px;
          opacity: .52;
          pointer-events: none;
        }
        .map-route-caption i {
          display: block;
          width: 18px;
          height: 1px;
          background: var(--text-main);
          opacity: .6;
        }
        .active-place-info {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          padding: 19px 22px 11px;
        }
        .active-place-name {
          overflow: hidden;
          font-size: 20px;
          font-weight: 750;
          letter-spacing: -.7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .active-place-meta {
          margin-top: 5px;
          color: var(--text-main);
          font-size: 10px;
          opacity: .46;
        }
        .active-place-index {
          flex-shrink: 0;
          color: var(--text-main);
          font-size: 10px;
          letter-spacing: 1px;
          opacity: .4;
        }
        .place-list {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          padding: 7px 22px 20px;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
        }
        .place-list::-webkit-scrollbar {
          display: none;
        }
        .place-item {
          position: relative;
          display: flex;
          min-width: 168px;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          border: 0;
          border-bottom: 1px solid var(--divider);
          background: transparent;
          color: var(--text-main);
          text-align: left;
          cursor: pointer;
          scroll-snap-align: start;
          opacity: .46;
          transition: opacity .35s ease, transform .45s cubic-bezier(.16,1,.3,1), background .35s ease;
        }
        .place-item:hover {
          opacity: .78;
          transform: translateY(-3px);
        }
        .place-item[data-active="true"] {
          border-radius: 16px;
          background: var(--control-soft-bg);
          opacity: 1;
          box-shadow: 0 12px 28px -20px rgba(0,0,0,.35);
        }
        .place-item-mark {
          display: flex;
          width: 26px;
          height: 26px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--booklet-mark-bg, rgba(0,0,0,.06));
          color: var(--text-main);
          transition: background .35s ease, color .35s ease, transform .45s cubic-bezier(.16,1,.3,1);
        }
        .place-item[data-active="true"] .place-item-mark {
          background: var(--accent-color);
          color: var(--accent-foreground);
          transform: scale(1.15);
        }
        .place-item-text {
          min-width: 0;
        }
        .place-item-name {
          overflow: hidden;
          font-size: 11px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .place-item-date {
          margin-top: 3px;
          font-size: 9px;
          opacity: .48;
          white-space: nowrap;
        }
        .place-delete {
          position: absolute;
          top: 4px;
          right: 4px;
          display: flex;
          width: 21px;
          height: 21px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--text-main);
          opacity: 0;
          cursor: pointer;
          transition: opacity .25s ease, color .25s ease, background .25s ease;
        }
        .place-item:hover .place-delete,
        .place-item[data-active="true"] .place-delete {
          opacity: .42;
        }
        .place-delete:hover {
          background: rgba(180,40,40,.12);
          color: #a52e36;
          opacity: 1 !important;
        }
        .empty-state {
          display: flex;
          min-height: 52vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          opacity: .42;
        }
        .empty-state p {
          max-width: 240px;
          line-height: 1.7;
        }
      `}</style>

      <header className="place-booklet-header">
        <button
          type="button"
          onClick={onBack}
          className="place-back-button text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </button>

        <div>
          <div className="place-title">
            {character?.name || '伴侣'} 认识的地方
          </div>
          <div className="place-title-sub">
            Memory atlas · shared places
          </div>
        </div>
      </header>

      <section className="place-content">
        {isLoading && (
          <p className="py-16 text-center text-xs opacity-40">
            正在翻找记忆里的地点...
          </p>
        )}

        {!isLoading && places.length === 0 && (
          <div className="empty-state">
            <MapPin className="h-7 w-7" />
            <p className="font-serif text-xs italic">
              还没有留下足迹，等你们一起走过更多地方吧。
            </p>
          </div>
        )}

        {!isLoading && places.length > 0 && (
          <>
            <div className="map-stage">
              <div className="map-heading">
                <strong>SHARED TERRITORY</strong>
                <span>PLACES WE HAVE KNOWN</span>
              </div>

              <div className="map-route-caption">
                <i />
                <span>memory route</span>
              </div>

              <svg
                className="virtual-map"
                viewBox="0 0 800 480"
                preserveAspectRatio="xMidYMid slice"
                aria-label="地点记忆地图"
              >
                <g className="map-world" transform={mapTransform}>
                  <path
                    className="map-river"
                    d="M-40 350 C80 280 120 350 205 286 S340 178 416 232 S560 330 835 105"
                  />

                  <path
                    className="map-road"
                    d="M-40 120 C115 178 182 82 315 140 S510 315 850 270"
                  />
                  <path
                    className="map-road"
                    d="M70 490 C178 390 218 270 344 244 S580 148 810 -20"
                  />

                  <path
                    className="map-road-thin"
                    d="M0 226 C120 190 188 210 310 188 S550 210 800 150"
                  />
                  <path
                    className="map-road-thin"
                    d="M82 20 C198 100 215 210 274 480"
                  />
                  <path
                    className="map-road-thin"
                    d="M580 0 C522 115 586 224 758 480"
                  />

                  <path
                    className="map-terrain"
                    d="M-30 90 C70 30 170 62 242 30 S382 22 472 64 S672 44 835 92"
                  />
                  <path
                    className="map-terrain"
                    d="M-30 115 C74 55 175 88 250 56 S388 50 478 88 S676 72 835 117"
                  />
                  <path
                    className="map-terrain"
                    d="M-30 145 C80 83 180 118 260 84 S398 80 488 112 S680 104 835 144"
                  />
                  <path
                    className="map-terrain-light"
                    d="M20 386 C108 328 165 370 242 332 S402 290 510 342 S685 385 820 330"
                  />
                  <path
                    className="map-terrain-light"
                    d="M-10 414 C105 355 167 398 250 357 S405 320 520 370 S690 416 840 355"
                  />

                  <path
                    className="map-route"
                    d={mapPoints.length > 1
                      ? mapPoints
                        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
                        .join(' ')
                      : 'M80 300 L220 170 L400 220 L640 120'}
                  />

                  {mapPoints.map((point, index) => (
                    <g
                      key={point.id}
                      className="map-point"
                      data-active={index === activeIndex}
                      onClick={() => setActiveIndex(index)}
                    >
                      <circle
                        className="map-point-ring"
                        cx={point.x}
                        cy={point.y}
                        r={index === activeIndex ? 23 : 13}
                      />
                      <circle
                        className="map-point-core"
                        cx={point.x}
                        cy={point.y}
                        r={index === activeIndex ? 10 : 6}
                      />
                      <text
                        className="map-point-label"
                        x={point.x + 17}
                        y={point.y - 15}
                      >
                        {point.name}
                      </text>
                    </g>
                  ))}
                </g>
              </svg>
            </div>

            {activePlace && (
              <div className="active-place-info">
                <div className="min-w-0">
                  <div className="active-place-name">
                    {activePlace.name}
                  </div>
                  <div className="active-place-meta">
                    到访 {activePlace.visitCount || 1} 次 · 初次到访{' '}
                    {new Date(activePlace.firstVisitAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                <div className="active-place-index">
                  {String(activeIndex + 1).padStart(2, '0')} /{' '}
                  {String(places.length).padStart(2, '0')}
                </div>
              </div>
            )}

            <div className="place-list">
              {mapPoints.map((place, index) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="place-item"
                  data-active={index === activeIndex}
                >
                  <div className="place-item-mark">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>

                  <div className="place-item-text">
                    <div className="place-item-name">{place.name}</div>
                    <div className="place-item-date">
                      最近一次{' '}
                      {new Date(place.lastVisitAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>

                  <span
                    role="button"
                    tabIndex={-1}
                    className="place-delete"
                    title="忘记这个地方"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(place.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default PlaceBooklet;
