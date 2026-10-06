// src/apps/textgames/liarsDice/diceFx.js
//
// 吹牛骰子动效的底层小工具：Web Animations + 少量 DOM 操作，不依赖 React。
// 所有全屏演出（摇骰 / 开骰 / 出局 / 获胜）都用 createTimeline() 拿一个
// “时间线”，用它的 play / wait 排演出；组件卸载时调 tl.cancel()，所有还没
// 播完的动画和等待都会被一并取消，之后的步骤不会再执行。
//
// 减少动效：系统开了 prefers-reduced-motion 时所有时长压到 1/4，粒子也
// 减少，不另外写一套静态版本。
//
// 3D 骰子：真正的 CSS 立方体（六个面各自带点数，对面之和为 7）。ORI 表
// 记录“让某个点数转到正面”需要的 [rotateX, rotateY]；oriStr 在这个基础上
// 再整体微微倾斜，让顶面和侧面看得到。动画里所有关键帧都用 oriStr 生成，
// 函数列表的结构固定，浏览器才能逐项插值，而且最后一定落在正确的朝向上。

export const GOLD = ['#f6e6b6', '#c5a059', '#edd9a8', '#9e7d3b', '#fff6d8'];
export const CRIM = ['#ff5a73', '#961b2e', '#e8465f', '#fffdf7', '#c5a059'];

export const rnd = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const NEVER = () => new Promise(() => {});

// 取消之后，所有 await 住的步骤都不会再往下走（返回一个永远不 resolve 的
// promise），所以演出函数里不用到处检查“是不是已经取消了”。
export const createTimeline = () => {
  const tl = {
    speed: 1,
    cancelled: false,
    reduced: prefersReducedMotion(),
    anims: new Set(),
    timers: new Set(),
  };

  tl.T = (ms) => ms * tl.speed * (tl.reduced ? 0.25 : 1);

  tl.wait = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        tl.timers.delete(id);
        resolve();
      }, tl.T(ms));
      tl.timers.add(id);
    });

  tl.play = (el, keyframes, opts = {}) => {
    if (!el || typeof el.animate !== 'function') return Promise.resolve();
    const anim = el.animate(keyframes, {
      fill: 'both',
      easing: 'ease',
      ...opts,
      duration: Math.max(1, tl.T(opts.duration ?? 300)),
      delay: tl.T(opts.delay ?? 0),
    });
    tl.anims.add(anim);
    return anim.finished.catch(() => {}).then(() => (tl.cancelled ? NEVER() : undefined));
  };

  // 点一下屏幕跳过：后面的等待和动画时长压到很短，演出很快收尾。
  tl.skip = () => {
    tl.speed = 0.05;
  };

  tl.cancel = () => {
    tl.cancelled = true;
    tl.timers.forEach(clearTimeout);
    tl.timers.clear();
    tl.anims.forEach((a) => {
      try {
        a.cancel();
      } catch (err) {
        // 已经结束的动画取消会抛错，忽略。
      }
    });
    tl.anims.clear();
  };

  return tl;
};

export const shakeEl = (tl, el, amp = 10, ms = 360) => {
  if (tl.reduced) return Promise.resolve();
  return tl.play(
    el,
    [
      { transform: 'translate(0,0)' },
      { transform: `translate(${-amp}px,${amp / 2}px)` },
      { transform: `translate(${amp}px,${-amp / 2}px)` },
      { transform: `translate(${-amp / 2}px,${-amp / 3}px)` },
      { transform: `translate(${amp / 3}px,${amp / 3}px)` },
      { transform: 'translate(0,0)' },
    ],
    { duration: ms, fill: 'none', easing: 'linear' }
  );
};

export const centerOf = (el, layer) => {
  const a = el.getBoundingClientRect();
  const b = layer.getBoundingClientRect();
  return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
};

// 粒子迸发：在 layer（要求 position:absolute/relative 的容器）里的 (x, y) 处。
export const burst = (
  tl,
  layer,
  { x, y, count = 18, colors = GOLD, spread = 140, size = [4, 9], life = [500, 900], gravity = 60 }
) => {
  if (!layer) return;
  const n = tl.reduced ? Math.ceil(count / 4) : count;
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement('i');
    p.className = 'tld-spark';
    const s = rnd(size[0], size[1]);
    const ang = rnd(0, Math.PI * 2);
    const dist = spread * rnd(0.35, 1.1);
    p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s * rnd(0.6, 1.2)}px;background:${colors[i % colors.length]}`;
    layer.appendChild(p);
    tl.play(
      p,
      [
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist + gravity}px)) scale(.25) rotate(${rnd(-540, 540)}deg)`,
          opacity: 0,
        },
      ],
      { duration: rnd(life[0], life[1]), easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' }
    ).then(() => p.remove());
  }
};

// ---------- 3D 骰子 ----------
// 点阵坐标：[cx, cy, r]（100x100 的画布）。
export const PIPS = {
  1: [[50, 50, 14]],
  2: [[30, 30, 9], [70, 70, 9]],
  3: [[28, 28, 9], [50, 50, 9], [72, 72, 9]],
  4: [[30, 30, 9], [70, 30, 9], [30, 70, 9], [70, 70, 9]],
  5: [[28, 28, 9], [72, 28, 9], [50, 50, 9], [28, 72, 9], [72, 72, 9]],
  6: [[30, 24, 8], [70, 24, 8], [30, 50, 8], [70, 50, 8], [30, 76, 8], [70, 76, 8]],
};

// 立方体六个面：[面的名字, 点数]。
export const FACES = [
  ['front', 1],
  ['back', 6],
  ['right', 3],
  ['left', 4],
  ['top', 2],
  ['bottom', 5],
];

// 让某个点数转到正面需要的 [rotateX, rotateY]。
export const ORI = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

export const oriStr = (value, ax = 0, ay = 0, az = 0) => {
  const [rx, ry] = ORI[value];
  return `rotateX(-18deg) rotateY(24deg) rotateX(${rx + ax}deg) rotateY(${ry + ay}deg) rotateZ(${az}deg)`;
};

// 让一颗骰子（.tld-d3 元素）翻滚几圈，最后落在 value 朝上的位置。
export const tumbleTo = (tl, die, value, ms = 700, spins = 2) => {
  if (!die || !die.firstChild) return Promise.resolve();
  const sign = () => (Math.random() < 0.5 ? -1 : 1);
  die.dataset.value = String(value);
  return tl.play(
    die.firstChild,
    [
      { transform: oriStr(value, 360 * rint(1, spins) * sign(), 360 * rint(1, spins) * sign(), rint(-170, 170)) },
      { transform: oriStr(value, 0, 0, 0) },
    ],
    { duration: ms, easing: 'cubic-bezier(.16,.75,.25,1)' }
  );
};