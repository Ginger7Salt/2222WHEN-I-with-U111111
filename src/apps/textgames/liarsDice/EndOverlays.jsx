// src/apps/textgames/liarsDice/EndOverlays.jsx
//
// 两段收尾用的全屏演出，都接在“开骰”演出之后各播一次：
// - OutOverlay：你的最后一颗骰子裂开，盖上“出局”章；
// - WinOverlay：你成了最后剩下的人，放射光芒、金色骰子、礼花、筹码数字滚动。
// 演出本身不改变任何游戏状态，演完调 onDone；点一下屏幕可以跳过。

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Die3D } from './Dice3D';
import { GOLD, burst, centerOf, createTimeline, oriStr, rint, rnd, shakeEl, tumbleTo } from './diceFx';

export const OutOverlay = ({ onDone }) => {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const dieRef = useRef(null);
  const titleRef = useRef(null);
  const stampRef = useRef(null);
  const sparkRef = useRef(null);
  const tlRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const value = useMemo(() => rint(2, 6), []);

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    const root = rootRef.current;
    const stage = stageRef.current;
    const die = dieRef.current;
    const sparks = sparkRef.current;
    if (!root || !die) return undefined;

    (async () => {
      tl.play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      tl.play(
        die,
        [
          { transform: 'translateY(-62vh) scale(.6)', opacity: 0 },
          { transform: 'translateY(10px) scale(1.04)', opacity: 1, offset: 0.7 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ],
        { duration: 780, easing: 'cubic-bezier(.3,.7,.4,1)' }
      );
      tumbleTo(tl, die, value, 1000, 3);
      await tl.wait(1150);

      // 裂开：抖动、泛白、迸出碎片
      const c = centerOf(die, sparks);
      await tl.play(
        die,
        [
          { transform: 'translateX(0) scale(1)', filter: 'brightness(1)' },
          { transform: 'translateX(-6px) scale(1.04)' },
          { transform: 'translateX(6px) scale(1.06)' },
          { transform: 'translateX(-5px) scale(1.1)' },
          { transform: 'translateX(5px) scale(1.14)' },
          { transform: 'translateX(0) scale(1.2)', filter: 'brightness(2.4)' },
        ],
        { duration: 480, fill: 'forwards' }
      );
      burst(tl, sparks, {
        x: c.x,
        y: c.y,
        count: 38,
        colors: ['#fffdf7', '#c5a059', '#961b2e', '#9e7d3b', '#ff5a73'],
        spread: 190,
        size: [5, 13],
        gravity: 90,
        life: [700, 1200],
      });
      shakeEl(tl, stage, 16, 420);
      tl.play(die, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
      tl.play(titleRef.current, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420, delay: 200 });
      tl.play(
        stampRef.current,
        [
          { opacity: 0, transform: 'scale(3) rotate(-14deg)' },
          { opacity: 1, transform: 'scale(.95) rotate(-6deg)', offset: 0.6 },
          { opacity: 1, transform: 'scale(1) rotate(-6deg)' },
        ],
        { duration: 440, delay: 560, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
      await tl.wait(2300);
      await tl.play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 320 });
      doneRef.current();
    })();

    return () => tl.cancel();
  }, [value]);

  return createPortal(
    <div ref={rootRef} className="tld-screen tld-fx tld-fx-out" onClick={() => tlRef.current && tlRef.current.skip()}>
      <div ref={stageRef} className="tld-fx-stage">
        <div className="tld-end-col">
          <div className="tld-end-diebox">
            <Die3D ref={dieRef} value={value} size={120} />
          </div>
          <div ref={titleRef} className="tld-end-title">你的骰子用光了</div>
          <div ref={stampRef} className="tld-end-stamp">出局</div>
        </div>
        <div ref={sparkRef} className="tld-fx-spark" />
      </div>
    </div>,
    document.body
  );
};

// amount：这一局净赚的筹码；balance：结算后的筹码池余额（还没算出来就是 null，不显示）。
export const WinOverlay = ({ amount, balance, onDone }) => {
  const rootRef = useRef(null);
  const raysRef = useRef(null);
  const dieRef = useRef(null);
  const titleRef = useRef(null);
  const numRef = useRef(null);
  const sparkRef = useRef(null);
  const tlRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    const root = rootRef.current;
    const die = dieRef.current;
    const num = numRef.current;
    const sparks = sparkRef.current;
    if (!root || !die) return undefined;

    (async () => {
      tl.play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      tl.play(
        raysRef.current,
        [
          { opacity: 0, transform: 'scale(.4) rotate(0deg)' },
          { opacity: 1, transform: 'scale(1) rotate(60deg)' },
        ],
        { duration: 1200, fill: 'forwards' }
      );
      tl.play(
        die,
        [
          { transform: 'scale(.2)', opacity: 0 },
          { transform: 'scale(1.18)', opacity: 1, offset: 0.65 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 760, easing: 'cubic-bezier(.2,.9,.3,1)' }
      );
      // 金色骰子持续缓慢转动
      tl.play(die.firstChild, [{ transform: oriStr(1, 0, 0, 0) }, { transform: oriStr(1, 0, 360, 0) }], {
        duration: tl.reduced ? 12000 : 5200,
        iterations: Infinity,
        fill: 'none',
        easing: 'linear',
      });
      await tl.wait(500);

      // 礼花
      const box = sparks.getBoundingClientRect();
      const colors = GOLD.concat(['#961b2e', '#fffdf7']);
      const pieces = tl.reduced ? 14 : 54;
      for (let i = 0; i < pieces; i += 1) {
        const p = document.createElement('i');
        p.className = 'tld-confetti';
        const w = rnd(6, 11);
        p.style.cssText = `left:${rnd(0, box.width)}px;width:${w}px;height:${w * rnd(1.2, 2)}px;background:${colors[i % colors.length]}`;
        sparks.appendChild(p);
        tl.play(
          p,
          [
            { transform: 'translateY(0) rotateX(0deg) rotateZ(0deg)', opacity: 1 },
            {
              transform: `translateY(${box.height + 40}px) translateX(${rnd(-80, 80)}px) rotateX(${rnd(360, 1080)}deg) rotateZ(${rnd(-360, 360)}deg)`,
              opacity: 1,
            },
          ],
          { duration: rnd(2200, 3800), delay: rnd(0, 900), fill: 'forwards', easing: 'cubic-bezier(.3,.2,.5,1)' }
        ).then(() => p.remove());
      }
      const c = centerOf(die, sparks);
      burst(tl, sparks, { x: c.x, y: c.y, count: 30, colors: GOLD, spread: 230, size: [3, 9], gravity: 30, life: [700, 1200] });

      tl.play(titleRef.current, [{ opacity: 0, transform: 'translateY(16px) scale(.9)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 480 });
      tl.play(num, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 480, delay: 240 });

      // 数字滚动
      await new Promise((resolve) => {
        const t0 = performance.now();
        const dur = tl.T(1300);
        const tick = (now) => {
          if (tl.cancelled) return;
          const k = Math.min(1, (now - t0) / dur);
          num.textContent = `+${Math.round(amount * (1 - (1 - k) ** 3))}`;
          if (k < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await tl.wait(2200);
      await tl.play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 360 });
      doneRef.current();
    })();

    return () => tl.cancel();
    // amount 在演出期间不会变。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div ref={rootRef} className="tld-screen tld-fx tld-fx-win" onClick={() => tlRef.current && tlRef.current.skip()}>
      <div ref={raysRef} className="tld-end-rays" />
      <div className="tld-fx-stage">
        <div className="tld-end-col">
          <div className="tld-end-diebox">
            <Die3D ref={dieRef} value={1} size={104} gold />
          </div>
          <div ref={titleRef} className="tld-end-title">你赢到了最后</div>
          <div ref={numRef} className="tld-end-num">+0</div>
          {balance !== null && balance !== undefined && <div className="tld-end-sub">筹码池余额 {balance}</div>}
        </div>
        <div ref={sparkRef} className="tld-fx-spark" />
      </div>
    </div>,
    document.body
  );
};