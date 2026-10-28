// src/apps/greeting/PopupBookShelf.jsx
//
// 收藏夹里"立体书"标签页的书架：和贺卡书架同一套外观（复用 .gc-* 样式），
// 自己管理列表、"制作中 -> 送到"的推进、失败重试、删除。
// 请求抽屉的开关由外层（GreetingApp 顶部的"请 TA 做一本"按钮）通过 props 控制。
//
// 这一刀还没有阅读器：点已送到的书只会标记已读。阅读器下一刀接在 handleOpen 上。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, RotateCw } from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import {
  announcePopupBookReady,
  deletePopupBook,
  listPopupBooks,
  markPopupBookRead,
  reconcilePopupBooks,
  requestPopupBook,
  retryPopupBook,
  subscribePopupBooks,
} from './popupBookService';
import { BOOK_MAKING_STAGES, BOOK_SOURCE, BOOK_STATUS, getBookKind } from './popupBookConstants';
import GreetingCover from './GreetingCover';
import PopupBookAskSheet from './PopupBookAskSheet';

const PopupBookShelf = ({ showAsk, onCloseAsk, onCountChange }) => {
  const [books, setBooks] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [askError, setAskError] = useState('');
  const [stageIndex, setStageIndex] = useState(0);

  const charactersById = useMemo(
    () => Object.fromEntries(characters.map((character) => [character.id, character])),
    [characters],
  );

  const load = useCallback(async () => {
    const [list, chars] = await Promise.all([listPopupBooks(), db.characters.toArray()]);
    setBooks(list);
    setCharacters(chars);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    return subscribePopupBooks(load);
  }, [load]);

  useEffect(() => {
    if (onCountChange) {
      onCountChange(books.filter((book) => book.status === BOOK_STATUS.READY).length);
    }
  }, [books, onCountChange]);

  // 推进"制作中 -> 送到"。挂载期间每 3 秒检查一次；有书刚送到就弹提示。
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const ready = await reconcilePopupBooks();
        if (!alive) return;
        for (const book of ready) {
          const character = await db.characters.get(book.characterId);
          announcePopupBookReady(character);
        }
      } catch (error) {
        console.warn('推进立体书状态失败：', error);
      }
    };

    tick();
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setStageIndex((value) => value + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmitAsk = async (payload) => {
    setSubmitting(true);
    setAskError('');
    try {
      await requestPopupBook({ ...payload, source: BOOK_SOURCE.REQUESTED });
      onCloseAsk();
    } catch (error) {
      setAskError(String(error?.message || '没能发出请求。'));
    } finally {
      setSubmitting(false);
    }
  };

  // 阅读器接入点：下一刀在这里打开阅读器。现在只记已读。
  const handleOpen = (book) => {
    if (!book.isRead) markPopupBookRead(book.id);
  };

  const handleConfirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    await deletePopupBook(target.id);
  };

  const renderSlot = (book) => {
    const character = charactersById[book.characterId];
    const characterName = character?.name || '（角色已被删除）';

    if (book.status === BOOK_STATUS.MAKING) {
      return (
        <div className="gc-slot" key={book.id}>
          <div className="gc-making">
            <i className="gc-making__orb" />
            <i className="gc-making__scan" />
            <span className="gc-making__stage">{BOOK_MAKING_STAGES[stageIndex % BOOK_MAKING_STAGES.length]}</span>
            <span className="gc-making__eta">{characterName} 正在做</span>
          </div>
          <div className="gc-rule" />
          <div className="gc-meta">
            <span>制作中 / {getBookKind(book.kind).label}</span>
          </div>
        </div>
      );
    }

    if (book.status === BOOK_STATUS.FAILED) {
      return (
        <div className="gc-slot" key={book.id}>
          <div className="gc-making is-failed">
            <span className="gc-making__stage">没做成</span>
            <span className="gc-making__err">{book.error || '这次没有做成。'}</span>
          </div>
          <div className="gc-rule" />
          <div className="gc-meta gc-meta--actions">
            <button type="button" onClick={() => retryPopupBook(book.id)}>
              <RotateCw size={11} /> 重试
            </button>
            <button type="button" onClick={() => setDeleteTarget(book)}>
              <Trash2 size={11} /> 删除
            </button>
          </div>
        </div>
      );
    }

    const unread = !book.isRead;
    // 书架上的封面直接复用贺卡封面组件：它只读 id / cover / inside.sign / 日期。
    const coverCard = { ...book, inside: { sign: book.sign } };
    return (
      <div className="gc-slot" key={book.id}>
        <button
          type="button"
          className={`gc-mini${unread ? ' is-unread' : ''}`}
          onClick={() => handleOpen(book)}
          aria-label={`打开立体书：${book.cover?.title || ''}`}
        >
          <GreetingCover card={coverCard} signFallback={characterName} live={unread} showUnreadDot={unread} />
        </button>
        <div className="gc-rule" />
        <div className="gc-meta">
          <span>
            {unread ? '未翻 / ' : ''}
            {getBookKind(book.kind).label}
          </span>
        </div>
        <div className="gc-meta gc-meta--actions">
          <button type="button" onClick={() => setDeleteTarget(book)}>
            <Trash2 size={11} /> 删除
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {loaded && books.length === 0 ? (
        <div className="gc-empty">这里还空着。让 TA 为你做第一本立体书吧。</div>
      ) : (
        <div className="gc-rack">{books.map(renderSlot)}</div>
      )}

      <PopupBookAskSheet
        open={showAsk}
        characters={characters}
        submitting={submitting}
        error={askError}
        onClose={onCloseAsk}
        onSubmit={handleSubmitAsk}
      />

      <div style={{ position: 'relative', zIndex: 1300 }}>
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="删除这本立体书？"
          message="删除后就找不回来了。"
          confirmText="删除"
          cancelText="留着"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </>
  );
};

export default PopupBookShelf;
