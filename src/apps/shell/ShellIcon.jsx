// src/apps/shell/ShellIcon.jsx
//
// 正面扇贝图标：铰链在下，扇形轮廓带波浪缺口，肋线从铰链点向上放射。
// tier 0/1 用当前主题的浅色调（gC0），tier 2 用墨卡（ink）配色 + 顶部
// 三颗小珠点缀，呼应贝壳册卡片里"高稀有度用墨卡底"的既有视觉语言
// （跟 RpMessageCard/占卜卡的稀有度处理是同一套做法）。
import React from 'react';

let uid = 0;

const shellOutline = (cx, cy, r, scallops) => {
  const pts = [];

  for (let i = 0; i <= scallops * 2; i += 1) {
    const a = Math.PI - (Math.PI * i) / (scallops * 2);
    const rr = r + (i % 2 === 0 ? 0 : -3.5);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }

  return pts;
};

export default function ShellIcon({ tier = 0, className = '', style }) {
  const idRef = React.useRef(null);
  if (idRef.current === null) {
    uid += 1;
    idRef.current = uid;
  }

  const cx = 60;
  const cy = 78;
  const r = 44;
  const sc = 7;

  const fill = tier === 0 ? 'var(--bg-blob-2)' : tier === 1 ? 'var(--bg-blob-1)' : 'var(--ink-a)';
  const edge = tier === 2 ? 'var(--ink-card-border)' : 'var(--bg-blob-3)';
  const ribClr = tier === 2 ? 'var(--text-on-ink-muted)' : 'var(--bg-blob-1)';
  const innerFill = tier === 2 ? 'var(--ink-b)' : 'var(--bg-surface-strong)';

  const pts = shellOutline(cx, cy, r, sc);
  const arcPts = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join('');
  const outerPath = `${arcPts} Q${(cx + r + 4).toFixed(1)},${(cy + 4).toFixed(1)} ${cx},${(cy + 8).toFixed(1)} Q${(cx - r - 4).toFixed(1)},${(cy + 4).toFixed(1)} ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}Z`;

  const ribAngles = [-72, -54, -36, -18, 0, 18, 36, 54, 72];
  const clipId = `shellClip-${idRef.current}`;

  return (
    <svg
      viewBox="0 0 120 110"
      className={className}
      style={style}
      overflow="visible"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outerPath} />
        </clipPath>
      </defs>

      <ellipse cx={cx} cy={cy + 4} rx="14" ry="5" fill={innerFill} stroke={edge} strokeWidth="1.2" opacity="0.9" />

      <path d={outerPath} fill={fill} stroke={edge} strokeWidth="1.3" />

      <g clipPath={`url(#${clipId})`}>
        {ribAngles.map((deg) => {
          const a = ((90 + deg) * Math.PI) / 180;
          const x2 = (cx + Math.cos(a) * r).toFixed(1);
          const y2 = (cy - Math.sin(a) * r).toFixed(1);

          return (
            <line
              key={deg}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke={ribClr}
              strokeWidth="1"
              opacity="0.7"
              strokeLinecap="round"
            />
          );
        })}

        {[0.38, 0.62, 0.85].map((ratio) => {
          const rr = (r * ratio).toFixed(1);

          return (
            <path
              key={ratio}
              d={`M${(cx - rr).toFixed(1)},${cy} A${rr},${rr} 0 0 1 ${(cx + Number(rr)).toFixed(1)},${cy}`}
              fill="none"
              stroke={ribClr}
              strokeWidth={ratio < 0.5 ? '0.7' : '0.8'}
              opacity="0.5"
            />
          );
        })}
      </g>

      {tier === 2 && (
        <g fill="var(--text-on-ink-muted)" opacity="0.9">
          <circle cx={cx - 18} cy={cy - r * 0.7} r="1.4" />
          <circle cx={cx} cy={cy - r * 0.95} r="1.6" />
          <circle cx={cx + 18} cy={cy - r * 0.7} r="1.4" />
        </g>
      )}
    </svg>
  );
}