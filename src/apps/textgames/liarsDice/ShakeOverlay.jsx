// src/apps/textgames/liarsDice/ShakeOverlay.jsx
//
// 每一轮开始的全屏“摇骰”演出（伪 3D）：磨砂薄纱铺满屏幕，骰盅从下方升起，
// 左右甩动并带两层残影，骰子被抛起又落回盅里；最后一块磨砂盖板从上方砸在
// 金色法阵上，地面冲击波加震屏。演出本身不决定任何游戏结果，只是一段过场：演完调
// onDone，界面这时露出桌面，磨砂骰盅已经盖在骰子上面。
//
// 点一下屏幕可以跳过。用 portal 挂在 document.body 上，避免被大厅里祖先
// 元素的 transform / overflow 影响 position: fixed。

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { CupSymbols, Die3D } from './Dice3D';
import { GOLD, burst, createTimeline, oriStr, rint, rnd, shakeEl } from './diceFx';

const ShakeOverlay = ({ onDone }) => {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const cupRef = useRef(null);
  const ghost1Ref = useRef(null);
  const ghost2Ref = useRef(null);
  const ringRef = useRef(null);
  const plateRef = useRef(null);
  const capRef = useRef(null);
  const sparkRef = useRef(null);
  const dieRefs = useRef([]);
  const tlRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const tossValues = useMemo(() => Array.from({ length: 5 }, () => rint(1, 6)), []);

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    const root = rootRef.current;
    const stage = stageRef.current;
    const cup = cupRef.current;
    const ring = ringRef.current;
    const plate = plateRef.current;
    const cap = capRef.current;
    const sparks = sparkRef.current;
    const ghosts = [ghost2Ref.current, ghost1Ref.current];
    const dice = dieRefs.current.filter(Boolean);
    if (!root || !cup) return undefined;

    (async () => {
      tl.play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
      tl.play(cap, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 300 });

      // 入场：骰盅从下方升起，带两层残影
      const layers = [...ghosts, cup];
      layers.forEach((l) =>
        tl.play(l, [{ transform: 'translateY(60vh) rotate(8deg)' }, { transform: 'translateY(0) rotate(0deg)' }], {
          duration: 430,
          easing: 'cubic-bezier(.2,.85,.25,1)',
        })
      );
      tl.play(cup, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      await tl.wait(470);

      // 摇：骰盅左右甩动 + 残影拖尾 + 骰子被抛起又落回盅里
      const cycle = [
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: 'translate(-38px,-10px) rotate(-13deg)' },
        { transform: 'translate(34px,6px) rotate(12deg)' },
        { transform: 'translate(-26px,-4px) rotate(-8deg)' },
        { transform: 'translate(0,0) rotate(0deg)' },
      ];
      layers.forEach((l, i) =>
        tl.play(l, cycle, { duration: 300, iterations: 5, delay: (layers.length - 1 - i) * 55, easing: 'ease-in-out' })
      );
      for (let k = 0; k < 3; k += 1) {
        dice.forEach((d, i) => {
          const dx = rnd(-120, 120);
          const up = rnd(150, 250);
          const dz = rnd(-60, 60);
          const delay = k * 440 + i * 50;
          tl.play(
            d,
            [
              { transform: 'translate3d(0,0,0) scale(.5)', opacity: 0 },
              { transform: `translate3d(${dx * 0.6}px,${-up * 0.6}px,${dz}px) scale(1.05)`, opacity: 1, offset: 0.35 },
              { transform: `translate3d(${dx}px,${-up}px,${dz}px) scale(1.12)`, opacity: 1, offset: 0.5 },
              { transform: `translate3d(${dx * 0.3}px,6px,0) scale(.6)`, opacity: 0 },
            ],
            // 同一个元素上叠多段带延迟的动画，必须只用 forwards：
            // 否则后面几段的“开始前”状态会覆盖前面正在播放的那一段。
            { duration: 520, delay, fill: 'forwards', easing: 'cubic-bezier(.3,.6,.6,1)' }
          );
          const v = rint(1, 6);
          const sign = Math.random() < 0.5 ? -1 : 1;
          tl.play(
            d.firstChild,
            [{ transform: oriStr(v, 0, 0, 0) }, { transform: oriStr(v, 540 * sign, 720, rint(-200, 200)) }],
            { duration: 520, delay, fill: 'forwards' }
          );
        });
      }
      await tl.wait(1650);

      // 落板：碗淡出，磨砂盖板从上方砸在法阵上，把骰子盖住——和接下来桌面上
      // 盖着你骰子的那块板是同一个东西。
      ghosts.forEach((g) => tl.play(g, [{ opacity: 0.2 }, { opacity: 0 }], { duration: 160 }));
      tl.play(
        cup,
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: 'translate(0,4vh) rotate(0deg) scale(.82)', opacity: 0 },
        ],
        { duration: 320, easing: 'ease-in' }
      );
      tl.play(
        plate,
        [
          { transform: 'translate(-50%,-50%) translateY(-52vh) scale(1.2) rotate(-5deg)', opacity: 0 },
          { transform: 'translate(-50%,-50%) translateY(0) scale(1.02,1) rotate(0deg)', opacity: 1, offset: 0.75 },
          { transform: 'translate(-50%,-50%) translateY(6px) scale(1.1,.9)', opacity: 1, offset: 0.88 },
          { transform: 'translate(-50%,-50%) translateY(0) scale(1)', opacity: 1 },
        ],
        { duration: 520, delay: 120, easing: 'cubic-bezier(.45,0,.75,.55)' }
      );
      await tl.wait(510);

      // 冲击波 + 灰尘 + 震屏
      tl.play(
        ring,
        [
          { transform: 'translate(-50%,-50%) rotateX(70deg) scale(.3)', opacity: 0.95 },
          { transform: 'translate(-50%,-50%) rotateX(70deg) scale(9)', opacity: 0 },
        ],
        { duration: 720, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }
      );
      const box = sparks.getBoundingClientRect();
      burst(tl, sparks, { x: box.width / 2, y: box.height * 0.66, count: 26, colors: GOLD, spread: 190, size: [3, 8], gravity: 20 });
      shakeEl(tl, stage, 9, 340);
      await tl.wait(760);

      await tl.play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 380 });
      doneRef.current();
    })();

    return () => tl.cancel();
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      className="tld-screen tld-fx tld-fx-veil"
      onClick={() => tlRef.current && tlRef.current.skip()}
    >
      <CupSymbols />
      <div ref={stageRef} className="tld-fx-stage">
        <div className="tld-sk-floor">
          <svg className="tld-sk-sigil" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" strokeDasharray="1.2 2.4" />
            <circle cx="50" cy="50" r="38" />
            <path d="M50 8 L92 50 L50 92 L8 50 Z" />
            <circle cx="50" cy="50" r="12" />
            <line x1="50" y1="4" x2="50" y2="96" />
            <line x1="4" y1="50" x2="96" y2="50" />
          </svg>
        </div>
        <div className="tld-sk-cuppos">
          <div ref={ghost2Ref} className="tld-sk-ghost tld-sk-ghost-far">
            <svg viewBox="0 0 300 170"><use href="#tld-sym-bowl" /></svg>
          </div>
          <div ref={ghost1Ref} className="tld-sk-ghost">
            <svg viewBox="0 0 300 170"><use href="#tld-sym-bowl" /></svg>
          </div>
          <div ref={cupRef} className="tld-sk-cup">
            <svg viewBox="0 0 300 170"><use href="#tld-sym-bowl" /></svg>
            <div className="tld-sk-toss">
              {tossValues.map((v, i) => (
                <Die3D
                  key={i}
                  ref={(el) => {
                    dieRefs.current[i] = el;
                  }}
                  value={v}
                  size={40}
                />
              ))}
            </div>
          </div>
        </div>
        <div ref={plateRef} className="tld-sk-plate">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d="M20 90 L20 40 Q50 5 80 40 L80 90 Z" />
            <line x1="50" y1="10" x2="50" y2="90" />
            <circle cx="50" cy="45" r="8" />
          </svg>
        </div>
        <div ref={ringRef} className="tld-sk-ring" />
        <div ref={capRef} className="tld-sk-cap">摇骰中</div>
        <div ref={sparkRef} className="tld-fx-spark" />
      </div>
    </div>,
    document.body
  );
};

export default ShakeOverlay;