import React, { useEffect, useState } from 'react';

/*
 * 纪念碑谷式的等距建筑绘制（React SVG 版）。
 * 几何和配色比例移植自预览稿的 visual-lib.py / visual-gen.py：
 * 顶面最亮、左面居中、右面最暗，颜色由 --bg-main 和 --text-main 按比例混出来，跟随四套主题。
 */

// 未点亮建筑的轮廓：想改回虚线，把它改成 '3 3' 即可
export const GHOST_DASH = 'none';

const mixInk = (pct) => `color-mix(in srgb, var(--text-main) ${pct}%, var(--bg-main))`;

export const getPalette = (isDark) => {
  const a = isDark ? [36, 21, 11] : [5, 15, 27];

  return {
    top: mixInk(a[0]),
    left: mixInk(a[1]),
    right: mixInk(a[2]),
    edge: mixInk(isDark ? 42 : 50),
    ghost: mixInk(34),
    muted: 'color-mix(in srgb, var(--text-sub) 62%, var(--bg-main))',
    acc: 'var(--accent-color)',
    accfg: 'var(--accent-foreground)',
    pawnBody: mixInk(60),
    pawnBody2: mixInk(55),
    isDark,
  };
};

/** 判断当前是不是深色主题：看 --bg-main 的亮度，主题切换时会更新。 */
export const useIsDarkTheme = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        const probe = document.createElement('div');
        probe.style.color = 'var(--bg-main)';
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        document.body.removeChild(probe);

        const nums = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        if (nums.length === 3) {
          setDark(0.2126 * nums[0] + 0.7152 * nums[1] + 0.0722 * nums[2] < 128);
        }
      } catch {
        setDark(false);
      }
    };

    read();

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    return () => observer.disconnect();
  }, []);

  return dark;
};

const P = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/**
 * 一个画笔：把建筑的每个面按顺序收集成 SVG 元素。
 * lit=false 时只画细轮廓。
 */
const createPainter = (pal, lit, uid, effects) => {
  const out = [];
  let n = 0;
  const key = () => `p${n++}`;

  const poly = (pts, fill) => {
    if (lit) {
      out.push(
        <polygon key={key()} points={P(pts)} style={{ fill }} stroke={pal.edge} strokeWidth="0.8" strokeLinejoin="round" />
      );
    } else {
      out.push(
        <polygon
          key={key()}
          points={P(pts)}
          fill="none"
          stroke={pal.ghost}
          strokeWidth="1.1"
          strokeDasharray={GHOST_DASH}
          strokeLinejoin="round"
        />
      );
    }
  };

  const cube = (cx, cy, w, h, H) => {
    const top = [[cx, cy - h], [cx + w, cy], [cx, cy + h], [cx - w, cy]];
    const left = [[cx - w, cy], [cx, cy + h], [cx, cy + h + H], [cx - w, cy + H]];
    const right = [[cx, cy + h], [cx + w, cy], [cx + w, cy + H], [cx, cy + h + H]];
    poly(left, pal.left);
    poly(right, pal.right);
    poly(top, pal.top);
  };

  const litShape = (pts) => {
    if (effects) {
      out.push(
        <polygon key={key()} points={P(pts)} style={{ fill: pal.acc }} filter={`url(#blurD${uid})`} opacity="0.95" />
      );
    }
    out.push(<polygon key={key()} points={P(pts)} style={{ fill: pal.acc }} />);
  };

  const door = (cx, cy, w, h, H, dw = 9, dh = 13, off = 15) => {
    const x1 = cx - off;
    const x2 = cx - off + dw;
    const yb = (x) => cy + ((x - (cx - w)) * h) / w + H;
    const pts = [[x1, yb(x1)], [x2, yb(x2)], [x2, yb(x2) - dh], [x1, yb(x1) - dh]];

    if (lit) litShape(pts);
    else {
      out.push(
        <polygon key={key()} points={P(pts)} fill="none" stroke={pal.ghost} strokeWidth="1" strokeDasharray={GHOST_DASH} />
      );
    }
  };

  const win = (cx, cy, w, h) => {
    const x1 = cx + 4;
    const x2 = cx + 11;
    const yt = (x) => cy + h - ((x - cx) * h) / w;
    const y0 = 6;
    const pts = [[x1, yt(x1) + y0], [x2, yt(x2) + y0], [x2, yt(x2) + y0 + 8], [x1, yt(x1) + y0 + 8]];

    if (lit) litShape(pts);
  };

  const plinth = (bx, by) => cube(bx, by - 8, 42, 24, 8);

  const tower = (bx, by, count, withWindow = true) => {
    const widths = [17, 15, 13, 11, 9];
    let y = by;

    for (let i = 0; i < count; i += 1) {
      const w = widths[Math.min(i, 4)];
      const h = w * 0.57;
      const H = 20;
      const cy = y - H;
      cube(bx, cy, w, h, H);
      if (lit && withWindow && i === 0) win(bx, cy, w, h);
      y = cy;
    }

    return y;
  };

  const hut = (bx, by) => {
    const w = 21;
    const h = 12;
    const H = 24;
    const cy = by - H;
    cube(bx, cy, w, h, H);
    door(bx, cy, w, h, H);
    cube(bx, cy - 5, 15, 8.5, 5);
  };

  const gate = (bx, by) => {
    [[-12, -6.8], [12, 6.8]].forEach(([dx, dy]) => cube(bx + dx, by + dy - 30, 7, 4, 30));
    cube(bx, by - 30 - 7, 22, 12.5, 7);
  };

  const bridge = (bx, by) => {
    cube(bx, by - 6, 36, 20, 6);
    [[-14, -8], [14, 8]].forEach(([dx, dy]) => cube(bx + dx, by + dy - 6 - 14, 4, 2.3, 14));
  };

  const summit = (bx, by) => {
    const top = tower(bx, by, 4, false);
    out.push(
      <line
        key={key()}
        x1={bx}
        y1={top - 3}
        x2={bx}
        y2={top - 30}
        strokeWidth="1.4"
        style={{ stroke: lit ? pal.acc : pal.ghost }}
      />
    );
    out.push(
      lit ? (
        <polygon key={key()} points={P([[bx, top - 30], [bx + 15, top - 25], [bx, top - 20]])} style={{ fill: pal.acc }} />
      ) : (
        <polygon
          key={key()}
          points={P([[bx, top - 30], [bx + 15, top - 25], [bx, top - 20]])}
          fill="none"
          stroke={pal.ghost}
          strokeDasharray={GHOST_DASH}
        />
      )
    );
  };

  const step = (cx, cy) => cube(cx, cy, 10, 5.8, 4);

  return { out, plinth, tower, hut, gate, bridge, summit, step };
};

const BUILDERS = {
  tower1: (p, x, y) => p.tower(x, y, 1),
  tower2: (p, x, y) => p.tower(x, y, 2),
  tower3: (p, x, y) => p.tower(x, y, 3),
  tower4: (p, x, y) => p.tower(x, y, 5),
  hut: (p, x, y) => p.hut(x, y),
  gate: (p, x, y) => p.gate(x, y),
  bridge: (p, x, y) => p.bridge(x, y),
  summit: (p, x, y) => p.summit(x, y),
};

/** 一座建筑，底座中心在 (x, y)。 */
export const Building = ({ kind, x, y, lit, pal, uid, effects }) => {
  const painter = createPainter(pal, lit, uid, effects);
  painter.plinth(x, y);
  (BUILDERS[kind] || BUILDERS.tower1)(painter, x, y - 8);

  return <g>{painter.out}</g>;
};

/** 台阶上的一级小方块。 */
export const StepBlock = ({ x, y, lit, pal, uid, effects }) => {
  const painter = createPainter(pal, lit, uid, effects);
  painter.step(x, y);

  return <g>{painter.out}</g>;
};

/** 锥帽小人偶，脚在 (x, y)。 */
export const Pawn = ({ x, y, h, hat, body }) => (
  <g>
    <polygon
      points={P([[x - 4.5, y], [x + 4.5, y], [x + 3, y - h * 0.42], [x - 3, y - h * 0.42]])}
      style={{ fill: body }}
    />
    <circle cx={x} cy={y - h * 0.5} r="2.6" style={{ fill: body }} />
    <polygon points={P([[x - 4.2, y - h * 0.55], [x + 4.2, y - h * 0.55], [x, y - h]])} style={{ fill: hat }} />
  </g>
);

/** 辉光滤镜和光晕渐变。 */
export const MonumentDefs = ({ uid, isDark }) => {
  const glowOpacity = isDark ? 0.6 : 0.3;
  const haloOpacity = isDark ? 0.34 : 0.13;

  return (
    <defs>
      <filter id={`glow${uid}`} x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b" />
        <feFlood style={{ floodColor: 'var(--accent-color)' }} floodOpacity={glowOpacity} />
        <feComposite in2="b" operator="in" result="g" />
        <feMerge>
          <feMergeNode in="g" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`blurD${uid}`} x="-300%" y="-300%" width="700%" height="700%">
        <feGaussianBlur stdDeviation="3.2" />
      </filter>
      <radialGradient id={`halo${uid}`}>
        <stop offset="0" style={{ stopColor: 'var(--accent-color)' }} stopOpacity={haloOpacity} />
        <stop offset="0.6" style={{ stopColor: 'var(--accent-color)' }} stopOpacity={haloOpacity * 0.4} />
        <stop offset="1" style={{ stopColor: 'var(--accent-color)' }} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
};