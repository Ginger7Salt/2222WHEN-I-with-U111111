import React, { useMemo, useState } from 'react';
import {
  Droplets,
  Wind,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Gauge,
  Thermometer,
  Umbrella,
  Sparkles,
} from 'lucide-react';

const getWeatherType = (condition = '', isDay = true) => {
  const text = String(condition).toLowerCase();

  if (!isDay) return 'night';
  if (/雷|暴雨|storm|thunder/i.test(text)) return 'storm';
  if (/雨|阵雨|rain|shower/i.test(text)) return 'rain';
  if (/雪|snow/i.test(text)) return 'snow';
  if (/云|阴|cloud|overcast/i.test(text)) return 'cloudy';

  return 'clear';
};

const weatherThemes = {
  clear: {
    shell: 'from-[#5da8d0] via-[#82c3df] to-[#e5b66f] dark:from-[#245274] dark:via-[#397899] dark:to-[#805c3f]',
    glow: 'bg-amber-200/40 dark:bg-amber-300/15',
    subGlow: 'bg-sky-200/30 dark:bg-sky-300/10',
    accent: 'text-amber-100',
    softAccent: 'bg-amber-100/15',
    label: '晴朗天空',
  },
  cloudy: {
    shell: 'from-[#6e9bb2] via-[#8eafbd] to-[#c5a879] dark:from-[#344f63] dark:via-[#4c6a79] dark:to-[#665646]',
    glow: 'bg-white/25 dark:bg-slate-200/10',
    subGlow: 'bg-sky-100/25 dark:bg-sky-300/10',
    accent: 'text-slate-50',
    softAccent: 'bg-white/15',
    label: '云层缓慢移动',
  },
  rain: {
    shell: 'from-[#405b73] via-[#55778e] to-[#5c6771] dark:from-[#1e3043] dark:via-[#273f52] dark:to-[#303942]',
    glow: 'bg-sky-200/20 dark:bg-sky-300/10',
    subGlow: 'bg-blue-300/20 dark:bg-blue-400/10',
    accent: 'text-sky-100',
    softAccent: 'bg-sky-100/10',
    label: '降雨天气',
  },
  storm: {
    shell: 'from-[#29384e] via-[#394b61] to-[#4c4a55] dark:from-[#111827] dark:via-[#1e293b] dark:to-[#312e37]',
    glow: 'bg-indigo-200/20 dark:bg-indigo-300/10',
    subGlow: 'bg-purple-300/15 dark:bg-purple-400/10',
    accent: 'text-indigo-100',
    softAccent: 'bg-indigo-100/10',
    label: '雷暴天气',
  },
  snow: {
    shell: 'from-[#7395ad] via-[#a6c2d0] to-[#d1d7d2] dark:from-[#294153] dark:via-[#415e70] dark:to-[#53626a]',
    glow: 'bg-white/35 dark:bg-sky-100/10',
    subGlow: 'bg-sky-100/30 dark:bg-sky-200/10',
    accent: 'text-sky-50',
    softAccent: 'bg-white/15',
    label: '降雪天气',
  },
  night: {
    shell: 'from-[#172343] via-[#29385f] to-[#111827] dark:from-[#0b1124] dark:via-[#131d3d] dark:to-[#090d18]',
    glow: 'bg-indigo-300/25 dark:bg-indigo-400/15',
    subGlow: 'bg-blue-300/15 dark:bg-blue-400/10',
    accent: 'text-indigo-100',
    softAccent: 'bg-indigo-100/10',
    label: '夜间天空',
  },
};

function SunIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <g
        className="origin-center animate-[spin_28s_linear_infinite]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
        opacity=".72"
      >
        <path d="M50 7v13M50 80v13M7 50h13M80 50h13M20 20l9 9M71 71l9 9M80 20l-9 9M29 71l-9 9" />
      </g>
      <circle
        cx="50"
        cy="50"
        r="25"
        fill="currentColor"
        className="drop-shadow-[0_0_18px_rgba(255,225,140,.65)]"
      />
    </svg>
  );
}

function MoonIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="47"
        cy="48"
        r="28"
        fill="currentColor"
        className="drop-shadow-[0_0_18px_rgba(190,205,255,.65)]"
      />
      <circle cx="62" cy="37" r="28" fill="#263657" />
      <circle cx="27" cy="29" r="2.5" fill="currentColor" opacity=".8" />
      <circle cx="76" cy="68" r="2" fill="currentColor" opacity=".7" />
    </svg>
  );
}

function CloudIcon({ rain = false, snow = false, className = '' }) {
  return (
    <svg
      viewBox="0 0 180 150"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M38 108h103c16 0 28-11 28-26 0-15-12-26-27-26-6-21-24-35-46-35-22 0-40 13-47 33-18 1-31 14-31 30 0 14 8 24 20 24Z"
        fill="rgba(221,239,246,.48)"
        transform="translate(4 7)"
      />

      <path
        d="M35 112h105c16 0 28-11 28-26 0-15-11-26-27-26-6-21-24-35-46-35-21 0-39 13-46 33-17 1-30 14-30 30 0 14 7 24 16 24Z"
        fill="rgba(246,250,251,.9)"
        className="drop-shadow-[0_12px_15px_rgba(38,72,94,.18)]"
      />

      {rain && (
        <g
          fill="none"
          stroke="rgba(165,218,244,.92)"
          strokeLinecap="round"
          strokeWidth="3"
        >
          <path className="animate-[pulse_1.5s_ease-in-out_infinite]" d="m57 124-6 14" />
          <path className="animate-[pulse_1.5s_.25s_ease-in-out_infinite]" d="m83 124-6 14" />
          <path className="animate-[pulse_1.5s_.5s_ease-in-out_infinite]" d="m109 124-6 14" />
          <path className="animate-[pulse_1.5s_.75s_ease-in-out_infinite]" d="m135 124-6 14" />
        </g>
      )}

      {snow && (
        <g
          fill="none"
          stroke="rgba(232,246,255,.9)"
          strokeLinecap="round"
          strokeWidth="2"
        >
          <path d="M58 130v12M52 136h12M54 132l8 8M62 132l-8 8" />
          <path d="M91 130v12M85 136h12M87 132l8 8M95 132l-8 8" />
          <path d="M124 130v12M118 136h12M120 132l8 8M128 132l-8 8" />
        </g>
      )}
    </svg>
  );
}

function WeatherVisual({ type }) {
  if (type === 'clear') {
    return <SunIcon className="h-36 w-36 text-amber-100 sm:h-40 sm:w-40" />;
  }

  if (type === 'night') {
    return (
      <div className="relative h-40 w-40">
        <div className="absolute inset-0 animate-[pulse_4s_ease-in-out_infinite]">
          <MoonIcon className="h-full w-full text-indigo-100" />
        </div>

        <span className="absolute left-3 top-5 h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-100/80" />
        <span className="absolute right-5 top-10 h-1 w-1 animate-pulse rounded-full bg-indigo-100/70 [animation-delay:500ms]" />
        <span className="absolute bottom-8 left-5 h-1 w-1 animate-pulse rounded-full bg-indigo-100/70 [animation-delay:900ms]" />
      </div>
    );
  }

  return (
    <div className="relative h-40 w-44">
      {(type === 'cloudy' || type === 'snow') && (
        <div className="absolute -left-1 -top-5 opacity-75">
          <SunIcon className="h-20 w-20 text-amber-100/80" />
        </div>
      )}

      <CloudIcon
        rain={type === 'rain' || type === 'storm'}
        snow={type === 'snow'}
        className="absolute bottom-0 right-0 h-36 w-44"
      />

      {type === 'storm' && (
        <svg
          viewBox="0 0 40 60"
          className="absolute bottom-0 left-20 h-16 w-10 text-amber-200 drop-shadow-[0_0_10px_rgba(253,230,138,.7)]"
          aria-hidden="true"
        >
          <path
            d="M25 2 5 34h13L12 58l23-35H21Z"
            fill="currentColor"
          />
        </svg>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon
        className={[
          'h-4 w-4 shrink-0',
          accent ? 'opacity-90' : 'opacity-55',
        ].join(' ')}
      />

      <div className="min-w-0">
        <div className="truncate text-[10px] tracking-[.12em] opacity-50">
          {label}
        </div>
        <div className="truncate text-sm font-medium opacity-90">
          {value || '--'}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative whitespace-nowrap px-3 py-2 text-xs transition-all duration-300',
        active
          ? 'font-semibold opacity-100'
          : 'opacity-50 hover:opacity-80',
      ].join(' ')}
    >
      {children}

      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-current" />
      )}
    </button>
  );
}

function OverviewPanel({ card, type, theme }) {
  const isDay = card.isDay !== false;

  return (
    <div className="grid min-h-[226px] grid-cols-1 gap-6 sm:grid-cols-[1.15fr_.85fr] sm:gap-8">
      <div className="flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] opacity-60">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            实时天气
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="text-[clamp(4rem,12vw,6.5rem)] font-extralight leading-[.82] tracking-[-.1em]">
              {card.temperature.replace(/°C|℃/g, '')}
            </div>

            <div className="pt-1 text-xl font-light opacity-70">
              °C
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-lg font-medium">
              {card.condition}
            </span>

            <span className="h-1 w-1 rounded-full bg-current opacity-40" />

            <span className="text-xs opacity-60">
              体感 {card.feelsLike}
            </span>
          </div>
        </div>

        <div className="mt-7 flex items-center gap-2 text-xs opacity-60">
          {isDay ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}

          <span>{card.daylightText || (isDay ? '白天' : '夜晚')}</span>
          <span className="opacity-40">·</span>
          <span>{theme.label}</span>
        </div>
      </div>

      <div className="relative flex min-h-[170px] items-center justify-center sm:min-h-0">
        <div
          className={[
            'absolute h-40 w-40 rounded-full blur-3xl',
            theme.glow,
          ].join(' ')}
        />

        <WeatherVisual type={type} />
      </div>
    </div>
  );
}

function EnvironmentPanel({ card }) {
  const uvLabel = card.uvIndex == null
    ? '未知'
    : card.uvIndex < 3
      ? '较低'
      : card.uvIndex < 6
        ? '中等'
        : card.uvIndex < 8
          ? '偏高'
          : '很高';

  return (
    <div className="grid min-h-[226px] grid-cols-2 gap-x-8 gap-y-8 py-2 sm:grid-cols-4 sm:gap-x-5">
      <Metric
        icon={Thermometer}
        label="当前温度"
        value={card.temperature}
        accent
      />

      <Metric
        icon={Thermometer}
        label="体感温度"
        value={card.feelsLike}
      />

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
        icon={Sun}
        label="紫外线指数"
        value={card.uvIndex == null ? '--' : `${card.uvIndex} · ${uvLabel}`}
      />

      <Metric
        icon={Gauge}
        label="天气状态"
        value={card.condition}
      />

      <Metric
        icon={Umbrella}
        label="出行建议"
        value={/雨|雪|雷/.test(card.condition) ? '建议携带雨具' : '适宜外出'}
      />

      <Metric
        icon={Sparkles}
        label="舒适度"
        value={Number.parseFloat(card.feelsLike) < 30 ? '体感舒适' : '注意防暑'}
      />
    </div>
  );
}

function AstronomyPanel({ card, type }) {
  const isDay = card.isDay !== false;

  return (
    <div className="min-h-[226px]">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          icon={Sunrise}
          label="日出"
          value={card.sunrise}
        />

        <Metric
          icon={Sunset}
          label="日落"
          value={card.sunset}
        />

        <Metric
          icon={isDay ? Sun : Moon}
          label="当前时段"
          value={card.daylightText || (isDay ? '白天' : '夜晚')}
        />

        <Metric
          icon={Sparkles}
          label="天空状态"
          value={type === 'night' ? '星空' : '可见度良好'}
        />
      </div>

      <div className="mt-12">
        <div className="mb-3 flex items-center justify-between text-[11px] opacity-55">
          <span>{card.sunrise}</span>
          <span>今日光照轨迹</span>
          <span>{card.sunset}</span>
        </div>

        <div className="relative h-9">
          <div className="absolute left-0 right-0 top-3 h-px bg-current opacity-25" />

          <div className="absolute left-0 top-0 h-7 w-7 rounded-full border border-current/40 bg-white/15 shadow-[0_0_18px_rgba(255,220,150,.35)]" />

          <div className="absolute right-0 top-0 h-7 w-7 rounded-full border border-current/30 bg-indigo-200/20 shadow-[0_0_18px_rgba(190,205,255,.3)]" />

          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-60" />
        </div>
      </div>
    </div>
  );
}

export default function WeatherCard({ card }) {
  const [activeTab, setActiveTab] = useState('overview');

  const type = useMemo(
    () => getWeatherType(card?.condition, card?.isDay !== false),
    [card?.condition, card?.isDay]
  );

  const theme = weatherThemes[type];

  if (!card) return null;

  return (
    <section
      className={[
        'relative isolate my-4 w-full max-w-3xl overflow-hidden',
        'rounded-[2rem] text-white',
        'bg-gradient-to-br',
        theme.shell,
        'shadow-[0_22px_70px_rgba(35,70,92,.22)]',
        'dark:shadow-[0_24px_80px_rgba(0,0,0,.36)]',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-3xl',
          theme.glow,
        ].join(' ')}
      />

      <div
        className={[
          'pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full blur-3xl',
          theme.subGlow,
        ].join(' ')}
      />

      <div className="relative px-5 pb-5 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 opacity-80"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.2" />
            </svg>

            <h3 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
              {card.city}
            </h3>

            <span className="hidden h-1 w-1 rounded-full bg-current opacity-40 sm:block" />

            <span className="hidden text-xs opacity-55 sm:block">
              {card.condition}
            </span>
          </div>

          <div className="shrink-0 text-[10px] tracking-[.14em] opacity-55">
            WEATHER
          </div>
        </header>

        <div className="mt-6">
          {activeTab === 'overview' && (
            <OverviewPanel
              card={card}
              type={type}
              theme={theme}
            />
          )}

          {activeTab === 'environment' && (
            <EnvironmentPanel card={card} />
          )}

          {activeTab === 'astronomy' && (
            <AstronomyPanel
              card={card}
              type={type}
            />
          )}
        </div>

        <nav className="mt-5 flex items-center gap-1 border-b border-white/15">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            概览
          </TabButton>

          <TabButton
            active={activeTab === 'environment'}
            onClick={() => setActiveTab('environment')}
          >
            环境
          </TabButton>

          <TabButton
            active={activeTab === 'astronomy'}
            onClick={() => setActiveTab('astronomy')}
          >
            日照
          </TabButton>

          <div className="ml-auto pb-2 text-[10px] opacity-45">
            实时数据
          </div>
        </nav>
      </div>
    </section>
  );
}
