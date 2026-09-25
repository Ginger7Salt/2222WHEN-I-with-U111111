import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Moon, RefreshCw, Sun } from 'lucide-react';

import {
  computeDayNightProgress,
  fetchTodayWeather,
  getTempUnit,
  getWeatherLocation,
} from '../../../services/weatherService';

// 展开状态卡里"天气氛围"这一页：复用"今日穿搭"里已经设置好的地点，
// 拿真实天气做一层背景氛围（渐变 + 对应天气的小动效），再叠一条
// 会随当前时刻真实移动的昼夜进度条。纯装饰用途，不写任何数据库
// 字段，只在这一页可见的时候才去请求（weatherService 自带 30
// 分钟缓存，不会因为来回切页就频繁打接口）。

// 每种天气一套日间/夜间配色，以及对应的小动效类型。
const WEATHER_THEME = {
  '晴': {
    day: 'linear-gradient(160deg, #ffe1a3 0%, #ffbd76 48%, #ff9d76 100%)',
    night: 'linear-gradient(160deg, #2a2559 0%, #17123a 55%, #0b0a1f 100%)',
    particle: 'sun',
  },
  '多云': {
    day: 'linear-gradient(160deg, #d7e4ec 0%, #aec4d4 55%, #8ba4b8 100%)',
    night: 'linear-gradient(160deg, #3c4c60 0%, #283442 58%, #171e27 100%)',
    particle: 'cloud',
  },
  '阴': {
    day: 'linear-gradient(160deg, #c1cace 0%, #a3adb4 55%, #838d95 100%)',
    night: 'linear-gradient(160deg, #363d44 0%, #262b31 58%, #16191d 100%)',
    particle: 'cloud',
  },
  '雨': {
    day: 'linear-gradient(160deg, #8298ac 0%, #607a8e 55%, #455a6c 100%)',
    night: 'linear-gradient(160deg, #232f3f 0%, #182029 58%, #0d1218 100%)',
    particle: 'rain',
  },
  '雪': {
    day: 'linear-gradient(160deg, #edf2f6 0%, #d0dce4 55%, #aec0cd 100%)',
    night: 'linear-gradient(160deg, #2e3f50 0%, #1d2833 58%, #101820 100%)',
    particle: 'snow',
  },
  '雾': {
    day: 'linear-gradient(160deg, #dee1e0 0%, #c6cbca 55%, #aeb5b4 100%)',
    night: 'linear-gradient(160deg, #3c4144 0%, #292d30 58%, #181b1d 100%)',
    particle: 'fog',
  },
  '风': {
    day: 'linear-gradient(160deg, #d5e7db 0%, #aecfbe 55%, #89ae9c 100%)',
    night: 'linear-gradient(160deg, #2d3f35 0%, #1c2923 58%, #101815 100%)',
    particle: 'wind',
  },
};

const DEFAULT_THEME = {
  day: 'linear-gradient(160deg, #e2e2df 0%, #c9c9c5 55%, #adadA8 100%)',
  night: 'linear-gradient(160deg, #33332f 0%, #222220 58%, #131312 100%)',
  particle: 'none',
};

// ISO 类似字符串（"2026-09-25T06:12"）里截出 "06:12"。
const formatClock = (isoLikeString) => {
  const match = /T(\d{2}:\d{2})/.exec(String(isoLikeString || ''));
  return match ? match[1] : '--:--';
};

const seededPieces = (count, build) => Array.from({ length: count }, (_, index) => build(index));

function RainLayer() {
  const drops = useMemo(
    () => seededPieces(16, (index) => ({
      id: index,
      left: Math.random() * 100,
      duration: 0.55 + Math.random() * 0.5,
      delay: Math.random() * 1.2,
    })),
    [],
  );

  return (
    <>
      {drops.map((drop) => (
        <span
          key={drop.id}
          className="chat-ambience-rain-drop"
          style={{
            left: `${drop.left}%`,
            animationDuration: `${drop.duration}s`,
            animationDelay: `${drop.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function SnowLayer() {
  const flakes = useMemo(
    () => seededPieces(13, (index) => ({
      id: index,
      left: Math.random() * 100,
      size: 3 + Math.random() * 3,
      duration: 4.5 + Math.random() * 3,
      delay: Math.random() * 4,
    })),
    [],
  );

  return (
    <>
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="chat-ambience-snow-flake"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function SunLayer() {
  const motes = useMemo(
    () => seededPieces(9, (index) => ({
      id: index,
      left: 8 + Math.random() * 84,
      top: 10 + Math.random() * 60,
      duration: 2.4 + Math.random() * 2,
      delay: Math.random() * 2.4,
    })),
    [],
  );

  return (
    <>
      {motes.map((mote) => (
        <span
          key={mote.id}
          className="chat-ambience-sun-mote"
          style={{
            left: `${mote.left}%`,
            top: `${mote.top}%`,
            animationDuration: `${mote.duration}s`,
            animationDelay: `${mote.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function StarLayer() {
  const stars = useMemo(
    () => seededPieces(11, (index) => ({
      id: index,
      left: Math.random() * 100,
      top: 6 + Math.random() * 55,
      size: 1 + Math.random() * 1.6,
      duration: 1.8 + Math.random() * 2.2,
      delay: Math.random() * 3,
    })),
    [],
  );

  return (
    <>
      {stars.map((star) => (
        <span
          key={star.id}
          className="chat-ambience-star"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function CloudLayer() {
  const clouds = useMemo(
    () => seededPieces(3, (index) => ({
      id: index,
      top: 12 + index * 22 + Math.random() * 8,
      width: 46 + Math.random() * 26,
      duration: 22 + Math.random() * 14 + index * 4,
      delay: Math.random() * 6,
    })),
    [],
  );

  return (
    <>
      {clouds.map((cloud) => (
        <span
          key={cloud.id}
          className="chat-ambience-cloud"
          style={{
            top: `${cloud.top}%`,
            width: `${cloud.width}%`,
            animationDuration: `${cloud.duration}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function FogLayer() {
  const bands = useMemo(
    () => seededPieces(3, (index) => ({
      id: index,
      top: 18 + index * 24,
      duration: 9 + index * 3,
      delay: index * 1.4,
    })),
    [],
  );

  return (
    <>
      {bands.map((band) => (
        <span
          key={band.id}
          className="chat-ambience-fog-band"
          style={{
            top: `${band.top}%`,
            animationDuration: `${band.duration}s`,
            animationDelay: `${band.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function WindLayer() {
  const lines = useMemo(
    () => seededPieces(5, (index) => ({
      id: index,
      top: 15 + Math.random() * 60,
      duration: 1.6 + Math.random() * 1.2,
      delay: Math.random() * 2,
    })),
    [],
  );

  return (
    <>
      {lines.map((line) => (
        <span
          key={line.id}
          className="chat-ambience-wind-line"
          style={{
            top: `${line.top}%`,
            animationDuration: `${line.duration}s`,
            animationDelay: `${line.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function ParticleLayer({ particle, phase }) {
  // 晴天的动效在夜里换成星星——"阳光颗粒"到了夜晚没有意义。
  if (particle === 'sun') {
    return phase === 'night' ? <StarLayer /> : <SunLayer />;
  }

  if (particle === 'rain') return <RainLayer />;
  if (particle === 'snow') return <SnowLayer />;
  if (particle === 'cloud') return <CloudLayer />;
  if (particle === 'fog') return <FogLayer />;
  if (particle === 'wind') return <WindLayer />;

  return null;
}

export const ChatHeaderWeatherAmbience = ({ active }) => {
  // idle：还没到这一页；loading/success/error：请求状态；
  // no-location：地点没在"今日穿搭"里设置过。
  const [status, setStatus] = useState('idle');
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [progress, setProgress] = useState(null);
  const tickRef = useRef(null);

  const loadWeather = async () => {
    setStatus('loading');

    const savedLocation = await getWeatherLocation();

    if (!savedLocation) {
      setStatus('no-location');
      return;
    }

    setLocation(savedLocation);

    const unit = await getTempUnit();
    const result = await fetchTodayWeather({
      lat: savedLocation.lat,
      lng: savedLocation.lng,
      unit,
    });

    if (result.status !== 'success') {
      setStatus('error');
      return;
    }

    setWeather(result.weather);
    setProgress(computeDayNightProgress(result.weather));
    setStatus('success');
  };

  useEffect(() => {
    if (!active) return;
    if (status === 'idle') {
      loadWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 页面停留在这里时，每分钟重新算一次昼夜进度，让日/月标记慢慢移动，
  // 而不是一进来就定死不动。
  useEffect(() => {
    if (!active || status !== 'success' || !weather) return undefined;

    tickRef.current = window.setInterval(() => {
      setProgress(computeDayNightProgress(weather));
    }, 60 * 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [active, status, weather]);

  const theme = weather ? (WEATHER_THEME[weather.label] || DEFAULT_THEME) : DEFAULT_THEME;
  const phase = progress?.phase || 'day';
  const background = theme[phase];

  return (
    <div
      className="chat-header-ambience relative min-h-[9.5rem] w-full overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--divider)', background }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {status === 'success' && (
          <ParticleLayer particle={theme.particle} phase={phase} />
        )}
      </div>

      <div className="relative flex h-full flex-col justify-between p-3 text-white">
        {status === 'loading' && (
          <div className="flex flex-1 items-center justify-center gap-1.5 text-[11px] opacity-80">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>正在感受此刻的天气...</span>
          </div>
        )}

        {status === 'no-location' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-[11px] opacity-80">
            <MapPin className="h-4 w-4" />
            <span>去"今日穿搭"里设置一个地点，</span>
            <span>这里就能一起感受当地的天气啦</span>
          </div>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={loadWeather}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] opacity-80 transition-opacity hover:opacity-100"
          >
            <RefreshCw className="h-4 w-4" />
            <span>天气数据暂时飘远了，点一下再试试</span>
          </button>
        )}

        {status === 'success' && weather && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] opacity-70">
                  {location?.name || '当前地点'}
                </p>
                <p className="mt-0.5 font-serif text-lg font-semibold leading-none">
                  {weather.temp}
                </p>
              </div>

              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                {weather.label || '未知'}
              </span>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] font-mono tracking-[0.08em] opacity-75">
                <span>{formatClock(weather.sunrise)}</span>
                <span>{phase === 'day' ? '白天' : '夜晚'}</span>
                <span>{formatClock(weather.sunset)}</span>
              </div>

              <div className="relative mt-1.5 h-1 rounded-full bg-white/25">
                <div
                  className="absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-sm transition-[left] duration-500"
                  style={{ left: `calc(${Math.round((progress?.fraction ?? 0) * 100)}% - 10px)` }}
                >
                  {phase === 'day' ? (
                    <Sun className="h-3 w-3" />
                  ) : (
                    <Moon className="h-3 w-3" />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .chat-ambience-rain-drop {
          position: absolute;
          top: -10%;
          width: 1.5px;
          height: 14%;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.55);
          animation: chat-ambience-rain-fall linear infinite;
        }

        @keyframes chat-ambience-rain-fall {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.8; }
          100% { transform: translateY(760%); opacity: 0; }
        }

        .chat-ambience-snow-flake {
          position: absolute;
          top: -8%;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          animation: chat-ambience-snow-fall linear infinite;
        }

        @keyframes chat-ambience-snow-fall {
          0% { transform: translate(0, 0); opacity: 0; }
          10% { opacity: 0.9; }
          100% { transform: translate(14px, 720%); opacity: 0.1; }
        }

        .chat-ambience-sun-mote {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          animation: chat-ambience-sun-drift ease-in-out infinite;
        }

        @keyframes chat-ambience-sun-drift {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-8px); opacity: 0.9; }
        }

        .chat-ambience-star {
          position: absolute;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          animation: chat-ambience-star-twinkle ease-in-out infinite;
        }

        @keyframes chat-ambience-star-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        .chat-ambience-cloud {
          position: absolute;
          left: -50%;
          height: 20%;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.28);
          filter: blur(6px);
          animation: chat-ambience-cloud-drift linear infinite;
        }

        @keyframes chat-ambience-cloud-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(220%); }
        }

        .chat-ambience-fog-band {
          position: absolute;
          left: -30%;
          width: 160%;
          height: 22%;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          filter: blur(10px);
          animation: chat-ambience-fog-drift ease-in-out infinite;
        }

        @keyframes chat-ambience-fog-drift {
          0%, 100% { transform: translateX(0); opacity: 0.5; }
          50% { transform: translateX(6%); opacity: 0.9; }
        }

        .chat-ambience-wind-line {
          position: absolute;
          left: -20%;
          width: 26%;
          height: 1.5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.5);
          animation: chat-ambience-wind-streak ease-out infinite;
        }

        @keyframes chat-ambience-wind-streak {
          0% { transform: translateX(0); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translateX(520%); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .chat-ambience-rain-drop,
          .chat-ambience-snow-flake,
          .chat-ambience-sun-mote,
          .chat-ambience-star,
          .chat-ambience-cloud,
          .chat-ambience-fog-band,
          .chat-ambience-wind-line {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatHeaderWeatherAmbience;