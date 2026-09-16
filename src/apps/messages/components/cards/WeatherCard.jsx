import React from 'react';
import {
  Droplets,
  Wind,
  Sunrise,
  Sunset,
  Gauge,
  Umbrella,
} from 'lucide-react';

const getWeatherType = (condition, isDay) => {
  const text = String(condition || '').toLowerCase();

  if (!isDay) return 'night';
  if (/雷|雷雨|storm|thunder/i.test(text)) return 'storm';
  if (/雨|阵雨|小雨|中雨|大雨|暴雨|rain|shower/i.test(text)) return 'rain';
  if (/雪|雨夹雪|snow/i.test(text)) return 'snow';
  if (/阴|阴天|overcast/i.test(text)) return 'overcast';
  if (/云|多云|少云|cloud/i.test(text)) return 'cloudy';

  return 'clear';
};

const weatherTheme = {
  clear: {
    shell: 'from-[#4c9ccc] via-[#75bddb] to-[#e7b56e] dark:from-[#1c5275] dark:via-[#286c8e] dark:to-[#875b37]',
    glow: 'bg-amber-200/35 dark:bg-amber-200/15',
    text: 'text-white',
    muted: 'text-white/65',
    soft: 'bg-white/[0.12]',
  },
  cloudy: {
    shell: 'from-[#527d99] via-[#759eaf] to-[#bca982] dark:from-[#263f55] dark:via-[#365a6d] dark:to-[#604f40]',
    glow: 'bg-slate-100/25 dark:bg-sky-200/10',
    text: 'text-white',
    muted: 'text-white/65',
    soft: 'bg-white/[0.12]',
  },
  overcast: {
    shell: 'from-[#607f91] via-[#829ba5] to-[#9d9e9a] dark:from-[#283b48] dark:via-[#384f5c] dark:to-[#4c4c4a]',
    glow: 'bg-white/20 dark:bg-slate-200/10',
    text: 'text-white',
    muted: 'text-white/65',
    soft: 'bg-white/[0.12]',
  },
  rain: {
    shell: 'from-[#3d5c76] via-[#55738b] to-[#626f7b] dark:from-[#162638] dark:via-[#213d54] dark:to-[#303a43]',
    glow: 'bg-sky-200/15 dark:bg-sky-300/10',
    text: 'text-white',
    muted: 'text-white/60',
    soft: 'bg-white/[0.1]',
  },
  storm: {
    shell: 'from-[#293952] via-[#414e6a] to-[#4d4c5b] dark:from-[#111827] dark:via-[#202b45] dark:to-[#312c43]',
    glow: 'bg-violet-200/20 dark:bg-violet-300/10',
    text: 'text-white',
    muted: 'text-white/60',
    soft: 'bg-white/[0.1]',
  },
  snow: {
    shell: 'from-[#759bb3] via-[#a8c5d1] to-[#d3d5d0] dark:from-[#263f56] dark:via-[#486b80] dark:to-[#6f7780]',
    glow: 'bg-white/35 dark:bg-blue-100/10',
    text: 'text-white',
    muted: 'text-white/70',
    soft: 'bg-white/[0.15]',
  },
  night: {
    shell: 'from-[#172743] via-[#293b63] to-[#172033] dark:from-[#0b1224] dark:via-[#151e3b] dark:to-[#080c18]',
    glow: 'bg-indigo-200/20 dark:bg-indigo-300/10',
    text: 'text-white',
    muted: 'text-white/60',
    soft: 'bg-white/[0.1]',
  },
};

const Cloud = ({ className = '', opacity = 1 }) => (
  <path
    className={className}
    opacity={opacity}
    d="M34 78h105c16 0 29-11 29-26 0-15-12-26-27-27-6-22-25-37-48-37-23 0-42 14-49 36C25 25 10 38 10 54c0 14 10 24 24 24Z"
  />
);

const WeatherIllustration = ({ type }) => {
  if (type === 'night') {
    return (
      <svg
        viewBox="0 0 220 190"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx="107"
          cy="80"
          r="42"
          fill="#dbe7ff"
          className="drop-shadow-[0_0_22px_rgba(190,210,255,.65)]"
        />
        <circle cx="128" cy="63" r="42" fill="#24365d" />
        <circle cx="47" cy="47" r="3" fill="#e5edff" className="animate-pulse" />
        <circle
          cx="170"
          cy="45"
          r="2.5"
          fill="#e5edff"
          className="animate-pulse [animation-delay:500ms]"
        />
        <circle
          cx="164"
          cy="112"
          r="3"
          fill="#e5edff"
          className="animate-pulse [animation-delay:900ms]"
        />
        <circle
          cx="55"
          cy="125"
          r="2"
          fill="#e5edff"
          className="animate-pulse [animation-delay:1200ms]"
        />
      </svg>
    );
  }

  if (type === 'clear') {
    return (
      <svg
        viewBox="0 0 220 190"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <g
          stroke="#ffe7a1"
          strokeLinecap="round"
          strokeWidth="5"
          opacity=".8"
          className="animate-[spin_24s_linear_infinite]"
          style={{ transformOrigin: '110px 86px' }}
        >
          <path d="M110 12v23M110 137v23M36 86h23M161 86h23M57 33l17 17M146 122l17 17M163 33l-17 17M74 122l-17 17" />
        </g>
        <circle
          cx="110"
          cy="86"
          r="39"
          fill="#ffdf8b"
          className="drop-shadow-[0_0_25px_rgba(255,213,110,.7)]"
        />
      </svg>
    );
  }

  if (type === 'rain' || type === 'storm') {
    return (
      <svg
        viewBox="0 0 220 210"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <Cloud fill="#b6cad3" opacity=".54" transform="translate(9 5)" />
        <Cloud fill="#eef6f8" opacity=".88" />
        <g
          stroke={type === 'storm' ? '#f9d98d' : '#b6e1fa'}
          strokeLinecap="round"
          strokeWidth="4"
        >
          <path d="M66 112l-9 21" className="animate-pulse" />
          <path d="M98 112l-9 25" className="animate-pulse [animation-delay:180ms]" />
          <path d="M130 112l-9 21" className="animate-pulse [animation-delay:360ms]" />
          <path d="M162 112l-9 25" className="animate-pulse [animation-delay:540ms]" />
        </g>
        {type === 'storm' && (
          <path
            d="M119 135l-18 31h15l-8 27 27-38h-16l12-20Z"
            fill="#ffe09c"
            className="drop-shadow-[0_0_10px_rgba(255,220,130,.55)]"
          />
        )}
      </svg>
    );
  }

  if (type === 'snow') {
    return (
      <svg
        viewBox="0 0 220 200"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <Cloud fill="#d6e6ec" opacity=".65" transform="translate(8 5)" />
        <Cloud fill="#f6fbfc" opacity=".92" />
        <g fill="#e8f7ff" className="animate-pulse">
          <circle cx="67" cy="137" r="4" />
          <circle cx="99" cy="154" r="3.5" />
          <circle cx="131" cy="137" r="4" />
          <circle cx="162" cy="154" r="3.5" />
        </g>
      </svg>
    );
  }

  if (type === 'overcast') {
    return (
      <svg
        viewBox="0 0 220 190"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <Cloud fill="#d4e0e4" opacity=".5" transform="translate(7 6)" />
        <Cloud fill="#f0f5f5" opacity=".85" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 220 190"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <circle
        cx="78"
        cy="60"
        r="28"
        fill="#ffdf8b"
        className="drop-shadow-[0_0_18px_rgba(255,215,120,.55)]"
      />
      <Cloud fill="#d3e4e9" opacity=".58" transform="translate(10 7)" />
      <Cloud fill="#f2f8f9" opacity=".9" />
    </svg>
  );
};

const Metric = ({ icon: Icon, label, value }) => (
  <div className="min-w-0">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.7} />
      <span className="truncate text-[11px] tracking-wide opacity-60">
        {label}
      </span>
    </div>
    <div className="mt-2 truncate text-sm font-medium tracking-tight">
      {value || '--'}
    </div>
  </div>
);

const getUvText = (uvIndex) => {
  if (uvIndex === null || uvIndex === undefined) return '--';

  const value = Number(uvIndex);

  if (!Number.isFinite(value)) return String(uvIndex);
  if (value < 3) return `${value} 低`;
  if (value < 6) return `${value} 中等`;
  if (value < 8) return `${value} 偏高`;

  return `${value} 很高`;
};

const WeatherCard = ({ card }) => {
  if (!card) return null;

  const type = getWeatherType(card.condition, card.isDay);
  const theme = weatherTheme[type];

  const isDay = card.isDay !== false;
  const dayText = card.daylightText || (isDay ? '白天' : '夜晚');

  return (
    <section
      className={[
        'relative isolate my-3 w-full max-w-2xl min-w-0 overflow-hidden',
        'rounded-[28px] bg-gradient-to-br',
        theme.shell,
        theme.text,
        'shadow-[0_18px_55px_rgba(30,65,90,.18)]',
        'dark:shadow-[0_20px_70px_rgba(0,0,0,.3)]',
      ].join(' ')}
      aria-label={`${card.city}天气`}
    >
      <div
        className={[
          'pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl',
          theme.glow,
        ].join(' ')}
      />

      <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-black/10 blur-3xl" />

      <div className="relative px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 opacity-75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.2" />
            </svg>

            <h3 className="truncate text-base font-semibold tracking-tight">
              {card.city}
            </h3>
          </div>

          <div className="shrink-0 text-[10px] tracking-[0.14em] opacity-50">
            LIVE WEATHER
          </div>
        </header>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(130px,42%)] items-center gap-2 sm:gap-5">
          <div className="min-w-0">
            <div className={`text-xs ${theme.muted}`}>
              {dayText}
            </div>

            <div className="mt-3 whitespace-nowrap text-[clamp(3.8rem,16vw,6rem)] font-extralight leading-[.9] tracking-[-0.1em]">
              {card.temperature}
            </div>

            <div className="mt-4 truncate text-lg font-medium">
              {card.condition}
            </div>

            <div className={`mt-1 text-xs ${theme.muted}`}>
              体感温度 {card.feelsLike}
            </div>
          </div>

          <div className="h-36 w-full sm:h-48">
            <WeatherIllustration type={type} />
          </div>
        </div>

        <div
          className={[
            'mt-5 grid grid-cols-2 gap-x-5 gap-y-5 rounded-2xl px-4 py-4',
            theme.soft,
            'sm:grid-cols-4 sm:gap-x-4 sm:px-5',
          ].join(' ')}
        >
          <Metric
            icon={Droplets}
            label="相对湿度"
            value={card.humidity}
          />

          <Metric
            icon={Wind}
            label="风速"
            value={card.windSpeed}
          />

          <Metric
            icon={Gauge}
            label="紫外线指数"
            value={getUvText(card.uvIndex)}
          />

          <Metric
            icon={Umbrella}
            label="体感状态"
            value={type === 'rain' || type === 'storm' ? '注意降雨' : '适宜外出'}
          />
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-[11px]">
            <span className="opacity-60">今日天空变化</span>
            <span className="opacity-45">
              {card.sunrise} — {card.sunset}
            </span>
          </div>

          <div className="relative h-8">
            <div className="absolute left-1 right-1 top-3 h-px bg-white/30" />

            <div className="absolute left-0 top-0 flex flex-col items-start gap-1">
              <Sunrise className="h-4 w-4 text-amber-200/90" strokeWidth={1.7} />
              <span className="text-[10px] opacity-60">
                {card.sunrise}
              </span>
            </div>

            <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
              <Sunset className="h-4 w-4 text-indigo-100/80" strokeWidth={1.7} />
              <span className="text-[10px] opacity-60">
                {card.sunset}
              </span>
            </div>

            <div className="absolute left-1/2 top-[9px] h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,.8)]" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default React.memo(WeatherCard);

