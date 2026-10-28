// src/apps/greeting/GreetingUnwrap.jsx
//
// 全屏拆封：信封（未拆的卡才有）-> 合着的贺卡 -> 翻开内页。
//
// 流程：
//   envelope：点信封，封印散去、盖子翻开、卡片抽出，信封淡出
//   card    ：合着的卡片，随手指轻微倾斜；再点一下，封面绕顶边翻起
//   read    ：翻开约 1.1s 后进入 is-read，内页的展示动画开始（光斑聚焦、文字逐行浮现）
// 所有动画时序都用 setTimeout 驱动 CSS 类名切换，组件卸载时统一清掉。
//
// 用 portal 挂到 document.body：这个页面是 position:fixed 的全屏层，如果挂在
// 带 transform 动画的祖先里（例如页面入场的 animate-fade-in），fixed 会被相对于
// 那个祖先定位，铺不满屏。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';

import GreetingCover from './GreetingCover';
import { BlocksScene, BlocksText, FreeFrame, getInsidePageStyle } from './GreetingInside';
import { GREETING_MODE } from './greetingConstants';

const GreetingUnwrap = ({ card, onClose, onOpened, onDelete }) => {
  // 已经拆过的卡直接从合着的卡片开始，没拆过的从信封开始。只在挂载时判断一次，
  // 中途 card.isRead 被写库改成 1 不能让界面跳阶段。
  const [phase, setPhase] = useState(() => (card?.isRead ? 'card' : 'envelope'));
  const [visible, setVisible] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [envLeave, setEnvLeave] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [read, setRead] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const [actionsOn, setActionsOn] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [round, setRound] = useState(0);

  const timers = useRef([]);
  const tiltRef = useRef(null);
  const stageRef = useRef(null);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      clearTimers();
    };
  }, [clearTimers]);

  // 每进入一个新阶段（或重看一遍），过一会儿再显示底部的提示文字。
  useEffect(() => {
    setHintOn(false);
    const id = setTimeout(() => setHintOn(true), 900);
    return () => clearTimeout(id);
  }, [phase, round]);

  const inside = card?.inside || {};
  const isFree = card?.mode === GREETING_MODE.FREE && Boolean(inside.html);
  const isInkMotif = card?.cover?.motif === 'ink';

  const handleEnvelopeClick = () => {
    if (envOpen) return;
    setEnvOpen(true);
    setHintOn(false);
    later(() => {
      setEnvLeave(true);
      later(() => setPhase('card'), 600);
    }, 2300);
  };

  const handleCardClick = () => {
    if (cardOpen) return;
    if (tiltRef.current) {
      tiltRef.current.style.setProperty('--rx', '0deg');
      tiltRef.current.style.setProperty('--ry', '0deg');
    }
    setCardOpen(true);
    setHintOn(false);
    if (onOpened) onOpened(card.id);
    later(() => {
      setRead(true);
      setActionsOn(true);
    }, 1100);
  };

  const handleReplay = () => {
    clearTimers();
    setActionsOn(false);
    setRead(false);
    setCardOpen(false);
    setPhase('card');
    setRound((value) => value + 1);
  };

  const handleBack = () => {
    setCollecting(true);
    later(() => onClose(), 760);
  };

  // 合着的状态下，卡片随手指/鼠标轻微倾斜，有一点"拿在手里"的感觉。
  const handlePointerMove = (event) => {
    if (phase !== 'card' || cardOpen || !tiltRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    tiltRef.current.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
    tiltRef.current.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
  };

  const body = (
    <div
      className={`gc-unwrap${visible ? ' is-visible' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="贺卡"
    >
      <div className="gc-blobs" aria-hidden="true">
        <i className="gc-bl gc-bl1" />
        <i className="gc-bl gc-bl2" />
        <i className="gc-bl gc-bl3" />
      </div>
      <div className="gc-spot" aria-hidden="true" />

      <button type="button" className="gc-uw-btn gc-uw-btn--del" onClick={() => onDelete(card)}>
        <Trash2 size={14} />
        <span>删除</span>
      </button>
      <button type="button" className="gc-uw-btn gc-uw-btn--close" onClick={onClose} aria-label="关闭">
        <X size={16} />
      </button>

      <div
        ref={stageRef}
        className={`gc-stage${collecting ? ' is-collect' : ''}`}
        onPointerMove={handlePointerMove}
      >
        {phase === 'envelope' ? (
          <button
            type="button"
            className={`gc-env ${isInkMotif ? 'gc-env--ink' : 'gc-env--light'}${envOpen ? ' is-open' : ''}${envLeave ? ' is-leave' : ''}`}
            onClick={handleEnvelopeClick}
            aria-label="拆开信封"
          >
            <span className="gc-e-back" />
            <span className="gc-e-card" />
            <span className="gc-e-front">
              <i className="gc-e-l" />
              <i className="gc-e-r" />
              <i className="gc-e-b" />
            </span>
            <span className="gc-e-label">
              <b>{inside.to || '给你'}</b>
              <small>FROM {inside.sign}</small>
            </span>
            <span className="gc-e-flap" />
            <span className="gc-wax">{String(inside.sign || '').slice(0, 1)}</span>
          </button>
        ) : (
          <div key={round} className="gc-cardwrap is-enter">
            <div className="gc-tilt" ref={tiltRef}>
              <div
                className={`gc-card${cardOpen ? ' is-open' : ''}${read ? ' is-read' : ''}${isFree ? ' is-free' : ''}`}
                onClick={handleCardClick}
                role="button"
                tabIndex={0}
                aria-label="翻开贺卡"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') handleCardClick();
                }}
              >
                <div className="gc-pg" style={isFree ? undefined : getInsidePageStyle(inside)}>
                  {isFree ? <FreeFrame html={inside.html} mounted={read} /> : <BlocksText card={card} />}
                </div>
                <div className="gc-cover">
                  <div className="gc-face gc-face--front">
                    <GreetingCover card={card} signFallback={inside.sign} live />
                  </div>
                  <div className="gc-face gc-face--back">
                    {isFree ? null : <BlocksScene inside={inside} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`gc-hint${hintOn ? ' is-on' : ''}`}>
        {phase === 'envelope' ? '轻点，拆开' : '再轻点，翻开'}
      </div>

      <div className={`gc-actions${actionsOn ? ' is-on' : ''}`}>
        <button type="button" className="gc-btn-ghost" onClick={handleReplay}>
          再看一遍
        </button>
        <button type="button" className="gc-btn-solid" onClick={handleBack}>
          放回书架
        </button>
      </div>
    </div>
  );

  return createPortal(body, document.body);
};

export default GreetingUnwrap;
