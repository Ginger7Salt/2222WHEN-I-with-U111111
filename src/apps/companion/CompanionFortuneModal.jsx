/**
 * CompanionFortuneModal.jsx
 *
 * 宠物日签模态框
 * 支持三种风格：神签(omikuji) / 塔罗(tarot) / 星盘(astro)
 *
 * Props:
 *   companionId       number   — 小伙伴 ID
 *   companionAvatarUrl string  — 小伙伴头像图片 URL
 *   companionName     string   — 小伙伴名字（用于"小伙伴的话"）
 *   streakCount       number   — 当前火花天数（用于头部展示）
 *   onClose           function — 关闭回调
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import './fortune.css';
import {
  STYLE_NAMES, IDLE_TEXT, GO_LABEL, POKE_LINES, WEEKDAYS,
  TAROT, ASTRO, RANKS,
} from './fortuneData';
import {
  getFortuneState, drawFortune, savePreferredStyle, todayDateStr,
} from './fortuneService';

/* ------------------------------------------------------------------ */
/* 小工具                                                               */
/* ------------------------------------------------------------------ */

function pickFromArr(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayDateStr();
  if (dateStr === today) return '今天';
  const yesterday = (() => {
    const t = new Date();
    t.setDate(t.getDate() - 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
  if (dateStr === yesterday) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`;
}

/* ------------------------------------------------------------------ */
/* SVG Defs — 所有 icon symbol 内联声明                                   */
/* ------------------------------------------------------------------ */

function SvgDefs({ avatarUrl }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true">
      <defs>
        {/* 返回箭头 */}
        <symbol id="i-back" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </symbol>

        {/* 火焰 */}
        <symbol id="i-flame" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2C12 2 8 8 8 13a4 4 0 0 0 8 0c0-1.5-.8-3-2-4 0 0 .5 2-1 3-.7-1.2-1-2.5-1-4 0-3 2-6 2-6z"/>
          <path fill="currentColor" opacity="0.6" d="M12 14c0 1.1-.9 2-2 2-.5-1-.8-2.2-.5-3.5C10.6 14 11.5 14 12 14z"/>
        </symbol>

        {/* 发送 */}
        <symbol id="i-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </symbol>

        {/* 勾 */}
        <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </symbol>

        {/* 闪光 */}
        <symbol id="i-sparkle" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z"/>
          <circle fill="currentColor" cx="5" cy="5" r="1.2"/>
          <circle fill="currentColor" cx="19" cy="4" r="0.9"/>
          <circle fill="currentColor" cx="19" cy="19" r="1.1"/>
        </symbol>

        {/* 锁 */}
        <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </symbol>

        {/* ---- 塔罗牌字形 ---- */}
        {/* 太阳 #g-sun */}
        <symbol id="g-sun" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="13" fill="currentColor" opacity="0.9"/>
          {[0,45,90,135,180,225,270,315].map((deg,i) => (
            <line key={i}
              x1={32 + 17 * Math.cos(deg * Math.PI/180)}
              y1={32 + 17 * Math.sin(deg * Math.PI/180)}
              x2={32 + 26 * Math.cos(deg * Math.PI/180)}
              y2={32 + 26 * Math.sin(deg * Math.PI/180)}
              stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          ))}
        </symbol>

        {/* 星星 #g-star */}
        <symbol id="g-star" viewBox="0 0 64 64">
          <polygon points="32,6 38,24 57,24 42,35 48,54 32,42 16,54 22,35 7,24 26,24" fill="currentColor"/>
        </symbol>

        {/* 恋人 #g-lovers */}
        <symbol id="g-lovers" viewBox="0 0 64 64">
          <path fill="currentColor" d="M32 54 C20 42 8 34 8 22 a11 11 0 0 1 22 0 c0-6 4-10 9-11a11 11 0 0 1 13 11c0 12-12 20-20 32z"/>
        </symbol>

        {/* 命运之轮 #g-wheel */}
        <symbol id="g-wheel" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="3"/>
          <circle cx="32" cy="32" r="8" fill="currentColor"/>
          {[0,60,120,180,240,300].map((deg,i) => (
            <line key={i}
              x1="32" y1="32"
              x2={32 + 20 * Math.cos((deg - 90) * Math.PI/180)}
              y2={32 + 20 * Math.sin((deg - 90) * Math.PI/180)}
              stroke="currentColor" strokeWidth="2"/>
          ))}
        </symbol>

        {/* 隐者 #g-lamp */}
        <symbol id="g-lamp" viewBox="0 0 64 64">
          <path fill="currentColor" d="M32 12 L26 32 H38z"/>
          <rect x="24" y="32" width="16" height="12" rx="2" fill="currentColor"/>
          <line x1="32" y1="44" x2="32" y2="54" stroke="currentColor" strokeWidth="2"/>
          <circle cx="32" cy="56" r="3" fill="currentColor"/>
        </symbol>

        {/* 月亮 #g-moon */}
        <symbol id="g-moon" viewBox="0 0 64 64">
          <path fill="currentColor" d="M32 8 a24 24 0 0 0 0 48 18 18 0 0 1 0-48z"/>
        </symbol>

        {/* 高塔 #g-tower */}
        <symbol id="g-tower" viewBox="0 0 64 64">
          <rect x="22" y="20" width="20" height="36" fill="currentColor"/>
          <polygon points="22,20 32,4 42,20" fill="currentColor" opacity="0.8"/>
          <rect x="18" y="36" width="28" height="4" fill="currentColor" opacity="0.5"/>
          {/* 闪电 */}
          <path fill="#FFD700" d="M38 10 l-6 10 h4 l-6 14 l10-14 h-4z"/>
        </symbol>

        {/* 小伙伴头像（clipPath 用于圆形裁剪） */}
        <clipPath id="pet-clip">
          <circle cx="22" cy="22" r="22"/>
        </clipPath>
      </defs>

      {/* 头像 image（如果有 avatarUrl 的话展示在 #pet-face 里） */}
      {/* 直接通过 CSS background-image 在 .fo-avatar 上展示，不需要 symbol */}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 粒子特效                                                              */
/* ------------------------------------------------------------------ */

function Particles({ rank }) {
  const kinds = rank === '大吉' || rank === '吉'
    ? ['conf', 'spark', 'heart']
    : ['spark'];
  const particles = Array.from({ length: 18 }, (_, i) => ({
    kind: kinds[i % kinds.length],
    style: {
      left: `${5 + Math.random() * 90}%`,
      animationDelay: `${Math.random() * 0.6}s`,
      animationDuration: `${0.8 + Math.random() * 0.8}s`,
    },
  }));
  return (
    <div className="fo-fx" aria-hidden="true">
      {particles.map((p, i) => (
        <div key={i} className={`fo-p ${p.kind}`} style={p.style} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 神签（omikuji）阶段组件                                                */
/* ------------------------------------------------------------------ */

function OmikujiStage({ shaking, onShake, drawn }) {
  return (
    <div className="fo-stage">
      <button
        className={`fo-box${shaking ? ' is-shaking' : ''}`}
        onClick={onShake}
        aria-label="摇签筒"
        disabled={!!drawn}
      >
        <div className="fo-box-body">
          <span className="fo-box-label">签</span>
        </div>
        {shaking && <div className="fo-stick" aria-hidden="true" />}
      </button>
      <p className="bub">{drawn ? '签文已出～' : IDLE_TEXT.omikuji}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 塔罗（tarot）阶段组件                                                  */
/* ------------------------------------------------------------------ */

function TarotStage({ shuffling, onShuffle, drawn, drawnEntry }) {
  const cards = TAROT;
  return (
    <div className="fo-stage">
      <div className={`fo-fan${shuffling ? ' is-shuffling' : ''}`}>
        {cards.map((card, i) => {
          const isDrawn = drawn && drawnEntry && card.glyph === drawnEntry.glyph;
          return (
            <button
              key={card.glyph}
              className={`fo-card${isDrawn ? ' is-flipped' : ''}`}
              style={{ '--card-i': i, '--card-total': cards.length }}
              onClick={!drawn ? onShuffle : undefined}
              disabled={!!drawn && !isDrawn}
              aria-label={`塔罗牌 ${card.name}`}
            >
              <div className="fo-card-back" aria-hidden="true" />
              <div className="fo-card-front">
                <svg className="fo-glyph" width="40" height="40" aria-hidden="true">
                  <use href={`#g-${card.glyph}`} />
                </svg>
                <span className="fo-card-name">{card.name}</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="bub">{drawn ? '牌已翻开～' : IDLE_TEXT.tarot}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 星盘（astro）阶段组件                                                  */
/* ------------------------------------------------------------------ */

const SIGN_ANGLES = Array.from({ length: 12 }, (_, i) => (i * 30 - 90 + 15));

function AstroStage({ spinning, onSpin, drawn, drawnEntry }) {
  return (
    <div className="fo-stage">
      <div className="fo-wheel-wrap">
        <button
          className={`fo-wheel${spinning ? ' is-spinning' : ''}`}
          onClick={!drawn ? onSpin : undefined}
          disabled={!!drawn}
          aria-label="转动星盘"
        >
          <svg viewBox="0 0 200 200" width="200" height="200" className="fo-wheel-svg">
            {/* 底圆 */}
            <circle className="w-disc" cx="100" cy="100" r="96" />
            {/* 分割线 */}
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * 30 - 90) * Math.PI / 180;
              return (
                <line key={i} className="w-dash"
                  x1="100" y1="100"
                  x2={100 + 90 * Math.cos(a)}
                  y2={100 + 90 * Math.sin(a)}
                />
              );
            })}
            {/* 星座标签 */}
            {ASTRO.map((s, i) => {
              const a = SIGN_ANGLES[i] * Math.PI / 180;
              const r = 72;
              return (
                <text key={s.sign}
                  className="w-big"
                  x={100 + r * Math.cos(a)}
                  y={100 + r * Math.sin(a)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: 11 }}
                >
                  {s.sign}
                </text>
              );
            })}
            {/* 中心圆 */}
            <circle cx="100" cy="100" r="18" className="w-disc" style={{ opacity: 0.9 }} />
          </svg>
          {/* 指针 */}
          <div className="fo-pointer" aria-hidden="true" />
        </button>
      </div>
      <p className="bub">{drawn ? `${drawnEntry?.sign}座 已定位～` : IDLE_TEXT.astro}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 结果展示 — 签文区                                                      */
/* ------------------------------------------------------------------ */

function ResultOverlay({ result, style, companionName, companionAvatarUrl, onClose, onShare }) {
  const { entry, rank, sec, item, color } = result;
  const toneClass = `tone-${RANKS[rank]?.tone ?? 'ji'}`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        text: `我今天的宠物日签是【${rank}】${style === 'tarot' ? `·${entry.name}` : style === 'astro' ? `·${entry.sign}座` : ''}`,
      }).catch(() => {});
    }
    onShare?.();
  };

  return (
    <div className="fo-overlay" role="dialog" aria-modal="true" aria-label="今日签文结果">
      {/* 粒子 */}
      <Particles rank={rank} />

      <div className="fo-result">
        {/* 封印印章 */}
        <div className={`fo-seal ${toneClass}`} aria-label={`签级：${rank}`}>
          <span className="fo-rank-kanji">{RANKS[rank]?.ch ?? '吉'}</span>
          <span className="fo-rank-big">{rank}</span>
        </div>

        {/* 神签 诗句 */}
        {style === 'omikuji' && (
          <div className="fo-poem" aria-label="签诗">
            {entry.poem.map((line, i) => (
              <div key={i} className="fo-poem-line" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* 塔罗 */}
        {style === 'tarot' && (
          <div className="fo-trow">
            <div className="fo-tface">
              <svg width="56" height="56" className={toneClass} aria-label={entry.name}>
                <use href={`#g-${entry.glyph}`} />
              </svg>
            </div>
            <div className="fo-tinfo">
              <span className="fo-card-name-big">{entry.name}</span>
              <span className="fo-card-en">{entry.en}</span>
              <div className="fo-kws">
                {entry.kw.map((k) => <span key={k} className={`fo-chip ${toneClass}`}>{k}</span>)}
              </div>
              <p className="fo-lines">{entry.lines.join('')}</p>
            </div>
          </div>
        )}

        {/* 星盘 */}
        {style === 'astro' && (
          <div className="fo-trow">
            <div className="fo-tface fo-rwheel">
              <svg viewBox="0 0 80 80" width="72" height="72" className={toneClass}>
                <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
                <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fontSize="16" fill="currentColor">{entry.sign}</text>
              </svg>
            </div>
            <div className="fo-tinfo">
              <span className="fo-card-name-big">{entry.sign}座</span>
              <span className="fo-card-en">{entry.planet} 守护</span>
              <p className="fo-lines">{entry.lines.join('')}</p>
            </div>
          </div>
        )}

        {/* 各节 grid */}
        <div className="fo-grid">
          <div className="fo-sec">
            <span className="fo-sec-label">愿望</span>
            <p>{sec.wish}</p>
          </div>
          <div className="fo-sec">
            <span className="fo-sec-label">出行</span>
            <p>{sec.trip}</p>
          </div>
          <div className="fo-sec">
            <span className="fo-sec-label">人际</span>
            <p>{sec.people}</p>
          </div>
          <div className="fo-sec fo-full">
            <span className="fo-sec-label">提醒</span>
            <p>{sec.tip}</p>
          </div>
        </div>

        {/* 宜 / 忌 */}
        <div className="fo-yiji">
          <span className="fo-mark yi">宜</span>
          <span className="fo-chip">{sec.yi}</span>
          <span className="fo-mark ji">忌</span>
          <span className="fo-chip">{sec.ji}</span>
        </div>

        {/* 幸运 */}
        <div className="fo-lucky">
          <span>
            <span className="fo-lucky-label">幸运物</span> {item}
          </span>
          <span>
            <span className="fo-lucky-label">幸运色</span>
            <span
              className="fo-color-dot"
              style={{ background: color.h }}
              title={color.n}
            />
            {color.n}
          </span>
        </div>

        {/* 小伙伴的话 */}
        <div className="fo-says">
          <div
            className="fo-avatar"
            style={companionAvatarUrl ? { backgroundImage: `url(${companionAvatarUrl})` } : {}}
            aria-label={companionName}
          />
          <div className="fo-says-bubble">
            <span className="fo-says-name">{companionName}</span>
            <p>{sec.pet}</p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="fo-res-actions">
          <button className="fo-btn main" onClick={onClose}>
            <svg width="16" height="16" aria-hidden="true"><use href="#i-check" /></svg>
            收好啦
          </button>
          <button className="fo-btn" onClick={handleShare} aria-label="分享签文">
            <svg width="16" height="16" aria-hidden="true"><use href="#i-send" /></svg>
            分享
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 历史记录抽屉                                                          */
/* ------------------------------------------------------------------ */

function HistorySheet({ open, history, onToggle }) {
  return (
    <div className={`fo-sheet${open ? ' is-open' : ''}`}>
      <button className="fo-sheet-toggle" onClick={onToggle} aria-expanded={open}>
        <svg width="14" height="14" aria-hidden="true">
          <use href="#i-sparkle" />
        </svg>
        过去七天
        <span className="fo-sheet-arrow" aria-hidden="true">{open ? '▾' : '▴'}</span>
      </button>
      <div className="fo-sheet-body">
        {history.length === 0 ? (
          <p className="fo-sheet-empty">还没有历史签文</p>
        ) : (
          <div className="fo-days">
            {history.map((row) => {
              const toneClass = `tone-${RANKS[row.result?.rank]?.tone ?? 'ji'}`;
              return (
                <div key={row.id} className="fo-day">
                  <div className={`fo-day-dot ${toneClass}`} title={row.result?.rank} />
                  <span className="fo-day-date">{formatDateLabel(row.dateStr)}</span>
                  <span className={`fo-day-rank ${toneClass}`}>{row.result?.rank}</span>
                  <span className="fo-day-style">
                    {STYLE_NAMES[row.style] ?? row.style}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 主组件                                                               */
/* ------------------------------------------------------------------ */

export default function CompanionFortuneModal({
  companionId,
  companionAvatarUrl,
  companionName = '小伙伴',
  streakCount = 0,
  onClose,
}) {
  const [style, setStyle] = useState('omikuji');
  const [todayDraw, setTodayDraw] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [animating, setAnimating] = useState(false); // 摇签/洗牌/旋转中
  const [pokeText, setPokeText] = useState(null);
  const [toast, setToast] = useState(null);

  const pokeTimer = useRef(null);
  const toastTimer = useRef(null);

  /* 初始化 */
  useEffect(() => {
    if (!companionId) return;
    getFortuneState(companionId).then(({ todayDraw: td, history: h, preferredStyle }) => {
      setTodayDraw(td);
      setHistory(h);
      setStyle(preferredStyle);
      if (td) setShowResult(true);
    });
  }, [companionId]);

  /* 切换风格 */
  const handleStyleChange = useCallback((s) => {
    if (todayDraw) return; // 已抽过不允许切换
    setStyle(s);
    savePreferredStyle(companionId, s);
  }, [companionId, todayDraw]);

  /* 抽签 */
  const handleDraw = useCallback(async () => {
    if (busy || todayDraw) return;
    setBusy(true);
    setAnimating(true);

    // 动画延迟（摇签/洗牌/旋转大约 1.2s）
    await new Promise((r) => setTimeout(r, 1300));

    try {
      const draw = await drawFortune(companionId, style);
      setTodayDraw(draw);
      setAnimating(false);

      // 短暂延迟后展示结果
      await new Promise((r) => setTimeout(r, 300));
      setShowResult(true);

      // 刷新历史
      getFortuneState(companionId).then(({ history: h }) => setHistory(h));
    } catch (e) {
      console.error('[FortuneModal] drawFortune 失败：', e);
      showToast('抽签失败了，再试试吧');
      setAnimating(false);
    } finally {
      setBusy(false);
    }
  }, [busy, todayDraw, companionId, style]);

  /* 戳一戳（结果画面的小伙伴） */
  const handlePoke = useCallback(() => {
    const txt = pickFromArr(POKE_LINES);
    setPokeText(txt);
    clearTimeout(pokeTimer.current);
    pokeTimer.current = setTimeout(() => setPokeText(null), 2200);
  }, []);

  /* Toast */
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  /* 关闭 */
  const handleClose = useCallback(() => {
    setShowResult(false);
    setTimeout(() => onClose?.(), 200);
  }, [onClose]);

  /* 背景键盘关闭 */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleClose]);

  /* 清理 timer */
  useEffect(() => () => {
    clearTimeout(pokeTimer.current);
    clearTimeout(toastTimer.current);
  }, []);

  const alreadyDrawn = !!todayDraw;
  const modeTabIndex = ['omikuji', 'tarot', 'astro'].indexOf(style);

  return (
    <div className="fo-backdrop" role="presentation">
      <SvgDefs avatarUrl={companionAvatarUrl} />

      <div
        className={`fo-root`}
        data-style={style}
        role="dialog"
        aria-modal="true"
        aria-label="宠物日签"
      >
        {/* 星星背景 */}
        <div className="fo-stars" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="fo-star"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
                animationDelay: `${(Math.random() * 3).toFixed(1)}s`,
                animationDuration: `${(2 + Math.random() * 2).toFixed(1)}s`,
              }}
            />
          ))}
        </div>

        {/* 顶部栏 */}
        <header className="fo-header">
          <button className="fo-back" onClick={handleClose} aria-label="关闭日签">
            <svg width="20" height="20" aria-hidden="true"><use href="#i-back" /></svg>
          </button>

          <h2 className="fo-title">今日日签</h2>

          {streakCount >= 2 && (
            <div className="fo-streak" title={`连续打卡 ${streakCount} 天`}>
              <svg width="14" height="14" aria-hidden="true" style={{ color: '#ff8c00' }}>
                <use href="#i-flame" />
              </svg>
              <span>{streakCount}</span>
            </div>
          )}
        </header>

        {/* 风格切换标签 */}
        <nav className="fo-modes" aria-label="风格切换">
          {['omikuji', 'tarot', 'astro'].map((s, idx) => (
            <button
              key={s}
              className={`fo-mode-btn${style === s ? ' is-active' : ''}${alreadyDrawn && style !== s ? ' is-locked' : ''}`}
              onClick={() => handleStyleChange(s)}
              aria-pressed={style === s}
              aria-label={`${STYLE_NAMES[s]}风格${alreadyDrawn && style !== s ? '（今日已抽，不可切换）' : ''}`}
            >
              {STYLE_NAMES[s]}
              {alreadyDrawn && style !== s && (
                <svg width="10" height="10" style={{ marginLeft: 3 }} aria-hidden="true">
                  <use href="#i-lock" />
                </svg>
              )}
            </button>
          ))}
          {/* 滑动指示器 */}
          <div
            className="fo-mode-ind"
            style={{ transform: `translateX(${modeTabIndex * 100}%)` }}
            aria-hidden="true"
          />
        </nav>

        {/* 签文主舞台 */}
        <div className="fo-stage-wrap">
          {style === 'omikuji' && (
            <OmikujiStage
              shaking={animating}
              onShake={handleDraw}
              drawn={alreadyDrawn}
            />
          )}
          {style === 'tarot' && (
            <TarotStage
              shuffling={animating}
              onShuffle={handleDraw}
              drawn={alreadyDrawn}
              drawnEntry={todayDraw?.result?.entry}
            />
          )}
          {style === 'astro' && (
            <AstroStage
              spinning={animating}
              onSpin={handleDraw}
              drawn={alreadyDrawn}
              drawnEntry={todayDraw?.result?.entry}
            />
          )}
        </div>

        {/* 抽签按钮 */}
        <div className="fo-go-wrap">
          <button
            className={`fo-go${alreadyDrawn ? ' is-done' : ''}${busy ? ' is-busy' : ''}`}
            onClick={alreadyDrawn ? () => setShowResult(true) : handleDraw}
            disabled={busy}
          >
            {busy ? (
              <span className="fo-go-loading" aria-label="抽签中">…</span>
            ) : alreadyDrawn ? (
              <>
                <svg width="16" height="16" aria-hidden="true"><use href="#i-check" /></svg>
                查看今日签文
              </>
            ) : (
              <>
                <svg width="16" height="16" aria-hidden="true"><use href="#i-sparkle" /></svg>
                {GO_LABEL[style]}
              </>
            )}
          </button>
        </div>

        {/* 历史记录抽屉 */}
        <HistorySheet
          open={sheetOpen}
          history={history}
          onToggle={() => setSheetOpen((v) => !v)}
        />

        {/* 结果遮罩层 */}
        {showResult && todayDraw && (
          <ResultOverlay
            result={todayDraw.result}
            style={todayDraw.style}
            companionName={companionName}
            companionAvatarUrl={companionAvatarUrl}
            onClose={() => setShowResult(false)}
            onShare={() => showToast('已复制到剪贴板～')}
          />
        )}

        {/* Toast 提示 */}
        {toast && (
          <div className="fo-toast is-show" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}