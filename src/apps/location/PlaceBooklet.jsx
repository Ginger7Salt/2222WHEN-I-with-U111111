import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';

import { listPlaces, deletePlace } from './placeService';

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
  const longitude = Number(place?.longitude ?? place?.lng ?? place?.lon);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
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

  const mapPlaces = places.map((place, index) => ({
    place,
    index,
    point: getMapPoint(place, index),
  }));

  const activePoint = mapPlaces[activeIndex]?.point || { x: 500, y: 310 };

  const mapOffsetX = 500 - activePoint.x * 1.34;
  const mapOffsetY = 310 - activePoint.y * 1.34;

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

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
          --map-land: #e8e9e5;
          --map-land-dark: #d7d9d3;
          --map-water: #cbdce0;
          --map-accent: var(--accent-color);
          --map-line: rgba(20,22,28,.13);
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
          background: var(--map-land);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.65),
            0 24px 50px -32px rgba(0,0,0,.42);
          isolation: isolate;
        }
        .map-frame::before {
          content: "";
          position: absolute;
          z-index: 3;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 60px rgba(25,28,30,.12);
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
        .map-grid {
          opacity: .32;
        }
        .map-road {
          fill: none;
          stroke: var(--map-road);
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .map-road.main {
          stroke-width: 10;
          opacity: .86;
        }
        .map-road.secondary {
          stroke-width: 4;
          opacity: .7;
        }
        .map-road.small {
          stroke-width: 2;
          opacity: .58;
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
          0% { opacity: .55; transform: scale(.65); }
          70%, 100% { opacity: 0; transform: scale(1.8); }
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
        .place-delete {
          display: flex;
          width: 28px;
          height: 28px;
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

                  <filter id="softShadow">
                    <feDropShadow
                      dx="0"
                      dy="8"
                      stdDeviation="10"
                      floodColor="#5e6e70"
                      floodOpacity=".18"
                    />
                  </filter>
                </defs>

                <rect width="1000" height="620" fill="#e7e8e3" />

                <g className="map-world">
                  <rect
                    className="map-grid"
                    x="0"
                    y="0"
                    width="1000"
                    height="620"
                    fill="url(#mapGrid)"
                  />

                  <path
                    d="M-80 110 C100 35 205 130 330 80 S570 30 690 120 S865 170 1090 70 L1090 0 L-80 0Z"
                    fill="#c9dce0"
                  />
                  <path
                    d="M-80 110 C100 35 205 130 330 80 S570 30 690 120 S865 170 1090 70"
                    fill="none"
                    stroke="#a9c8cd"
                    strokeWidth="7"
                    opacity=".7"
                  />

                  <path
                    d="M-50 505 C110 430 215 540 355 490 S590 430 720 520 S890 560 1060 470 L1060 650 L-50 650Z"
                    fill="#d4dccd"
                  />

                  <path
                    d="M90 30 C170 150 100 250 190 355 S235 545 155 680"
                    fill="none"
                    stroke="#c0c9ba"
                    strokeWidth="48"
                    opacity=".7"
                  />
                  <path
                    d="M770 -30 C700 95 820 205 730 315 S665 510 770 660"
                    fill="none"
                    stroke="#d2d7cd"
                    strokeWidth="65"
                    opacity=".9"
                  />

                  <g opacity=".9">
                    <path className="map-road main" d="M-30 180 C180 210 280 165 430 230 S735 305 1030 230" />
                    <path className="map-road main" d="M35 -30 C180 125 250 250 335 650" />
                    <path className="map-road main" d="M960 -30 C820 115 790 270 930 650" />

                    <path className="map-road secondary" d="M-20 285 C160 245 330 290 490 335 S810 410 1035 345" />
                    <path className="map-road secondary" d="M150 -20 C220 130 420 185 580 245 S820 520 870 660" />
                    <path className="map-road secondary" d="M-30 430 C180 355 260 380 430 470 S760 550 1040 450" />
                    <path className="map-road secondary" d="M520 -30 C465 100 505 220 470 340 S510 525 470 660" />

                    <path className="map-road small" d="M20 110 L330 155 L450 105 L700 155 L980 105" />
                    <path className="map-road small" d="M50 245 L220 205 L360 275 L520 250 L700 300 L950 260" />
                    <path className="map-road small" d="M35 350 L180 315 L300 365 L470 320 L650 390 L900 355" />
                    <path className="map-road small" d="M120 530 L260 440 L410 510 L590 430 L770 485 L960 400" />
                    <path className="map-road small" d="M270 0 L320 180 L290 330 L350 620" />
                    <path className="map-road small" d="M620 0 L590 150 L650 280 L605 450 L650 620" />
                  </g>

                  <g opacity=".38" fill="none" stroke="#8f9a90" strokeWidth="2">
                    <path d="M80 130 C170 105 235 120 300 160 S430 205 520 170" />
                    <path d="M110 145 C190 125 250 140 310 178 S420 220 500 190" />
                    <path d="M590 430 C690 385 800 400 890 445" />
                    <path d="M570 450 C680 410 790 425 900 470" />
                  </g>

                  {routePoints && (
                    <polyline
                      points={routePoints}
                      fill="none"
                      stroke="var(--accent-color)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="10 9"
                      opacity=".8"
                    />
                  )}

                  {mapPlaces.map(({ place, index, point }) => {
                    const isActive = index === activeIndex;

                    return (
                      <g
                        key={place.id}
                        className={`map-marker ${isActive ? 'active' : ''}`}
                        transform={`translate(${point.x} ${point.y})`}
                        onClick={() => setActiveIndex(index)}
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
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`place-row ${index === activeIndex ? 'active' : ''}`}
                >
                  <div className="place-row-marker">
                    <MapPin className="h-4 w-4" />
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
