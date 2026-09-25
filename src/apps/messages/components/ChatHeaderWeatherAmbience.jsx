import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';

import {
  computeDayNightProgress,
  fetchTodayWeather,
  getTempUnit,
  getWeatherLocation,
} from '../../../services/weatherService';
import PixelWeatherScene from './PixelWeatherScene';

// 展开状态卡里"天气氛围"这一页：一扇趴着往外看的像素风窗户。玻璃
// 后面的天空场景（PixelWeatherScene）跟着"今日穿搭"里设置的真实地点、
// 真实天气、真实的此刻昼夜换景；窗台上摆一盆小盆栽，纯装饰。
// 只在这一页可见的时候才去请求（weatherService 自带 30 分钟缓存，
// 不会因为来回切页就频繁打接口）。

const FRAME_WOOD = '#5b3d2b';
const FRAME_HIGHLIGHT = 'rgba(255, 255, 255, 0.16)';
const FRAME_SHADOW = 'rgba(0, 0, 0, 0.4)';
const LEDGE_WOOD = '#6b4a34';
const LEDGE_HIGHLIGHT = '#8a6448';

// ISO 类似字符串（"2026-09-25T06:12"）里截出 "06:12"。
const formatClock = (isoLikeString) => {
  const match = /T(\d{2}:\d{2})/.exec(String(isoLikeString || ''));
  return match ? match[1] : '--:--';
};

// 窗台上的小盆栽：跟 PixelWeatherScene 同一套"行字符串转小方块"画法，
// 独立、简单，先放一盆最普通的绿植；以后想在节日换成不同装饰，
// 只需要在这里换一套 rows/配色，不影响天空场景那边的代码。
const POT_PX = 3;
const POT_ROWS = [
  { row: '..X.X..', color: '#3f7d4a' },
  { row: '.XXXXX.', color: '#4a8f56' },
  { row: 'XXXXXXX', color: '#4a8f56' },
  { row: '..XXX..', color: '#3f7d4a' },
  { row: '.XXXXX.', color: '#b5652f' },
  { row: '.XXXXX.', color: '#a5551f' },
  { row: '..XXX..', color: '#8f4718' },
];

function PlantPotSprite() {
  const width = 7 * POT_PX;
  const height = POT_ROWS.length * POT_PX;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {POT_ROWS.map(({ row, color }, ry) => (
        Array.from(row).map((cell, rx) => (
          cell === 'X' ? (
            <rect
              key={`${rx}-${ry}`}
              x={rx * POT_PX}
              y={ry * POT_PX}
              width={POT_PX}
              height={POT_PX}
              fill={color}
            />
          ) : null
        ))
      ))}
    </svg>
  );
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

  // 页面停留在这里时，每分钟重新算一次昼夜进度，让太阳/月亮在窗外
  // 天空里慢慢移动，而不是一进来就定死不动。
  useEffect(() => {
    if (!active || status !== 'success' || !weather) return undefined;

    tickRef.current = window.setInterval(() => {
      setProgress(computeDayNightProgress(weather));
    }, 60 * 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [active, status, weather]);

  const phase = progress?.phase || 'day';
  const isNight = phase === 'night';

  return (
    <div
      className="chat-header-pixel-window relative w-full overflow-hidden rounded-2xl"
      style={{
        minHeight: '9.5rem',
        background: FRAME_WOOD,
        padding: '9px 9px 0',
        boxShadow: `inset 2px 2px 0 0 ${FRAME_HIGHLIGHT}, inset -2px -2px 0 0 ${FRAME_SHADOW}`,
      }}
    >
      {/* 玻璃窗口 */}
      <div
        className="relative overflow-hidden"
        style={{
          height: '7.4rem',
          border: `5px solid ${FRAME_WOOD}`,
          boxShadow: `inset 2px 2px 0 0 ${FRAME_HIGHLIGHT}, inset -2px -2px 0 0 ${FRAME_SHADOW}`,
        }}
      >
        {status === 'loading' && (
          <div
            className="flex h-full flex-col items-center justify-center gap-1.5 text-[11px]"
            style={{ background: '#1c2530', color: '#e3e8ee' }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>正在感受此刻的天气...</span>
          </div>
        )}

        {status === 'no-location' && (
          <div
            className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[11px]"
            style={{ background: '#1c2530', color: '#e3e8ee' }}
          >
            <MapPin className="h-4 w-4" />
            <span>去"今日穿搭"里设置一个地点，</span>
            <span>这里就能一起感受当地的天气啦</span>
          </div>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={loadWeather}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] transition-opacity hover:opacity-80"
            style={{ background: '#1c2530', color: '#e3e8ee' }}
          >
            <RefreshCw className="h-4 w-4" />
            <span>天气数据暂时飘远了，点一下再试试</span>
          </button>
        )}

        {status === 'success' && weather && (
          <>
            <PixelWeatherScene
              weatherLabel={weather.label}
              phase={phase}
              fraction={progress?.fraction ?? 0}
            />

            {/* 窗棂：十字分隔玻璃 */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2"
              style={{ background: FRAME_WOOD, opacity: 0.85 }}
            />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2"
              style={{ background: FRAME_WOOD, opacity: 0.85 }}
            />

            {/* HUD：地点/温度 */}
            <div
              className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] leading-tight"
              style={{ background: 'rgba(20, 22, 26, 0.55)', color: '#fdfdfb' }}
            >
              <p className="uppercase tracking-[0.1em] opacity-75">
                {location?.name || '当前地点'}
              </p>
              <p className="text-[12px] font-semibold">{weather.temp}</p>
            </div>

            {/* HUD：天气标签 */}
            <span
              className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-medium"
              style={{ background: 'rgba(20, 22, 26, 0.55)', color: '#fdfdfb' }}
            >
              {weather.label || '未知'}
            </span>

            {/* HUD：日出 · 昼/夜 · 日落 */}
            <div
              className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between rounded px-1.5 py-0.5 font-mono text-[8px] tracking-[0.06em]"
              style={{ background: 'rgba(20, 22, 26, 0.55)', color: '#fdfdfb' }}
            >
              <span>{formatClock(weather.sunrise)}</span>
              <span className="opacity-80">{isNight ? '夜晚' : '白天'}</span>
              <span>{formatClock(weather.sunset)}</span>
            </div>
          </>
        )}
      </div>

      {/* 窗台：前景木质台面，盆栽摆在上面 */}
      <div
        className="relative flex h-[1.35rem] items-end justify-start pl-2"
        style={{
          background: LEDGE_WOOD,
          boxShadow: `inset 0 2px 0 0 ${LEDGE_HIGHLIGHT}`,
        }}
      >
        <div className="translate-y-1">
          <PlantPotSprite />
        </div>
      </div>
    </div>
  );
};

export default ChatHeaderWeatherAmbience;