import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';

import { listPlaces, deletePlace } from './placeService';

/**
 * 可翻阅的地点小册子：展示某个聊天窗下角色已经"认识"的所有地点，
 * 按最近到访排序，翻阅感 = 一页一个地点。
 *
 * 使用方式与 ParallelOrbit / InnerWorldApp 一致：全屏覆盖 + onBack 返回。
 */
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
      className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col text-xs animate-fade-in-up"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold opacity-85 hover:opacity-100"
          style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </button>

        <span className="ml-1 text-sm font-bold">
          {character?.name || '伴侣'} 认识的地方
        </span>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
        {isLoading && (
          <p className="py-16 text-center opacity-40">正在翻找记忆里的地点...</p>
        )}

        {!isLoading && places.length === 0 && (
          <div className="space-y-2 py-16 text-center opacity-40">
            <MapPin className="mx-auto h-6 w-6" />
            <p className="font-serif text-xs italic">
              还没有留下足迹，等你们一起走过更多地方吧。
            </p>
          </div>
        )}

        {!isLoading && places.length > 0 && (
          <div className="space-y-3">
            {places.map((place, index) => (
              <button
                key={place.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all"
                style={{
                  background: index === activeIndex
                    ? 'var(--accent-color)'
                    : 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: index === activeIndex
                    ? 'var(--accent-foreground)'
                    : 'var(--text-main)',
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: index === activeIndex
                      ? 'rgba(255,255,255,0.25)'
                      : 'var(--accent-color)',
                  }}
                >
                  <MapPin className="h-4 w-4" style={{ color: 'var(--accent-foreground)' }} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{place.name}</p>
                  <p className="truncate text-[10px] opacity-70">
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
                  className="shrink-0 p-1 opacity-50 hover:opacity-100"
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
        <footer
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: 'var(--divider)' }}
        >
          <p className="font-serif text-[11px] italic opacity-70">
            初次到访：{new Date(activePlace.firstVisitAt).toLocaleDateString('zh-CN')}
          </p>
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;