import React from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from 'lucide-react';

const getWeatherType = (card) => {
  const condition = String(card?.condition || '').toLowerCase();
  const isDay = card?.isDay !== false;

  if (!isDay && !/雨|雪|雷|雾|rain|snow|storm|fog/i.test(condition)) {
    return 'night';
  }

  if (/雷|雷阵雨|storm|thunder/i.test(condition)) {
    return 'storm';
  }

  if (/雨|阵雨|小雨|中雨|大雨|rain|shower/i.test(condition)) {
    return 'rain';
  }

  if (/雪|雨夹雪|snow/i.test(condition)) {
    return 'snow';
  }

  if (/雾|霾|fog|haze/i.test(condition)) {
    return 'fog';
  }

  if (/阴|多云|云|cloud|overcast/i.test(condition)) {
    return 'cloudy';
  }

  return 'clear';
};

const WEATHER_THEME = {
  clear: {
    shell: 'from-[#4ca8d2] via-[#77c1dd] to-[#e7b879] dark:from-[#1d6388] dark:via-[#397f9e] dark:to-[#87663f]',
    glow: 'bg-amber-200/35 dark:bg-amber-200/15',
    secondaryGlow: 'bg-sky-100/25 dark:bg-sky-200/10',
    label: '晴朗天空',
    iconColor: '#ffe29a',
  },
  cloudy: {
    shell: 'from-[#638ca7] via-[#87aabd] to-[#cfae83] dark:from-[#263f53] dark:via-[#3c5f70] dark:to-[#705b48]',
    glow: 'bg-white/20 dark:bg-sky-200/10',
    secondaryGlow: 'bg-amber-100/20 dark:bg-slate-300/10',
    label: '云层流动',
    iconColor: '#dceaf0',
  },
  rain: {
    shell: 'from-[#405d76] via-[#58778e] to-[#66727c] dark:from-[#17283b] dark:via-[#253e52] dark:to-[#303941]',
    glow: 'bg-sky-200/15 dark:bg-sky-300/10',
    secondaryGlow: 'bg-slate-100/10 dark:bg-blue-300/10',
    label: '降雨天气',
    iconColor: '#c0e5f5',
  },
  storm: {
    shell: 'from-[#303b57] via-[#4c5d78] to-[#5a5961] dark:from-[#101828] dark:via-[#202d49] dark:to-[#302b39]',
    glow: 'bg-violet-200/15 dark:bg-violet-300/10',
    secondaryGlow: 'bg-blue-200/10 dark:bg-indigo-400/10',
    label: '雷雨天气',
    iconColor: '#f5d67b',
  },
  snow: {
    shell: 'from-[#8eb6cb] via-[#a7c9d8] to-[#c5d2d0] dark:from-[#314f64] dark:via-[#476d80] dark:to-[#667b83]',
    glow: 'bg-white/35 dark:bg-blue-100/10',
    secondaryGlow: 'bg-cyan-100/25 dark:bg-cyan-300/10',
    label: '降雪天气',
    iconColor: '#ecf8ff',
  },
  fog: {
    shell: 'from-[#809aa4] via-[#a5b8b9] to-[#b9b49f] dark:from-[#354850] dark:via-[#4d6267] dark:to-[#5d5c53]',
    glow: 'bg-white/30 dark:bg-white/10',
    secondaryGlow: 'bg-amber-100/15 dark:bg-slate-300/10',
    label: '能见度较低',
    iconColor: '#e6eeee',
  },
  night: {
    shell: 'from-[#111d3b] via-[#26365b] to-[#111827] dark:from-[#080d1d] dark:via-[#141d3a] dark:to-[#090c16]',
    glow: 'bg-indigo-300/20 dark:bg-indigo-400/15',
    secondaryGlow: 'bg-blue-200/10 dark:bg-blue-300/10',
    label: '宁静夜空',
    iconColor: '#dce5ff',
  },
};

const AmbientGlow = ({ className }) => (
  <div
    className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
  />
);

const WeatherIllustration = ({ type }) => {
  if (type === 'clear') {
    return (
      <svg
        viewBox="0 0 220 190"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <g className="origin-center animate-[spin_24s_linear_infinite]">
          <path
            d="M110 9v25M110 156v25M35 95H10M210 95h-25M57 42 39 24M163 42l18-18M57 148l-18 18M163 148l18 18"
            fill="none"
            stroke="#FFE9A8"
            strokeLinecap="round"
            strokeWidth="5"
            opacity=".75"
          />
        </g>
        <circle
          cx="110"
          cy="95"
          r="42"
          fill="#FFE39A"
          className="animate-[pulse_4s_ease-in-out_infinite]"
          style={{ filter: 'drop-shadow(0 0 22px rgba(255,218,125,.8))' }}
        />
        <circle
          cx="95"
          cy="81"
          r="8"
          fill="#FFF1BA"
          opacity=".55"
        />
      </svg>
    );
  }

  if (type === 'night') {
    return (
      <svg
        viewBox="0 0 220 190"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx="112"
          cy="91"
          r="48"
          fill="#E3EBFF"
          style={{ filter: 'drop-shadow(0 0 22px rgba(184,204,255,.7))' }}
        />
        <circle cx="135" cy="70" r="48" fill="#24345A" />
        <circle
          cx="49"
          cy="45"
          r="3"
          fill="#E9EFFF"
          className="animate-[pulse_3s_ease-in-out_infinite]"
        />
        <circle
          cx="168"
          cy="46"
          r="2.5"
          fill="#E9EFFF"
          className="animate-[pulse_3s_ease-in-out_infinite_700ms]"
        />
        <circle
          cx="164"
          cy="124"
          r="3"
          fill="#E9EFFF"
          className="animate-[pulse_3s_ease-in-out_infinite_1200ms]"
        />
        <circle
          cx="67"
          cy="135"
          r="2"
          fill="#E9EFFF"
          className="animate-[pulse_3s_ease-in-out_infinite_1800ms]"
        />
      </svg>
    );
  }

  if (type === 'rain' || type === 'storm') {
    return (
      <svg
        viewBox="0 0 240 210"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {type === 'storm' && (
          <path
            d="M155 106 128 151h24l-15 36 43-55h-25l18-26Z"
            fill="#F6D873"
            className="animate-[pulse_2.4s_ease-in-out_infinite]"
            style={{ filter: 'drop-shadow(0 0 12px rgba(246,216,115,.65))' }}
          />
        )}

        <path
          d="M48 132h132c17 0 30-12 30-28 0-16-12-28-29-29-6-25-28-43-55-43-26 0-48 16-55 40-19 1-34 16-34 35 0 14 4 21 11 25Z"
          fill="rgba(205,225,235,.68)"
        />

        <path
          d="M40 146h132c17 0 30-12 30-28 0-16-12-28-29-29-6-25-28-43-55-43-26 0-48 16-55 40-19 1-34 16-34 35 0 14 4 21 11 25Z"
          fill="rgba(242,249,251,.9)"
          style={{ filter: 'drop-shadow(0 12px 15px rgba(42,70,88,.18))' }}
        />

        {[
          ['M72 157 64 178', '0ms'],
          ['M105 157 97 181', '260ms'],
          ['M138 157 130 178', '520ms'],
          ['M171 157 163 181', '780ms'],
        ].map(([d, delay]) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="#B9E5F7"
            strokeLinecap="round"
            strokeWidth="4"
            className="animate-[weatherRain_1.5s_ease-in_infinite]"
            style={{ animationDelay: delay }}
          />
        ))}
      </svg>
    );
  }

  if (type === 'snow') {
    return (
      <svg
        viewBox="0 0 240 210"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M43 143h139c16 0 28-12 28-27 0-15-11-26-27-27-6-25-27-42-54-42-26 0-47 16-54 40-18 1-32 15-32 33 0 14 3 20 0 23Z"
          fill="rgba(238,248,252,.9)"
          style={{ filter: 'drop-shadow(0 12px 16px rgba(58,95,115,.15))' }}
        />

        {[
          ['68', '166', '0ms'],
          ['102', '178', '320ms'],
          ['139', '166', '640ms'],
          ['174', '178', '960ms'],
        ].map(([cx, cy, delay]) => (
          <g
            key={`${cx}-${cy}`}
            transform={`translate(${cx} ${cy})`}
            className="animate-[weatherSnow_2.8s_ease-in-out_infinite]"
            style={{ animationDelay: delay }}
          >
            <path
              d="M0-8V8M-7-4 7 4M7-4-7 4"
              fill="none"
              stroke="#E8F8FF"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </g>
        ))}
      </svg>
    );
  }

  if (type === 'fog') {
    return (
      <svg
        viewBox="0 0 240 190"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="rgba(239,247,247,.78)"
          strokeLinecap="round"
          strokeWidth="11"
          className="animate-[weatherFog_6s_ease-in-out_infinite]"
        >
          <path d="M40 73h145" />
          <path d="M25 101h172" />
          <path d="M52 129h128" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 240 200"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <circle
        cx="92"
        cy="67"
        r="27"
        fill="#FFE29A"
        style={{ filter: 'drop-shadow(0 0 18px rgba(255,218,125,.65))' }}
      />

      <path
        d="M42 139h139c16 0 28-12 28-27 0-15-11-26-27-27-6-24-27-41-53-41-25 0-46 15-53 39-18 1-32 15-32 33 0 14 3 20-2 23Z"
        fill="rgba(216,232,238,.72)"
      />

      <path
        d="M35 151h143c16 0 28-12 28-27 0-15-11-26-27-27-6-24-27-41-53-41-25 0-46 15-53 39-18 1-32 15-32 33 0 14 3 20-6 23Z"
        fill="rgba(245,250,251,.88)"
        style={{ filter: 'drop-shadow(0 12px 15px rgba(48,80,99,.16))' }}
      />
    </svg>
  );
};

const Metric = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <Icon className="h-4 w-4 shrink-0 text-white/65" strokeWidth={1.7} />

    <div className="min-w-0">
      <div className="text-[10px] tracking-[0.12em] text-white/50">
        {label}
      </div>

      <div className="mt-1 truncate text-[13px] font-medium text-white/90">
        {value || '--'}
      </div>
    </div>
  </div>
);

const UvLabel = ({ value }) => {
  if (value === null || value === undefined) return '--';

  if (value < 3) return `${value} 低`;
  if (value < 6) return `${value} 中等`;
  if (value < 8) return `${value} 偏高`;

  return `${value} 很高`;
};

const parseTime = (time) => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;

  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const SunPath = ({ sunrise, sunset }) => {
  const start = parseTime(sunrise);
  const end = parseTime(sunset);

  const daylight = start !== null && end !== null && end > start;

  return (
    <div className="relative mt-5">
      <div className="mb-2 flex items-center justify-between text-[10px] text-white/55">
        <span className="flex items-center gap-1.5">
          <Sunrise className="h-3.5 w-3.5 text-amber-200/80" />
          日出 {sunrise || '--:--'}
        </span>

        <span className="flex items-center gap-1.5">
          日落 {sunset || '--:--'}
          <Sunset className="h-3.5 w-3.5 text-indigo-100/75" />
        </span>
      </div>

      <div className="relative h-9 overflow-hidden">
        <div className="absolute left-3 right-3 top-7 h-16 rounded-[50%] border-t border-white/35" />

        <div className="absolute left-3 right-3 top-7 h-px bg-white/10" />

        <div
          className={[
            'absolute top-[22px] h-2 w-2 rounded-full',
            'bg-amber-100 shadow-[0_0_12px_rgba(255,230,150,.9)]',
            daylight
              ? 'left-[48%]'
              : 'left-[50%]',
          ].join(' ')}
        />
      </div>
    </div>
  );
};

const WeatherCard = ({ card }) => {
  if (!card) return null;

  const type = getWeatherType(card);
  const theme = WEATHER_THEME[type];

  const isDay = card.isDay !== false;
  const uvValue = card.uvIndex ?? null;

  return (
    <section
      aria-label={`${card.city}天气`}
      className={[
        'relative isolate my-4 w-full max-w-[540px] overflow-hidden',
        'rounded-[30px] text-white shadow-[0_24px_70px_rgba(24,58,80,.22)]',
        'bg-gradient-to-br',
        theme.shell,
      ].join(' ')}
    >
      <style>
        {`
          @keyframes weatherRain {
            0% { transform: translateY(-7px); opacity: 0; }
            25% { opacity: .9; }
            100% { transform: translateY(12px); opacity: 0; }
          }
          @keyframes weatherSnow {
            0%, 100% { transform: translateY(-3px) rotate(0deg); opacity: .35; }
            50% { transform: translateY(6px) rotate(28deg); opacity: 1; }
          }
          @keyframes weatherFog {
            0%, 100% { transform: translateX(-7px); opacity: .55; }
            50% { transform: translateX(8px); opacity: .9; }
          }
        `}
      </style>

      <AmbientGlow
        className={`-right-24 -top-28 h-72 w-72 ${theme.glow}`}
      />

      <AmbientGlow
        className={`-bottom-28 -left-24 h-72 w-72 ${theme.secondaryGlow}`}
      />

      <div className="relative">
        <header className="flex items-center justify-between px-6 pb-0 pt-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-white/75" strokeWidth={1.8} />
            <span>{card.city}</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-white/50">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300/80" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            LIVE
          </div>
        </header>

        <div className="relative min-h-[285px] px-6 pt-9">
          <div className="relative z-10 max-w-[58%]">
            <div className="text-[11px] tracking-[0.14em] text-white/55">
              {theme.label}
            </div>

            <div className="mt-3 flex items-start">
              <span className="text-[70px] font-extralight leading-[.9] tracking-[-0.1em]">
                {card.temperature || '--'}
              </span>
            </div>

            <div className="mt-5 text-lg font-medium">
              {card.condition || '天气状况未知'}
            </div>

            <div className="mt-1.5 flex items-center gap-2 text-xs text-white/60">
              <Thermometer className="h-3.5 w-3.5" strokeWidth={1.7} />
              体感 {card.feelsLike || '--'}
            </div>
          </div>

          <div className="pointer-events-none absolute -right-3 top-7 h-[205px] w-[230px]">
            <WeatherIllustration type={type} />
          </div>

          <div className="absolute bottom-5 left-6 right-6 flex items-center gap-2 text-[10px] text-white/45">
            <span className="h-px flex-1 bg-white/20" />
            <span>{isDay ? 'DAYLIGHT' : 'NIGHT CONDITIONS'}</span>
            <span className="h-px flex-1 bg-white/20" />
          </div>
        </div>

        <div className="mx-6 border-t border-white/15" />

        <div className="grid grid-cols-2 gap-x-6 gap-y-6 px-6 py-6 sm:grid-cols-4">
          <Metric
            icon={Droplets}
            label="湿度"
            value={card.humidity}
          />

          <Metric
            icon={Wind}
            label="风速"
            value={card.windSpeed}
          />

          <Metric
            icon={Gauge}
            label="紫外线"
            value={<UvLabel value={uvValue} />}
          />

          <Metric
            icon={Eye}
            label="状态"
            value={card.daylightText || (isDay ? '白天' : '夜晚')}
          />
        </div>

        <div className="mx-6 border-t border-white/15" />

        <div className="px-6 pb-6">
          <SunPath
            sunrise={card.sunrise}
            sunset={card.sunset}
          />
        </div>

        <footer className="flex items-center justify-between bg-black/10 px-6 py-3.5 text-[10px] text-white/50">
          <span>实时环境观测</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
            数据已更新
          </span>
        </footer>
      </div>
    </section>
  );
};

export default React.memo(WeatherCard);

