import React, { useMemo } from 'react';

// "窗台像素画"里，玻璃后面那片天空的画面。纯 SVG + CSS 动画，不用图片，
// 也不用 canvas——用小方块（viewBox 里的"逻辑像素"）拼出复古游戏机那种
// 粗颗粒像素风：色块之间没有渐变、没有模糊，边缘干脆利落。

// 每个"逻辑像素"在 viewBox 里占几个单位；改这个数字可以整体调粗细，
// 数字越大颗粒越粗。
const PX = 4;
const GRID_W = 25;
const GRID_H = 15;
const VIEW_W = GRID_W * PX;
const VIEW_H = GRID_H * PX;

// 把一份"行字符串"（X=填色，.=透明）铺成一组 <rect>，rows 的每一行
// 长度可以不一样，方便画不规则的小图案（云、太阳、月亮）。
const spriteRects = (rows, { originX, originY, fill, keyPrefix }) => {
  const rects = [];

  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      if (row[rx] !== 'X') continue;

      rects.push(
        <rect
          key={`${keyPrefix}-${rx}-${ry}`}
          x={originX + rx * PX}
          y={originY + ry * PX}
          width={PX}
          height={PX}
          fill={fill}
        />
      );
    }
  });

  return rects;
};

const SUN_ROWS = ['.XXX.', 'XXXXX', 'XXXXX', 'XXXXX', '.XXX.'];
const MOON_ROWS = ['.XXX.', 'XXXX.', 'XXXX.', 'XXXX.', '.XXX.'];
const CLOUD_ROWS = ['..XXXX...', '.XXXXXXX.', 'XXXXXXXXX', '.XXXXXXX.'];
const SNOWFLAKE_ROWS = ['.X.', 'XXX', '.X.'];

// 天空配色：按天气类别分组，day/night 各一套（3 条横向色带 + 远处天际线）。
const SKY_PALETTES = {
  clear: {
    day: { bands: ['#7ec8f2', '#a9dcf5', '#ffd9a0'], skyline: '#8a7f8f' },
    night: { bands: ['#0d1130', '#171c46', '#2b2f5e'], skyline: '#0a0c1c' },
  },
  cloud: {
    day: { bands: ['#9fb4c2', '#b7c8d2', '#d8cdb8'], skyline: '#75808a' },
    night: { bands: ['#232a38', '#2f3947', '#3c4655'], skyline: '#12151b' },
  },
  rain: {
    day: { bands: ['#5f7488', '#728a9c', '#8a9aa8'], skyline: '#3f4d59' },
    night: { bands: ['#161e2a', '#1f2937', '#283542'], skyline: '#0b0f15' },
  },
  snow: {
    day: { bands: ['#cfe1ec', '#e2eef5', '#f3f2ec'], skyline: '#9fb0bd' },
    night: { bands: ['#232f3d', '#2d3c4c', '#3a4a59'], skyline: '#141c24' },
  },
  fog: {
    day: { bands: ['#c7cccb', '#d6dad8', '#e6e6e2'], skyline: '#9aa19d' },
    night: { bands: ['#2f3335', '#3a3f41', '#484d4e'], skyline: '#191c1d' },
  },
  wind: {
    day: { bands: ['#a9cdbc', '#c1dccb', '#dfe9d3'], skyline: '#6f8a79' },
    night: { bands: ['#1e2c25', '#28372e', '#334436'], skyline: '#0f1712' },
  },
};

const WEATHER_TO_CATEGORY = {
  '晴': 'clear',
  '多云': 'cloud',
  '阴': 'cloud',
  '雨': 'rain',
  '雪': 'snow',
  '雾': 'fog',
  '风': 'wind',
};

// 远处的一排"小房子/山丘"剪影，纯装饰，跟天气无关，只跟随昼夜换色。
const SKYLINE_BUILDINGS = [
  { x: 0, width: 10, height: 14 },
  { x: 10, width: 14, height: 20 },
  { x: 24, width: 10, height: 10 },
  { x: 34, width: 16, height: 24 },
  { x: 50, width: 12, height: 14 },
  { x: 62, width: 18, height: 22 },
  { x: 80, width: 10, height: 12 },
  { x: 90, width: 10, height: 16 },
];

// 太阳/月亮沿一条"升起—到顶—落下"的弧线移动，fraction 就是白天/夜晚
// 里走到了百分之多少（跟 weatherService.computeDayNightProgress 是同一个值）。
const useCelestialPosition = (fraction) => useMemo(() => {
  const clamped = Math.min(1, Math.max(0, fraction ?? 0));
  const spriteSize = 5 * PX;
  const leftMargin = 4;
  const travel = VIEW_W - leftMargin * 2 - spriteSize;
  const x = leftMargin + clamped * travel;

  const horizonY = VIEW_H * 0.62;
  const arcHeight = VIEW_H * 0.5;
  const y = horizonY - arcHeight * Math.sin(clamped * Math.PI) - spriteSize / 2;

  return { x, y };
}, [fraction]);

function CloudLayer({ color }) {
  const clouds = useMemo(
    () => Array.from({ length: 3 }, (_, index) => ({
      id: index,
      originX: 6 + index * 6,
      originY: 4 + index * 5,
      duration: 26 + index * 9,
      delay: index * 3,
    })),
    [],
  );

  return (
    <>
      {clouds.map((cloud) => (
        <g
          key={cloud.id}
          className="pixel-weather-cloud"
          style={{
            animationDuration: `${cloud.duration}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        >
          {spriteRects(CLOUD_ROWS, {
            originX: cloud.originX,
            originY: cloud.originY,
            fill: color,
            keyPrefix: `cloud-${cloud.id}`,
          })}
        </g>
      ))}
    </>
  );
}

function RainLayer() {
  const drops = useMemo(
    () => Array.from({ length: 10 }, (_, index) => ({
      id: index,
      x: 4 + Math.random() * (VIEW_W - 8),
      duration: 0.5 + Math.random() * 0.4,
      delay: Math.random() * 1,
    })),
    [],
  );

  return (
    <>
      {drops.map((drop) => (
        <rect
          key={drop.id}
          className="pixel-weather-raindrop"
          x={drop.x}
          y={-6}
          width={PX * 0.6}
          height={PX * 1.6}
          fill="#cfe6f7"
          style={{
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
    () => Array.from({ length: 7 }, (_, index) => ({
      id: index,
      originX: 2 + Math.random() * (GRID_W - 5) * 1,
      duration: 5 + Math.random() * 3,
      delay: Math.random() * 4,
    })),
    [],
  );

  return (
    <>
      {flakes.map((flake) => (
        <g
          key={flake.id}
          className="pixel-weather-snowflake"
          style={{
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
          }}
        >
          {spriteRects(SNOWFLAKE_ROWS, {
            originX: flake.originX,
            originY: -6,
            fill: '#ffffff',
            keyPrefix: `snow-${flake.id}`,
          })}
        </g>
      ))}
    </>
  );
}

function FogLayer() {
  return (
    <>
      <rect className="pixel-weather-fog" x={-20} y={VIEW_H * 0.42} width={VIEW_W + 40} height={PX * 2} fill="rgba(255,255,255,0.3)" />
      <rect className="pixel-weather-fog pixel-weather-fog-b" x={-20} y={VIEW_H * 0.58} width={VIEW_W + 40} height={PX * 2} fill="rgba(255,255,255,0.22)" />
    </>
  );
}

function WindLayer() {
  const streaks = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({
      id: index,
      y: VIEW_H * 0.25 + index * (VIEW_H * 0.14),
      duration: 1.4 + Math.random() * 0.8,
      delay: Math.random() * 1.5,
    })),
    [],
  );

  return (
    <>
      {streaks.map((streak) => (
        <rect
          key={streak.id}
          className="pixel-weather-wind"
          x={-20}
          y={streak.y}
          width={PX * 3}
          height={PX * 0.5}
          fill="rgba(255,255,255,0.6)"
          style={{
            animationDuration: `${streak.duration}s`,
            animationDelay: `${streak.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function StarLayer() {
  const stars = useMemo(
    () => Array.from({ length: 8 }, (_, index) => ({
      id: index,
      x: 3 + Math.random() * (VIEW_W - 6),
      y: 2 + Math.random() * (VIEW_H * 0.4),
      duration: 1.8 + Math.random() * 2,
      delay: Math.random() * 3,
    })),
    [],
  );

  return (
    <>
      {stars.map((star) => (
        <rect
          key={star.id}
          className="pixel-weather-star"
          x={star.x}
          y={star.y}
          width={PX * 0.5}
          height={PX * 0.5}
          fill="#ffffff"
          style={{
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </>
  );
}

export const PixelWeatherScene = ({ weatherLabel, phase = 'day', fraction = 0 }) => {
  const category = WEATHER_TO_CATEGORY[weatherLabel] || 'clear';
  const palette = (SKY_PALETTES[category] || SKY_PALETTES.clear)[phase === 'night' ? 'night' : 'day'];
  const celestial = useCelestialPosition(fraction);

  const bandHeight1 = VIEW_H * 0.4;
  const bandHeight2 = VIEW_H * 0.27;
  const bandHeight3 = VIEW_H * 0.13;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      style={{ shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {/* 天空：三条平色带，不用渐变，故意做出"色块"的感觉 */}
      <rect x={0} y={0} width={VIEW_W} height={bandHeight1} fill={palette.bands[0]} />
      <rect x={0} y={bandHeight1} width={VIEW_W} height={bandHeight2} fill={palette.bands[1]} />
      <rect x={0} y={bandHeight1 + bandHeight2} width={VIEW_W} height={bandHeight3} fill={palette.bands[2]} />

      {phase === 'night' && <StarLayer />}

      {spriteRects(phase === 'night' ? MOON_ROWS : SUN_ROWS, {
        originX: celestial.x,
        originY: celestial.y,
        fill: phase === 'night' ? '#eef0f5' : '#ffdd57',
        keyPrefix: 'celestial',
      })}

      {(category === 'cloud' || category === 'rain') && (
        <CloudLayer color={phase === 'night' ? '#4b5566' : '#f5f7f8'} />
      )}

      {category === 'rain' && <RainLayer />}
      {category === 'snow' && <SnowLayer />}
      {category === 'fog' && <FogLayer />}
      {category === 'wind' && <WindLayer />}

      {/* 远处天际线剪影 */}
      {SKYLINE_BUILDINGS.map((building) => (
        <rect
          key={building.x}
          x={building.x}
          y={VIEW_H - building.height}
          width={building.width}
          height={building.height}
          fill={palette.skyline}
        />
      ))}

      <style>{`
        .pixel-weather-cloud {
          animation-name: pixel-weather-cloud-drift;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes pixel-weather-cloud-drift {
          0% { transform: translateX(-30px); }
          100% { transform: translateX(130px); }
        }

        .pixel-weather-raindrop {
          animation-name: pixel-weather-rain-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes pixel-weather-rain-fall {
          0% { transform: translateY(0); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(${VIEW_H + 12}px); opacity: 0; }
        }

        .pixel-weather-snowflake {
          animation-name: pixel-weather-snow-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes pixel-weather-snow-fall {
          0% { transform: translate(0, 0); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translate(6px, ${VIEW_H + 12}px); opacity: 0.2; }
        }

        .pixel-weather-fog {
          animation: pixel-weather-fog-drift 8s ease-in-out infinite;
        }

        .pixel-weather-fog-b {
          animation-duration: 11s;
          animation-delay: 1.2s;
        }

        @keyframes pixel-weather-fog-drift {
          0%, 100% { transform: translateX(0); opacity: 0.6; }
          50% { transform: translateX(8px); opacity: 1; }
        }

        .pixel-weather-wind {
          animation-name: pixel-weather-wind-streak;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }

        @keyframes pixel-weather-wind-streak {
          0% { transform: translateX(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateX(${VIEW_W + 30}px); opacity: 0; }
        }

        .pixel-weather-star {
          animation: pixel-weather-star-twinkle ease-in-out infinite;
        }

        @keyframes pixel-weather-star-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pixel-weather-cloud,
          .pixel-weather-raindrop,
          .pixel-weather-snowflake,
          .pixel-weather-fog,
          .pixel-weather-fog-b,
          .pixel-weather-wind,
          .pixel-weather-star {
            animation: none;
          }
        }
      `}</style>
    </svg>
  );
};

export default PixelWeatherScene;