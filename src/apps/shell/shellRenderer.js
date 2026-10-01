// src/apps/shell/shellRenderer.js
//
// 贝壳 SVG markup（字符串形式），1:1 对应最初视觉预览稿（tidal-shell-
// preview-v2.html）里的 clam()/pearls() 实现。这里特意保留字符串拼接
// 的写法而不是改写成 React 组件，是因为开壳动画需要把同一个贝壳拆成
// top（壳盖，做旋转动画）/ bottom（铰链底座）两半分别独立控制 CSS
// transform，预览稿的原始实现就是这么做的——直接照搬字符串结构，才能
// 保证拖进圈里开壳的那段视觉和手感跟预览稿完全一致。

const shellOutline = (cx, cy, r, scallops) => {
  const pts = [];

  for (let i = 0; i <= scallops * 2; i += 1) {
    const a = Math.PI - (Math.PI * i) / (scallops * 2);
    const rr = r + (i % 2 === 0 ? 0 : -3.5);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }

  return pts;
};

// part: 'full'（完整贝壳，贝壳册/静态展示用) | 'top'（壳盖，开壳动画旋转用）
// | 'bottom'（铰链底座，开壳动画用）
export function shellMarkup(tier, part = 'full') {
  const cx = 60;
  const cy = 78;
  const r = 44;
  const sc = 7;

  const fill0 = tier === 0 ? 'url(#tsGC0)' : 'url(#tsGC1)';
  const edge = tier === 0 ? 'var(--bg-blob-3)' : 'var(--ink-card-border)';
  const ribClr = tier === 0 ? 'var(--bg-blob-1)' : 'var(--text-on-ink-muted)';
  const innerFill = tier === 0 ? 'var(--bg-surface-strong)' : 'var(--ink-b)';

  const pts = shellOutline(cx, cy, r, sc);
  const arcPts = pts
    .map((p, i) => (i === 0 ? `M${p[0].toFixed(1)},${p[1].toFixed(1)}` : `L${p[0].toFixed(1)},${p[1].toFixed(1)}`))
    .join('');
  const outerPath = `${arcPts} Q${(cx + r + 4).toFixed(1)},${(cy + 4).toFixed(1)} ${cx},${(cy + 8).toFixed(1)} Q${(cx - r - 4).toFixed(1)},${(cy + 4).toFixed(1)} ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}Z`;

  const ribAngles = [-72, -54, -36, -18, 0, 18, 36, 54, 72];
  const ribs = ribAngles
    .map((deg) => {
      const a = ((90 + deg) * Math.PI) / 180;
      const x2 = (cx + Math.cos(a) * r).toFixed(1);
      const y2 = (cy - Math.sin(a) * r).toFixed(1);
      return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${ribClr}" stroke-width="1" opacity=".7" stroke-linecap="round"/>`;
    })
    .join('');

  const arcs = [0.38, 0.62, 0.85]
    .map((ratio) => {
      const rr = r * ratio;
      return `<path d="M${(cx - rr).toFixed(1)},${cy} A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 1 ${(cx + rr).toFixed(1)},${cy}" fill="none" stroke="${ribClr}" stroke-width="${ratio < 0.5 ? '0.7' : '0.8'}" opacity=".5"/>`;
    })
    .join('');

  const dots = tier === 2
    ? `<g fill="var(--text-on-ink-muted)" opacity=".9"><circle cx="${cx - 18}" cy="${cy - r * 0.7}" r="1.4"/><circle cx="${cx}" cy="${cy - r * 0.95}" r="1.6"/><circle cx="${cx + 18}" cy="${cy - r * 0.7}" r="1.4"/></g>`
    : '';

  const hinge = `<ellipse cx="${cx}" cy="${cy + 4}" rx="14" ry="5" fill="${innerFill}" stroke="${edge}" stroke-width="1.2" opacity=".9"/>`;

  const clipId = `tsFanClip${tier}${part}`;
  const defs = `<defs>
    <clipPath id="${clipId}"><path d="${outerPath}"/></clipPath>
    <radialGradient id="tsGC0" cx="50%" cy="85%" r="70%"><stop offset="0%" stop-color="var(--bg-blob-2)"/><stop offset="100%" stop-color="var(--bg-blob-1)"/></radialGradient>
    <radialGradient id="tsGC1" cx="50%" cy="85%" r="70%"><stop offset="0%" stop-color="var(--ink-a)"/><stop offset="100%" stop-color="var(--ink-b)"/></radialGradient>
  </defs>`;

  const shellBody = `<path d="${outerPath}" fill="${fill0}" stroke="${edge}" stroke-width="1.3"/>
    <g clip-path="url(#${clipId})">${ribs}${arcs}</g>${dots}`;

  let body;

  if (part === 'bottom') {
    body = hinge;
  } else if (part === 'top') {
    body = shellBody;
  } else {
    body = `${hinge}${shellBody}`;
  }

  return `<svg viewBox="0 0 120 110" width="100%" height="100%" overflow="visible">${defs}${body}</svg>`;
}

export function pearlsMarkup(tier) {
  return `<span class="ts-pearls">${[0, 1, 2].map((i) => `<i class="${i <= tier ? 'on' : ''}"></i>`).join('')}</span>`;
}