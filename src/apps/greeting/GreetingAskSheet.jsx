// src/apps/greeting/GreetingAskSheet.jsx
//
// "请 TA 做一张"抽屉：选角色、选场合、选做法（积木库 / 自由创作）、可选留一句话。
// 选角色的头像网格沿用长RP建局向导的写法（用主题变量，不单独配色）。
// 角色在建好之后不可更换，所以这里每次都是重新选。

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

import { GREETING_MODE, OCCASIONS } from './greetingConstants';

const MODE_OPTIONS = [
  {
    id: GREETING_MODE.BLOCKS,
    label: '积木库',
    desc: '款式稳定。TA 自己挑颜色、场景和字体，写文案。',
  },
  {
    id: GREETING_MODE.FREE,
    label: '自由创作',
    desc: '实验性。TA 直接写整张内页，更自由，也更不可预测。',
  },
];

const GreetingAskSheet = ({ open, characters, submitting, error, onClose, onSubmit }) => {
  const [characterId, setCharacterId] = useState(null);
  const [occasion, setOccasion] = useState('comfort');
  const [mode, setMode] = useState(GREETING_MODE.BLOCKS);
  const [note, setNote] = useState('');
  const [shown, setShown] = useState(false);

  // 每次打开重置表单；用一帧延迟切换 is-shown，让抽屉有滑入动画。
  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    setCharacterId(characters.length === 1 ? characters[0].id : null);
    setOccasion('comfort');
    setMode(GREETING_MODE.BLOCKS);
    setNote('');
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open, characters]);

  if (!open) return null;

  const canSubmit = Boolean(characterId) && !submitting;
  const activeMode = MODE_OPTIONS.find((item) => item.id === mode);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ characterId, occasion, mode, userNote: note });
  };

  const sheet = (
    <div className={`gc-sheet-layer${shown ? ' is-shown' : ''}`}>
      <div className="gc-sheet-bg" onClick={onClose} />
      <form className="gc-sheet" onSubmit={handleSubmit}>
        <div className="gc-sheet__grab" />
        <h2>请 TA 做一张贺卡</h2>
        <p className="gc-sheet__sub">选个角色和场合，也可以留一句想说的话。款式和写什么，TA 自己决定。</p>

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

        <span className="gc-field-label">场合</span>
        <div className="gc-chip-row">
          {OCCASIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`gc-chip${occasion === item.id ? ' is-on' : ''}`}
              onClick={() => setOccasion(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <span className="gc-field-label">做法</span>
        <div className="gc-seg">
          {MODE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'is-on' : ''}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="gc-sheet__hint">{activeMode?.desc}</p>

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

export default GreetingAskSheet;
