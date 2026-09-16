import React, { useEffect, useState } from 'react';
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

  return (
    <div
      className="place-booklet fixed inset-0 z-50 flex h-[100dvh] w-full flex-col animate-fade-in-up"
      style={{
        background: `
          radial-gradient(circle at 82% 4%, rgba(150,150,170,0.14), transparent 30%),
          radial-gradient(circle at 8% 72%, rgba(0,0,0,0.07), transparent 34%),
          var(--bg-main)
        `,
        color: 'var(--text-main)',
      }}
    >
      <style>{`
        .place-booklet {
          --booklet-line: rgba(0,0,0,0.09);
          --booklet-soft: rgba(255,255,255,0.58);
          --booklet-soft-dark: rgba(0,0,0,0.055);
          --booklet-shadow: 0 18px 42px -24px rgba(0,0,0,0.28);
          isolation: isolate;
          overflow: hidden;
        }
        .place-booklet *,
        .place-booklet *::before,
        .place-booklet *::after {
          box-sizing: border-box;
        }
        .place-booklet-header {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px 22px 14px;
        }
        .place-booklet-header::after {
          content: "";
          position: absolute;
          left: 22px;
          right: 22px;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--booklet-line), transparent);
        }
        .place-back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 2px;
          border: 0;
          background: transparent;
          color: var(--text-main);
          opacity: .62;
          cursor: pointer;
          transition: opacity .25s ease, transform .25s ease;
        }
        .place-back-button:hover {
          opacity: 1;
          transform: translateX(-3px);
        }
        .place-booklet-title {
          min-width: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -.35px;
        }
        .place-booklet-title small {
          display: block;
          margin-top: 3px;
          color: var(--text-main);
          opacity: .38;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .place-booklet-content {
          position: relative;
          z-index: 1;
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          padding: 26px 22px 120px;
          scrollbar-width: none;
        }
        .place-booklet-content::-webkit-scrollbar {
          display: none;
        }
        .place-empty-state {
          display: flex;
          min-height: 52vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-main);
          opacity: .42;
          text-align: center;
        }
        .place-empty-state svg {
          opacity: .72;
        }
        .place-empty-state p {
          max-width: 230px;
          line-height: 1.7;
        }
        .place-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .place-entry {
          position: relative;
          display: flex;
          width: 100%;
          align-items: center;
          gap: 14px;
          padding: 15px 5px 15px 0;
          border: 0;
          border-bottom: 1px solid var(--booklet-line);
          background: transparent;
          color: var(--text-main);
          text-align: left;
          cursor: pointer;
          transition: padding .4s cubic-bezier(.16,1,.3,1), opacity .3s ease, transform .3s ease;
        }
        .place-entry::before {
          content: "";
          position: absolute;
          top: 11px;
          bottom: 11px;
          left: -22px;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: var(--accent-color);
          opacity: 0;
          transform: scaleY(.45);
          transition: opacity .35s ease, transform .35s cubic-bezier(.16,1,.3,1);
        }
        .place-entry:hover {
          padding-left: 5px;
          transform: translateX(3px);
        }
        .place-entry[data-active="true"] {
          padding-top: 19px;
          padding-bottom: 19px;
        }
        .place-entry[data-active="true"]::before {
          opacity: 1;
          transform: scaleY(1);
        }
        .place-entry-mark {
          display: flex;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--booklet-soft-dark);
          color: var(--text-main);
          transition: background .35s ease, color .35s ease, transform .35s ease;
        }
        .place-entry:hover .place-entry-mark {
          transform: rotate(-8deg) scale(1.05);
        }
        .place-entry[data-active="true"] .place-entry-mark {
          background: var(--accent-color);
          color: var(--accent-foreground);
          box-shadow: 0 8px 22px -8px var(--accent-color);
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
          margin-top: 5px;
          overflow: hidden;
          color: var(--text-main);
          font-size: 10px;
          opacity: .48;
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
          opacity: .25;
          cursor: pointer;
          transition: opacity .25s ease, background .25s ease, color .25s ease;
        }
        .place-delete-button:hover {
          background: rgba(180,45,45,.1);
          color: #a52e36;
          opacity: 1;
        }
        .place-booklet-footer {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          padding: 15px 22px 23px;
          background: linear-gradient(180deg, transparent, var(--bg-main) 35%);
        }
        .place-booklet-footer::before {
          content: "";
          display: block;
          width: 34px;
          height: 2px;
          margin-bottom: 11px;
          border-radius: 2px;
          background: var(--accent-color);
          opacity: .7;
        }
        .place-booklet-footer p {
          color: var(--text-main);
          font-size: 10px;
          letter-spacing: .1px;
          opacity: .48;
        }
        @media (prefers-reduced-motion: reduce) {
          .place-booklet *,
          .place-booklet *::before,
          .place-booklet *::after {
            transition-duration: .01ms !important;
            animation-duration: .01ms !important;
          }
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
                  <MapPin className="h-[17px] w-[17px]" />
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
        )}
      </section>

      {activePlace && (
        <footer className="place-booklet-footer">
          <p className="font-serif italic">
            初次到访：{new Date(activePlace.firstVisitAt).toLocaleDateString('zh-CN')}
          </p>
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;
