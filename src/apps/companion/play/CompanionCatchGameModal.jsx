/**
 * CompanionCatchGameModal.jsx
 *
 * 「接住掉落物」小游戏的模态框：开局说明 -> 游戏中（canvas + HUD）
 * -> 结算弹窗（分数/档位/奖励）。结构照抄 CompanionFortuneModal.jsx
 * 的外壳约定（.cp-overlay / .cp-backdrop + 一个固定尺寸的卡片容器），
 * 游戏本身的物理/碰撞交给 catchGameEngine.js，这个文件只管 UI 状态
 * 和跟 Dexie 数据层（catchService.js）对接。
 *
 * Props:
 *   companionId        number   — 小伙伴 ID
 *   companionAvatarUrl string   — 小伙伴头像图片 URL（画在 canvas 里当角色）
 *   companionName       string  — 小伙伴名字
 *   onRewardApplied     function(companion) — 奖励结算后，把最新的 companion
 *                                             传回去，调用方据此刷新主页状态
 *   onClose             function — 关闭整个弹窗
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import './catchGame.css';
import { ROUND_SECONDS, DAILY_REWARD_LIMIT } from './catchData';
import { getCatchState, submitCatchResult } from './catchService';
import { CatchGameEngine } from './catchGameEngine';

/* ------------------------------------------------------------------ */
/* 掉落物图片素材 URL                                                  */
/* ------------------------------------------------------------------ */

const ITEM_IMAGES = {
  // 小鱼干 (+1)
  fish: 'https://img.pagehost.cn/autoupload/amqnh/20261006/h3sR/1804X1199/_cgi-bin_mmwebwx-bin_webwxgetmsgimg__%26MsgID%3D6111048591254401307%26skey%3D%40crypt_5a237c93_af0ceda1a5de4ebe5ccf5821e6bb46cb%26mmweb_appid%3Dwx_webfilehelper.jpg/webp',
  // 小骨头 (+1)
  bone: 'https://img.pagehost.cn/autoupload/amqnh/20261006/ZkdZ/1799X1138/_cgi-bin_mmwebwx-bin_webwxgetmsgimg__%26MsgID%3D5117560328637036867%26skey%3D%40crypt_5a237c93_af0ceda1a5de4ebe5ccf5821e6bb46cb%26mmweb_appid%3Dwx_webfilehelper.jpg/webp',
  // 彩虹糖 (+4)
  star: 'https://img.pagehost.cn/autoupload/amqnh/20261006/uaMz/1762X1082/_cgi-bin_mmwebwx-bin_webwxgetmsgimg__%26MsgID%3D560298285990921510%26skey%3D%40crypt_5a237c93_af0ceda1a5de4ebe5ccf5821e6bb46cb%26mmweb_appid%3Dwx_webfilehelper.jpg/webp',
  // 坏石头 (-1)
  rock: 'https://img.pagehost.cn/autoupload/amqnh/20261006/SB89/1668X1461/_cgi-bin_mmwebwx-bin_webwxgetmsgimg__%26MsgID%3D7437426939240510681%26skey%3D%40crypt_5a237c93_af0ceda1a5de4ebe5ccf5821e6bb46cb%26mmweb_appid%3Dwx_webfilehelper.jpg/webp',
};

const PET_FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><radialGradient id="g" cx="35%" cy="28%" r="75%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#E1F0FE"/></radialGradient></defs><circle cx="40" cy="42" r="32" fill="url(#g)" stroke="#fff" stroke-width="5"/><circle cx="40" cy="42" r="32" fill="none" stroke="#DCEBF8" stroke-width="2"/><circle cx="29" cy="40" r="4" fill="#24415A"/><circle cx="51" cy="40" r="4" fill="#24415A"/><circle cx="30.3" cy="38.6" r="1.3" fill="#fff"/><circle cx="52.3" cy="38.6" r="1.3" fill="#fff"/><ellipse cx="21" cy="48" rx="6" ry="3.6" fill="#FFB0C2" opacity=".75"/><ellipse cx="59" cy="48" rx="6" ry="3.6" fill="#FFB0C2" opacity=".75"/><path d="M34 50q6 6 12 0" fill="none" stroke="#24415A" stroke-width="2.6" stroke-linecap="round"/></svg>';

const dataUriFromSvg = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const LEGEND = [
  { key: 'fish', label: '小鱼干 +1' },
  { key: 'bone', label: '骨头 +1' },
  { key: 'star', label: '彩虹糖 +4' },
  { key: 'rock', label: '石头 -1' },
];

/* ------------------------------------------------------------------ */
/* 内联 SVG 图标（UI chrome，不是游戏素材）                              */
/* ------------------------------------------------------------------ */

const IconBack = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconSparkle = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor" /></svg>
);
const IconPlay = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
);
const IconCheck = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconHeartMood = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M12 21s-7-4.35-9.5-8.8C.8 8.6 2.6 5 6.1 5c2 0 3.4 1.1 4 2.4C10.6 6.1 12 5 14 5c3.5 0 5.3 3.6 3.6 7.2C19.1 16.6 12 21 12 21z" fill="currentColor" /></svg>
);
const IconBowl = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M3 11h18a9 9 0 0 1-18 0Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);
const IconHeartCoin = () => (
  <svg className="pg-ic" viewBox="0 0 24 24"><path d="M12 20s-6.5-4.2-9-8C1.3 8.8 2.6 5.8 5.6 5.4c1.9-.3 3.6.7 4.4 2.2.8-1.5 2.5-2.5 4.4-2.2 3 .4 4.3 3.4 2.6 6.6-2.5 3.8-9 8-9 8Z" fill="currentColor" /></svg>
);

function AnimatedPetFace() {
  return <svg viewBox="0 0 100 100" aria-hidden="true"><use href="#pg-pet-face" /></svg>;
}

function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="pg-pet-face" viewBox="0 0 100 100">
          <path d="M45 24l5-10 5 10" fill="none" stroke="#3D9BEA" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="35" cy="55" r="4.6" fill="#24415A" /><circle cx="65" cy="55" r="4.6" fill="#24415A" />
          <circle cx="36.6" cy="53.4" r="1.5" fill="#fff" /><circle cx="66.6" cy="53.4" r="1.5" fill="#fff" />
          <ellipse cx="26" cy="65" rx="7" ry="4.5" fill="#FFB0C2" opacity="0.75" /><ellipse cx="74" cy="65" rx="7" ry="4.5" fill="#FFB0C2" opacity="0.75" />
          <path d="M44 64q6 7 12 0" fill="none" stroke="#24415A" strokeWidth="3" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

const TIER_COLORS = {
  S: 'linear-gradient(135deg,#FF86A0,#FFD27A)',
  A: 'linear-gradient(135deg,#3D9BEA,#8FD9C0)',
  B: 'linear-gradient(135deg,#8FD9C0,#3D9BEA)',
  C: 'linear-gradient(135deg,#9DB8CD,#5E819C)',
};

/* ------------------------------------------------------------------ */
/* 主组件                                                               */
/* ------------------------------------------------------------------ */

export default function CompanionCatchGameModal({
  companionId,
  companionAvatarUrl,
  companionName = '小伙伴',
  onRewardApplied,
  onClose,
}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const assetsRef = useRef({});
  const particleIdRef = useRef(0);

  const [assetsReady, setAssetsReady] = useState(false);
  const [state, setState] = useState('idle'); // idle | playing | result
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [scoreBumpKey, setScoreBumpKey] = useState(0);
  const [particles, setParticles] = useState([]);
  const [dailyState, setDailyState] = useState({
    playsToday: 0, rewardedToday: 0, dailyLimit: DAILY_REWARD_LIMIT, bestScoreToday: 0,
  });
  const [result, setResult] = useState(null); // { tier, rewarded, effect }

  /* ---------------- 载入素材（含小伙伴自己的头像）---------------- */
  useEffect(() => {
    let cancelled = false;
    const toImg = (src) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      return img;
    };
    const assets = {
      fish: toImg(ITEM_IMAGES.fish),
      bone: toImg(ITEM_IMAGES.bone),
      star: toImg(ITEM_IMAGES.star),
      rock: toImg(ITEM_IMAGES.rock),
      pet: toImg(companionAvatarUrl || dataUriFromSvg(PET_FALLBACK_SVG)),
    };
    assetsRef.current = assets;

    const waits = Object.values(assets).map((img) => (
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    ));
    Promise.all(waits).then(() => { if (!cancelled) setAssetsReady(true); });

    return () => { cancelled = true; };
  }, [companionAvatarUrl]);

  /* ---------------- 读取今天的次数状态 ---------------- */
  const refreshDailyState = useCallback(async () => {
    const s = await getCatchState(companionId);
    setDailyState(s);
  }, [companionId]);

  useEffect(() => { void refreshDailyState(); }, [refreshDailyState]);

  /* ---------------- 粒子/漂浮分数 ---------------- */
  const spawnFx = useCallback(({
    kind, delta, x, y,
  }) => {
    const base = particleIdRef.current;
    particleIdRef.current += 6;

    const sparkClass = kind === 'bad' ? 'bad' : kind === 'rare' ? 'rare' : '';
    const sparkCount = kind === 'rare' ? 7 : kind === 'bad' ? 4 : 4;
    const color = kind === 'bad' ? '#9DB8CD' : kind === 'rare' ? '#FFD27A' : '#3D9BEA';

    const sparks = Array.from({ length: sparkCount }, (_, i) => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 44;
      return {
        id: `${base}-s${i}`,
        type: 'spark',
        cls: sparkClass,
        style: {
          '--x': `${x}px`,
          '--y': `${y}px`,
          '--dx': `${Math.cos(ang) * dist}px`,
          '--dy': `${Math.sin(ang) * dist}px`,
          animationDelay: `${i * 16}ms`,
        },
      };
    });

    const float = {
      id: `${base}-f`,
      type: 'float',
      text: delta > 0 ? `+${delta}` : String(delta),
      color,
      style: { '--x': `${x}px`, '--y': `${y}px` },
    };

    setParticles((prev) => [...prev, float, ...sparks]);
    const doomedIds = new Set([float.id, ...sparks.map((s) => s.id)]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !doomedIds.has(p.id)));
    }, 1100);
  }, []);

  /* ---------------- 引擎生命周期 ---------------- */
  const ensureEngine = useCallback(() => {
    if (engineRef.current || !canvasRef.current) return engineRef.current;
    const engine = new CatchGameEngine({
      canvas: canvasRef.current,
      assets: assetsRef.current,
      onScoreChange: (s) => { setScore(s); setScoreBumpKey((k) => k + 1); },
      onTimeChange: (t) => setTimeLeft(t),
      onCatch: (info) => spawnFx(info),
      onEnd: (finalScore) => { void handleRoundEnd(finalScore); },
    });
    engine.attachControls();
    engineRef.current = engine;
    return engine;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnFx]);

  useEffect(() => () => { if (engineRef.current) engineRef.current.destroy(); }, []);

  useEffect(() => {
    const handleResize = () => { if (engineRef.current) engineRef.current.resize(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ---------------- 开始 / 结算 ---------------- */
  const handleStart = useCallback(() => {
    const engine = ensureEngine();
    if (!engine) return;
    setParticles([]);
    setResult(null);
    setState('playing');
    engine.start();
  }, [ensureEngine]);

  const handleRoundEnd = useCallback(async (finalScore) => {
    setState('result');
    try {
      const res = await submitCatchResult(companionId, finalScore);
      setResult(res);
      setDailyState({
        playsToday: dailyState.playsToday + 1,
        rewardedToday: res.rewardedToday,
        dailyLimit: res.dailyLimit,
        bestScoreToday: Math.max(dailyState.bestScoreToday, finalScore),
      });
      if (res.rewarded && res.companion && onRewardApplied) {
        onRewardApplied(res.companion);
      }
    } catch (error) {
      console.error('[CatchGame] 结算失败：', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionId, dailyState, onRewardApplied]);

  const handlePlayAgain = useCallback(() => { handleStart(); }, [handleStart]);
  const handleBackToIdle = useCallback(() => setState('idle'), []);
  const handleClose = useCallback(() => {
    if (engineRef.current) engineRef.current.stop();
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && state !== 'playing') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state, handleClose]);

  const timerPct = Math.max(0, Math.min(1, timeLeft / ROUND_SECONDS));
  const reachedDailyLimit = dailyState.rewardedToday >= dailyState.dailyLimit;
  const tierColor = result ? (TIER_COLORS[result.tier.key] || TIER_COLORS.C) : TIER_COLORS.C;

  return (
    <div className="cp-overlay center">
      <div className="cp-backdrop" onClick={state === 'playing' ? undefined : handleClose} />
      <div className={`pg-root is-${state}`} role="dialog" aria-modal="true" aria-label="接住掉落物">
        <SvgDefs />

        {/* 场景 */}
        <div className="pg-scene">
          <div className="pg-orb" />
          <i className="pg-cloud c1" /><i className="pg-cloud c2" /><i className="pg-cloud c3" />
          <div className="pg-ground" />
        </div>

        <canvas ref={canvasRef} className="pg-canvas" />

        {/* 顶栏 */}
        <button type="button" className="pg-round-btn" aria-label="返回" onClick={handleClose} disabled={state === 'playing'}>
          <IconBack />
        </button>
        <div className="pg-title"><b>零食雨</b><small>接住掉下来的零食</small></div>
        <div className="pg-attempts">
          <span>今日 {Math.min(dailyState.rewardedToday, dailyState.dailyLimit)}/{dailyState.dailyLimit}</span>
          <span className="dots">
            {Array.from({ length: dailyState.dailyLimit }, (_, i) => (
              <span key={i} className={`dot${i < dailyState.rewardedToday ? ' is-used' : ''}`} />
            ))}
          </span>
        </div>

        {/* 游戏中 HUD */}
        <div className="pg-hud">
          <div key={scoreBumpKey} className={`pg-score-pill${scoreBumpKey ? ' is-bump' : ''}`}>
            <IconSparkle />
            <b>{score}</b>
          </div>
          <div className="pg-timer-wrap">
            <div className="pg-timer-track">
              <span className={`pg-timer-fill${timeLeft <= 10 ? ' is-low' : ''}`} style={{ width: `${timerPct * 100}%` }} />
            </div>
            <div className="pg-timer-label">{Math.ceil(timeLeft)}s</div>
          </div>
        </div>

        <div className="pg-bottombar"><p className="pg-hint">左右拖动小伙伴 · 接住零食加分，躲开石头</p></div>

        {/* 开局前说明 */}
        <div className="pg-idle">
          <div className="pg-idle-card">
            <h2>今天接点什么好吃的？</h2>
            <p className="desc">
              拖动{companionName}左右移动，接住掉落的零食得分；接到彩虹糖加分更多，碰到石头会扣一点分还会晕一下～
              限时 {ROUND_SECONDS} 秒，越到后面石头会掉得越多。
            </p>
            <div className="pg-legend">
              {LEGEND.map((it) => (
                <div className="it" key={it.key}>
                  <img src={ITEM_IMAGES[it.key]} alt="" />
                  <small>{it.label}</small>
                </div>
              ))}
            </div>
            <button type="button" className="pg-start-btn" onClick={handleStart} disabled={!assetsReady}>
              <IconPlay />
              <span>{reachedDailyLimit ? '再玩一局（无加成）' : '开始游戏'}</span>
            </button>
            <p className="pg-limit-note">
              {reachedDailyLimit
                ? '今天的奖励次数已经用完啦，接下来纯粹是陪它玩～'
                : `今日还有 ${dailyState.dailyLimit - dailyState.rewardedToday} 次游戏能拿加成`}
            </p>
          </div>
        </div>

        {/* 结算弹窗 */}
        <div className="pg-overlay">
          <div className="pg-backdrop" onClick={handleBackToIdle} />
          {result && (
            <div className="pg-result">
              <div className="pg-result-head">
                <div className="pg-tier-badge" style={{ background: tierColor }}>{result.tier.key}</div>
                <h3>{result.tier.label}</h3>
                <p>本局得分 {score}</p>
              </div>
              <div className="pg-result-body">
                {result.rewarded ? (
                  <div className="pg-reward-row">
                    <div className="pg-reward-chip mood">
                      <IconHeartMood />
                      <b>+{result.effect.mood}</b>
                      <small>心情</small>
                    </div>
                    <div className="pg-reward-chip satiety">
                      <IconBowl />
                      <b>{result.effect.satiety}</b>
                      <small>饱食度</small>
                    </div>
                    <div className="pg-reward-chip hearts">
                      <IconHeartCoin />
                      <b>+{result.effect.hearts}</b>
                      <small>心心</small>
                    </div>
                  </div>
                ) : (
                  <p className="pg-no-reward">今天的奖励次数已经用完啦，这局纯粹是陪小伙伴玩一下～</p>
                )}
              </div>
              <div className="pg-result-actions">
                <button type="button" className="pg-btn" onClick={handlePlayAgain}>再玩一次</button>
                <button type="button" className="pg-btn main" onClick={handleBackToIdle}>
                  <IconCheck />
                  <span>好哒</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 漂浮分数 + 粒子 */}
        <div className="pg-fx">
          {particles.map((p) => (
            p.type === 'float' ? (
              <i key={p.id} className="pg-float" style={{ ...p.style, color: p.color }}>{p.text}</i>
            ) : (
              <i key={p.id} className={`pg-p spark ${p.cls}`} style={p.style} />
            )
          ))}
        </div>
      </div>
    </div>
  );
}
