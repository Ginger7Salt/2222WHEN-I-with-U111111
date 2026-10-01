// src/apps/shell/ShellApp.jsx
//
// 潮汐贝壳。视觉和交互 1:1 搬自 user 已经确认过的 HTML 预览稿
// （tidal-shell-preview-v2.html）：按住蓄潮、水位上升、气泡、满潮
// 脉动、潮水涌起、贝壳出现（带稀有度预兆）、拖拽磁吸进圈、开壳
// 动效、阅读卡翻出（新打捞可"放回潮水"/"收进贝壳册"，飞入右上角
// 贝壳册计数）。贝壳册（全局一本）用文字链接切换，不用底部 tab bar。
//
// 跟蓄潮/拖拽/开壳这类高频动效相关的状态（水位、按钮进度环、贝壳
// 位置、磁吸强度、提示文字）都直接用 ref 操作 DOM（style.setProperty /
// classList），不走 React state——这是为了保留预览稿原本的手感（逐帧
// 更新，没有 React 重渲染的延迟），也是预览稿本身的实现方式。只有
// 真正需要触发界面结构变化的（选中角色、配额、贝壳册列表、阅读卡
// 内容）才用 useState。
import React, { useEffect, useRef, useState } from 'react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import {
  salvageShell,
  getRemainingQuota,
  getShellCollection,
  deleteShellCatch,
} from './shellService';
import {
  DAILY_QUOTA,
  IDENTITY,
  IDENTITY_LABEL,
  FORM_LABEL,
  TIER_LABEL,
} from './shellTypes';
import { shellMarkup, pearlsMarkup } from './shellRenderer';
import './shell.css';

const HOLD_MS = 1300;

const WAVE_PATH = 'M0 28Q100 8 200 28T400 28T600 28T800 28V64H0Z';
const WAVE_LINE = 'M0 28Q100 8 200 28T400 28T600 28T800 28';

const splitParagraphs = (content) => {
  const text = String(content || '').trim();
  const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
};

const firstParagraph = (content) => splitParagraphs(content)[0] || '';

const formatShortDate = (ts) => {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
};

const signFor = (identity, name) => (
  identity === IDENTITY.PARALLEL ? `—— 另一个 ${name || 'ta'}` : `—— ${name || 'ta'}`
);

export default function ShellApp({ onBackHub }) {
  const [view, setView] = useState('shore'); // 'shore' | 'book'

  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterIdState] = useState(null);
  const selectedCharacterIdRef = useRef(null);
  const setSelectedCharacterId = (id) => {
    selectedCharacterIdRef.current = id;
    setSelectedCharacterIdState(id);
  };

  const [remaining, setRemainingState] = useState(DAILY_QUOTA);
  const remainingRef = useRef(DAILY_QUOTA);
  const setRemaining = (n) => {
    remainingRef.current = n;
    setRemainingState(n);
  };

  const [phase, setPhaseState] = useState('idle'); // idle/charging/surging/waiting/opening
  const phaseRef = useRef('idle');
  const setPhase = (next) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const [collection, setCollection] = useState([]);
  const [identityFilter, setIdentityFilter] = useState('all');
  const [badgePop, setBadgePop] = useState(false);

  const [sheetData, setSheetData] = useState(null); // {item, mode:'new'|'view', no}
  const [sheetAnim, setSheetAnim] = useState('');

  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const toastTimerRef = useRef(null);

  const stageRef = useRef(null);
  const hwRef = useRef(null);
  const ringRef = useRef(null);
  const surgeRef = useRef(null);
  const shellRef = useRef(null);
  const artRef = useRef(null);
  const hintRef = useRef(null);
  const hintTimerRef = useRef(null);
  const cardSheetRef = useRef(null);
  const sheetWrapRef = useRef(null);
  const bookBadgeRef = useRef(null);

  const holdRef = useRef({ raf: 0, t0: 0, full: false, active: false });
  const dragRef = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });
  const pendingCatchRef = useRef(null);

  // ── 初始加载 ──
  useEffect(() => {
    (async () => {
      const list = await db.characters.toArray();
      setCharacters(list);
      if (list.length > 0) setSelectedCharacterId(list[0].id);
    })();
    loadCollection();
  }, []);

  useEffect(() => {
    refreshQuota(selectedCharacterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacterId]);

  const refreshQuota = async (characterId) => {
    if (!characterId) {
      setRemaining(DAILY_QUOTA);
      return;
    }
    const left = await getRemainingQuota(characterId);
    setRemaining(left);
  };

  const loadCollection = async () => {
    try {
      const rows = await getShellCollection();
      setCollection(rows);
    } catch {
      // 贝壳册加载失败不影响打捞主流程，静默即可。
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setToastOn(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastOn(false), 1900);
  };

  const setHintText = (text) => {
    const el = hintRef.current;
    if (!el) return;
    el.classList.add('ts-sw');
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      el.textContent = text;
      el.classList.remove('ts-sw');
    }, 260);
  };

  const idleHintNow = () => {
    setHintText(remainingRef.current <= 0 ? '今日潮水已退，明天再来' : '按住「打捞」，等潮水涨满');
  };

  // ── 按住蓄潮 ──
  const tickHold = () => {
    const hold = holdRef.current;
    if (!hold.active) return;
    const p = Math.min(1, (performance.now() - hold.t0) / HOLD_MS);
    stageRef.current?.style.setProperty('--lvl', p.toFixed(3));
    hwRef.current?.style.setProperty('--pr', p.toFixed(3));
    if (p >= 1 && !hold.full) {
      hold.full = true;
      hwRef.current?.classList.add('ts-full');
      setHintText('松手');
      if (navigator.vibrate) navigator.vibrate(18);
    }
    hold.raf = requestAnimationFrame(tickHold);
  };

  const startHold = () => {
    if (phaseRef.current !== 'idle' || remainingRef.current <= 0 || holdRef.current.active) return;
    holdRef.current = { t0: performance.now(), full: false, raf: 0, active: true };
    setPhase('charging');
    stageRef.current?.classList.add('ts-charging');
    hwRef.current?.classList.add('ts-charging');
    setHintText('潮在涨……别松手');
    tickHold();
  };

  const endHold = () => {
    const hold = holdRef.current;
    if (!hold.active) return;
    cancelAnimationFrame(hold.raf);
    const full = hold.full;
    holdRef.current = { raf: 0, t0: 0, full: false, active: false };
    stageRef.current?.classList.remove('ts-charging');
    hwRef.current?.classList.remove('ts-charging', 'ts-full');
    stageRef.current?.style.setProperty('--lvl', '0');
    hwRef.current?.style.setProperty('--pr', '0');
    if (full) {
      crash();
    } else {
      setPhase('idle');
      setHintText('潮还没涨满，再按久一点');
      setTimeout(() => {
        if (phaseRef.current === 'idle') idleHintNow();
      }, 1700);
    }
  };

  const handleHoldPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startHold();
  };
  const handleHoldKeyDown = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      startHold();
    }
  };
  const handleHoldKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      endHold();
    }
  };

  // ── 满潮松手：潮水涌起 + 现场调 AI 生成内容 ──
  const crash = async () => {
    setPhase('surging');
    setHintText('潮水涌来……');

    const surgeEl = surgeRef.current;
    if (surgeEl) {
      surgeEl.classList.remove('ts-go');
      // eslint-disable-next-line no-void
      void surgeEl.offsetWidth;
      surgeEl.classList.add('ts-go');
      setTimeout(() => surgeEl.classList.remove('ts-go'), 2900);
    }

    const charId = selectedCharacterIdRef.current;
    let chat = null;
    try {
      chat = await db.chats.where('characterId').equals(charId).first();
    } catch {
      chat = null;
    }

    const aiPromise = salvageShell({ characterId: charId, chatId: chat?.id || null });
    let settled = false;
    aiPromise.then(
      () => { settled = true; },
      () => { settled = true; }
    );

    await new Promise((resolve) => setTimeout(resolve, 1350));
    if (!settled) setHintText('贝壳正在成形……');

    try {
      const item = await aiPromise;
      pendingCatchRef.current = item;
      refreshQuota(charId);
      placeShell(item.tier);
    } catch (error) {
      showToast(error?.message || '打捞失败，潮水好像有点乱');
      triggerGlobalToast({
        title: '打捞失败',
        content: error?.message || '潮水好像有点乱，稍后再试试',
        iconType: 'bell',
      });
      resetShore();
    }
  };

  const placeShell = (tier) => {
    if (artRef.current) artRef.current.innerHTML = shellMarkup(tier, 'full');
    const shellEl = shellRef.current;
    if (shellEl) {
      shellEl.dataset.look = String(tier);
      posRef.current = { x: 0, y: 0 };
      shellEl.style.setProperty('--x', '0px');
      shellEl.style.setProperty('--y', '0px');
      shellEl.classList.remove('ts-spring');
      shellEl.classList.add('ts-show', 'ts-arrive');
      setTimeout(() => shellEl.classList.remove('ts-arrive'), 1000);
    }
    ringRef.current?.classList.add('ts-on');
    setPhase('waiting');
    setHintText('把贝壳拖进下方的圈里');
  };

  const resetShore = () => {
    setPhase('idle');
    pendingCatchRef.current = null;
    idleHintNow();
  };

  // ── 拖拽 + 磁吸 ──
  const measure = () => {
    const sr = shellRef.current.getBoundingClientRect();
    const rr = ringRef.current.getBoundingClientRect();
    const bx = sr.left + sr.width / 2 - posRef.current.x;
    const by = sr.top + sr.height / 2 - posRef.current.y;
    return { tx: rr.left + rr.width / 2 - bx, ty: rr.top + rr.height / 2 - by };
  };

  const handleShellPointerDown = (e) => {
    if (phaseRef.current !== 'waiting' || shellRef.current?.classList.contains('ts-spring')) return;
    shellRef.current.setPointerCapture?.(e.pointerId);
    const m = measure();
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
      tx: m.tx,
      ty: m.ty,
      lx: e.clientX,
      d: Math.hypot(m.tx - posRef.current.x, m.ty - posRef.current.y),
    };
    dragRef.current.R = Math.min(120, dragRef.current.d * 0.75);
    shellRef.current.classList.add('ts-drag');
  };

  const handleShellPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    let x = drag.ox + (e.clientX - drag.sx);
    let y = drag.oy + (e.clientY - drag.sy);
    const dx = drag.tx - x;
    const dy = drag.ty - y;
    const d = Math.hypot(dx, dy);
    let p = 0;
    if (d < drag.R) {
      p = 1 - d / drag.R;
      const k = Math.pow(p, 1.6) * 0.7;
      x += dx * k;
      y += dy * k;
    }
    posRef.current = { x, y };
    shellRef.current.style.setProperty('--x', `${x}px`);
    shellRef.current.style.setProperty('--y', `${y}px`);
    ringRef.current.style.setProperty('--p', p.toFixed(3));
    shellRef.current.style.setProperty('--r', `${Math.max(-14, Math.min(14, (e.clientX - drag.lx) * 1.4))}deg`);
    drag.lx = e.clientX;
    drag.d = Math.hypot(drag.tx - x, drag.ty - y);
  };

  const handleShellPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    const d = drag.d;
    const t = { tx: drag.tx, ty: drag.ty };
    dragRef.current = null;
    shellRef.current.classList.remove('ts-drag');
    shellRef.current.style.setProperty('--r', '0deg');
    if (d < 58) {
      snapAndOpen(t);
    } else {
      springBack();
    }
  };

  const handleShellDblClick = () => {
    if (phaseRef.current === 'waiting') snapAndOpen(measure());
  };
  const handleShellKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && phaseRef.current === 'waiting') {
      e.preventDefault();
      snapAndOpen(measure());
    }
  };

  const springBack = () => {
    const shellEl = shellRef.current;
    shellEl.classList.add('ts-spring');
    posRef.current = { x: 0, y: 0 };
    shellEl.style.setProperty('--x', '0px');
    shellEl.style.setProperty('--y', '0px');
    ringRef.current?.style.setProperty('--p', '0');
    setHintText('再靠近一点，圈会把它吸过去');
    setTimeout(() => shellEl.classList.remove('ts-spring'), 720);
  };

  // ── 开壳 ──
  const buildOpener = (tier) => {
    const stageEl = stageRef.current;
    const ringRect = ringRef.current.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const o = document.createElement('div');
    o.className = 'ts-opener';
    o.dataset.tier = String(tier);
    o.style.left = `${ringRect.left + ringRect.width / 2 - stageRect.left}px`;
    o.style.top = `${ringRect.top + ringRect.height / 2 - stageRect.top}px`;
    const stars = tier === 2
      ? `<div class="ts-op-stars">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<i style="--a:${a}deg"></i>`).join('')}</div>`
      : '';
    const rings = tier >= 1 ? '<div class="ts-op-rings"><i></i><i></i></div>' : '';
    o.innerHTML = `<div class="ts-op-glow"></div>${rings}<div class="ts-op-beam"></div>${shellMarkup(tier, 'bottom')}<div class="ts-op-paper"></div>${shellMarkup(tier, 'top').replace('<svg ', '<svg class="ts-op-top" ')}${stars}`;
    stageEl.appendChild(o);
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('ts-go')));
    return o;
  };

  const snapAndOpen = (t) => {
    setPhase('opening');
    const shellEl = shellRef.current;
    shellEl.classList.add('ts-spring');
    posRef.current = { x: t.tx, y: t.ty };
    shellEl.style.setProperty('--x', `${t.tx}px`);
    shellEl.style.setProperty('--y', `${t.ty}px`);
    ringRef.current.style.setProperty('--p', '1');
    setHintText('');

    const tier = pendingCatchRef.current?.tier ?? 0;
    let op;
    setTimeout(() => {
      op = buildOpener(tier);
      shellEl.classList.remove('ts-show', 'ts-spring');
      posRef.current = { x: 0, y: 0 };
      shellEl.style.setProperty('--x', '0px');
      shellEl.style.setProperty('--y', '0px');
    }, 450);
    setTimeout(() => openSheetForNewCatch(), 2000);
    setTimeout(() => { if (op) op.classList.add('ts-out'); }, 2150);
    setTimeout(() => {
      if (op) op.remove();
      ringRef.current?.classList.remove('ts-on');
      ringRef.current?.style.setProperty('--p', '0');
    }, 2700);
  };

  const openSheetForNewCatch = () => {
    const item = pendingCatchRef.current;
    if (!item) return;
    setSheetData({ item, mode: 'new' });
    setSheetAnim('');
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetAnim('ts-open')));
  };

  // ── 阅读卡的三种收场 ──
  const handleSheetClose = () => {
    setSheetAnim('');
    setTimeout(() => setSheetData(null), 450);
  };

  const handleSheetBack = () => {
    const item = sheetData?.item;
    setSheetAnim('ts-leave');
    setTimeout(async () => {
      setSheetData(null);
      setSheetAnim('');
      resetShore();
      if (item?.id) {
        try {
          await deleteShellCatch(item.id);
        } catch {
          // 删除失败就留在贝壳册里，不影响继续打捞。
        }
      }
    }, 650);
  };

  const handleSheetKeep = () => {
    const cardEl = cardSheetRef.current;
    const badgeEl = bookBadgeRef.current;
    if (cardEl && badgeEl && sheetWrapRef.current) {
      const cr = cardEl.getBoundingClientRect();
      const br = badgeEl.getBoundingClientRect();
      sheetWrapRef.current.style.setProperty('--fx', `${br.left + br.width / 2 - cr.left - cr.width / 2}px`);
      sheetWrapRef.current.style.setProperty('--fy', `${br.top + br.height / 2 - cr.top - cr.height / 2}px`);
    }
    setSheetAnim('ts-fly');
    setTimeout(async () => {
      setSheetData(null);
      setSheetAnim('');
      resetShore();
      showToast('已收进贝壳册');
      setBadgePop(true);
      setTimeout(() => setBadgePop(false), 700);
      await loadCollection();
    }, 820);
  };

  const openViewSheet = (item, no) => {
    setSheetData({ item, mode: 'view', no });
    setSheetAnim('');
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetAnim('ts-open')));
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteShellCatch(deleteTargetId);
    } finally {
      setDeleteTargetId(null);
      handleSheetClose();
      await loadCollection();
    }
  };

  const cycleCharacter = () => {
    if (phaseRef.current !== 'idle') {
      showToast('先处理手中的贝壳');
      return;
    }
    if (characters.length <= 1) return;
    const idx = characters.findIndex((c) => c.id === selectedCharacterId);
    const next = characters[(idx + 1) % characters.length];
    setSelectedCharacterId(next.id);
  };

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) || null;

  const total = collection.length;
  const numbered = collection.map((item, idx) => ({ item, idx, no: total - idx }));
  const filteredCollection = numbered.filter(
    ({ item }) => identityFilter === 'all' || item.identity === identityFilter
  );

  const sheetParas = sheetData ? splitParagraphs(sheetData.item.content) : [];
  const sheetSign = sheetData
    ? signFor(sheetData.item.identity, sheetData.item.character?.name)
    : '';

  return (
    <div className="ts-scope">
      <div className="ts-root">
        <i className="ts-haze ts-h1" />
        <i className="ts-haze ts-h2" />

        {view === 'shore' && (
          <section className="ts-screen">
            <div className="ts-folio">
              <button type="button" className="ts-lnk" onClick={onBackHub}>
                返回
              </button>
              <button type="button" className="ts-lnk" ref={bookBadgeRef} onClick={() => setView('book')}>
                贝壳册<em className={badgePop ? 'ts-pop' : ''}>{total}</em>
              </button>
            </div>

            <header className="ts-mast">
              <h1>潮汐贝壳</h1>
              <div className="ts-mrow">
                <p className="ts-lede">潮水带来的，<br />不属于此刻的 ta</p>
                <button type="button" className="ts-who" onClick={cycleCharacter}>
                  当前 <b>{selectedCharacter?.name || '—'}</b> · 切换
                </button>
              </div>
            </header>

            <div className="ts-stage" ref={stageRef}>
              <div className="ts-ruler"><i /></div>

              <div className="ts-tide">
                <div className="ts-sea" />
                {['ts-w1', 'ts-w2', 'ts-w3', 'ts-w4'].map((cls) => (
                  <div className={`ts-wave ${cls}`} key={cls}>
                    <svg viewBox="0 0 800 64" preserveAspectRatio="none">
                      <path className="ts-f" d={WAVE_PATH} />
                      <path className="ts-l" d={WAVE_LINE} />
                    </svg>
                  </div>
                ))}
              </div>

              {[0, 1, 2, 3, 4, 5].map((i) => <i className="ts-bub" key={i} />)}

              <div className="ts-sand" />

              <div className="ts-ring" ref={ringRef}><i /><i /><i /><i /></div>

              <div className="ts-surge" ref={surgeRef}>
                <svg viewBox="0 0 800 420" preserveAspectRatio="none">
                  <path className="ts-s2" d="M0 96Q100 56 200 96T400 96T600 96T800 96V420H0Z" />
                  <path className="ts-s" d="M0 60Q100 20 200 60T400 60T600 60T800 60V420H0Z" />
                  <path className="ts-e" d="M0 60Q100 20 200 60T400 60T600 60T800 60" />
                </svg>
              </div>

              <div
                className="ts-shell"
                ref={shellRef}
                tabIndex={0}
                role="button"
                aria-label="拖动贝壳到圈内，或按回车打开"
                onPointerDown={handleShellPointerDown}
                onPointerMove={handleShellPointerMove}
                onPointerUp={handleShellPointerUp}
                onPointerCancel={handleShellPointerUp}
                onDoubleClick={handleShellDblClick}
                onKeyDown={handleShellKeyDown}
              >
                <div className="ts-sh-a"><div className="ts-sh-t"><div className="ts-sh-b">
                  <div className="ts-omen">
                    <i className="ts-rg" /><i className="ts-rg" /><i className="ts-halo" />
                    <i className="ts-st" /><i className="ts-st" /><i className="ts-st" /><i className="ts-st" />
                  </div>
                  <div className="ts-art" ref={artRef} />
                </div></div></div>
              </div>

              <p className="ts-hint" ref={hintRef}>按住「打捞」，等潮水涨满</p>
            </div>

            <div className="ts-dock">
              <div className="ts-hw" ref={hwRef}>
                <button
                  type="button"
                  className="ts-hold"
                  disabled={(phase !== 'idle' && phase !== 'charging') || remaining <= 0}
                  onPointerDown={handleHoldPointerDown}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                  onKeyDown={handleHoldKeyDown}
                  onKeyUp={handleHoldKeyUp}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label="按住蓄潮，涨满后松手"
                >
                  <b>打捞</b><small>Hold</small>
                </button>
              </div>
              <div className="ts-ticks">
                {Array.from({ length: DAILY_QUOTA }, (_, i) => (
                  <i key={i} className={i < remaining ? 'on' : ''} />
                ))}
              </div>
              <div className="ts-quota">
                <span>今日余 {remaining} / {DAILY_QUOTA}</span> &nbsp;·&nbsp; 按角色分别计算
              </div>
            </div>
          </section>
        )}

        {view === 'book' && (
          <section className="ts-screen">
            <div className="ts-folio">
              <span>Shell Album</span>
              <button type="button" className="ts-lnk" onClick={() => setView('shore')}>海岸</button>
            </div>

            <header className="ts-mast" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <h1>贝壳册</h1>
              <div className="ts-col-no">{String(total).padStart(2, '0')}</div>
            </header>

            <div className="ts-filters">
              {[['all', '全部'], [IDENTITY.SELF, '本尊'], [IDENTITY.PARALLEL, '平行世界']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`ts-fl ${identityFilter === key ? 'ts-on' : ''}`}
                  onClick={() => setIdentityFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredCollection.length === 0 && (
              <p style={{ fontSize: 12, opacity: 0.5, textAlign: 'center', padding: '32px 0' }}>还没有捞到过贝壳</p>
            )}

            <div className="ts-grid">
              {filteredCollection.map(({ item, no }, i) => (
                <article
                  key={item.id}
                  className="ts-cc"
                  data-tier={item.tier}
                  style={{ '--i': i, animationDelay: `${i * 0.06}s` }}
                  onClick={() => openViewSheet(item, no)}
                >
                  <div className="ts-cc-top">
                    <div className="ts-cc-shell" dangerouslySetInnerHTML={{ __html: shellMarkup(item.tier) }} />
                    <span dangerouslySetInnerHTML={{ __html: pearlsMarkup(item.tier) }} />
                  </div>
                  <h3>{FORM_LABEL[item.form]}</h3>
                  <p className="ts-cc-id">{IDENTITY_LABEL[item.identity]}</p>
                  <p className="ts-cc-ex">{firstParagraph(item.content)}</p>
                  <div className="ts-cc-ft">
                    <span>No.{String(no).padStart(2, '0')}</span>
                    <span>{formatShortDate(item.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {sheetData && (
        <div className={`ts-sheet ${sheetAnim}`} ref={sheetWrapRef}>
          <div className="ts-backdrop" onClick={sheetData.mode === 'view' ? handleSheetClose : undefined} />
          <div className="ts-cardsheet" data-tier={sheetData.item.tier} ref={cardSheetRef}>
            <div className="ts-stars" />
            <div className="ts-card-in">
              <div className="ts-c-top ts-reveal" style={{ '--d': '.05s' }}>
                <span className="ts-c-no">
                  {sheetData.mode === 'new' ? '刚刚打捞' : `No.${String(sheetData.no).padStart(2, '0')}`}
                </span>
                <span dangerouslySetInnerHTML={{ __html: pearlsMarkup(sheetData.item.tier) }} />
              </div>

              <div className="ts-c-tags ts-reveal" style={{ '--d': '.12s' }}>
                <span className="ts-tag">{IDENTITY_LABEL[sheetData.item.identity]}</span>
                <span className="ts-tag">{TIER_LABEL[sheetData.item.tier]}</span>
              </div>

              <h2 className="ts-c-title ts-reveal" style={{ '--d': '.2s' }}>
                {FORM_LABEL[sheetData.item.form]}
              </h2>

              {sheetData.item.when && (
                <p className="ts-c-when ts-reveal" style={{ '--d': '.28s' }}>{sheetData.item.when}</p>
              )}

              <div className="ts-c-rule" />

              <div className="ts-c-body">
                {sheetParas.map((p, i) => (
                  <p key={i} className="ts-reveal" style={{ '--d': `${0.45 + i * 0.16}s` }}>{p}</p>
                ))}
              </div>

              <p className="ts-c-sign ts-reveal" style={{ '--d': `${0.45 + sheetParas.length * 0.16}s` }}>
                {sheetSign}
              </p>

              {sheetData.item.identity === IDENTITY.PARALLEL && (
                <p className="ts-c-note ts-reveal" style={{ '--d': '1.1s' }}>
                  此为虚构 · 与 ta 的任何真实经历无关
                </p>
              )}
            </div>

            <div className="ts-c-actions">
              {sheetData.mode === 'new' ? (
                <>
                  <button type="button" className="ts-btn ts-gh" onClick={handleSheetBack}>放回潮水</button>
                  <button type="button" className="ts-btn ts-pri" onClick={handleSheetKeep}>收进贝壳册</button>
                </>
              ) : (
                <button type="button" className="ts-btn ts-pri" onClick={handleSheetClose}>合上</button>
              )}
            </div>

            {sheetData.mode === 'view' && (
              <button
                type="button"
                onClick={() => setDeleteTargetId(sheetData.item.id)}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  opacity: 0.45,
                  padding: '0 22px 16px',
                }}
              >
                放回大海（删除）
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`ts-toast ${toastOn ? 'ts-on' : ''}`}>{toastMsg}</div>

      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="放回大海"
        message="这枚贝壳会从贝壳册里彻底删除，确定吗？"
        confirmText="放回大海"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}