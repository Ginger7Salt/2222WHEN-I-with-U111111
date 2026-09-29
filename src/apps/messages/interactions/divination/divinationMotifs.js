// src/apps/messages/interactions/divination/divinationMotifs.js
//
// 卡面的几何图案：纯函数，只依赖一个整数 seed，返回一组 SVG 图元描述
// （{ tag, attrs }），不依赖 React，也不含随机数——同一张牌任何时候
// 渲染出来的图案都一样。图案统一画在 0 0 100 100 的坐标系里，线条颜色
// 和填充都交给 CSS（currentColor），所以会跟着当前主题变色。
//
// 十种基础图形 x 四种变化 = 40 种组合，正好够塔罗 22 张与自创牌 40 张
// 各自内部不重样。

const round = (value) => Math.round(value * 100) / 100;

const pointAt = (cx, cy, radius, degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return [
    round(cx + radius * Math.cos(radians)),
    round(cy + radius * Math.sin(radians)),
  ];
};

const circle = (cx, cy, r, filled = false) => ({
  tag: 'circle',
  attrs: filled
    ? { cx, cy, r, fill: 'currentColor', stroke: 'none' }
    : { cx, cy, r },
});

const line = (x1, y1, x2, y2) => ({
  tag: 'line',
  attrs: { x1, y1, x2, y2 },
});

const path = (d) => ({ tag: 'path', attrs: { d } });

const polygon = (cx, cy, radius, sides, rotation = -90) => ({
  tag: 'polygon',
  attrs: {
    points: Array.from({ length: sides }, (_, index) => (
      pointAt(cx, cy, radius, rotation + (360 / sides) * index).join(',')
    )).join(' '),
  },
});

const star = (cx, cy, outer, inner, tips) => ({
  tag: 'polygon',
  attrs: {
    points: Array.from({ length: tips * 2 }, (_, index) => (
      pointAt(
        cx,
        cy,
        index % 2 === 0 ? outer : inner,
        -90 + (180 / tips) * index
      ).join(',')
    )).join(' '),
  },
});

// 0 同心圆
const rings = (v) => {
  const count = 3 + v;
  const shapes = Array.from({ length: count }, (_, index) => (
    circle(50, 50, round(40 - index * (32 / count)))
  ));
  shapes.push(circle(50, 50, 2.5, true));
  return shapes;
};

// 1 月牙：外圆减去一个向右偏移的内圆，交点用几何公式算出来
const crescent = (v) => {
  const outerR = 34;
  const innerR = 26 + v * 2;
  const offset = 12 + v * 2;
  const chordX = (offset ** 2 + outerR ** 2 - innerR ** 2) / (2 * offset);
  const half = Math.sqrt(outerR ** 2 - chordX ** 2);
  const x = round(50 + chordX);
  const top = round(50 - half);
  const bottom = round(50 + half);
  const innerLargeArc = chordX > offset ? 1 : 0;

  return [
    path(
      `M ${x} ${top} A ${outerR} ${outerR} 0 1 0 ${x} ${bottom} `
      + `A ${innerR} ${innerR} 0 ${innerLargeArc} 1 ${x} ${top} Z`
    ),
    circle(82, 30, 2, true),
    circle(88, 46, 1.5, true),
  ];
};

// 2 星芒
const starburst = (v) => [
  star(50, 50, 40, 17, 4 + v),
  circle(50, 50, 4),
];

// 3 菱形嵌套
const diamonds = (v) => {
  const count = 3 + v;
  const shapes = Array.from({ length: count }, (_, index) => (
    polygon(50, 50, round(42 - index * (30 / count)), 4)
  ));
  shapes.push(circle(50, 50, 2.5, true));
  return shapes;
};

// 4 三角嵌套
const triangles = (v) => {
  const count = 3 + v;
  return Array.from({ length: count }, (_, index) => (
    polygon(50, 58, round(42 - index * (30 / count)), 3)
  ));
};

// 5 波纹
const waves = (v) => {
  const rows = 4 + v;

  return Array.from({ length: rows }, (_, index) => {
    const y = round(20 + index * (60 / (rows - 1)));
    const bend = index % 2 === 0 ? -9 : 9;
    return path(`M 12 ${y} Q 31 ${y + bend} 50 ${y} T 88 ${y}`);
  });
};

// 6 十字
const cross = (v) => {
  const shapes = [
    line(50, 12, 50, 88),
    line(12, 50, 88, 50),
    circle(50, 50, 8 + v * 3),
    circle(50, 12, 2, true),
    circle(50, 88, 2, true),
    circle(12, 50, 2, true),
    circle(88, 50, 2, true),
  ];

  if (v >= 2) {
    shapes.push(line(24, 24, 76, 76));
    shapes.push(line(76, 24, 24, 76));
  }

  return shapes;
};

// 7 螺旋
const spiral = (v) => {
  const turns = 2 + v * 0.5;
  const steps = 90;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const theta = t * turns * 2 * Math.PI;
    const radius = 4 + t * 36;
    return [
      round(50 + radius * Math.cos(theta)),
      round(50 + radius * Math.sin(theta)),
    ];
  });

  return [
    path(points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')),
  ];
};

// 8 拱门嵌套
const arches = (v) => {
  const count = 2 + v;

  return Array.from({ length: count }, (_, index) => {
    const w = round(34 - index * (28 / count));
    return path(`M ${round(50 - w)} 88 V 50 A ${w} ${w} 0 0 1 ${round(50 + w)} 50 V 88`);
  });
};

// 9 六边形嵌套
const hexagons = (v) => {
  const count = 2 + v;
  const shapes = Array.from({ length: count }, (_, index) => (
    polygon(50, 50, round(40 - index * (30 / count)), 6)
  ));
  shapes.push(circle(50, 50, 2.5, true));
  return shapes;
};

const MOTIFS = [
  rings,
  crescent,
  starburst,
  diamonds,
  triangles,
  waves,
  cross,
  spiral,
  arches,
  hexagons,
];

export const MOTIF_COUNT = MOTIFS.length;

export const getMotifPrimitives = (seed) => {
  const safeSeed = Math.max(0, Math.floor(Number(seed) || 0));
  const motif = MOTIFS[safeSeed % MOTIFS.length];
  const variation = Math.floor(safeSeed / MOTIFS.length) % 4;

  return motif(variation);
};