import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Heart, Inbox } from 'lucide-react';
import db from '../../db';
import {
  drawFromEmotionKit,
  ensureEmotionKitGenerated,
  getPoolTotal,
  regenerateEmotionKit,
} from './emotionKitService';
import { EMOTION_KIT_CATEGORIES } from './emotionKitTypes';
import './emotionkit.css';

/* 侧面条形码（纯 SVG，装饰用） */
const SideBarcode = () => (
  <svg className="ek-side-barcode" viewBox="0 0 100 24" fill="currentColor">
    <rect x="0" y="0" width="3" height="24" />
    <rect x="5" y="0" width="2" height="24" />
    <rect x="10" y="0" width="4" height="24" />
    <rect x="18" y="0" width="1" height="24" />
    <rect x="23" y="0" width="3" height="24" />
    <rect x="30" y="0" width="5" height="24" />
    <rect x="40" y="0" width="2" height="24" />
    <rect x="46" y="0" width="3" height="24" />
    <rect x="54" y="0" width="1" height="24" />
    <rect x="60" y="0" width="4" height="24" />
    <rect x="70" y="0" width="2" height="24" />
    <rect x="76" y="0" width="3" height="24" />
    <rect x="85" y="0" width="4" height="24" />
  </svg>
);

/* 各类别的视觉图示 */
const visualFor = (visual) => {
  if (visual === 'breath') {
    return (
      <div className="ek-sat-icon">
        <div className="ek-breath-pulse" />
      </div>
    );
  }
  if (visual === 'letter') {
    return (
      <div className="ek-sat-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6h18v12H3z" />
          <path d="M3 6l9 7 9-7" />
        </svg>
      </div>
    );
  }
  if (visual === 'stamp') {
    return (
      <div className="ek-sat-icon" style={{ fontSize: '8.5px', fontWeight: 700 }}>
        SEAL
      </div>
    );
  }
  return (
    <div className="ek-sat-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="4" />
        <path d="M4 7h3l1-2h8l1 2h3v12H4z" />
      </svg>
    </div>
  );
};

/* 弹窗里的大图示 */
const modalVisualFor = (visual) => {
  if (visual === 'breath') {
    return (
      <>
        <div className="emotionkit-breath-ring" />
        <div className="emotionkit-breath-core">REST</div>
      </>
    );
  }
  if (visual === 'letter') {
    return (
      <div className="emotionkit-letter-seal">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6h18v12H3z" />
          <path d="M3 6l9 7 9-7" />
        </svg>
      </div>
    );
  }
  if (visual === 'stamp') {
    return <div className="emotionkit-stamp-seal">TRUE</div>;
  }
  return (
    <div className="emotionkit-polaroid">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="4" />
        <path d="M4 7h3l1-2h8l1 2h3v12H4z" />
      </svg>
    </div>
  );
};

const BASE_PITCH = -18;
const BASE_YAW = -28;

export default function EmotionKitApp({ onBackHub }) {
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnResult, setDrawnResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const boxMeshRef = useRef(null);
  const rocketRef = useRef(null);
  const dragStateRef = useRef({ startX: 0, dragging: false, moved: false, currentY: BASE_YAW });

  useEffect(() => {
    db.characters.toArray().then((list) => {
      const usable = list.filter((character) => character?.id);
      setCharacters(usable);
      setActiveCharId((currentId) => {
        const exists = usable.some((character) => character.id === currentId);
        return exists ? currentId : usable[0]?.id || null;
      });
    });
  }, []);

  const loadActiveCharacter = useCallback(async (characterId) => {
    if (!characterId) {
      setActiveCharacter(null);
      return;
    }
    setIsLoading(true);
    try {
      const character = await db.characters.get(characterId);
      await ensureEmotionKitGenerated(character);
      const refreshed = await db.characters.get(characterId);
      setActiveCharacter(refreshed || character || null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveCharacter(activeCharId);
  }, [activeCharId, loadActiveCharacter]);

  const poolTotal = useMemo(
    () => getPoolTotal(activeCharacter?.emotionKit),
    [activeCharacter]
  );

  const handleRegenerate = async () => {
    if (!activeCharacter || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await regenerateEmotionKit(activeCharacter);
      const refreshed = await db.characters.get(activeCharacter.id);
      setActiveCharacter(refreshed);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDraw = () => {
    if (!activeCharacter || isDrawing) return;

    const box = boxMeshRef.current;
    const rocket = rocketRef.current;

    if (box) {
      const state = dragStateRef.current;
      box.style.setProperty('--cur-y', `${state.currentY}deg`);
      box.classList.add('is-ejecting');
      setTimeout(() => box.classList.remove('is-ejecting'), 500);
    }

    if (rocket) {
      rocket.classList.remove('shoot-up');
      void rocket.offsetWidth; // reflow
      rocket.classList.add('shoot-up');
    }

    setIsDrawing(true);
    window.setTimeout(() => {
      setIsDrawing(false);
      const drawn = drawFromEmotionKit(activeCharacter.emotionKit);
      if (!drawn) return;
      setDrawnResult(drawn);
      setIsModalOpen(true);
    }, 420);
  };

  /* 拖拽：左右旋转盒子，不进 React state，松手弹回 */
  const handlePointerDown = (event) => {
    const box = boxMeshRef.current;
    if (!box) return;
    dragStateRef.current = {
      startX: event.clientX,
      dragging: true,
      moved: false,
      currentY: dragStateRef.current.currentY,
    };
    box.style.transition = 'none';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const box = boxMeshRef.current;
    const state = dragStateRef.current;
    if (!box || !state.dragging) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 5) state.moved = true;

    const rotateY = Math.max(BASE_YAW - 42, Math.min(BASE_YAW + 42, BASE_YAW + deltaX * 0.35));
    state.currentY = rotateY;
    box.style.transform = `rotateX(${BASE_PITCH}deg) rotateY(${rotateY}deg)`;
  };

  const handlePointerUp = () => {
    const box = boxMeshRef.current;
    const state = dragStateRef.current;
    if (!box) return;

    box.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    box.style.transform = `rotateX(${BASE_PITCH}deg) rotateY(${BASE_YAW}deg)`;
    dragStateRef.current.currentY = BASE_YAW;

    const wasDrag = state.moved;
    dragStateRef.current = { ...dragStateRef.current, dragging: false, moved: false };

    if (!wasDrag) {
      handleDraw();
    }
  };

  const handleBoxKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDraw();
    }
  };

  const category = drawnResult ? EMOTION_KIT_CATEGORIES[drawnResult.categoryId] : null;

  return (
    <div className="emotionkit-app">
      {/* 弥散光斑背景 */}
      <div className="ek-diffuse" aria-hidden="true">
        <div className="ek-orb ek-orb--1" />
        <div className="ek-orb ek-orb--2" />
      </div>

      <div className="ek-layout">
        {/* 顶部导航 */}
        <header className="ek-topline">
          <button type="button" className="ek-back-btn" onClick={onBackHub}>
            <ArrowLeft size={14} strokeWidth={2} />
            返回
          </button>
          <span className="ek-edition-tag">EMOTION FIRST-AID</span>
        </header>

        {characters.length > 0 ? (
          <>
            {/* 角色切换条 */}
            <div className="ek-char-strip" aria-label="选择角色">
              {characters.map((character) => {
                const isActive = character.id === activeCharId;
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`ek-char-chip ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveCharId(character.id)}
                  >
                    <span className="ek-char-chip__avatar">
                      {character.avatar ? (
                        <img src={character.avatar} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Heart size={11} strokeWidth={1.6} />
                      )}
                    </span>
                    <span>{character.name}</span>
                  </button>
                );
              })}
            </div>

            {activeCharacter && (
              <section className="ek-stage">
                {/* 标语 */}
                <div className="ek-statement">
                  <div className="ek-statement-eyebrow">WHEN YOU NEED COMFORT</div>
                  <h2 className="ek-statement-headline">
                    不想说话也没关系，<br />先抽一张给自己。
                  </h2>
                  <p className="ek-statement-sub">
                    按住盒子左右转动，轻按顶部槽口抽取便签——
                    可能是一句及时的安慰、轻度的任务或一段回忆。
                  </p>
                </div>

                {/* 3D 场景区 */}
                <div
                  className="ek-scene"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  {/* 轨道卫星 */}
                  <div className="ek-satellite ek-satellite--1" aria-hidden="true">
                    {visualFor('breath')}
                    <span>呼吸刻度</span>
                  </div>
                  <div className="ek-satellite ek-satellite--2" aria-hidden="true">
                    {visualFor('letter')}
                    <span>封漆信笺</span>
                  </div>
                  <div className="ek-satellite ek-satellite--3" aria-hidden="true">
                    {visualFor('stamp')}
                    <span>誓约印章</span>
                  </div>
                  <div className="ek-satellite ek-satellite--4" aria-hidden="true">
                    {visualFor('polaroid')}
                    <span>拍立得</span>
                  </div>

                  {/* 悬浮升降层 */}
                  <div className="ek-rig-float">
                    {/* 3D 盒体 */}
                    <div
                      ref={boxMeshRef}
                      className="ek-box-mesh"
                      role="button"
                      tabIndex={0}
                      aria-label="点击抽取急救便签"
                      onKeyDown={handleBoxKeyDown}
                    >
                      {/* 抽卡弹射纸条动效 */}
                      <div ref={rocketRef} className="ek-paper-rocket" aria-hidden="true" />

                      {/* 面 1：正面 */}
                      <div className="ek-face ek-face--front">
                        <div className="ek-front-top">
                          <div className="ek-relief-cross-wrap">
                            <div className="ek-relief-cross" />
                            <span>EMERGENCY</span>
                          </div>
                          <span className="ek-issue-no">N° 04</span>
                        </div>
                        <div>
                          <div className="ek-front-title">FIRST-AID KIT</div>
                          <div className="ek-front-sub">急救便签收纳盒</div>
                        </div>
                        <div className="ek-front-meta">
                          <span>{isLoading ? '生成中…' : 'TAP TO DRAW'}</span>
                          <span>2026</span>
                        </div>
                      </div>

                      {/* 面 2：顶盖 */}
                      <div className="ek-face ek-face--top">
                        <div className="ek-top-groove" />
                        <div className="ek-eject-slot">
                          <div className="ek-slip-tip" />
                        </div>
                        <div className="ek-top-handle" />
                        <div className="ek-top-hint">PULL / TAP</div>
                      </div>

                      {/* 面 3：右侧 */}
                      <div className="ek-face ek-face--right">
                        <span className="ek-side-brand">CARE &amp; TENDERNESS</span>
                        <SideBarcode />
                      </div>

                      {/* 面 4：左侧 */}
                      <div className="ek-face ek-face--left" />

                      {/* 面 5：背面 */}
                      <div className="ek-face ek-face--back" />

                      {/* 面 6：底面 */}
                      <div className="ek-face ek-face--bottom" />
                    </div>

                    {/* 地面投影 */}
                    <div className="ek-ground-shadow" aria-hidden="true" />
                  </div>
                </div>

                {/* 底部状态 */}
                <div className="ek-foot">
                  <div className="ek-pool-tag">
                    急救盒存量 · <b>{poolTotal}</b> 条存根 / 5 个维度
                  </div>
                  <button
                    type="button"
                    className="ek-regen-btn"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? '正在重新生成…' : '重新生成全部内容'}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="ek-empty">
            <Inbox size={24} strokeWidth={1.35} />
            <h3>还没有可以准备急救盒的角色</h3>
            <p>请先创建一位陪伴者，再回来抽第一张纸条。</p>
          </section>
        )}
      </div>

      {/* 抽取结果弹窗 */}
      <div
        className={`ek-modal-backdrop ${isModalOpen ? 'is-active' : ''}`}
        onClick={() => setIsModalOpen(false)}
      >
        {category && drawnResult && (
          <article className="ek-paper-note" onClick={(e) => e.stopPropagation()}>
            <div className="ek-note-header">
              <span className="ek-note-tag">{category.tag}</span>
              <span className="ek-note-time">
                记录于 {new Date(drawnResult.note.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </span>
            </div>

            <div className="ek-note-visual">{modalVisualFor(category.visual)}</div>

            <h2 className="ek-note-title">{category.label}</h2>
            <p className="ek-note-content">"{drawnResult.note.text}"</p>

            <button
              type="button"
              className="ek-note-accept-btn"
              onClick={() => setIsModalOpen(false)}
            >
              收下并放回急救盒
            </button>
          </article>
        )}
      </div>
    </div>
  );
}