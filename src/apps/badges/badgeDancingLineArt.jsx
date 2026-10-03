// src/apps/badges/badgeDancingLineArt.jsx
//
// 万圣节限定徽章——"跳舞的线"风格的 2D 关卡地图绘制（纯 SVG，不依赖 three.js）。
//
// 跟 Almanac 的「这一路走来」（AlmanacMonumentPath / almanacMonumentArt）刻意拉开差距：
// 那边是纵向、随时间增长、等距建筑的"纪念碑谷"路径；这里是固定 4 个节点、
// 横向 Z 字转折、万圣节剪影图标的"关卡地图"，参照用户给的参考图（Dancing Line
// 风格的折线赛道 + 发光祭坛）里那种"沿一条会转弯的路走向终点宝箱"的感觉，
// 但完全用 2D SVG + CSS 动画实现，不引入新的渲染引擎、不破坏四套主题。
//
// 几何只服务于"3 个条件节点 + 1 个终点宝箱节点"这个固定结构（跟
// monthlyBadgeCatalog.js 里每季固定 3 个条件一一对应），不是通用的任意长度路径。

export const TRACK_STAGE_W = 320;
export const TRACK_STAGE_H = 150;

// 路径上的全部折点，节点（可点亮的 3 个条件 + 1 个宝箱）落在偶数下标上，
// 奇数下标只是转角，不渲染图标。
export const getTrackPoints = () => [
  { x: 26, y: 122 }, // 0 节点：条件一
  { x: 26, y: 78 },  // 1 转角
  { x: 128, y: 78 }, // 2 节点：条件二
  { x: 128, y: 38 }, // 3 转角
  { x: 218, y: 38 }, // 4 节点：条件三
  { x: 218, y: 16 }, // 5 转角
  { x: 294, y: 16 }, // 6 节点：终点宝箱
];

export const NODE_POINT_INDEXES = [0, 2, 4, 6];

const pointsToPath = (points) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** 轨道底色 + 全部点亮后的庆祝发光层。uid 保证同页多个赛季各自的滤镜 id 不冲突。 */
export const BadgeTrackDefs = ({ uid }) => (
  <defs>
    <filter id={`bdl-glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="b" />
      <feFlood style={{ floodColor: 'var(--accent-color)' }} floodOpacity="0.75" />
      <feComposite in2="b" operator="in" result="g" />
      <feMerge>
        <feMergeNode in="g" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <radialGradient id={`bdl-sparkle-${uid}`}>
      <stop offset="0" style={{ stopColor: 'var(--accent-color)' }} stopOpacity="0.5" />
      <stop offset="1" style={{ stopColor: 'var(--accent-color)' }} stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** 轨道本身：一条底色折线 + （全部解锁时）叠加一条发光折线。 */
export const BadgeTrackPath = ({ points, allUnlocked, uid, effects }) => (
  <>
    <path
      d={pointsToPath(points)}
      fill="none"
      stroke="var(--divider)"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    />

    {allUnlocked && (
      <path
        d={pointsToPath(points)}
        fill="none"
        style={{ stroke: 'var(--accent-color)' }}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={effects ? `url(#bdl-glow-${uid})` : undefined}
        className={effects ? 'bdl-track-lit' : undefined}
      />
    )}
  </>
);

const nodeBase = (lit) => ({
  fill: lit ? 'var(--accent-color)' : 'var(--control-soft-bg)',
  stroke: lit ? 'var(--accent-color)' : 'var(--divider)',
});

/** 条件一：南瓜灯——圆身 + 肋线 + 顶上小茎。 */
export const PumpkinMark = ({ x, y, lit, uid, effects }) => {
  const { fill, stroke } = nodeBase(lit);
  const r = 13;

  return (
    <g filter={lit && effects ? `url(#bdl-glow-${uid})` : undefined} className={lit ? 'bdl-node-lit' : 'bdl-node'}>
      <circle cx={x} cy={y} r={r} style={{ fill }} stroke={stroke} strokeWidth="1.4" />
      {[-5, 0, 5].map((dx) => (
        <path
          key={dx}
          d={`M${x + dx},${y - r + 2} Q${x + dx + (dx === 0 ? 0 : -dx * 0.3)},${y} ${x + dx},${y + r - 2}`}
          fill="none"
          stroke={lit ? 'var(--accent-foreground)' : 'var(--divider)'}
          strokeWidth="1"
          opacity={lit ? 0.55 : 0.6}
        />
      ))}
      <path
        d={`M${x - 2.5},${y - r - 3} L${x + 2.5},${y - r - 3} L${x + 1.5},${y - r + 1} L${x - 1.5},${y - r + 1} Z`}
        style={{ fill: lit ? 'var(--accent-color)' : 'var(--text-muted)' }}
      />
    </g>
  );
};

/** 条件二：墓碑——圆顶矩形 + 一道十字裂纹。 */
export const TombstoneMark = ({ x, y, lit, uid, effects }) => {
  const { fill, stroke } = nodeBase(lit);
  const w = 11;
  const h = 15;

  return (
    <g filter={lit && effects ? `url(#bdl-glow-${uid})` : undefined} className={lit ? 'bdl-node-lit' : 'bdl-node'}>
      <path
        d={`M${x - w},${y + h} L${x - w},${y - h * 0.2} A${w},${w} 0 0 1 ${x + w},${y - h * 0.2} L${x + w},${y + h} Z`}
        style={{ fill }}
        stroke={stroke}
        strokeWidth="1.4"
      />
      <line
        x1={x - 3.5}
        y1={y - 2}
        x2={x + 3.5}
        y2={y - 2}
        stroke={lit ? 'var(--accent-foreground)' : 'var(--divider)'}
        strokeWidth="1"
        opacity="0.6"
      />
      <line
        x1={x}
        y1={y - 5.5}
        x2={x}
        y2={y + 1.5}
        stroke={lit ? 'var(--accent-foreground)' : 'var(--divider)'}
        strokeWidth="1"
        opacity="0.6"
      />
    </g>
  );
};

/** 条件三：神秘水晶——菱形轮廓，呼应"TA 自己想的要求"的不确定感。 */
export const CrystalMark = ({ x, y, lit, uid, effects }) => {
  const { fill, stroke } = nodeBase(lit);
  const r = 12;

  return (
    <g filter={lit && effects ? `url(#bdl-glow-${uid})` : undefined} className={lit ? 'bdl-node-lit' : 'bdl-node'}>
      <path
        d={`M${x},${y - r} L${x + r * 0.72},${y - r * 0.15} L${x},${y + r} L${x - r * 0.72},${y - r * 0.15} Z`}
        style={{ fill }}
        stroke={stroke}
        strokeWidth="1.4"
      />
      <line
        x1={x}
        y1={y - r}
        x2={x}
        y2={y + r}
        stroke={lit ? 'var(--accent-foreground)' : 'var(--divider)'}
        strokeWidth="0.8"
        opacity="0.5"
      />
    </g>
  );
};

/** 通用占位节点（未来新增条件类型，没有专属图标时的兜底）：一颗小星。 */
export const SparkMark = ({ x, y, lit, uid, effects }) => {
  const { fill, stroke } = nodeBase(lit);
  const r = 11;

  return (
    <g filter={lit && effects ? `url(#bdl-glow-${uid})` : undefined} className={lit ? 'bdl-node-lit' : 'bdl-node'}>
      <circle cx={x} cy={y} r={r} style={{ fill }} stroke={stroke} strokeWidth="1.4" />
    </g>
  );
};

/** 终点宝箱：锁住的箱子 / 已开启的箱子（配合外层 CSS 做 sparkle）。 */
export const VaultMark = ({ x, y, unlocked, uid, effects }) => {
  const w = 19;
  const bodyH = 14;
  const lidH = 7;

  return (
    <g filter={unlocked && effects ? `url(#bdl-glow-${uid})` : undefined} className={unlocked ? 'bdl-vault-lit' : 'bdl-vault'}>
      {unlocked && (
        <circle cx={x} cy={y - lidH - 6} r="20" fill={`url(#bdl-sparkle-${uid})`} className={effects ? 'bdl-vault-sparkle' : undefined} />
      )}

      <rect
        x={x - w}
        y={y - bodyH / 2}
        width={w * 2}
        height={bodyH}
        rx="2.5"
        style={{ fill: unlocked ? 'var(--accent-color)' : 'var(--control-soft-bg)' }}
        stroke={unlocked ? 'var(--accent-color)' : 'var(--divider)'}
        strokeWidth="1.5"
      />

      <path
        d={
          unlocked
            ? `M${x - w},${y - bodyH / 2} Q${x},${y - bodyH / 2 - lidH * 2.1} ${x + w},${y - bodyH / 2}`
            : `M${x - w},${y - bodyH / 2} Q${x},${y - bodyH / 2 - lidH} ${x + w},${y - bodyH / 2}`
        }
        fill="none"
        style={{ stroke: unlocked ? 'var(--accent-color)' : 'var(--divider)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {!unlocked && (
        <rect
          x={x - 2.6}
          y={y - 2}
          width="5.2"
          height="4.6"
          rx="1"
          style={{ fill: 'var(--text-muted)' }}
        />
      )}
    </g>
  );
};

/** 按条件类型挑选对应的图标组件。不认识的类型落到 SparkMark。 */
export const pickConditionMark = (condition) => {
  if (condition?.type === 'messages_total') return PumpkinMark;
  if (condition?.type === 'trick_triggered') return TombstoneMark;
  if (condition?.kind === 'ai') return CrystalMark;
  return SparkMark;
};

/** 环境小精灵：漂浮的蝙蝠轮廓 + 小幽灵，纯装饰，effects 关闭时不渲染。 */
export const BadgeAmbientSprites = ({ effects }) => {
  if (!effects) return null;

  return (
    <div className="bdl-sprites" aria-hidden="true">
      <span className="bdl-bat bdl-bat-a">
        <svg viewBox="0 0 24 14" width="22" height="13">
          <path
            d="M12 7 C10 2 4 1 0 4 C3 4.5 5 6 6 8 C4 7.5 1.5 8 0 10 C4 10.5 8 9.5 12 7 C16 9.5 20 10.5 24 10 C22.5 8 20 7.5 18 8 C19 6 21 4.5 24 4 C20 1 14 2 12 7 Z"
            fill="var(--text-muted)"
          />
        </svg>
      </span>
      <span className="bdl-bat bdl-bat-b">
        <svg viewBox="0 0 24 14" width="16" height="9">
          <path
            d="M12 7 C10 2 4 1 0 4 C3 4.5 5 6 6 8 C4 7.5 1.5 8 0 10 C4 10.5 8 9.5 12 7 C16 9.5 20 10.5 24 10 C22.5 8 20 7.5 18 8 C19 6 21 4.5 24 4 C20 1 14 2 12 7 Z"
            fill="var(--text-muted)"
          />
        </svg>
      </span>
      <span className="bdl-ghost bdl-ghost-a" />
    </div>
  );
};