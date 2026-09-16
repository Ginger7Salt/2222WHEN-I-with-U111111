import React from 'react';

function WeatherGlyph({ condition, isDay }) {
  const text = `${condition || ''}`.toLowerCase();
  const isRain = /雨|阵雨|雷|rain|storm/i.test(text);
  const isCloudy = /云|阴|cloud|overcast/i.test(text);
  const isSnow = /雪|snow/i.test(text);

  if (isSnow) {
    return (
      <div className="relative h-24 w-28 text-center">
        <div className="absolute left-7 top-1 text-5xl drop-shadow-[0_8px_18px_rgba(120,170,255,.3)]">
          ❄
        </div>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 text-sm text-sky-300/80 animate-pulse">
          <span>·</span><span>·</span><span>·</span>
        </div>
      </div>
    );
  }

  if (isRain) {
    return (
      <div className="relative h-24 w-28">
        <div className="absolute left-4 top-1 text-5xl opacity-90 drop-shadow-[0_8px_20px_rgba(100,150,220,.3)]">
          ☁
        </div>
        <div className="absolute left-7 top-[58px] flex gap-2 text-sky-400/80">
          <span className="animate-pulse">╱</span>
          <span className="mt-2 animate-pulse [animation-delay:180ms]">╱</span>
          <span className="animate-pulse [animation-delay:360ms]">╱</span>
        </div>
      </div>
    );
  }

  if (isCloudy) {
    return (
      <div className="relative h-24 w-28">
        <div className={`absolute left-5 top-0 text-5xl ${isDay ? 'opacity-90' : 'opacity-60'} drop-shadow-[0_8px_20px_rgba(130,160,210,.3)]`}>
          {isDay ? '⛅' : '☁'}
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-3 rounded-full bg-white/10 blur-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative h-24 w-28">
      <div className={`absolute left-5 top-0 text-6xl ${isDay ? 'text-amber-300' : 'text-indigo-200'} drop-shadow-[0_0_24px_rgba(250,200,80,.45)] animate-[pulse_4s_ease-in-out_infinite]`}>
        {isDay ? '☀' : '☾'}
      </div>
      <div className="absolute bottom-0 left-1 right-1 h-5 rounded-full bg-amber-300/10 blur-xl" />
    </div>
  );
}

function WeatherMetric({ icon, label, value }) {
  return (
    <div className="group flex min-w-0 items-center gap-2.5">
      <span className="text-base opacity-70 transition-transform duration-300 group-hover:-translate-y-0.5">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {value || '--'}
        </div>
      </div>
    </div>
  );
}

function getUvLabel(value) {
  if (value === null || value === undefined) return '未知';
  if (value < 3) return '较低';
  if (value < 6) return '中等';
  if (value < 8) return '偏高';
  return '很高';
}

export default function WeatherCard({ card }) {
  if (!card) return null;

  const isDay = card.isDay !== false;
  const uvLabel = getUvLabel(card.uvIndex);

  return (
    <section
      className={[
        'relative isolate my-4 w-full max-w-xl overflow-hidden rounded-[2rem]',
        'bg-gradient-to-br from-sky-100/80 via-white/60 to-amber-50/70',
        'px-6 py-6 text-slate-800 shadow-[0_18px_60px_rgba(75,120,160,.12)]',
        'backdrop-blur-2xl dark:from-slate-800/80 dark:via-slate-900/70 dark:to-indigo-950/80',
        'dark:text-slate-100 dark:shadow-[0_18px_70px_rgba(0,0,0,.28)]'
      ].join(' ')}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl dark:bg-indigo-400/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl dark:bg-blue-500/10" />

      <div className="relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              LIVE ATMOSPHERE
            </div>

            <h3 className="text-2xl font-semibold tracking-tight">
              {card.city}
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {card.daylightText || (isDay ? '白天' : '夜晚')} · {card.condition}
            </p>
          </div>

          <WeatherGlyph condition={card.condition} isDay={isDay} />
        </div>

        <div className="-mt-2 flex items-end gap-3">
          <div className="text-6xl font-extralight tracking-[-0.08em]">
            {card.temperature}
          </div>
          <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            体感 {card.feelsLike}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <WeatherMetric icon="💧" label="湿度" value={card.humidity} />
          <WeatherMetric icon="〰" label="风速" value={card.windSpeed} />
          <WeatherMetric icon="☀" label="紫外线" value={card.uvIndex == null ? '--' : `${card.uvIndex} · ${uvLabel}`} />
          <WeatherMetric icon="◷" label="昼夜" value={`${card.sunrise} / ${card.sunset}`} />
        </div>

        <div className="mt-7 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
          <span>日出 {card.sunrise}</span>
          <span className="text-amber-500/80">·</span>
          <span>日落 {card.sunset}</span>
          <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
        </div>
      </div>
    </section>
  );
}
