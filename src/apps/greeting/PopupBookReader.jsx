// src/apps/greeting/PopupBookReader.jsx
//
// 立体书阅读器（全屏层）：加载 three 场景、底部翻页条、横屏提示。
//
// 加载：这个组件由书架用 React.lazy 动态引入；three 场景（popupBookScene.js）
// 在这里再用 import() 动态加载，所以 three 不进主包。
// 用 portal 挂到 document.body（原因同 GreetingUnwrap：避开带 transform 的祖先）。
// 卸载时：停动画循环、释放几何/材质/贴图、renderer.dispose + forceContextLoss。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { getBookKind } from './popupBookConstants';
import './popupBook.css';

const parseRgb = (value) => {
  const m = String(value || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

// 封面颜色跟随主题：造一个看不见的 .gc-cv--{motif} 元素，读它算出来的颜色。
const readCoverTheme = (motif) => {
  const fallbackDark = motif === 'ink';
  const fallback = {
    coverBg: fallbackDark ? '#1c1c1f' : '#f1f1ee',
    coverFg: fallbackDark ? '#f4f4f2' : '#1a1a1a',
    coverDark: fallbackDark,
  };
  try {
    const probe = document.createElement('div');
    probe.className = `gc-cv gc-cv--${motif}`;
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;visibility:hidden;';
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const bg = parseRgb(style.backgroundColor);
    const fg = parseRgb(style.color);
    document.body.removeChild(probe);
    // 透明背景（算出来是 rgba(0,0,0,0)）当没读到
    if (!bg || (bg[0] === 0 && bg[1] === 0 && bg[2] === 0 && /rgba\(.*,\s*0\)/.test(style.backgroundColor))) {
      return fallback;
    }
    const lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
    return {
      coverBg: toHex(bg),
      coverFg: fg ? toHex(fg) : fallback.coverFg,
      coverDark: lum < 110,
    };
  } catch {
    return fallback;
  }
};

const isPortrait = () => window.innerHeight > window.innerWidth;

// WebGL 不可用时的降级：把每个跨页的文字直接列出来，书不会因为打不开 3D 就读不了。
const TextFallback = ({ book }) => (
  <div className="pb-fallback">
    <h2>{book.cover?.title}</h2>
    {(book.spreads || []).map((spread, index) => (
      <section key={index}>
        {(spread.left?.items || []).map((item, i) =>
          item.t === 'h' ? (
            <h3 key={i}>{item.s}</h3>
          ) : (
            <p key={i} className={item.t === 'kick' ? 'is-kick' : ''}>
              {item.s}
            </p>
          ),
        )}
        {spread.right?.caption ? <p className="is-cap">{spread.right.caption}</p> : null}
      </section>
    ))}
    {book.sign ? <p className="is-sign">{book.sign}</p> : null}
  </div>
);

const PopupBookReader = ({ book, onClose, onOpened }) => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | failed
  const [ui, setUi] = useState({ cur: 0, total: 0, busy: false, label: '封面' });
  const [portrait, setPortrait] = useState(isPortrait);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setPortrait(isPortrait());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const handleOpened = useCallback(() => {
    if (onOpened) onOpened(book.id);
  }, [onOpened, book.id]);

  // 加载并创建场景。book 的内容在阅读期间不会变，所以只在挂载时跑一次。
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 字体要先就绪，否则 canvas 里第一次画出来的文字会是后备字体。
        if (document.fonts && document.fonts.ready) {
          await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
        }
        const mod = await import('./popupBookScene');
        if (cancelled || !canvasRef.current) return;
        const theme = readCoverTheme(book.cover?.motif || 'mist');
        const scene = mod.createBookScene({
          canvas: canvasRef.current,
          book,
          theme,
          labels: { kind: getBookKind(book.kind).label },
          onState: (state) => !cancelled && setUi(state),
          onOpened: handleOpened,
        });
        sceneRef.current = scene;
        setLoadState('ready');
      } catch (error) {
        console.warn('立体书场景加载失败，改用文字版：', error);
        if (!cancelled) setLoadState('failed');
      }
    })();

    return () => {
      cancelled = true;
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = (dir) => {
    if (sceneRef.current) sceneRef.current.step(dir);
  };

  const showRotate = loadState === 'ready' && portrait && !dismissed;
  const atEnd = ui.total > 0 && ui.cur === ui.total - 1;

  const body = (
    <div className={`pb-reader${visible ? ' is-visible' : ''}`} role="dialog" aria-modal="true" aria-label="立体书">
      <canvas ref={canvasRef} className="pb-canvas" />

      <button type="button" className="pb-btn pb-btn--close" onClick={onClose} aria-label="关闭">
        <X size={16} />
      </button>

      {loadState === 'loading' && <div className="pb-status">正在摊开</div>}
      {loadState === 'failed' && <TextFallback book={book} />}

      {loadState === 'ready' && (
        <>
          {ui.cur === 0 && <div className="pb-hint">轻点封面，翻开</div>}
          <div className="pb-bar">
            <button
              type="button"
              className="pb-btn"
              onClick={() => step(-1)}
              disabled={ui.busy || ui.cur === 0}
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="pb-title">
              <b>{String(ui.cur).padStart(2, '0')}</b>
              {ui.label}
            </div>
            <button
              type="button"
              className="pb-btn"
              onClick={() => step(1)}
              disabled={ui.busy}
              aria-label={atEnd ? '合上回到封面' : '下一页'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {showRotate && (
        <div className="pb-rotate">
          <div className="pb-rotate__box">
            <i className="pb-rotate__icon" />
            <p>横过来看这本书</p>
            <button type="button" onClick={() => setDismissed(true)}>
              先这样看
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(body, document.body);
};

export default PopupBookReader;
