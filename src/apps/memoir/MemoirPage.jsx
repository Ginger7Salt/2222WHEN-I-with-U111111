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
// 里塞，而是换成瓶身下面一排可以点开的"礼物架"。罐子里的糖果数量越接近
// 上限，单颗糖就越小（在 CANDY_SIZE_MIN ~ CANDY_SIZE_MAX 之间线性收缩），
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
//
// 重力方向/大小现在是可变的（gx/gy），由"晃罐子"的交互驱动：拖拽瓶身
// 空白处，或者授权后用手机陀螺仪实时倾斜，糖果会跟着往对应方向滚动、
// 堆在低的一侧，松手/回正按钮会让重力慢慢回到"正常竖直向下"。
// ----------------------------------------------------------------------
const GRAVITY_MAG = 0.55;
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

const stepPhysics = (list, w, h, radius, gx, gy) => {
  list.forEach((o) => {
    if (o.dragging) return;
    o.vx += gx;
    o.vy += gy;
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
// React 管理反而更卡、更绕）。React 只负责挂载/卸载、点开的说明卡片，
// 以及晃罐子的提示文字/按钮/状态这些低频更新的部分。
// ----------------------------------------------------------------------
const MemoirJar = ({ memoirs, onPick }) => {
  const jarRef = useRef(null);
  const gxRef = useRef(0);
  const gyRef = useRef(GRAVITY_MAG);
  const targetGxRef = useRef(0);
  const targetGyRef = useRef(GRAVITY_MAG);
  const usingLiveRef = useRef(false);

  const [hintVisible, setHintVisible] = useState(true);
  const [tiltStatus, setTiltStatus] = useState('当前：拖拽模拟倾斜');

  // 陀螺仪回调只依赖 ref，逻辑本身不需要随组件重渲染而变化，
  // 用 useRef 固定住这个函数，方便加/卸监听时用同一个引用。
  const handleOrientationRef = useRef((ev) => {
    if (ev.beta === null || ev.gamma === null) return;

    const beta = Math.max(-45, Math.min(45, ev.beta - 20));
    const gamma = Math.max(-45, Math.min(45, ev.gamma));

    targetGxRef.current = (gamma / 45) * GRAVITY_MAG * 1.4;
    targetGyRef.current = GRAVITY_MAG * 0.5 + (beta / 45) * GRAVITY_MAG;
  });

  useEffect(() => () => {
    window.removeEventListener('deviceorientation', handleOrientationRef.current, true);
  }, []);

  useEffect(() => {
    const jarEl = jarRef.current;
    if (!jarEl || memoirs.length === 0) return undefined;

    let cancelled = false;
    let rafId = null;
    let dragJar = false;
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
      stepPhysics(sim, rect.width, rect.height, radius, 0, GRAVITY_MAG);
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
        // 拿住这颗糖，别让事件继续冒泡触发瓶身的"晃一晃"手势。
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        o.dragging = true;
        moved = false;
        const r = jarEl.getBoundingClientRect();
        o.offX = (e.clientX - r.left) - o.x;
        o.offY = (e.clientY - r.top) - o.y;
        o.vx = 0;
        o.vy = 0;
        setHintVisible(false);
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

    const loop = () => {
      if (cancelled) return;
      gxRef.current += (targetGxRef.current - gxRef.current) * 0.12;
      gyRef.current += (targetGyRef.current - gyRef.current) * 0.12;
      const r = jarEl.getBoundingClientRect();
      stepPhysics(sim, r.width, r.height, radius, gxRef.current, gyRef.current);
      sim.forEach((o) => { if (!o.dragging) place(o); });
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    // ---- 拖拽瓶身空白处＝晃罐子：把手指相对瓶身中心的偏移换算成一个
    // 重力方向，松手后（如果没有开启陀螺仪）重力再慢慢回到竖直向下。----
    const applyDragGravity = (e) => {
      const r = jarEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.35;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      targetGxRef.current = Math.max(-1, Math.min(1, dx)) * GRAVITY_MAG * 1.4;
      targetGyRef.current = GRAVITY_MAG * 0.5 + Math.max(-0.3, Math.min(1, dy)) * GRAVITY_MAG;
    };

    const handleJarPointerDown = (e) => {
      if (e.target.closest('.memoir-candy')) return;
      dragJar = true;
      setHintVisible(false);
      jarEl.setPointerCapture(e.pointerId);
      applyDragGravity(e);
    };
    const handleJarPointerMove = (e) => { if (dragJar) applyDragGravity(e); };
    const endJarDrag = () => {
      if (!dragJar) return;
      dragJar = false;
      if (!usingLiveRef.current) {
        targetGxRef.current = 0;
        targetGyRef.current = GRAVITY_MAG;
      }
    };

    jarEl.addEventListener('pointerdown', handleJarPointerDown);
    jarEl.addEventListener('pointermove', handleJarPointerMove);
    jarEl.addEventListener('pointerup', endJarDrag);
    jarEl.addEventListener('pointercancel', endJarDrag);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      sim.forEach((o) => o.el?.remove());
      jarEl.removeEventListener('pointerdown', handleJarPointerDown);
      jarEl.removeEventListener('pointermove', handleJarPointerMove);
      jarEl.removeEventListener('pointerup', endJarDrag);
      jarEl.removeEventListener('pointercancel', endJarDrag);
    };
  }, [memoirs, onPick]);

  const startOrientation = () => {
    usingLiveRef.current = true;
    setHintVisible(false);
    window.addEventListener('deviceorientation', handleOrientationRef.current, true);
  };

  const requestShake = () => {
    if (typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((res) => {
          if (res === 'granted') {
            startOrientation();
            setTiltStatus('已开启，晃动手机试试');
          } else {
            setTiltStatus('未授权，继续用拖拽模拟');
          }
        })
        .catch(() => setTiltStatus('拿不到陀螺仪权限，先用拖拽体验'));
    } else if (typeof window.DeviceOrientationEvent !== 'undefined') {
      startOrientation();
      setTiltStatus('已监听陀螺仪（若无反应，继续用拖拽体验）');
    } else {
      setTiltStatus('当前环境不支持陀螺仪，用拖拽模拟倾斜');
    }
  };

  const handleReset = () => {
    targetGxRef.current = 0;
    targetGyRef.current = GRAVITY_MAG;
    if (!usingLiveRef.current) setTiltStatus('当前：拖拽模拟倾斜');
  };

  return (
    <div className="memoir-jar-wrap">
      <div className="memoir-jar-lid" />
      <div className="memoir-jar-neck" />
      <div ref={jarRef} className="memoir-jar-body">
        {hintVisible && (
          <div className="memoir-tilt-hint">
            拖星星＝拿起来看
            <br />
            拖空白处＝晃一晃罐子
          </div>
        )}
      </div>
      <div className="memoir-jar-controls">
        <button type="button" className="memoir-jar-btn is-primary" onClick={requestShake}>
          开启摇一摇
        </button>
        <button type="button" className="memoir-jar-btn" onClick={handleReset}>
          回正
        </button>
      </div>
      <div className="memoir-tilt-status">{tiltStatus}</div>
    </div>
  );
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

// ----------------------------------------------------------------------
// 礼物架：更早的回忆不再堆成一条纵向列表，改成一排可以横向滑动的小礼物
// 盒子，跟糖果一样默认是黑白（灰）的。点一份，丝带会显出那份回忆的颜色、
// 盒盖打开，具体内容复用下面同一张 SpecimenCard 展示——跟点糖果是同一
// 套"点开看详情"的交互，感受写在同一个位置，不用来回找。
// ----------------------------------------------------------------------
const GiftShelf = ({ memoirs, openId, onPick }) => (
  <div className="memoir-gift-shelf">
    {memoirs.map((memoir) => {
      const emotion = getMemoirEmotion(memoir.emotion);
      const hex = emotion ? emotion.dot : NEUTRAL_HEX;
      const isOpen = openId === memoir.id;

      return (
        <button
          key={memoir.id}
          type="button"
          className={`memoir-gift-slot${isOpen ? ' is-open' : ''}`}
          style={{ '--memoir-glow': hex }}
          onClick={(e) => {
            onPick(memoir);
            e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }}
        >
          <div className="memoir-gift-box">
            <div className="memoir-gift-glow" />
            <div className="memoir-gift-base" />
            <div className="memoir-gift-lid" />
          </div>
          <span className="memoir-gift-tag">{formatTime(memoir.timestamp)}</span>
        </button>
      );
    })}
  </div>
);

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
  // 挤进罐子，改成瓶身下面一排可以点开的礼物盒。
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
            <MemoirJar memoirs={jarMemoirs} onPick={setPickedMemoir} />

            {overflowMemoirs.length > 0 && (
              <div className="mx-auto mt-6" style={{ maxWidth: 360 }}>
                <div
                  className="mb-1 px-1 text-[11px] font-medium tracking-wide opacity-60"
                  style={{ color: 'var(--text-sub)' }}
                >
                  更早的回忆 · {overflowMemoirs.length}
                </div>
                <div
                  className="mb-2 px-1 text-[10.5px] leading-relaxed opacity-50"
                  style={{ color: 'var(--text-sub)' }}
                >
                  一排包好的小礼物，点一份，丝带会显出那份回忆的颜色。
                </div>
                <GiftShelf
                  memoirs={overflowMemoirs}
                  openId={pickedMemoir?.id ?? null}
                  onPick={setPickedMemoir}
                />
              </div>
            )}
          </>
        )}
      </div>

      {pickedMemoir && (
        <SpecimenCard memoir={pickedMemoir} onClose={() => setPickedMemoir(null)} />
      )}

      <style>{`
        .memoir-jar-wrap {
          width: 236px;
          margin: 0 auto;
        }
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
          cursor: grab;
        }
        .memoir-jar-body:active { cursor: grabbing; }
        .memoir-tilt-hint {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 30px;
          font-size: 10.5px;
          line-height: 1.7;
          color: var(--text-sub);
          opacity: 0.65;
          pointer-events: none;
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
        .memoir-jar-controls {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
        }
        .memoir-jar-btn {
          font: inherit;
          font-size: 11.5px;
          font-weight: 600;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-main);
          cursor: pointer;
        }
        .memoir-jar-btn.is-primary {
          background: var(--text-main);
          border-color: var(--text-main);
          color: var(--bg-main);
        }
        .memoir-jar-btn:active { transform: scale(0.97); }
        .memoir-tilt-status {
          text-align: center;
          font-size: 10px;
          color: var(--text-sub);
          opacity: 0.7;
          margin-top: 7px;
        }

        .memoir-gift-shelf {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding: 22px 4px 6px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .memoir-gift-shelf::-webkit-scrollbar { display: none; }
        .memoir-gift-slot {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          cursor: pointer;
        }
        .memoir-gift-box {
          position: relative;
          width: 62px;
          height: 48px;
          perspective: 360px;
        }
        .memoir-gift-glow {
          position: absolute;
          left: 50%;
          top: 40%;
          width: 110px;
          height: 110px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, var(--memoir-glow) 0%, transparent 68%);
          opacity: 0;
          filter: blur(6px);
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        .memoir-gift-base {
          position: absolute;
          inset: 8px 0 0;
          background: var(--card-bg);
          border: 1.5px solid var(--card-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }
        .memoir-gift-base::before,
        .memoir-gift-base::after {
          content: '';
          position: absolute;
          background: var(--text-sub);
          opacity: 0.4;
          transition: background 0.4s ease, opacity 0.4s ease;
        }
        .memoir-gift-base::before {
          left: 50%;
          top: 0;
          bottom: 0;
          width: 8px;
          transform: translateX(-50%);
        }
        .memoir-gift-base::after {
          top: 42%;
          left: 0;
          right: 0;
          height: 8px;
          transform: translateY(-50%);
        }
        .memoir-gift-lid {
          position: absolute;
          left: -3px;
          right: -3px;
          top: 2px;
          height: 15px;
          background: var(--control-soft-bg);
          border: 1.5px solid var(--card-border);
          border-radius: 6px 6px 3px 3px;
          transform-origin: 50% 100%;
          transform: rotateX(0deg);
          transition: transform 0.55s cubic-bezier(.2,.9,.3,1.2);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
        }
        .memoir-gift-lid::before {
          content: '';
          position: absolute;
          left: 50%;
          top: -8px;
          width: 14px;
          height: 14px;
          transform: translateX(-50%);
          border-radius: 50% 50% 50% 0;
          background: var(--text-sub);
          opacity: 0.4;
          transition: background 0.4s ease, opacity 0.4s ease;
        }
        .memoir-gift-tag {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          color: var(--text-sub);
          opacity: 0.7;
          transition: color 0.3s ease, opacity 0.3s ease;
        }
        .memoir-gift-slot.is-open .memoir-gift-lid {
          transform: rotateX(-128deg) translateY(2px);
        }
        .memoir-gift-slot.is-open .memoir-gift-glow {
          opacity: 0.5;
        }
        .memoir-gift-slot.is-open .memoir-gift-base::before,
        .memoir-gift-slot.is-open .memoir-gift-base::after,
        .memoir-gift-slot.is-open .memoir-gift-lid::before {
          background: var(--memoir-glow);
          opacity: 0.9;
        }
        .memoir-gift-slot.is-open .memoir-gift-tag {
          color: var(--text-main);
          opacity: 1;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default MemoirPage;