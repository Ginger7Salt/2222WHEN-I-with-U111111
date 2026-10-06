// src/apps/textgames/liarsDice/RevealOverlay.jsx
//
// 质疑之后的全屏“开骰”演出：
// 1. “质疑”两个大字砸下，震屏；
// 2. 每个人面前的磨砂盖板依次掀开，骰子滚落；
// 3. 不算数的骰子暗下去，算数的逐个发光，计数器跳动；
// 4. 和叫点的数量对比，盖章判定（叫点成立 / 抓到了虚张声势）；
// 5. 输家那一排泛红，最后一颗骰子碎裂，飘出 -1。
// 演出用的数据全部来自引擎的 lastReveal（allDice、bid、count、bidderRight、
// loser、eliminated、remaining），演出本身不改变任何游戏状态。演完调 onDone，
// 界面随后露出原来的静态摊牌表和“下一轮”按钮。点一下屏幕可以跳过。

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Die3D } from './Dice3D';
import { CRIM, GOLD, burst, centerOf, createTimeline, shakeEl, tumbleTo } from './diceFx';

const qa = (el, sel) => [...el.querySelectorAll(sel)];

const RevealOverlay = ({ reveal, names, onDone }) => {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const slamRef = useRef(null);
  const subRef = useRef(null);
  const meterRef = useRef(null);
  const countRef = useRef(null);
  const nRef = useRef(null);
  const boardRef = useRef(null);
  const footRef = useRef(null);
  const stampRef = useRef(null);
  const flashRef = useRef(null);
  const sparkRef = useRef(null);
  const tlRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // 只给还有骰子的座位出一排（已经出局的人 allDice 是空的）。
  const rows = useMemo(
    () => reveal.allDice.map((dice, idx) => ({ idx, dice })).filter((r) => r.dice.length > 0),
    [reveal]
  );

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    const root = rootRef.current;
    const stage = stageRef.current;
    const slam = slamRef.current;
    const sub = subRef.current;
    const meter = meterRef.current;
    const count = countRef.current;
    const nEl = nRef.current;
    const board = boardRef.current;
    const foot = footRef.current;
    const stamp = stampRef.current;
    const flash = flashRef.current;
    const sparks = sparkRef.current;
    if (!root || !board) return undefined;

    const { face } = reveal.bid;
    const isHit = (v) => v === face || (face !== 1 && v === 1);
    nEl.textContent = '0';

    (async () => {
      const rowEls = qa(board, '.tld-rv-row').map((el) => ({
        el,
        seat: Number(el.dataset.seat),
        cover: el.querySelector('.tld-rv-cover'),
        dice: qa(el, '.tld-d3'),
      }));

      tl.play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });

      // ① 质疑：大字砸下
      tl.play(
        slam,
        [
          { transform: 'translate(-50%,-50%) scale(3.4) rotate(-9deg)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(1) rotate(-5deg)', opacity: 1, offset: 0.55 },
          { transform: 'translate(-50%,-50%) scale(1.05) rotate(-5deg)', opacity: 1 },
        ],
        { duration: 380, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
      await tl.wait(330);
      shakeEl(tl, stage, 15, 400);
      tl.play(flash, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 460, fill: 'none' });
      const box = sparks.getBoundingClientRect();
      burst(tl, sparks, { x: box.width / 2, y: box.height * 0.46, count: 26, colors: CRIM, spread: 200, size: [3, 9], gravity: 30 });
      await tl.wait(560);
      tl.play(slam, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.9) rotate(-5deg)' }], { duration: 260 });
      [sub, meter, board].forEach((e, i) =>
        tl.play(e, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 320,
          delay: i * 90,
        })
      );
      await tl.wait(560);

      // ② 揭盅：每一排的骰盅掀开，骰子滚落
      for (const r of rowEls) {
        tl.play(
          r.cover,
          [
            { transform: 'translateY(0) scale(1)', opacity: 1 },
            { transform: 'translateY(-30px) scale(.96)', opacity: 0 },
          ],
          { duration: 380, easing: 'cubic-bezier(.3,.8,.3,1)' }
        );
        r.dice.forEach((d, j) => {
          tl.play(
            d,
            [
              { transform: 'translateY(-64px) scale(.7)', opacity: 0 },
              { transform: 'translateY(6px) scale(1.05)', opacity: 1, offset: 0.7 },
              { transform: 'translateY(0) scale(1)', opacity: 1 },
            ],
            { duration: 460, delay: 90 + j * 55, easing: 'cubic-bezier(.2,.8,.3,1)' }
          );
          tumbleTo(tl, d, Number(d.dataset.value), 560 + j * 20, 2);
        });
        await tl.wait(200);
      }
      await tl.wait(760);

      // ③ 点数：不算数的暗下去，算数的逐个亮起并计数
      rowEls.forEach((r) =>
        r.dice.forEach((d) => {
          if (!isHit(Number(d.dataset.value))) d.classList.add('tld-miss');
        })
      );
      await tl.wait(260);
      let n = 0;
      for (const r of rowEls) {
        for (const d of r.dice) {
          if (!isHit(Number(d.dataset.value))) continue;
          n += 1;
          d.classList.add('tld-hit');
          tl.play(
            d,
            [
              { transform: 'translateY(0) scale(1)' },
              { transform: 'translateY(-9px) scale(1.3)', offset: 0.4 },
              { transform: 'translateY(0) scale(1.1)' },
            ],
            { duration: 320 }
          );
          nEl.textContent = String(n);
          tl.play(nEl, [{ transform: 'scale(1.55)' }, { transform: 'scale(1)' }], { duration: 240, fill: 'none' });
          const c = centerOf(d, sparks);
          burst(tl, sparks, { x: c.x, y: c.y, count: 6, colors: GOLD, spread: 34, size: [2, 5], life: [300, 500], gravity: 10 });
          await tl.wait(150);
        }
      }
      await tl.wait(420);

      // ④ 对比叫点
      const ok = reveal.bidderRight;
      count.classList.add(ok ? 'tld-ok' : 'tld-bad');
      tl.play(meter, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 440, fill: 'none' });
      await tl.wait(560);

      // ⑤ 盖章判定
      stamp.textContent = ok ? '叫点成立' : '抓到了虚张声势';
      stamp.classList.add(ok ? 'tld-gold-stamp' : 'tld-red-stamp');
      flash.classList.toggle('tld-flash-gold', ok);
      tl.play(
        stamp,
        [
          { transform: 'translate(-50%,-50%) scale(3.2) rotate(-14deg)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(.94) rotate(-6deg)', opacity: 1, offset: 0.6 },
          { transform: 'translate(-50%,-50%) scale(1) rotate(-6deg)', opacity: 1 },
        ],
        { duration: 440, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
      await tl.wait(340);
      shakeEl(tl, stage, ok ? 8 : 17, 400);
      tl.play(flash, [{ opacity: ok ? 0.4 : 0.62 }, { opacity: 0 }], { duration: 520, fill: 'none' });
      const box2 = sparks.getBoundingClientRect();
      burst(tl, sparks, {
        x: box2.width / 2,
        y: box2.height * 0.56,
        count: ok ? 34 : 28,
        colors: ok ? GOLD : CRIM,
        spread: ok ? 230 : 210,
        size: [3, 10],
        gravity: ok ? 40 : 60,
      });

      // 输家：整排泛红，最后一颗骰子碎掉，飘出 -1
      const loserRow = rowEls.find((r) => r.seat === reveal.loser);
      if (loserRow) {
        loserRow.el.classList.add('tld-loser');
        await tl.wait(420);
        const lastDie = loserRow.dice[loserRow.dice.length - 1];
        const lc = centerOf(lastDie, sparks);
        const minus = document.createElement('div');
        minus.className = 'tld-float-minus';
        minus.textContent = '-1';
        minus.style.cssText = `left:${lc.x}px;top:${lc.y}px`;
        sparks.appendChild(minus);
        tl.play(
          minus,
          [
            { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
            { transform: 'translate(-50%,-90%) scale(1.2)', opacity: 1, offset: 0.3 },
            { transform: 'translate(-50%,-220%) scale(1)', opacity: 0 },
          ],
          { duration: 1100, fill: 'forwards' }
        );
        // 骰子碎裂：抖动、泛白、迸出碎片、消失
        await tl.play(
          lastDie,
          [
            { transform: 'translateX(0) scale(1.08)', filter: 'brightness(1)' },
            { transform: 'translateX(-4px) scale(1.15)' },
            { transform: 'translateX(4px) scale(1.15)' },
            { transform: 'translateX(-3px) scale(1.2)' },
            { transform: 'translateX(3px) scale(1.2)' },
            { transform: 'translateX(0) scale(1.26)', filter: 'brightness(2.2)' },
          ],
          { duration: 340, fill: 'forwards' }
        );
        burst(tl, sparks, { x: lc.x, y: lc.y, count: 18, colors: ['#fffdf7', '#c5a059', '#961b2e', '#9e7d3b'], spread: 90, size: [4, 10], gravity: 70 });
        await tl.play(lastDie, [{ opacity: 1, transform: 'scale(1.26)' }, { opacity: 0, transform: 'scale(.3) rotate(40deg)' }], { duration: 240, fill: 'forwards' });
      }

      foot.textContent = reveal.eliminated
        ? `${names[reveal.loser]}的骰子用光了，出局`
        : `${names[reveal.loser]}失去一颗骰子，还剩 ${reveal.remaining} 颗`;
      tl.play(foot, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 });
      await tl.wait(1500);

      await tl.play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 320 });
      doneRef.current();
    })();

    return () => tl.cancel();
    // 演出只在挂载时开始一次；reveal 在演出期间不会变。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      className="tld-screen tld-fx tld-fx-dark"
      onClick={() => tlRef.current && tlRef.current.skip()}
    >
      <div ref={stageRef} className="tld-fx-stage">
        <div ref={flashRef} className="tld-rv-flash" />
        <div className="tld-rv-col">
          <div ref={subRef} className="tld-rv-sub">
            {names[reveal.challenger]} 质疑 {names[reveal.bidder]}
          </div>
          <div ref={meterRef} className="tld-rv-meter">
            <div className="tld-rv-bid">
              叫点 <b>{reveal.bid.quantity}</b> x <Die3D value={reveal.bid.face} size={28} />
            </div>
            <div ref={countRef} className="tld-rv-count">
              <span ref={nRef} />
              <span className="tld-rv-of"> / {reveal.bid.quantity}</span>
            </div>
          </div>
          <div ref={boardRef} className="tld-rv-board">
            {rows.map(({ idx, dice }) => (
              <div key={idx} className="tld-rv-row" data-seat={idx}>
                <span className="tld-rv-name">{names[idx]}</span>
                <div className="tld-rv-dice">
                  {dice.map((v, j) => (
                    <Die3D key={j} value={v} size={34} />
                  ))}
                </div>
                <div className="tld-rv-cover">
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <path d="M20 90 L20 40 Q50 5 80 40 L80 90 Z" />
                    <line x1="50" y1="10" x2="50" y2="90" />
                    <circle cx="50" cy="45" r="8" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
          <div ref={footRef} className="tld-rv-foot" />
        </div>
        <div ref={slamRef} className="tld-rv-slam">质疑</div>
        <div ref={stampRef} className="tld-rv-stamp" />
        <div ref={sparkRef} className="tld-fx-spark" />
        <div className="tld-rv-hint">点一下屏幕跳过</div>
      </div>
    </div>,
    document.body
  );
};

export default RevealOverlay;