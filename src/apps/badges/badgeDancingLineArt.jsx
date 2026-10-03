// src/apps/badges/badgeDancingLineArt.jsx
//
// 万圣节限定赛季——场景 SVG 艺术模块（纯渲染，不碰数据库）。
// 由 BadgeDancingLineBoard.jsx 导入并使用。
//
// 配色：黑 / 紫 / 红 + 南瓜橙（#ff8a1f / #ff9a2e）。不使用青绿系颜色。
// 浮岛场景结构（从下到上）：
//   夜空背景 → 星星 → 月亮 → 两个小浮岛 → 浮云光带 →
//   主岛（石壁+岩底+草地表面+纹理） → 场景摆件（树/蜡烛/南瓜装饰/坩埚） →
//   Z 形石路（三层） → 四个节点祭坛（南瓜灯/墓碑+幽灵/水晶/塔+宝箱） →
//   选中圆环 + 灵魂方块 → 蝙蝠飞行路径 → 前景迷雾
//
// 坐标系：viewBox="0 0 360 260"

import React from 'react';

/* ─────────────────────────────────────────────
   路径关键点（7 个，Z 字形）
   NODE_IDX 对应第 0/2/4/6 号关键点（即四个节点位置）
───────────────────────────────────────────── */
export const TRACK_W = 360;
export const TRACK_H = 260;

const P = [
  [52, 178], [96, 152], [140, 166],
  [184, 140], [228, 154],
  [272, 128], [316, 142],
];
export const NODE_IDX = [0, 2, 4, 6];

/** 从第 a 个点到第 b 个点的 SVG path d 字符串 */
const pd = (a, b) =>
  P.slice(a, b + 1)
    .map((pt, i) => (i === 0 ? `M${pt[0]},${pt[1]}` : `L${pt[0]},${pt[1]}`))
    .join(' ');

/* ─────────────────────────────────────────────
   随机数生成（seeded，保证每次星星位置相同）
───────────────────────────────────────────── */
const mkRng = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

/* ─────────────────────────────────────────────
   灵魂方块位置 & 选中圆环位置
───────────────────────────────────────────── */
export const soulPos = (i) => {
  const [x, y] = P[NODE_IDX[i]];
  return i === 3 ? [x - 34, y - 26] : [x - 26, y - 20];
};
export const ringPos = (i) => {
  const [x, y] = P[NODE_IDX[i]];
  return [x, y + 1];
};

/* ─────────────────────────────────────────────
   SVG <defs>：渐变 / 滤镜 / 遮罩
───────────────────────────────────────────── */
function SceneDefs() {
  return (
    <defs>
      {/* 天空渐变 */}
      <linearGradient id="hwSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#080516" />
        <stop offset=".55" stopColor="#190e3a" />
        <stop offset="1" stopColor="#3a1a54" />
      </linearGradient>
      {/* 地平线橙光（南瓜色） */}
      <radialGradient id="hwHorizon" cx=".5" cy="1" r=".75">
        <stop offset="0" stopColor="#ff7a1a" stopOpacity=".34" />
        <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
      </radialGradient>
      {/* 月亮光晕 */}
      <radialGradient id="hwMoonGlow">
        <stop offset="0" stopColor="#fff1c2" stopOpacity=".55" />
        <stop offset="1" stopColor="#fff1c2" stopOpacity="0" />
      </radialGradient>
      {/* 月牙遮罩 */}
      <mask id="hwCrescent">
        <rect width="360" height="260" fill="#fff" />
        <circle cx="305" cy="40" r="15" fill="#000" />
      </mask>
      {/* 主岛表面 */}
      <radialGradient id="hwIsle" cx=".5" cy=".35" r=".75">
        <stop offset="0" stopColor="#4b3278" />
        <stop offset="1" stopColor="#22143f" />
      </radialGradient>
      {/* 岩石壁 */}
      <linearGradient id="hwRock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#302058" />
        <stop offset="1" stopColor="#0c0620" />
      </linearGradient>
      {/* 南瓜（亮） */}
      <radialGradient id="hwPump" cx=".4" cy=".35" r=".85">
        <stop offset="0" stopColor="#ffb347" />
        <stop offset=".55" stopColor="#f26a0e" />
        <stop offset="1" stopColor="#9c3806" />
      </radialGradient>
      {/* 南瓜（暗） */}
      <radialGradient id="hwPumpOff" cx=".4" cy=".35" r=".85">
        <stop offset="0" stopColor="#7a6a96" />
        <stop offset=".6" stopColor="#4a3d68" />
        <stop offset="1" stopColor="#261c3c" />
      </radialGradient>
      {/* 墓碑石材（亮） */}
      <linearGradient id="hwStone" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#9b8bd2" />
        <stop offset="1" stopColor="#53447f" />
      </linearGradient>
      {/* 墓碑石材（暗） */}
      <linearGradient id="hwStoneOff" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4f4a70" />
        <stop offset="1" stopColor="#2c2845" />
      </linearGradient>
      {/* 橙色辉光（南瓜 / 宝箱） */}
      <radialGradient id="hwGlowO">
        <stop offset="0" stopColor="#ff9a2e" stopOpacity=".7" />
        <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
      </radialGradient>
      {/* 紫色辉光（水晶 / 祭坛） */}
      <radialGradient id="hwGlowP">
        <stop offset="0" stopColor="#a86bff" stopOpacity=".6" />
        <stop offset="1" stopColor="#a86bff" stopOpacity="0" />
      </radialGradient>
      {/* 红紫色辉光（幽灵）— 替换原版青绿 */}
      <radialGradient id="hwGlowR">
        <stop offset="0" stopColor="#d060ff" stopOpacity=".55" />
        <stop offset="1" stopColor="#d060ff" stopOpacity="0" />
      </radialGradient>
      {/* 宝箱光束 */}
      <linearGradient id="hwBeam" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#ffd79a" stopOpacity=".7" />
        <stop offset="1" stopColor="#ffd79a" stopOpacity="0" />
      </linearGradient>
      {/* 宝箱木材（亮） */}
      <linearGradient id="hwWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9a6630" />
        <stop offset="1" stopColor="#4d2f14" />
      </linearGradient>
      {/* 宝箱木材（暗） */}
      <linearGradient id="hwWoodOff" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6a5668" />
        <stop offset="1" stopColor="#3a2c3a" />
      </linearGradient>
      {/* 轻微模糊 */}
      <filter id="hwBlur2" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" />
      </filter>
      <filter id="hwBlur6" x="-50%" y="-100%" width="200%" height="300%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      {/* 发光（节点 / 文字） */}
      <filter id="hwGlow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="1.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/* ─────────────────────────────────────────────
   辅助：祭坛平台
   on = 该节点是否已点亮
───────────────────────────────────────────── */
function Altar({ on }) {
  return (
    <g>
      <ellipse
        cx="0" cy="6" rx="31" ry="12"
        fill={`url(#${on ? 'hwGlowO' : 'hwGlowP'})`}
        opacity={on ? 0.95 : 0.4}
      />
      <path d="M-17,0 L-17,5 A17,8 0 0 0 17,5 L17,0 Z" fill="#150b2c" />
      <ellipse
        cx="0" cy="0" rx="17" ry="8"
        fill={on ? '#4b3283' : '#2f2150'}
        stroke={on ? '#ffb35c' : '#5a4a8c'}
        strokeWidth=".8"
      />
      {/* 符文环：用 CSS 动画 bdl-runes 让其旋转流动 */}
      <ellipse
        cx="0" cy="0" rx="12" ry="5.6"
        fill="none"
        stroke={on ? '#ff9a2e' : '#6a5aa0'}
        strokeWidth=".8"
        strokeDasharray="2.2 2.6"
        className="hw-runes"
      />
    </g>
  );
}

/* ─────────────────────────────────────────────
   节点 1：南瓜灯
───────────────────────────────────────────── */
function PumpkinNode({ on }) {
  return (
    <g>
      {on && (
        <circle
          cx="0" cy="-10" r="17"
          fill="url(#hwGlowO)"
          className="hw-flick"
        />
      )}
      {/* 瓜体 */}
      <ellipse cx="0" cy="-10.5" rx="13.5" ry="10.8" fill={`url(#${on ? 'hwPump' : 'hwPumpOff'})`} />
      <ellipse cx="-6.5" cy="-10.5" rx="6.6" ry="10.8" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth=".9" />
      <ellipse cx="6.5" cy="-10.5" rx="6.6" ry="10.8" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth=".9" />
      <ellipse cx="0" cy="-10.5" rx="2.6" ry="10.8" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth=".9" />
      {/* 茎 */}
      <path
        d="M-1.8,-20.5 Q-2,-25 1,-26.5 L3.2,-25.2 Q1.6,-23.5 1.8,-20.5 Z"
        fill={on ? '#5a8f2e' : '#3a4a3a'}
      />
      {/* 表情 */}
      {on ? (
        <g filter="url(#hwGlow)">
          <polygon points="-8,-14 -3.6,-14 -5.8,-10" fill="#ffd36b" />
          <polygon points="3.6,-14 8,-14 5.8,-10" fill="#ffd36b" />
          <path d="M-7.5,-7.5 L-5,-4.6 L-2.6,-7 L0,-4.6 L2.6,-7 L5,-4.6 L7.5,-7.5 Q0,-0.5 -7.5,-7.5 Z" fill="#ffd36b" />
        </g>
      ) : (
        <g>
          <polygon points="-8,-14 -3.6,-14 -5.8,-10" fill="#1a0f2a" />
          <polygon points="3.6,-14 8,-14 5.8,-10" fill="#1a0f2a" />
          <path d="M-7.5,-7.5 L-5,-4.6 L-2.6,-7 L0,-4.6 L2.6,-7 L5,-4.6 L7.5,-7.5 Q0,-0.5 -7.5,-7.5 Z" fill="#1a0f2a" />
        </g>
      )}
    </g>
  );
}

/* ─────────────────────────────────────────────
   节点 2：墓碑 + 幽灵
   幽灵配色改为淡紫白（去掉青绿）
───────────────────────────────────────────── */
function TombNode({ on }) {
  return (
    <g>
      {/* 小墓碑 */}
      <path
        d="M-18,-1 L-18,-9 Q-18,-14 -14,-14 Q-10,-14 -10,-9 L-10,-1 Z"
        fill={on ? '#6b5d9e' : '#3a3656'}
        stroke={on ? '#a99ae0' : '#4f4a74'}
        strokeWidth=".6"
      />
      {/* 主墓碑 */}
      <path
        d="M-9,-1 L-9,-19 Q-9,-28.5 0,-28.5 Q9,-28.5 9,-19 L9,-1 Z"
        fill={`url(#${on ? 'hwStone' : 'hwStoneOff'})`}
        stroke={on ? '#cdbdff' : '#6f6a96'}
        strokeWidth=".7"
      />
      {/* 十字 */}
      <path
        d="M0,-24 L0,-12 M-4,-19.5 L4,-19.5"
        stroke={on ? '#ffd36b' : '#4b4670'}
        strokeWidth="1.8"
        strokeLinecap="round"
        filter={on ? 'url(#hwGlow)' : undefined}
      />
      {/* 苔藓 */}
      <path d="M-9,-1 Q-6,-5.5 -2.5,-1 Z" fill="#3f7a4a" opacity={on ? 0.8 : 0.45} />
      {/* 幽灵（只有点亮才出现）— 改为紫白色 */}
      {on && (
        <g transform="translate(17,-27)">
          <g className="hw-bob">
            <ellipse cx="0" cy="0" rx="10" ry="11" fill="url(#hwGlowR)" />
            <path
              d="M-5.5,6 L-5.5,-1.5 Q-5.5,-9 0,-9 Q5.5,-9 5.5,-1.5 L5.5,6 L2.8,3.6 L0,6 L-2.8,3.6 Z"
              fill="#e8d5ff"
              opacity=".95"
              filter="url(#hwGlow)"
            />
            <circle cx="-1.9" cy="-2.6" r="1" fill="#1a0a2e" />
            <circle cx="1.9" cy="-2.6" r="1" fill="#1a0a2e" />
            <ellipse cx="0" cy="0.4" rx="1" ry="1.3" fill="#1a0a2e" />
          </g>
        </g>
      )}
    </g>
  );
}

/* ─────────────────────────────────────────────
   节点 3：浮动水晶 / 问号
───────────────────────────────────────────── */
function CrystalNode({ on }) {
  return (
    <g>
      <ellipse cx="0" cy="-1" rx="9" ry="3" fill="#000" opacity=".28" />
      <g className="hw-bob">
        <ellipse
          cx="0" cy="-26" rx="19" ry="22"
          fill="url(#hwGlowP)"
          opacity={on ? 1 : 0.22}
        />
        <polygon
          points="0,-44 -9.5,-27 0,-10"
          fill={on ? '#d2a9ff' : 'rgba(160,150,200,.22)'}
        />
        <polygon
          points="0,-44 9.5,-27 0,-10"
          fill={on ? '#8f5cf4' : 'rgba(120,110,170,.24)'}
        />
        {on && (
          <polygon points="0,-44 -9.5,-27 0,-27" fill="rgba(255,255,255,.34)" />
        )}
        <polygon
          points="0,-44 9.5,-27 0,-10 -9.5,-27"
          fill="none"
          stroke={on ? '#f0dcff' : '#8a80b8'}
          strokeWidth=".8"
          filter={on ? 'url(#hwGlow)' : undefined}
          strokeDasharray={on ? undefined : '2 2'}
        />
        {!on && (
          <text
            x="0" y="-23"
            textAnchor="middle"
            fontSize="12"
            fill="#a79ed4"
            fontFamily="Georgia,serif"
          >
            ?
          </text>
        )}
        {/* 亮起时的星芒 */}
        {on && (
          <g>
            <path className="hw-spark" d="M-15,-30 l1,-3 l1,3 l3,1 l-3,1 l-1,3 l-1,-3 l-3,-1z" fill="#f4e4ff" />
            <path className="hw-spark" style={{ animationDelay: '.8s' }} d="M14,-17 l.8,-2.4 l.8,2.4 l2.4,.8 l-2.4,.8 l-.8,2.4 l-.8,-2.4 l-2.4,-.8z" fill="#ffc4f4" />
            <path className="hw-spark" style={{ animationDelay: '1.5s' }} d="M12,-38 l.7,-2 l.7,2 l2,.7 l-2,.7 l-.7,2 l-.7,-2 l-2,-.7z" fill="#e0b8ff" />
          </g>
        )}
      </g>
    </g>
  );
}

/* ─────────────────────────────────────────────
   节点 4：哥特塔 + 宝箱
───────────────────────────────────────────── */
function VaultNode({ open }) {
  return (
    <g>
      {/* 塔身 */}
      <rect x="-26" y="-46" width="10" height="42" fill="#1a0f33" stroke="#4a3a80" strokeWidth=".6" />
      <polygon points="-28,-46 -21,-64 -14,-46" fill="#2a1650" stroke="#4a3a80" strokeWidth=".6" />
      <line x1="-21" y1="-64" x2="-21" y2="-72" stroke="#4a3a80" strokeWidth=".8" />
      {/* 旗帜 */}
      <path
        d="M-21,-72 L-21,-66.5 L-12,-69 Z"
        fill={open ? '#ff8a1f' : '#3b2d63'}
      />
      {/* 城堡主体 */}
      <path
        d="M-15,-4 L-15,-52 L-11,-52 L-11,-56 L-6,-56 L-6,-52 L-2,-52 L-2,-56 L3,-56 L3,-52 L7,-52 L7,-56 L12,-56 L12,-52 L16,-52 L16,-4 Z"
        fill="#1d1138"
        stroke="#4a3a80"
        strokeWidth=".7"
      />
      {/* 上窗（亮灯） */}
      <path
        d="M-4,-36 V-42 A4,4 0 0 1 4,-42 V-36 Z"
        fill={open ? '#ffd36b' : '#0c0620'}
        filter={open ? 'url(#hwGlow)' : undefined}
      />
      {/* 下窗 */}
      <path
        d="M-4,-24 V-29 A4,4 0 0 1 4,-29 V-24 Z"
        fill={open ? '#ffb35c' : '#0c0620'}
        opacity=".9"
      />
      {/* 光柱（打开时） */}
      {open && (
        <polygon
          className="hw-beam"
          points="-9,-14 -30,-70 30,-70 9,-14"
          fill="url(#hwBeam)"
        />
      )}
      {/* 宝箱 */}
      {open ? (
        <g>
          <path d="M-13,-12 L-11,-27 Q0,-31 11,-27 L13,-12 Z" fill="#5a3512" stroke="#2a1608" strokeWidth=".7" />
          <rect x="-13" y="-12" width="26" height="11" rx="2" fill="url(#hwWood)" stroke="#2a1608" strokeWidth=".7" />
          <ellipse cx="0" cy="-12" rx="11.5" ry="3" fill="#ffe3a0" filter="url(#hwGlow)" />
          <rect x="-9" y="-12" width="3" height="11" fill="#c8a14a" opacity=".85" />
          <rect x="6" y="-12" width="3" height="11" fill="#c8a14a" opacity=".85" />
          <path className="hw-spark" d="M-12,-30 l1,-3 l1,3 l3,1 l-3,1 l-1,3 l-1,-3 l-3,-1z" fill="#fff3c9" />
          <path className="hw-spark" style={{ animationDelay: '.9s' }} d="M13,-36 l1.2,-3.4 l1.2,3.4 l3.4,1.2 l-3.4,1.2 l-1.2,3.4 l-1.2,-3.4 l-3.4,-1.2z" fill="#ffd79a" />
          <path className="hw-spark" style={{ animationDelay: '1.7s' }} d="M2,-48 l.9,-2.6 l.9,2.6 l2.6,.9 l-2.6,.9 l-.9,2.6 l-.9,-2.6 l-2.6,-.9z" fill="#fff3c9" />
        </g>
      ) : (
        <g>
          <rect x="-13" y="-12" width="26" height="11" rx="2" fill="url(#hwWoodOff)" stroke="#1a0f1a" strokeWidth=".7" />
          <path d="M-13,-12 Q-13,-21 0,-21 Q13,-21 13,-12 Z" fill="#5a4658" stroke="#1a0f1a" strokeWidth=".7" />
          <rect x="-9" y="-21" width="3" height="20" fill="#7d7088" opacity=".7" />
          <rect x="6" y="-21" width="3" height="20" fill="#7d7088" opacity=".7" />
          <rect x="-3.6" y="-10.5" width="7.2" height="6" rx="1.2" fill="#8f8199" />
          <path d="M-2,-10.5 V-13 A2,2 0 0 1 2,-13 V-10.5" fill="none" stroke="#8f8199" strokeWidth="1.3" />
        </g>
      )}
    </g>
  );
}

/* ─────────────────────────────────────────────
   一只蝙蝠（带 SVG animateMotion）
   React 的 JSX 直接写 <animateMotion> 即可，不需要 dangerouslySetInnerHTML
───────────────────────────────────────────── */
function Bat({ path, dur, begin, scale }) {
  const wing = (
    <path
      d="M2,-1 C6,-6 13,-7 19,-3 C17,-2 16,0 15.5,2.5 C13.5,.8 11.5,.8 10,3 C8.5,1.2 6.5,1.4 5,3.4 C4,2 3,1 2,1 Z"
      fill="#0d0722"
      stroke="rgba(205,175,255,.55)"
      strokeWidth=".5"
    />
  );
  return (
    <g>
      <animateMotion
        dur={`${dur}s`}
        begin={`${begin}s`}
        repeatCount="indefinite"
        path={path}
      />
      <g transform={`scale(${scale})`}>
        <g className="hw-flap">{wing}</g>
        <g transform="scale(-1,1)">
          <g className="hw-flap">{wing}</g>
        </g>
        <ellipse cx="0" cy="0" rx="2.4" ry="3.4" fill="#0d0722" stroke="rgba(205,175,255,.55)" strokeWidth=".5" />
        <polygon points="-2,-2.6 -1.2,-5.4 -.3,-2.8" fill="#0d0722" />
        <polygon points="2,-2.6 1.2,-5.4 .3,-2.8" fill="#0d0722" />
      </g>
    </g>
  );
}

/* ─────────────────────────────────────────────
   小浮岛
───────────────────────────────────────────── */
function Islet({ x, y, scale, cls, withPumpkin }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <g className={cls}>
        <path
          d="M-17,0 Q-14,13 -4,19 Q0,24 4,19 Q14,13 17,0 Z"
          fill="#150b2c"
          stroke="rgba(170,140,255,.18)"
          strokeWidth=".5"
        />
        <ellipse
          cx="0" cy="0" rx="17" ry="5.6"
          fill="#28194d"
          stroke="rgba(190,160,255,.35)"
          strokeWidth=".6"
        />
        {withPumpkin ? (
          <g>
            <ellipse cx="2" cy="-5" rx="5.5" ry="4.4" fill="url(#hwPump)" />
            <polygon points="0,-6 1.4,-6 .7,-4.6" fill="#ffd36b" />
            <polygon points="3,-6 4.4,-6 3.7,-4.6" fill="#ffd36b" />
          </g>
        ) : (
          <path
            d="M-4,-1 L-4,-17 M-4,-11 L-9,-17 M-4,-8 L1,-14"
            stroke="#0d0620"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </g>
  );
}

/* ─────────────────────────────────────────────
   枯树
───────────────────────────────────────────── */
function Tree({ x, y, h }) {
  const t = h / 40;
  return (
    <g transform={`translate(${x},${y}) scale(${t})`} stroke="#0a0518" strokeLinecap="round" fill="none">
      <path d="M0,0 L0,-30" strokeWidth="3.6" />
      <path d="M0,-30 L-1,-40" strokeWidth="2.4" />
      <path d="M0,-18 L-11,-30 M-11,-30 L-15,-33 M-11,-30 L-13,-37" strokeWidth="2" />
      <path d="M0,-24 L11,-35 M11,-35 L15,-37 M11,-35 L12,-42" strokeWidth="2" />
      <path d="M0,-34 L6,-44" strokeWidth="1.6" />
    </g>
  );
}

/* ─────────────────────────────────────────────
   坩埚（调整配色：去掉绿色，改用暗紫红）
───────────────────────────────────────────── */
function Cauldron() {
  return (
    <g transform="translate(206,178)">
      {/* 紫色辉光替换原来的绿色 */}
      <ellipse cx="0" cy="-3" rx="18" ry="7" fill="url(#hwGlowP)" opacity=".7" />
      <path d="M-12,-9 Q-13,5 0,5 Q13,5 12,-9 Z" fill="#120a24" stroke="#3a2d62" strokeWidth=".6" />
      <ellipse cx="0" cy="-9" rx="12.5" ry="3.6" fill="#26163f" stroke="#4a3a7a" strokeWidth=".6" />
      {/* 液面：从绿色改成暗紫红 */}
      <ellipse cx="0" cy="-9" rx="10.5" ry="2.8" fill="#8b20d0" filter="url(#hwGlow)" opacity=".9" />
      {/* 冒泡（改成紫红色） */}
      <circle className="hw-rise" cx="-4" cy="-9" r="1.5" fill="#d060ff" />
      <circle className="hw-rise" style={{ animationDelay: '.8s' }} cx="3" cy="-9" r="1.2" fill="#d060ff" />
      <circle className="hw-rise" style={{ animationDelay: '1.5s' }} cx="0" cy="-9" r="1.7" fill="#d060ff" />
    </g>
  );
}

/* ─────────────────────────────────────────────
   石路渲染（三层 + 分段颜色逻辑）
   lit = [node0_lit, node1_lit, node2_lit, vault_lit]
───────────────────────────────────────────── */
function TrackPath({ lit }) {
  const segments = [];
  for (let k = 0; k < 3; k++) {
    const a = NODE_IDX[k];
    const b = NODE_IDX[k + 1];
    const both = lit[k] && lit[k + 1];
    const one = lit[k] !== lit[k + 1];
    const d = pd(a, b);
    if (both) {
      segments.push(
        <path
          key={k}
          d={d}
          fill="none"
          stroke="#ff9a2e"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#hwGlow)"
          className="hw-pulse"
        />
      );
    } else if (one) {
      segments.push(
        <path
          key={k}
          d={d}
          fill="none"
          stroke="#ffb35c"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 5"
          className="hw-flow"
          opacity=".9"
        />
      );
    } else {
      segments.push(
        <path
          key={k}
          d={d}
          fill="none"
          stroke="#7a5cc0"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".5"
        />
      );
    }
  }

  // 转折点的小圆点
  const corners = [1, 3, 5].map((i) => {
    const k = Math.floor(i / 2);
    const on = lit[k] && lit[k + 1];
    return (
      <circle
        key={i}
        cx={P[i][0]}
        cy={P[i][1]}
        r="2"
        fill={on ? '#ffb35c' : '#5a4a8c'}
        filter={on ? 'url(#hwGlow)' : undefined}
      />
    );
  });

  const allD = pd(0, 6);
  return (
    <g>
      {/* 三层底色石路 */}
      <path d={allD} fill="none" stroke="#0e0722" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d={allD} fill="none" stroke="#3b2a63" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={allD} transform="translate(0,-3.4)" fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d={allD} fill="none" stroke="#1d1240" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* 分段高亮 */}
      {segments}
      {/* 转折点 */}
      {corners}
    </g>
  );
}

/* ─────────────────────────────────────────────
   灵魂方块
   soulX / soulY = 当前坐标（由父组件通过 CSS transition 平滑移动）
───────────────────────────────────────────── */
function SoulOrb({ x, y }) {
  return (
    <g style={{ transform: `translate(${x}px,${y}px)`, transition: 'transform .9s cubic-bezier(.45,0,.2,1)' }}>
      <g className="hw-bob">
        <ellipse cx="0" cy="0" rx="14" ry="14" fill="url(#hwGlowO)" />
        {/* 菱形主体 */}
        <polygon points="0,-6 6,0 0,6 -6,0" fill="#ffd36b" filter="url(#hwGlow)" />
        <circle cx="0" cy="0" r="2.2" fill="#fff" />
        {/* 旋转外圈：改为红紫色，去掉青绿 */}
        <polygon
          className="hw-spin"
          points="0,-10 10,0 0,10 -10,0"
          fill="none"
          stroke="#d060ff"
          strokeWidth=".9"
        />
        {/* 轨道光点：改为紫色 */}
        <g className="hw-orbit">
          <circle cx="13" cy="0" r="1.8" fill="#a86bff" filter="url(#hwGlow)" />
        </g>
      </g>
    </g>
  );
}

/* ─────────────────────────────────────────────
   选中圆环
───────────────────────────────────────────── */
function SelectRing({ x, y }) {
  return (
    <g style={{ transform: `translate(${x}px,${y}px)`, transition: 'transform .45s cubic-bezier(.4,0,.2,1)' }}>
      <ellipse
        cx="0" cy="0" rx="26" ry="11.5"
        fill="none"
        stroke="#ffd36b"
        strokeWidth="1.2"
        className="hw-pulse"
      />
    </g>
  );
}

/* ─────────────────────────────────────────────
   星星（seeded，固定位置）
───────────────────────────────────────────── */
function Stars() {
  const r = mkRng(11);
  const stars = [];
  for (let i = 0; i < 34; i++) {
    const x = (6 + r() * 348).toFixed(1);
    const y = (5 + r() * 88).toFixed(1);
    const rad = (0.4 + r() * 0.8).toFixed(2);
    const d = (r() * 3).toFixed(1);
    stars.push(
      <circle
        key={i}
        cx={x} cy={y} r={rad}
        fill="#fff"
        opacity=".7"
        className="hw-twinkle"
        style={{ animationDelay: `${d}s` }}
      />
    );
  }
  return <g>{stars}</g>;
}

/* ─────────────────────────────────────────────
   岛面纹理（随机小色块，seeded）
───────────────────────────────────────────── */
function IsleSpecks() {
  const r2 = mkRng(5);
  const specks = [];
  for (let i = 0; i < 46; i++) {
    const x = 20 + r2() * 320;
    const y = 108 + r2() * 104;
    if (((x - 180) / 160) ** 2 + ((y - 158) / 52) ** 2 > 1) continue;
    specks.push(
      <ellipse
        key={i}
        cx={x.toFixed(1)} cy={y.toFixed(1)}
        rx={(1 + r2() * 2.2).toFixed(1)}
        ry={(0.5 + r2() * 0.9).toFixed(1)}
        fill={r2() > 0.5 ? '#6d4fb0' : '#120a28'}
        opacity=".35"
      />
    );
  }
  return <g>{specks}</g>;
}

/* ─────────────────────────────────────────────
   完整场景
   Props:
     lit          [boolean, boolean, boolean, boolean]  四个节点是否点亮
     selectedIdx  number  当前选中的节点（0-3）
     fxEnabled    boolean 是否启用动效
     onNodeClick  (i: number) => void
───────────────────────────────────────────── */
export function HalloweenScene({ lit, selectedIdx, fxEnabled, onNodeClick }) {
  const [sx, sy] = soulPos(selectedIdx);
  const [rx, ry] = ringPos(selectedIdx);

  // 节点渲染顺序（从后到前：vault/crystal/tomb/pumpkin）
  const nodeOrder = [3, 2, 1, 0];
  const nodeComponents = {
    0: <PumpkinNode on={lit[0]} />,
    1: <TombNode on={lit[1]} />,
    2: <CrystalNode on={lit[2]} />,
    3: <VaultNode open={lit[3]} />,
  };

  return (
    <svg
      viewBox={`0 0 ${TRACK_W} ${TRACK_H}`}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
      className={fxEnabled ? 'hw-fx' : ''}
    >
      <SceneDefs />

      {/* 天空 */}
      <rect width="360" height="260" fill="url(#hwSky)" />
      <rect width="360" height="260" fill="url(#hwHorizon)" />
      <Stars />

      {/* 月亮 */}
      <circle cx="300" cy="44" r="34" fill="url(#hwMoonGlow)" />
      <circle cx="300" cy="44" r="17" fill="#fff2cc" mask="url(#hwCrescent)" />

      {/* 小浮岛 */}
      <Islet x={170} y={60} scale={0.8} cls="hw-bob2" withPumpkin={false} />
      <Islet x={238} y={82} scale={0.6} cls="hw-bob" withPumpkin />

      {/* 飘云光带 */}
      <g className="hw-drift2">
        <ellipse cx="250" cy="116" rx="110" ry="9" fill="#b49cff" opacity=".07" filter="url(#hwBlur6)" />
      </g>

      {/* 主岛：石壁 + 岩底 + 顶面 */}
      <path d="M8,168 C22,206 66,224 104,236 C128,244 150,250 172,254 C190,254 206,246 238,238 C280,226 332,204 352,168 Z" fill="url(#hwRock)" />
      <polygon points="52,196 86,214 70,232" fill="#1a0f36" opacity=".7" />
      <polygon points="120,222 150,238 132,250" fill="#150b2c" opacity=".75" />
      <polygon points="236,224 270,214 256,238" fill="#241548" opacity=".6" />
      <polygon points="300,196 328,186 316,212" fill="#150b2c" opacity=".65" />
      <ellipse cx="180" cy="168" rx="172" ry="58" fill="#150b2c" />
      <ellipse cx="180" cy="158" rx="172" ry="58" fill="url(#hwIsle)" stroke="rgba(200,170,255,.4)" strokeWidth="1" />
      {/* 岛面装饰圆环 */}
      <ellipse cx="180" cy="158" rx="150" ry="49" fill="none" stroke="#ff9a2e" strokeWidth=".6" strokeDasharray="2 5" opacity=".22" />
      <ellipse cx="180" cy="158" rx="128" ry="41" fill="none" stroke="#a86bff" strokeWidth=".5" strokeDasharray="1 6" opacity=".25" />
      <IsleSpecks />
      {/* 岛边小石头 */}
      <g className="hw-bob2">
        <circle cx="30" cy="236" r="4" fill="#1a0f36" stroke="rgba(190,160,255,.25)" strokeWidth=".5" />
      </g>
      <g className="hw-bob">
        <polygon points="326,232 334,229 337,236 329,240" fill="#1a0f36" stroke="rgba(190,160,255,.25)" strokeWidth=".5" />
      </g>
      {/* 上升光粒 */}
      <circle className="hw-rise" cx="150" cy="236" r="1.4" fill="#ffb35c" opacity="0" />
      <circle className="hw-rise" style={{ animationDelay: '1.1s' }} cx="214" cy="238" r="1.2" fill="#ffb35c" opacity="0" />

      {/* 场景摆件 */}
      <Tree x={32} y={152} h={44} />
      <Tree x={338} y={160} h={30} />
      {/* 蜡烛 */}
      <g transform="translate(80,178)">
        <rect x="-6" y="-6" width="2.4" height="6" fill="#efe3ff" />
        <ellipse className="hw-flick" cx="-4.8" cy="-8" rx="1.1" ry="1.8" fill="#ffb35c" filter="url(#hwGlow)" />
        <rect x="0" y="-4" width="2.4" height="4" fill="#efe3ff" />
        <ellipse className="hw-flick" style={{ animationDelay: '.6s' }} cx="1.2" cy="-5.8" rx="1" ry="1.6" fill="#ffb35c" filter="url(#hwGlow)" />
        <rect x="6" y="-7" width="2.4" height="7" fill="#efe3ff" />
        <ellipse className="hw-flick" style={{ animationDelay: '1.1s' }} cx="7.2" cy="-9.2" rx="1.1" ry="1.8" fill="#ffb35c" filter="url(#hwGlow)" />
      </g>
      {/* 装饰南瓜 */}
      <g transform="translate(30,186)">
        <ellipse cx="0" cy="-4" rx="6.5" ry="5.2" fill="url(#hwPump)" />
        <polygon points="-2.4,-5.4 -.8,-5.4 -1.6,-3.8" fill="#ffd36b" />
        <polygon points="1,-5.4 2.6,-5.4 1.8,-3.8" fill="#ffd36b" />
        <path d="M-.6,-9 q0,-2.5 2,-3" stroke="#5a8f2e" strokeWidth="1.2" fill="none" />
      </g>
      <g transform="translate(296,168)">
        <ellipse cx="0" cy="-3.2" rx="5" ry="4" fill="url(#hwPump)" />
        <path d="M-.5,-7 q0,-2 1.6,-2.6" stroke="#5a8f2e" strokeWidth="1.1" fill="none" />
      </g>
      {/* 坩埚 */}
      <Cauldron />
      {/* 小蜡烛柱（岛中） */}
      <path d="M148,141 L148,134 Q148,130 151,130 Q154,130 154,134 L154,141 Z" fill="#4a3d6e" stroke="#7a6aa8" strokeWidth=".5" />
      <path d="M158,139 L158,133 Q158,129 161,129 Q164,129 164,133 L164,139 Z" fill="#3a3158" stroke="#6a5a98" strokeWidth=".5" />

      {/* 石路 */}
      <TrackPath lit={lit} />

      {/* 节点（从后到前渲染） */}
      {nodeOrder.map((i) => {
        const [x, y] = P[NODE_IDX[i]];
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            <Altar on={lit[i]} />
            {nodeComponents[i]}
          </g>
        );
      })}

      {/* 选中圆环 */}
      <SelectRing x={rx} y={ry} />

      {/* 灵魂方块 */}
      <SoulOrb x={sx} y={sy} />

      {/* 氛围光点（去掉青绿，改为紫色） */}
      <g className="hw-bob">
        <circle cx="22" cy="204" r="2" fill="#a86bff" filter="url(#hwGlow)" opacity=".8" />
      </g>
      <g className="hw-bob2">
        <circle cx="344" cy="196" r="1.7" fill="#a86bff" filter="url(#hwGlow)" opacity=".7" />
      </g>
      <g className="hw-bob">
        <circle cx="118" cy="118" r="1.5" fill="#ffb35c" filter="url(#hwGlow)" opacity=".7" />
      </g>
      <g className="hw-bob2">
        <circle cx="252" cy="108" r="1.6" fill="#a86bff" filter="url(#hwGlow)" opacity=".8" />
      </g>

      {/* 蝙蝠（动效模式下动画，静态模式下显示停止的翅膀） */}
      {fxEnabled ? (
        <>
          <Bat path="M-20,64 C60,26 120,86 200,48 S330,24 400,58" dur={15} begin={0} scale={1.15} />
          <Bat path="M380,118 C300,84 232,138 150,106 S40,96 -24,126" dur={19} begin={-7} scale={0.8} />
        </>
      ) : (
        /* 静态蝙蝠剪影（翅膀展开） */
        <g transform="translate(196,64) scale(1.05)">
          <path d="M2,-1 C6,-6 13,-7 19,-3 C17,-2 16,0 15.5,2.5 C13.5,.8 11.5,.8 10,3 C8.5,1.2 6.5,1.4 5,3.4 C4,2 3,1 2,1 Z" fill="#0d0722" stroke="rgba(205,175,255,.55)" strokeWidth=".5" />
          <g transform="scale(-1,1)">
            <path d="M2,-1 C6,-6 13,-7 19,-3 C17,-2 16,0 15.5,2.5 C13.5,.8 11.5,.8 10,3 C8.5,1.2 6.5,1.4 5,3.4 C4,2 3,1 2,1 Z" fill="#0d0722" stroke="rgba(205,175,255,.55)" strokeWidth=".5" />
          </g>
          <ellipse cx="0" cy="0" rx="2.4" ry="3.4" fill="#0d0722" />
        </g>
      )}

      {/* 前景迷雾 */}
      <g className="hw-drift">
        <ellipse cx="96" cy="236" rx="120" ry="12" fill="#c9b3ff" opacity=".1" filter="url(#hwBlur6)" />
      </g>
      <g className="hw-drift2">
        <ellipse cx="280" cy="230" rx="110" ry="10" fill="#c9b3ff" opacity=".08" filter="url(#hwBlur6)" />
      </g>

      {/* 可点击热区（transparent 椭圆，放在最上层） */}
      {[0, 1, 2, 3].map((i) => {
        const [x, y] = P[NODE_IDX[i]];
        return (
          <ellipse
            key={i}
            cx={x}
            cy={i === 3 ? y - 16 : y - 16}
            rx={i === 3 ? 30 : 24}
            ry={i === 3 ? 42 : 30}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => onNodeClick(i)}
            role="button"
            aria-label={['单聊满 520 条', '触发一次恶作剧', 'TA 自己定的小考验', '终点宝箱'][i]}
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick(i)}
          />
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   小图标 SVG（用于节点快捷条/chips）
───────────────────────────────────────────── */
export function NodeIcon({ type, on, size = 22 }) {
  const fill0 = on ? '#f6781a' : '#6d6188';
  const fill1 = on ? '#9a8ad0' : '#5b5878';
  const fill2 = on ? '#8f5cf4' : '#625c86';
  const fill2b = on ? '#d2a9ff' : '#7c76a0';
  const fill3 = on ? '#8a5a2b' : '#5a4a58';
  const fill3b = on ? '#b57a35' : '#6b5a68';

  const bodies = {
    pumpkin: (
      <>
        <ellipse cx="16" cy="18" rx="11" ry="9" fill={fill0} />
        <ellipse cx="11" cy="18" rx="5" ry="9" fill="none" stroke="rgba(0,0,0,.25)" />
        <ellipse cx="21" cy="18" rx="5" ry="9" fill="none" stroke="rgba(0,0,0,.25)" />
        <path d="M15,9 q0,-4 3,-5 l1.5,1.5 q-2,1 -2,3.5z" fill={on ? '#6aa636' : '#4a5a4a'} />
      </>
    ),
    tomb: (
      <>
        <path d="M8,27 V13 Q8,5 16,5 Q24,5 24,13 V27 Z" fill={fill1} />
        <path d="M16,10 V20 M12,14.5 H20" stroke={on ? '#ffd36b' : '#3c3a58'} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    crystal: (
      <>
        <polygon points="16,3 24,16 16,29 8,16" fill={fill2} />
        <polygon points="16,3 8,16 16,29" fill={fill2b} />
      </>
    ),
    vault: (
      <>
        <rect x="5" y="14" width="22" height="13" rx="2.5" fill={fill3} />
        <path d="M5,14 Q5,5 16,5 Q27,5 27,14Z" fill={fill3b} />
        <rect x="14" y="16" width="4" height="6" rx="1" fill={on ? '#ffd36b' : '#8a7f98'} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {bodies[type]}
    </svg>
  );
}