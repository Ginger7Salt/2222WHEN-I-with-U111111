import React from 'react';
import {
  Droplets,
  Wind,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Waves,
} from 'lucide-react';

const WeatherIcon = ({ condition, isDay }) => {
  const text = String(condition || '');

  if (/雨|雷|rain|storm/i.test(text)) {
    return (
      <div className="relative h-24 w-28">
        <div className="absolute left-4 top-0 text-5xl opacity-80">
          ☁
        </div>

        <div className="absolute left-8 top-[58px] flex gap-2 text-sky-400/80">
          <span className="animate-pulse">╱</span>
          <span className="animate-pulse [animation-delay:180ms]">╱</span>
          <span className="animate-pulse [animation-delay:360ms]">╱</span>
        </div>
      </div>
    );
  }

  if (/雪|snow/i.test(text)) {
    return (
      <div className="relative h-24 w-28">
        <div className="absolute left-7 top-0 text-5xl text-sky-200 drop-shadow-[0_0_18px_rgba(125,211,252,.35)]">
          ❄
        </div>

        <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-3 text-sm text-sky-300/80 animate-pulse">
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </div>
      </div>
    );
  }

  if (/云|阴|cloud|overcast/i.test(text)) {
    return (
      <div className="relative h-24 w-28">
        <div className="absolute left-5 top-0 text-5xl opacity-90 drop-shadow-[0_8px_20px_rgba(100,140,190,.28)]">
          {isDay ? '⛅' : '☁'}
        </div>

        <div className="absolute bottom-0 left-2 right-2 h-3 rounded-full bg-sky-400/20 blur-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative h-24 w-28">
      <div
        className={[
          'absolute left-5 top-0 text-6xl',
          isDay
            ? 'text-amber-300 drop-shadow-[0_0_26px_rgba(251,191,36,.5)]'
            : 'text-indigo-200 drop-shadow-[0_0_22px_rgba(165,180,252,.4)]',
          'animate-[pulse_4s_ease-in-out_infinite]',
        ].join(' ')}
      >
        {isDay ? '☀' : '☾'}
      </div>

      <div className="absolute bottom-0 left-1 right-1 h-5 rounded-full bg-amber-300/10 blur-xl" />
    </div>
  );
};

const WeatherMetric = ({ icon: Icon, label, value }) => (
  <div className="group flex min-w-0 items-center gap-2.5">
    <Icon className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-300 group-hover:-translate-y-0.5" />

    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] opacity-45">
        {label}
      </div>

      <div className="truncate text-sm font-medium opacity-85">
        {value || '--'}
      </div>
    </div>
  </div>
);

const getUvLabel = (value) => {
  if (value === null || value === undefined) return '未知';
  if (value < 3) return '较低';
  if (value < 6) return '中等';
  if (value < 8) return '偏高';
  return '很高';
};

const WeatherCard = ({ card }) => {
  if (!card) return null;

  const isDay = card.isDay !== false;
  const uvText = card.uvIndex == null
    ? '--'
    : `${card.uvIndex} · ${getUvLabel(card.uvIndex)}`;

  return (
    <section
      className={[
        'relative isolate my-3 w-full max-w-xl overflow-hidden',
        'rounded-[2rem] px-6 py-6',
        'bg-gradient-to-br from-sky-100/80 via-white/65 to-amber-50/70',
        'text-slate-800 shadow-[0_18px_60px_rgba(75,120,160,.12)]',
        'backdrop-blur-2xl',
        'dark:from-slate-800/85 dark:via-slate-900/75 dark:to-indigo-950/85',
        'dark:text-slate-100 dark:shadow-[0_18px_70px_rgba(0,0,0,.28)]',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-sky-300/20 blur-3xl dark:bg-indigo-400/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-amber-200/30 blur-3xl dark:bg-blue-500/10" />

      <div className="relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] tracking-[0.2em] opacity-50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>

              LIVE ATMOSPHERE
            </div>

            <h3 className="text-2xl font-semibold tracking-tight">
              {card.city}
            </h3>

            <p className="mt-1 text-sm opacity-55">
              {card.daylightText || (isDay ? '白天' : '夜晚')}
              <span className="mx-1.5 opacity-50">·</span>
              {card.condition}
            </p>
          </div>

          <WeatherIcon
            condition={card.condition}
            isDay={isDay}
          />
        </div>

        <div className="-mt-1 flex items-end gap-3">
          <div className="text-6xl font-extralight tracking-[-0.08em]">
            {card.temperature}
          </div>

          <div className="mb-2 text-xs opacity-55">
            体感 {card.feelsLike}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
          <WeatherMetric
            icon={Droplets}
            label="湿度"
            value={card.humidity}
          />

          <WeatherMetric
            icon={Wind}
            label="风速"
            value={card.windSpeed}
          />

          <WeatherMetric
            icon={Sun}
            label="紫外线"
            value={uvText}
          />

          <WeatherMetric
            icon={Waves}
            label="昼夜"
            value={`${card.sunrise} / ${card.sunset}`}
          />
        </div>

        <div className="mt-7 flex items-center gap-3 text-xs opacity-50">
          <Sunrise className="h-3.5 w-3.5 text-amber-500/80" />
          <span>{card.sunrise}</span>

          <div className="h-px flex-1 bg-current opacity-15" />

          <Sunset className="h-3.5 w-3.5 text-indigo-400/80" />
          <span>{card.sunset}</span>
        </div>
      </div>
    </section>
  );
};

export default React.memo(WeatherCard);
