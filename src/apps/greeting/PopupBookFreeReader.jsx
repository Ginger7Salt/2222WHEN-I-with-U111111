// src/apps/greeting/PopupBookFreeReader.jsx
//
// "自由发挥"的立体书的阅读器：全屏层 + 一个隔离的 iframe，画面完全由角色写的代码决定，
// 我们只提供一个关闭按钮和加载 / 出错提示。沙箱的安全模型见 popupBookFreeSandbox.js。
//
// 打开时才创建 iframe（角色的动画从你打开的那一刻开始），关闭 / 卸载就整个移除，代码随之停止。
// 沙箱模块（里面内联了 three 的源码）用动态 import 加载，只有读自由书时才会进来。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { FREE_BOOK_LIMITS, getBookKind } from './popupBookConstants';
import './popupBook.css';

const PopupBookFreeReader = ({ book, onClose, onOpened }) => {
  const frameRef = useRef(null);
  const sandboxRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [srcDoc, setSrcDoc] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | running | slow | failed
  const [errorText, setErrorText] = useState('');
  const openedRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // 加载沙箱模块并拼出 srcDoc。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!book.freeCode) throw new Error('这本书没有内容。');
        const mod = await import('./popupBookFreeSandbox');
        if (cancelled) return;
        sandboxRef.current = mod;
        setSrcDoc(
          mod.buildFreeBookDocument({
            code: book.freeCode,
            book: { cover: book.cover, sign: book.sign, kindLabel: getBookKind(book.kind).label },
          }),
        );
      } catch (error) {
        console.warn('自由发挥的书没能加载：', error);
        if (!cancelled) {
          setErrorText(String(error?.message || '没能加载。'));
          setPhase('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markOpened = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    if (onOpened) onOpened(book.id);
  }, [onOpened, book.id]);

  // 听 iframe 报告：画出画面了 -> running；报错 -> failed（画面出来之后的报错不打扰读者）。
  useEffect(() => {
    if (!srcDoc) return undefined;

    const onMessage = (event) => {
      const mod = sandboxRef.current;
      const frame = frameRef.current;
      if (!mod || !frame) return;
      const message = mod.readFrameMessage(event, frame.contentWindow);
      if (!message) return;

      if (message.type === 'ready') {
        setPhase((current) => (current === 'failed' ? current : 'running'));
        markOpened();
      } else if (message.type === 'error') {
        setPhase((current) => {
          if (current === 'running') return current;
          setErrorText(message.message);
          return 'failed';
        });
      }
    };

    window.addEventListener('message', onMessage);
    // 迟迟没有结果：不替读者做决定，只提示一句，关闭按钮一直都在。
    const timer = setTimeout(
      () => setPhase((current) => (current === 'loading' ? 'slow' : current)),
      FREE_BOOK_LIMITS.readerReadyTimeoutMs,
    );
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };
  }, [srcDoc, markOpened]);

  const body = (
    <div className={`pb-reader${visible ? ' is-visible' : ''}`} role="dialog" aria-modal="true" aria-label="立体书">
      {srcDoc && phase !== 'failed' && (
        <iframe
          ref={frameRef}
          title={book.cover?.title || '立体书'}
          className={`pb-freeframe${phase === 'loading' ? ' is-hidden' : ''}`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          allow=""
          scrolling="no"
          srcDoc={srcDoc}
        />
      )}

      <button type="button" className="pb-btn pb-btn--close" onClick={onClose} aria-label="关闭">
        <X size={16} />
      </button>

      {phase === 'loading' && <div className="pb-status pb-status--free">正在摊开</div>}
      {phase === 'slow' && <div className="pb-status pb-status--free">还在准备，可以再等一下，或者先关掉</div>}

      {phase === 'failed' && (
        <div className="pb-freeerr">
          <p>这一本没能打开。</p>
          <p>TA 写的画面在这台设备上跑不起来，可以回到收藏夹删掉它，再请 TA 做一本。</p>
          {errorText ? <small>{errorText}</small> : null}
        </div>
      )}
    </div>
  );

  return createPortal(body, document.body);
};

export default PopupBookFreeReader;