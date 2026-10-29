// src/apps/greeting/PopupBookAskSheet.jsx
//
// "请 TA 做一本立体书"抽屉：选角色、选类型、可选留一句话。
// 样式整个复用贺卡抽屉的 .gc-sheet* 系列，不另起一套。

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

import { BOOK_KINDS, BOOK_MODE } from './popupBookConstants';

const PopupBookAskSheet = ({ open, characters, submitting, error, onClose, onSubmit }) => {
  const [characterId, setCharacterId] = useState(null);
  const [kind, setKind] = useState(BOOK_KINDS[0].id);
  const [note, setNote] = useState('');
  const [free, setFree] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    setCharacterId(characters.length === 1 ? characters[0].id : null);
    setKind(BOOK_KINDS[0].id);
    setNote('');
    setFree(false);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open, characters]);

  if (!open) return null;

  const canSubmit = Boolean(characterId) && !submitting;
  const activeKind = BOOK_KINDS.find((item) => item.id === kind);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ characterId, kind, userNote: note, mode: free ? BOOK_MODE.FREE : BOOK_MODE.BLOCKS });
  };

  const sheet = (
    <div className={`gc-sheet-layer${shown ? ' is-shown' : ''}`}>
      <div className="gc-sheet-bg" onClick={onClose} />
      <form className="gc-sheet" onSubmit={handleSubmit}>
        <div className="gc-sheet__grab" />
        <h2>请 TA 做一本立体书</h2>
        <p className="gc-sheet__sub">选个角色和类型，也可以留一句想说的话。写什么、用什么模型，TA 自己决定。</p>

        <span className="gc-field-label">谁来做</span>
        {characters.length === 0 ? (
          <p className="gc-sheet__empty">还没有可选角色，先去角色库建一个吧。</p>
        ) : (
          <div className="gc-pick-grid">
            {characters.map((character) => {
              const checked = characterId === character.id;
              return (
                <button
                  key={character.id}
                  type="button"
                  className={`gc-pick${checked ? ' is-checked' : ''}`}
                  onClick={() => setCharacterId(character.id)}
                >
                  <span className="gc-pick__avatar">
                    {character.avatar ? (
                      <img src={character.avatar} alt={character.name} />
                    ) : (
                      <b>{character.name?.[0] || '?'}</b>
                    )}
                    {checked && (
                      <span className="gc-pick__check">
                        <Check size={10} />
                      </span>
                    )}
                  </span>
                  <span className="gc-pick__name">{character.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <span className="gc-field-label">做一本什么书</span>
        <div className="gc-chip-row">
          {BOOK_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`gc-chip${kind === item.id ? ' is-on' : ''}`}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="gc-sheet__hint">{activeKind?.hint}</p>

        <span className="gc-field-label">做法</span>
        <div className="gc-chip-row">
          <button type="button" className={`gc-chip${free ? '' : ' is-on'}`} onClick={() => setFree(false)}>
            积木库
          </button>
          <button type="button" className={`gc-chip${free ? ' is-on' : ''}`} onClick={() => setFree(true)}>
            自由发挥
          </button>
        </div>
        <p className="gc-sheet__hint">
          {free
            ? 'TA 自己写整本书的画面，想怎么做就怎么做。更费时间，偶尔会没做成，可以重试。'
            : '用现成的积木拼，稳定好看。'}
        </p>

        <textarea
          rows={2}
          maxLength={120}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="想对 TA 说的话（可以不填）"
          className="gc-textarea"
        />

        {error ? <p className="gc-sheet__error">{error}</p> : null}

        <button type="submit" className="gc-primary" disabled={!canSubmit}>
          拜托了
        </button>
      </form>
    </div>
  );

  return createPortal(sheet, document.body);
};

export default PopupBookAskSheet;