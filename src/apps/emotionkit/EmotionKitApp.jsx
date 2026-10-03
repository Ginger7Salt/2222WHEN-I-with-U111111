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

const visualFor = (visual) => {
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

export default function EmotionKitApp({ onBackHub }) {
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnResult, setDrawnResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const boxRef = useRef(null);

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

    const box = boxRef.current;
    if (box) box.classList.add('is-drawing');
    setIsDrawing(true);

    window.setTimeout(() => {
      if (box) box.classList.remove('is-drawing');
      setIsDrawing(false);

      const drawn = drawFromEmotionKit(activeCharacter.emotionKit);
      if (!drawn) return;

      setDrawnResult(drawn);
      setIsModalOpen(true);
    }, 420);
  };

  // 盒子的手势改成"左右拖拽=旋转，松手回正；原地点一下=抽取"，取代原来
  // 鼠标悬停跟随倾斜的写法——用户这一轮明确要的是"可以被左右滑动产生
  // 旋转的效果，点击盒子会抽取一张"，鼠标 hover 跟手指划动是两种不同的
  // 交互意图，不能用同一套逻辑覆盖。拖拽过程中直接改 DOM 的 transform
  // （不进 React state），松手之后才用 CSS transition 把角度弹回 0，
  // 这样整个拖拽阶段没有一次 re-render，跟手感不卡顿。
  const dragStateRef = useRef({ startX: 0, dragging: false, moved: false });

  const handlePointerDown = (event) => {
    const box = boxRef.current;
    if (!box) return;

    dragStateRef.current = { startX: event.clientX, dragging: true, moved: false };
    box.style.transition = 'none';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const box = boxRef.current;
    const state = dragStateRef.current;
    if (!box || !state.dragging) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 5) state.moved = true;

    const rotateY = Math.max(-42, Math.min(42, deltaX * 0.35));
    box.style.transform = `perspective(1000px) rotateY(${rotateY}deg)`;
  };

  const handlePointerUp = () => {
    const box = boxRef.current;
    const state = dragStateRef.current;
    if (!box) return;

    box.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    box.style.transform = 'perspective(1000px) rotateY(0deg)';

    const wasDrag = state.moved;
    dragStateRef.current = { startX: 0, dragging: false, moved: false };

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
      <div className="emotionkit-diffuse">
        <div className="emotionkit-orb emotionkit-orb--1" />
        <div className="emotionkit-orb emotionkit-orb--2" />
        <div className="emotionkit-orb emotionkit-orb--3" />
      </div>

      <div className="emotionkit-layout">
        <div className="emotionkit-topline">
          <button type="button" className="emotionkit-back-button" onClick={onBackHub}>
            <ArrowLeft size={15} strokeWidth={1.7} />
            返回
          </button>

          <span className="emotionkit-edition">情绪急救盒</span>
        </div>

        {characters.length > 0 ? (
          <>
            <div className="emotionkit-character-strip" aria-label="选择角色">
              {characters.map((character) => {
                const isActive = character.id === activeCharId;

                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`emotionkit-character-chip ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveCharId(character.id)}
                  >
                    <span className="emotionkit-character-chip__avatar">
                      {character.avatar ? (
                        <img src={character.avatar} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Heart size={12} strokeWidth={1.6} />
                      )}
                    </span>
                    <span>{character.name}</span>
                  </button>
                );
              })}
            </div>

            {activeCharacter && (
              <section className="emotionkit-stage">
                <div>
                  <div className="emotionkit-statement-tag">WHEN YOU NEED IT</div>
                  <h2 className="emotionkit-statement-quote">
                    不想说话也没关系，先抽一张给自己。
                  </h2>
                  <p className="emotionkit-statement-desc">
                    点一下盒子，随机抽取一张 {activeCharacter.name} 留给你的纸条——
                    可能是一句安慰，一个小任务，一封信，一句肯定，或者一个你们之间的回忆。
                  </p>
                </div>

                <div className="emotionkit-box-scene">
                  {/* 悬浮在盒子周围的"例子"：复用处方弹窗同一套视觉元素
                      （呼吸环/信封印章/双线圆章/拍立得），缩小、半透明、
                      各自独立漂浮，暗示盒子里装的是这几类东西，同时
                      让整个舞台有"漂浮在空间里"的立体感，而不是一个
                      孤零零贴在背景上的方块。 */}
                  <div className="emotionkit-orbit emotionkit-orbit--1" aria-hidden="true">
                    {visualFor('breath')}
                  </div>
                  <div className="emotionkit-orbit emotionkit-orbit--2" aria-hidden="true">
                    {visualFor('letter')}
                  </div>
                  <div className="emotionkit-orbit emotionkit-orbit--3" aria-hidden="true">
                    {visualFor('stamp')}
                  </div>
                  <div className="emotionkit-orbit emotionkit-orbit--4" aria-hidden="true">
                    {visualFor('polaroid')}
                  </div>

                  <div className="emotionkit-box-float">
                    <div
                      className="emotionkit-box-wrap"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      <div
                        ref={boxRef}
                        className="emotionkit-box"
                        onKeyDown={handleBoxKeyDown}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="emotionkit-box-handle" />

                        <div className="emotionkit-box-lid">
                          <div className="emotionkit-box-cross-badge">
                            <div className="emotionkit-cross-mark" />
                          </div>
                        </div>

                        <div className="emotionkit-box-body">
                          <div className="emotionkit-slip-ghost" />
                          <div className="emotionkit-box-slot">TAP TO DRAW</div>
                          <div className="emotionkit-box-cta">
                            {isLoading ? '生成中…' : '抽一张'}
                          </div>
                          <div className="emotionkit-box-sub">轻触抽取 · 左右滑动可以转一转</div>
                        </div>
                      </div>
                    </div>

                    <div className="emotionkit-box-shadow" />
                  </div>
                </div>

                <div className="emotionkit-pool-status">
                  池中剩余 · <b>{poolTotal}</b> 条 / 5 类别
                </div>

                <button
                  type="button"
                  className="emotionkit-regen-btn"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? '正在重新生成…' : '重新生成全部'}
                </button>
              </section>
            )}
          </>
        ) : (
          <section className="emotionkit-empty">
            <Inbox size={24} strokeWidth={1.35} />
            <h3>还没有可以准备急救盒的角色</h3>
            <p>请先创建一位陪伴者，再回来抽第一张纸条。</p>
          </section>
        )}
      </div>

      <div
        className={`emotionkit-modal ${isModalOpen ? 'is-active' : ''}`}
        onClick={() => setIsModalOpen(false)}
      >
        {category && drawnResult && (
          <div className="emotionkit-card" onClick={(event) => event.stopPropagation()}>
            <div className="emotionkit-card-tag">{category.tag}</div>
            <div className="emotionkit-card-time">
              记录于 {new Date(drawnResult.note.createdAt).toLocaleString('zh-CN', { hour12: false })}
            </div>

            <div className="emotionkit-visual-slot">{visualFor(category.visual)}</div>

            <h2 className="emotionkit-card-title">{category.label}</h2>
            <p className="emotionkit-card-text">“{drawnResult.note.text}”</p>

            <button
              type="button"
              className="emotionkit-close-btn"
              onClick={() => setIsModalOpen(false)}
            >
              收下
            </button>
          </div>
        )}
      </div>
    </div>
  );
}