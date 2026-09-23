import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookHeart } from 'lucide-react';

import { getMemoirsForChat } from './memoirService';
import { getMemoirEmotion } from './memoirEmotions';
import { pickForgingLine } from './memoirForgingLines';

const EVENT_TYPE_LABEL = {
  food: '外卖',
  transfer: '转账',
  mcp: 'MCP',
};

const formatTime = (iso) => {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ----------------------------------------------------------------------
// 一颗"糖果"用五角星表示：固定的星形轮廓，只有颜色/大小随回忆变化，
// 不再是之前那个手感很怪的金平糖结晶形状。
//
// 罐子里最多同时装 JAR_CAPACITY 颗糖，多出来的（更早的回忆）不再往罐子
// 里塞，而是在瓶身下面单独列一排小卡片。罐子里的糖果数量越接近上限，
// 单颗糖就越小（在 CANDY_SIZE_MIN ~ CANDY_SIZE_MAX 之间线性收缩），
// 这样糖果堆不会因为数量变多而挤爆瓶身。
// ----------------------------------------------------------------------
const JAR_CAPACITY = 14;
const CANDY_SIZE_MAX = 46;
const CANDY_SIZE_MIN = 26;
const NEUTRAL_HEX = '#9a9a9a';

const getCandySize = (count) => {
  if (count <= 6) return CANDY_SIZE_MAX;
  if (count >= JAR_CAPACITY) return CANDY_SIZE_MIN;
  const t = (count - 6) / (JAR_CAPACITY - 6);
  return CANDY_SIZE_MAX - (CANDY_SIZE_MAX - CANDY_SIZE_MIN) * t;
};

const buildStarPath = (size) => {
  const points = 5;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.47;
  const innerR = outerR * 0.42;
  let d = '';

  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }

  return `${d}Z`;
};

const STAR_PATH = buildStarPath(100);

const candySvgMarkup = (id, hex) => {
  const gid = `memoir-star-${id}`;

  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="${gid}" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
          <stop offset="45%" stop-color="${hex}" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="${hex}" stop-opacity="0.55"/>
        </radialGradient>
      </defs>
      <path d="${STAR_PATH}" fill="url(#${gid})"/>
      <circle cx="42" cy="40" r="7" fill="#fff" opacity="0.45"/>
    </svg>
  `;
};

// ----------------------------------------------------------------------
// 重力 + 碰撞的小物理：糖果掉进瓶子里、互相挤开、贴着瓶壁和瓶底的圆角
// 堆起来，静止时不动——不是"空气粒子"那种到处漂的效果。
// ----------------------------------------------------------------------
const GRAVITY = 0.55;
const FRICTION = 0.93;
const PAD_SIDE = 24;
const PAD_TOP = 40;
const PAD_BOTTOM = 16;
const CORNER_R = 44;

const constrainToJar = (x, y, r, w, h) => {
  const left = PAD_SIDE + r;
  const right = w - PAD_SIDE - r;
  const top = PAD_TOP + r;
  const bottom = h - PAD_BOTTOM - r;

  let nx = Math.max(left, Math.min(right, x));
  let ny = Math.max(top, Math.min(bottom, y));

  const cl = left + CORNER_R;
  const cr = right - CORNER_R;
  const cy = bottom - CORNER_R;

  if (nx < cl && ny > cy) {
    const dx = nx - cl;
    const dy = ny - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (dist > CORNER_R) {
      nx = cl + (dx / dist) * CORNER_R;
      ny = cy + (dy / dist) * CORNER_R;
    }
  } else if (nx > cr && ny > cy) {
    const dx = nx - cr;
    const dy = ny - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (dist > CORNER_R) {
      nx = cr + (dx / dist) * CORNER_R;
      ny = cy + (dy / dist) * CORNER_R;
    }
  }

  return { x: nx, y: ny };
};

const stepPhysics = (list, w, h, radius) => {
  list.forEach((o) => {
    if (o.dragging) return;
    o.vy += GRAVITY;
    o.vx *= FRICTION;
    o.vy *= FRICTION;
    o.x += o.vx;
    o.y += o.vy;
  });

  for (let iter = 0; iter < 3; iter += 1) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = radius * 2 * 0.92;

        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          if (!a.dragging) { a.x -= nx * overlap; a.y -= ny * overlap; }
          if (!b.dragging) { b.x += nx * overlap; b.y += ny * overlap; }
        }
      }
    }
  }

  list.forEach((o) => {
    if (o.dragging) return;
    const c = constrainToJar(o.x, o.y, radius, w, h);
    if (c.x !== o.x) o.vx *= -0.25;
    if (c.y !== o.y) o.vy *= -0.15;
    o.x = c.x;
    o.y = c.y;
  });
};

const seededRandom = (seed) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// ----------------------------------------------------------------------
// 玻璃罐：候选糖果用普通 DOM 节点直接挂在这个容器下，位置由上面的物理
// 循环每帧直接改 transform，不走 React 的重渲染（这类高频动画交给
// React 管理反而更卡、更绕）。React 只负责挂载/卸载和点开的说明卡片。
// ----------------------------------------------------------------------
const MemoirJar = ({ memoirs, onPick }) => {
  const jarRef = useRef(null);
  const candiesRef = useRef([]);

  useEffect(() => {
    const jarEl = jarRef.current;
    if (!jarEl || memoirs.length === 0) return undefined;

    let cancelled = false;
    let rafId = null;
    const rand = seededRandom(2026);
    const rect = jarEl.getBoundingClientRect();

    // 糖果数量越多，单颗越小，避免罐子里的堆越堆越挤。
    const candySize = getCandySize(memoirs.length);
    const radius = candySize / 2;

    // 先在纯数据里把糖果"倒进瓶子"、模拟到彻底安定，用户第一眼看到的
    // 就已经是堆好的样子，不会出现半空中往下掉的过渡态。
    const sim = memoirs.map((memoir, index) => ({
      memoir,
      x: rect.width / 2 + (rand() - 0.5) * 60,
      y: PAD_TOP + 10 - index * 34,
      vx: (rand() - 0.5) * 1.2,
      vy: 0,
      dragging: false,
    }));

    for (let step = 0; step < 260; step += 1) {
      stepPhysics(sim, rect.width, rect.height, radius);
    }

    const place = (o) => {
      o.el.style.transform =
        `translate3d(calc(${o.x.toFixed(1)}px - 50%), calc(${o.y.toFixed(1)}px - 50%), 0)`;
    };

    const wake = (o) => {
      sim.forEach((c) => c.el.classList.remove('memoir-candy-awake'));
      o.el.classList.add('memoir-candy-awake');
      onPick(o.memoir);
    };

    const bindDrag = (o) => {
      const { el } = o;
      let moved = false;

      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        o.dragging = true;
        moved = false;
        const r = jarEl.getBoundingClientRect();
        o.offX = (e.clientX - r.left) - o.x;
        o.offY = (e.clientY - r.top) - o.y;
        o.vx = 0;
        o.vy = 0;
        wake(o);
      });

      el.addEventListener('pointermove', (e) => {
        if (!o.dragging) return;
        moved = true;
        const r = jarEl.getBoundingClientRect();
        const tx = (e.clientX - r.left) - o.offX;
        const ty = (e.clientY - r.top) - o.offY;
        const c = constrainToJar(tx, ty, radius, r.width, r.height);
        o.vx = (c.x - o.x) * 0.6;
        o.vy = (c.y - o.y) * 0.6;
        o.x = c.x;
        o.y = c.y;
        place(o);
      });

      const release = () => {
        if (!o.dragging) return;
        o.dragging = false;
        if (!moved) wake(o);
      };

      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
    };

    sim.forEach((o) => {
      const emotion = getMemoirEmotion(o.memoir.emotion);
      const hex = emotion ? emotion.dot : NEUTRAL_HEX;

      const el = document.createElement('div');
      el.className = 'memoir-candy';
      el.style.width = `${candySize}px`;
      el.style.height = `${candySize}px`;
      el.style.setProperty('--memoir-glow', hex);
      el.innerHTML = candySvgMarkup(o.memoir.id, hex);
      jarEl.appendChild(el);

      o.el = el;
      place(o);
      bindDrag(o);
    });

    candiesRef.current = sim;

    const loop = () => {
      if (cancelled) return;
      const r = jarEl.getBoundingClientRect();
      stepPhysics(sim, r.width, r.height, radius);
      sim.forEach((o) => { if (!o.dragging) place(o); });
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      sim.forEach((o) => o.el?.remove());
      candiesRef.current = [];
    };
  }, [memoirs, onPick]);

  return <div ref={jarRef} className="memoir-jar-body" />;
};

const SpecimenCard = ({ memoir, onClose }) => {
  const emotion = getMemoirEmotion(memoir.emotion);

  return (
    <div
      className="absolute inset-x-3 bottom-3 rounded-2xl p-4 shadow-lg"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 text-lg leading-none opacity-60 hover:opacity-100"
        style={{ color: 'var(--text-sub)' }}
        aria-label="关闭"
      >
        &times;
      </button>

      <div
        className="mb-2 flex items-center justify-between border-b pb-2 font-mono text-[10px] tracking-wide opacity-70"
        style={{ borderColor: 'var(--divider)', color: 'var(--text-sub)' }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: emotion ? emotion.dot : NEUTRAL_HEX }}
          />
          {emotion ? emotion.label : '一段回忆'}
        </span>
        <span
          className="rounded-full px-2 py-0.5"
          style={{ background: 'var(--control-soft-bg)' }}
        >
          {EVENT_TYPE_LABEL[memoir.eventType] || '经历'}
        </span>
      </div>

      <p className="mb-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-main)' }}>
        {memoir.summary}
      </p>
      <p className="mb-2 font-mono text-[10px] opacity-60" style={{ color: 'var(--text-sub)' }}>
        {formatTime(memoir.timestamp)}
      </p>

      {memoir.feeling && (
        <p
          className="border-l-2 pl-2.5 text-[12.5px] italic leading-relaxed"
          style={{ borderColor: 'var(--text-main)', color: 'var(--text-sub)' }}
        >
          {memoir.feeling}
        </p>
      )}
    </div>
  );
};

const MemoirPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [memoirs, setMemoirs] = useState([]);
  const [pickedMemoir, setPickedMemoir] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getMemoirsForChat(chatId).then((rows) => {
      if (cancelled) return;
      setMemoirs(rows);
      setPickedMemoir(null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const forgingLine = pickForgingLine({ memoirs });

  // 罐子里最多同时住 JAR_CAPACITY 颗糖（最新的那些）；再往前的回忆不再
  // 挤进罐子，改成瓶身下面一排可以点开的小卡片。
  const jarMemoirs = memoirs.slice(0, JAR_CAPACITY);
  const overflowMemoirs = memoirs.slice(JAR_CAPACITY);

  return (
    <div className="relative flex h-[100dvh] flex-col" style={{ background: 'var(--bg-main)' }}>
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
          style={{ background: 'var(--control-soft-bg)' }}
          title="返回"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <BookHeart className="h-4 w-4" />
        <span className="text-sm font-medium">回忆录</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: 'var(--card-bg-gradient, var(--card-bg))',
            border: '1px solid var(--card-border)',
            color: 'var(--text-sub)',
          }}
        >
          {forgingLine}
        </div>

        {isLoading ? null : memoirs.length === 0 ? (
          <div className="py-10 text-center text-[12px] leading-relaxed opacity-60">
            还没有记下的共同经历。点外卖、转账，或者让
            {character?.name || 'TA'}
            帮你办点事，都会留在这里。
          </div>
        ) : (
          <>
            <div className="relative mx-auto" style={{ width: 236, height: 356 }}>
              <div className="memoir-jar-lid" />
              <div className="memoir-jar-neck" />
              <MemoirJar memoirs={jarMemoirs} onPick={setPickedMemoir} />
            </div>

            {overflowMemoirs.length > 0 && (
              <div className="mx-auto mt-5" style={{ maxWidth: 340 }}>
                <div
                  className="mb-2 px-1 text-[11px] font-medium tracking-wide opacity-60"
                  style={{ color: 'var(--text-sub)' }}
                >
                  更早的回忆 · {overflowMemoirs.length}
                </div>
                <div className="flex flex-col gap-2">
                  {overflowMemoirs.map((memoir) => {
                    const emotion = getMemoirEmotion(memoir.emotion);
                    return (
                      <button
                        key={memoir.id}
                        type="button"
                        onClick={() => setPickedMemoir(memoir)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                        }}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: emotion ? emotion.dot : NEUTRAL_HEX }}
                        />
                        <span
                          className="flex-1 truncate text-[12.5px]"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {memoir.summary}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                          style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
                        >
                          {EVENT_TYPE_LABEL[memoir.eventType] || '经历'}
                        </span>
                        <span
                          className="shrink-0 font-mono text-[10px] opacity-60"
                          style={{ color: 'var(--text-sub)' }}
                        >
                          {formatTime(memoir.timestamp)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {pickedMemoir && (
        <SpecimenCard memoir={pickedMemoir} onClose={() => setPickedMemoir(null)} />
      )}

      <style>{`
        .memoir-jar-lid {
          width: 96px;
          height: 26px;
          margin: 0 auto;
          border-radius: 6px 6px 2px 2px;
          background: linear-gradient(180deg, var(--text-main) 0%, var(--text-sub) 100%);
          opacity: 0.85;
        }
        .memoir-jar-neck {
          width: 110px;
          height: 16px;
          margin: 0 auto;
          background: var(--control-soft-bg);
          border: 1.5px solid var(--card-border);
          border-bottom: none;
          border-radius: 8px 8px 0 0;
        }
        .memoir-jar-body {
          position: relative;
          width: 100%;
          height: 314px;
          border-radius: 44px 44px 58px 58px;
          background: var(--control-soft-bg);
          border: 1.5px solid var(--card-border);
          box-shadow: inset 0 3px 14px rgba(0, 0, 0, 0.05), inset 0 -12px 24px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          touch-action: none;
        }
        .memoir-candy {
          position: absolute;
          top: 0;
          left: 0;
          cursor: grab;
          touch-action: none;
          will-change: transform;
        }
        .memoir-candy:active { cursor: grabbing; }
        .memoir-candy svg {
          width: 100%;
          height: 100%;
          filter: grayscale(100%) contrast(96%) brightness(1.05);
          transition: filter 0.5s cubic-bezier(.16,1,.3,1), transform 0.35s cubic-bezier(.16,1,.3,1);
        }
        .memoir-candy-awake {
          z-index: 5;
        }
        .memoir-candy-awake svg {
          filter: grayscale(0%) contrast(105%) saturate(1.05) drop-shadow(0 0 10px var(--memoir-glow));
          transform: scale(1.15);
        }
      `}</style>
    </div>
  );
};

export default MemoirPage;