// src/apps/badges/BadgeDancingLineBoard.jsx
//
// "本月限定" tab 的主视觉：一条会转弯的万圣节关卡小路（3 个条件节点 + 1 个终点宝箱），
// 外加条件清单和图标网格。只负责当前这个还在进行中的赛季；已经结束的赛季用
// BadgeArchivedSeasonCard，不会再画这条路（意义不大，徒增视觉噪音）。

import React, { useLayoutEffect, useRef, useState } from 'react';

import {
  BadgeAmbientSprites,
  BadgeTrackDefs,
  BadgeTrackPath,
  NODE_POINT_INDEXES,
  TRACK_STAGE_H,
  TRACK_STAGE_W,
  VaultMark,
  getTrackPoints,
  pickConditionMark,
} from './badgeDancingLineArt';

const CONDITION_LABELS = {
  messages_total: (condition) => `累计消息满 ${condition.threshold} 条`,
};

const EFFECTS_KEY = 'badge-dancingline-effects';

const readEffectsPreference = () => {
  try {
    const saved = window.localStorage.getItem(EFFECTS_KEY);
    if (saved === 'off') return false;
    if (saved === 'on') return true;
  } catch {
    // 读不到就用默认值
  }

  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};

const useStageScale = (ref) => {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => setScale(Math.min(1, Math.max(0.68, element.clientWidth / TRACK_STAGE_W)));

    update();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return scale;
};

let uidCounter = 0;
const useUid = () => {
  const ref = useRef(null);
  if (!ref.current) {
    uidCounter += 1;
    ref.current = `bdl${uidCounter}`;
  }
  return ref.current;
};

export const BadgeDancingLineBoard = ({ board, activeSeasonKey, equipError, onEquip }) => {
  const [effects, setEffects] = useState(readEffectsPreference);
  const outerRef = useRef(null);
  const scale = useStageScale(outerRef);
  const uid = useUid();

  const season = board.seasons.find((item) => item.seasonKey === activeSeasonKey);
  if (!season) return null;

  const { seasonDef, unlocked, aiCondition, characterWantedBadgeId, conditionResults = {} } = season;
  const points = getTrackPoints();

  const toggleEffects = () => {
    const next = !effects;
    setEffects(next);

    try {
      window.localStorage.setItem(EFFECTS_KEY, next ? 'on' : 'off');
    } catch {
      // 存不了也不影响使用
    }
  };

  return (
    <section className="badge-season badge-season--current">
      <div className="badge-season-header">
        <h3>{seasonDef.seasonTitle}</h3>
        <span className="badge-season-key">{activeSeasonKey}</span>

        <button type="button" className="bdl-effects-toggle" onClick={toggleEffects} aria-pressed={effects}>
          {effects ? '关闭光效' : '开启光效'}
        </button>
      </div>

      <p className="badge-conditions-hint">
        {unlocked ? '整套图标已经解锁，藏宝箱已经打开。' : '沿着这条路，三个节点都点亮，终点的宝箱才会开。'}
      </p>

      <div className="bdl-outer" ref={outerRef} style={{ height: TRACK_STAGE_H * scale }}>
        <div
          className={effects ? 'bdl-stage has-effects' : 'bdl-stage'}
          style={{ width: TRACK_STAGE_W, height: TRACK_STAGE_H, transform: `scale(${scale})` }}
        >
          <BadgeAmbientSprites effects={effects} />

          <svg
            width={TRACK_STAGE_W}
            height={TRACK_STAGE_H}
            viewBox={`0 0 ${TRACK_STAGE_W} ${TRACK_STAGE_H}`}
            className="bdl-svg"
            aria-hidden="true"
          >
            <BadgeTrackDefs uid={uid} />
            <BadgeTrackPath points={points} allUnlocked={unlocked} uid={uid} effects={effects} />

            {seasonDef.conditions.map((condition, index) => {
              const pointIndex = NODE_POINT_INDEXES[index];
              const point = points[pointIndex];
              if (!point) return null;

              const Mark = pickConditionMark(condition);
              const isMet = Boolean(conditionResults[condition.id]);

              return <Mark key={condition.id} x={point.x} y={point.y} lit={isMet} uid={uid} effects={effects} />;
            })}

            {(() => {
              const vaultPoint = points[NODE_POINT_INDEXES[NODE_POINT_INDEXES.length - 1]];
              return <VaultMark x={vaultPoint.x} y={vaultPoint.y} unlocked={unlocked} uid={uid} effects={effects} />;
            })()}
          </svg>
        </div>
      </div>

      <ul className="badge-conditions">
        {seasonDef.conditions.map((condition) => {
          const isMet = Boolean(conditionResults[condition.id]);
          return (
            <li key={condition.id} className={`badge-condition ${isMet ? 'badge-condition--met' : ''}`}>
              <span className="badge-condition-check" aria-hidden="true">
                {isMet ? '✓' : ''}
              </span>
              <span className="badge-condition-body">
                <span className="badge-condition-title">{condition.title}</span>
                <span className="badge-condition-desc">
                  {condition.kind === 'ai'
                    ? aiCondition?.title || '正在等待 TA 想一个要求…'
                    : CONDITION_LABELS[condition.type]
                      ? CONDITION_LABELS[condition.type](condition)
                      : condition.description}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {equipError && <p className="badge-equip-error">{equipError}</p>}

      <div className="badge-grid">
        {seasonDef.badges.map((badge) => {
          const isEquipped = board.equippedBadgeId === badge.id;
          const isWanted = characterWantedBadgeId === badge.id;
          const isLocked = !unlocked;

          return (
            <button
              type="button"
              key={badge.id}
              className={`badge-tile ${isLocked ? 'badge-tile--locked' : ''} ${isEquipped ? 'badge-tile--equipped' : ''}`}
              onClick={() => !isLocked && onEquip(badge.id)}
              disabled={isLocked}
              title={badge.description}
            >
              {isWanted && <span className="badge-tile-wanted">TA 想要</span>}
              <span className="badge-tile-image-wrap">
                <img src={badge.imageUrl} alt={badge.title} loading="lazy" />
              </span>
              <span className="badge-tile-title">{badge.title}</span>
              {isEquipped && <span className="badge-tile-equipped-tag">佩戴中</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default BadgeDancingLineBoard;