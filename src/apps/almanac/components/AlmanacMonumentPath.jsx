import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  Building,
  MonumentDefs,
  Pawn,
  StepBlock,
  getPalette,
  useIsDarkTheme,
} from './almanacMonumentArt';

/*
 * 「这一路走来」的纪念碑谷式路径。
 * 舞台固定为 390 宽，按容器宽度整体缩放。几何参数来自预览稿：
 * 节点左右交替（x = 105 / 285），纵向间隔 132，节点之间 5 级台阶，文字标签宽 112。
 * nodes 的顺序就是从路的最下面往上：先是已点亮的，然后是没点亮的。
 */

const STAGE_W = 390;
const NODE_GAP = 132;
const TOP_PAD = 286;
const BOTTOM_PAD = 136;
const MOTE_COUNT = 22;

const nodePosition = (index, count) => ({
  x: index % 2 === 0 ? 105 : 285,
  y: TOP_PAD + (count - 1 - index) * NODE_GAP,
});

// 固定随机种子，光点位置不会每次渲染都变
const buildMotes = (height) => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  return Array.from({ length: MOTE_COUNT }, (_, i) => ({
    x: 30 + Math.floor(rnd() * 330),
    y: i < 15 ? height - 500 + Math.floor(rnd() * 500) : 300 + Math.floor(rnd() * (height - 800)),
    r: [1.1, 1.5, 1.9][Math.floor(rnd() * 3)],
    delay: -(rnd() * 6).toFixed(1),
    duration: (4.5 + rnd() * 3.5).toFixed(1),
  }));
};

const useStageScale = (ref) => {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => setScale(Math.min(1.25, Math.max(0.6, element.clientWidth / STAGE_W)));

    update();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return scale;
};

export const AlmanacMonumentPath = ({ nodes, effects, onSelect, scrollSignal }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const isDark = useIsDarkTheme();
  const pal = useMemo(() => getPalette(isDark), [isDark]);

  const outerRef = useRef(null);
  const currentRef = useRef(null);
  const scale = useStageScale(outerRef);

  const count = nodes.length;
  const litCount = nodes.filter((node) => node.lit).length;
  const current = Math.max(0, litCount - 1);
  const height = TOP_PAD + (count - 1) * NODE_GAP + BOTTOM_PAD;

  const positions = useMemo(() => nodes.map((_, index) => nodePosition(index, count)), [nodes, count]);
  const motes = useMemo(() => buildMotes(height), [height]);

  // 打开时自动滚到"你们在这里"
  useEffect(() => {
    const timer = window.setTimeout(() => {
      currentRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [scrollSignal]);

  // 台阶和建筑按 y 从小到大画，下面的盖住上面的
  const drawItems = useMemo(() => {
    const items = [];

    for (let k = 0; k < count - 1; k += 1) {
      const [a, b] = [positions[k], positions[k + 1]];
      const lit = nodes[k + 1].lit;

      for (let i = 1; i < 6; i += 1) {
        const f = i / 6;
        items.push({
          sort: a.y + (b.y - a.y) * f,
          kind: 'step',
          x: a.x + (b.x - a.x) * f,
          y: a.y + (b.y - a.y) * f - 6,
          lit,
          id: `s${k}-${i}`,
        });
      }
    }

    nodes.forEach((node, k) => {
      items.push({ sort: positions[k].y, kind: 'node', index: k, id: `n${k}` });
    });

    return items.sort((a, b) => a.sort - b.sort);
  }, [nodes, positions, count]);

  const glowColor = 'var(--accent-color)';
  const stepGlow = `drop-shadow(0 0 3px color-mix(in srgb, ${glowColor} ${isDark ? 60 : 25}%, transparent))`;

  const cur = positions[current];
  const next = positions[current + 1];

  return (
    <div className="amp-outer" ref={outerRef} style={{ height: height * scale }}>
      <div
        className={effects ? 'amp-stage has-effects' : 'amp-stage'}
        data-dark={isDark ? 'true' : 'false'}
        style={{ width: STAGE_W, height, transform: `scale(${scale})` }}
      >
        <div className="amp-fog amp-fog-a" aria-hidden="true" />
        <div className="amp-fog amp-fog-b" aria-hidden="true" />

        <svg width={STAGE_W} height={height} viewBox={`0 0 ${STAGE_W} ${height}`} className="amp-svg" aria-hidden="true">
          <MonumentDefs uid={uid} isDark={isDark} />

          {effects &&
            nodes.map((node, k) =>
              node.lit ? (
                <ellipse
                  key={`h${k}`}
                  cx={positions[k].x}
                  cy={positions[k].y - 14}
                  rx={120 * (k === current ? 1.5 : 1)}
                  ry={70 * (k === current ? 1.5 : 1)}
                  fill={`url(#halo${uid})`}
                />
              ) : null
            )}

          {cur && (
            <ellipse
              className={effects ? 'amp-pulse' : undefined}
              cx={cur.x}
              cy={cur.y - 6}
              rx="58"
              ry="33"
              fill="none"
              style={{ stroke: glowColor }}
              strokeWidth="1.4"
              opacity={effects ? undefined : 0.5}
            />
          )}

          {drawItems.map((item) => {
            if (item.kind === 'step') {
              const block = <StepBlock x={item.x} y={item.y} lit={item.lit} pal={pal} uid={uid} effects={effects} />;

              return (
                <g key={item.id} style={item.lit && effects ? { filter: stepGlow } : undefined}>
                  {block}
                </g>
              );
            }

            const k = item.index;
            const node = nodes[k];
            const { x, y } = positions[k];
            const isNext = k === current + 1;

            return (
              <g key={item.id}>
                <g
                  filter={node.lit && effects ? `url(#glow${uid})` : undefined}
                  className={isNext && effects ? 'amp-breathe' : undefined}
                  opacity={isNext && !effects ? 0.8 : undefined}
                >
                  <Building kind={node.building} x={x} y={y} lit={node.lit} pal={pal} uid={uid} effects={effects} />
                </g>

                {k === current && (
                  <g className={effects ? 'amp-pawns' : undefined}>
                    <Pawn x={x - 9} y={y + 3} h={21} hat={pal.acc} body={pal.pawnBody} />
                    <Pawn x={x + 8} y={y + 7} h={16} hat={pal.pawnBody2} body={pal.acc} />
                  </g>
                )}
              </g>
            );
          })}

          {effects &&
            motes.map((mote, i) => (
              <circle
                key={i}
                className="amp-mote"
                cx={mote.x}
                cy={mote.y}
                r={mote.r}
                style={{ fill: glowColor, animationDelay: `${mote.delay}s`, animationDuration: `${mote.duration}s` }}
              />
            ))}
        </svg>

        {nodes.map((node, k) => {
          const { x, y } = positions[k];
          const left = k % 2 === 0;
          const opacity = node.lit ? 1 : Math.max(0.45, 0.85 - 0.08 * (k - current));

          return (
            <button
              key={node.id}
              type="button"
              className={`amp-label ${left ? 'is-left' : 'is-right'} ${node.lit ? 'is-lit' : ''}`}
              style={{ top: y + 26, opacity }}
              onClick={() => onSelect(node)}
              aria-label={`${node.title}，${node.lit ? '已点亮' : '未点亮'}`}
            >
              <span className="amp-label-title">{node.title}</span>
              <span className="amp-label-sub">{node.lit ? '已点亮' : node.hint}</span>
            </button>
          );
        })}

        {cur && (
          <span
            ref={currentRef}
            className="amp-pill"
            style={{ top: cur.y - 98, left: cur.x - 34 }}
          >
            你们在这里
          </span>
        )}

        {next && (
          <span className={effects ? 'amp-tag amp-breathe' : 'amp-tag'} style={{ top: next.y - 84, left: next.x - 30 }}>
            下一个
          </span>
        )}
      </div>
    </div>
  );
};

export default AlmanacMonumentPath;