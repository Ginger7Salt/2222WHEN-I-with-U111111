// src/apps/greeting/popupBookPaper.js
//
// 立体书的"纸面"：用 2D canvas 把文字排到页面上，再由场景当成贴图贴到书页上。
// 不依赖 three，只依赖 canvas，所以可以单独测试。
//
// 单位：页宽 PW = 2，页高 PH = 2.6；封面板比纸大一圈（BW / BH）。

export const PW = 2.0;
export const PH = 2.6;
export const BW = PW + 0.07;
export const BH = PH + 0.12;

export const SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong",Georgia,serif';
export const MONO = '"IBM Plex Mono","JetBrains Mono",ui-monospace,Menlo,Consolas,monospace';

export const mkCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// 逐字量宽换行（中文没有空格，不能按词切）。
export const wrapText = (ctx, text, maxW) => {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// 在 (ox, oy, pw, ph) 这块纸面上排版。spec = { items, no, side }。
// pal = { ink, paper, mute, accent }。
export const drawPage = (ctx, ox, oy, pw, ph, spec, pal) => {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, pw, ph);
  const g = ctx.createLinearGradient(0, 0, 0, ph);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.035)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pw, ph);

  const pad = pw * 0.105;
  const W = pw - pad * 2;
  const f = pw / 1024;
  let y = ph * 0.075;
  ctx.textBaseline = 'alphabetic';

  (spec.items || []).forEach((it) => {
    if (it.t === 'kick') {
      ctx.fillStyle = pal.mute;
      ctx.font = `500 ${22 * f}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(it.s).split('').join(' '), pw / 2, y + 22 * f);
      y += 52 * f;
    } else if (it.t === 'h') {
      ctx.fillStyle = pal.ink;
      ctx.font = `500 ${62 * f}px ${SERIF}`;
      ctx.textAlign = 'center';
      wrapText(ctx, it.s, W).forEach((l) => {
        ctx.fillText(l, pw / 2, y + 54 * f);
        y += 84 * f;
      });
      y += 20 * f;
    } else if (it.t === 'p') {
      ctx.fillStyle = pal.ink;
      ctx.font = `400 ${33 * f}px ${SERIF}`;
      ctx.textAlign = 'left';
      wrapText(ctx, it.s, W).forEach((l) => {
        ctx.fillText(l, pad, y + 30 * f);
        y += 54 * f;
      });
      y += 18 * f;
    } else if (it.t === 'space') {
      y += it.n * f;
    } else if (it.t === 'sign') {
      ctx.fillStyle = pal.ink;
      ctx.font = `400 ${34 * f}px ${SERIF}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(it.s).split('').join(' '), pw - pad, y + 34 * f);
      y += 60 * f;
    } else if (it.t === 'cap') {
      // 图注：贴在页面下部，it.y 是占页高的比例
      ctx.textAlign = 'left';
      ctx.fillStyle = pal.mute;
      ctx.font = `400 ${21 * f}px ${MONO}`;
      ctx.fillText(it.k || '', pad, ph * it.y);
      ctx.fillStyle = pal.ink;
      ctx.font = `400 ${30 * f}px ${SERIF}`;
      wrapText(ctx, it.s, W).forEach((l, i) => {
        ctx.fillText(l, pad, ph * it.y + 44 * f + i * 46 * f);
      });
    } else if (it.t === 'rule') {
      // 一条细线，右页没有模型时当装饰
      ctx.strokeStyle = pal.mute;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2 * f;
      ctx.beginPath();
      ctx.moveTo(pad, ph * it.y);
      ctx.lineTo(pw - pad, ph * it.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });

  if (spec.no) {
    ctx.fillStyle = pal.mute;
    ctx.font = `400 ${22 * f}px ${MONO}`;
    ctx.textAlign = spec.side === 'l' ? 'left' : 'right';
    ctx.fillText(spec.no, spec.side === 'l' ? pad : pw - pad, ph * 0.965);
  }
  ctx.restore();
};

export const pageCanvas = (spec, pal) => {
  const c = mkCanvas(1024, Math.round((1024 * PH) / PW));
  drawPage(c.getContext('2d'), 0, 0, c.width, c.height, spec, pal);
  return c;
};

// 封面板背面：内页贴在板上，板比纸大一圈（外缘 .07，上下各 .06）。
export const boardBackCanvas = (spec, pal, boardColor) => {
  const k = 1024 / BW;
  const c = mkCanvas(1024, Math.round(BH * k));
  const x = c.getContext('2d');
  x.fillStyle = boardColor;
  x.fillRect(0, 0, c.width, c.height);
  drawPage(x, 0.07 * k, 0.06 * k, PW * k, PH * k, spec, pal);
  return c;
};

const orb = (x, cx, cy, r, col) => {
  const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  rg.addColorStop(0, col);
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = rg;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
};

// 封面。theme = { bg, fg, dark }，来自主题变量（见 PopupBookReader 的 readCoverTheme）。
export const coverCanvas = ({ title, motif, sign, no, kindLabel }, theme) => {
  const k = 1024 / BW;
  const c = mkCanvas(1024, Math.round(BH * k));
  const x = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  x.fillStyle = theme.bg;
  x.fillRect(0, 0, w, h);

  const soft = theme.dark ? 'rgba(255,255,255,0.22)' : 'rgba(120,120,120,0.20)';
  const soft2 = theme.dark ? 'rgba(120,120,120,0.45)' : 'rgba(180,180,180,0.28)';
  if (motif === 'mist' || motif === 'ink') {
    orb(x, w * 0.62, h * 0.18, w * 0.62, soft);
    orb(x, w * 0.12, h * 0.95, w * 0.52, soft2);
  } else if (motif === 'blank') {
    x.strokeStyle = theme.fg;
    x.globalAlpha = 0.35;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(w * 0.5, h * 0.42, w * 0.2, 0, Math.PI * 2);
    x.stroke();
    x.globalAlpha = 1;
  } else if (motif === 'line') {
    x.strokeStyle = theme.fg;
    x.globalAlpha = 0.25;
    x.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      const yy = h * (0.12 + i * 0.045);
      x.beginPath();
      x.moveTo(w * 0.11, yy);
      x.lineTo(w * 0.89, yy);
      x.stroke();
    }
    x.globalAlpha = 1;
  }

  x.fillStyle = theme.fg;
  x.globalAlpha = 0.7;
  x.font = `500 24px ${MONO}`;
  x.textAlign = 'left';
  x.fillText(String(no || '').split('').join(' '), w * 0.11, h * 0.075);
  x.globalAlpha = 1;

  // 标题：按宽度换行，最多 3 行
  const size = w * 0.092;
  x.font = `500 ${size}px ${SERIF}`;
  const lines = wrapText(x, title || '', w * 0.78).slice(0, 3);
  const lineH = size * 1.25;
  const startY = h * 0.84 - (lines.length - 1) * lineH;
  lines.forEach((l, i) => x.fillText(l, w * 0.11, startY + i * lineH));

  x.globalAlpha = 0.7;
  x.font = `400 24px ${MONO}`;
  x.fillText(`POP-UP / ${kindLabel || ''}`, w * 0.11, h * 0.93);
  if (sign) {
    x.textAlign = 'right';
    x.fillText(sign, w * 0.89, h * 0.93);
  }
  x.globalAlpha = 1;
  return c;
};

// 把 spreads 整理成每一页的排版 spec。
// 返回 { leftSpecs[i]（第 i+1 个跨页的左页）, rightSpecs[i], endSpec }。
export const buildPageSpecs = (book) => {
  const spreads = Array.isArray(book.spreads) ? book.spreads : [];
  const leftSpecs = [];
  const rightSpecs = [];

  spreads.forEach((spread, i) => {
    leftSpecs.push({ items: spread.left?.items || [], no: String(i * 2 + 1), side: 'l' });
    const right = spread.right || {};
    const items = [];
    if (right.model) {
      if (right.caption) items.push({ t: 'cap', k: `FIG. ${i + 1}`, y: 0.905, s: right.caption });
    } else {
      // 模型不合法时降级成纯文字页
      items.push({ t: 'space', n: 120 });
      if (right.caption) items.push({ t: 'p', s: right.caption });
      items.push({ t: 'rule', y: 0.5 });
    }
    rightSpecs.push({ items, no: String(i * 2 + 2), side: 'r' });
  });

  const endSpec = {
    items: [
      { t: 'kick', s: 'END' },
      { t: 'h', s: '合上这一本' },
      { t: 'p', s: '点右下角的按钮，回到封面。' },
      { t: 'space', n: 40 },
      ...(book.sign ? [{ t: 'sign', s: book.sign }] : []),
    ],
    no: String(spreads.length * 2 + 1),
    side: 'l',
  };

  return { leftSpecs, rightSpecs, endSpec };
};
