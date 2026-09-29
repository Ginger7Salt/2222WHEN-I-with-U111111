// src/apps/messages/interactions/divination/DivinationSetupModal.jsx
//
// 占卜的设置面板：选牌组 -> 选牌阵 -> 写问题 -> 抽牌，都在同一个面板里
// 一次完成（三个区块从上到下排开，不做分页）。牌组与牌阵的选择在
// 组件不卸载期间会被记住；问题每次打开都清空。

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DivinationMiniCard } from './DivinationCardFace';
import { DECK_IDS, DECK_OPTIONS } from './divinationDecks';
import { SPREAD_IDS, SPREAD_OPTIONS } from './divinationSpreads';
import { MAX_DIVINATION_QUESTION_LENGTH } from './divinationService';
import './divination.css';

// 牌组磁贴里的三张迷你牌：[图案 seed, 色调]
const DECK_PREVIEW = {
  [DECK_IDS.TAROT]: [[17, 'tarot'], [18, 'tarot'], [19, 'tarot']],
  [DECK_IDS.CUSTOM]: [[1, 'gentle'], [12, 'gentle'], [26, 'weighty']],
};

// 牌阵磁贴里的位置示意：true 表示该位置稍微抬高
const SPREAD_DIAGRAM = {
  [SPREAD_IDS.SINGLE]: [false],
  [SPREAD_IDS.PAST_PRESENT_FUTURE]: [false, false, false],
  [SPREAD_IDS.RELATIONSHIP]: [false, false, true],
  [SPREAD_IDS.DECISION]: [false, false, true],
};

const Sparkle = () => (
  <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <path d="M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4Z" />
  </svg>
);

export const DivinationSetupModal = ({ isOpen, onClose, onSubmit }) => {
  const [deckId, setDeckId] = useState(DECK_IDS.TAROT);
  const [spreadId, setSpreadId] = useState(SPREAD_IDS.SINGLE);
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuestion('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedQuestion = question.trim();
  const canSubmit = trimmedQuestion.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      await onSubmit?.({
        question: trimmedQuestion,
        deckId,
        spreadId,
      });
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dv-backdrop divination-scope" onClick={onClose}>
      <div
        className="dv-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="占卜"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="dv-close"
          onClick={onClose}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="dv-header">
          <span className="dv-kicker">DIVINATION</span>
          <h2 className="dv-title">占卜</h2>
          <div className="dv-divider" aria-hidden="true"><i /></div>
          <p className="dv-subtitle">静下心来，问一个问题</p>
        </div>

        <section className="dv-step">
          <h3 className="dv-step-label"><span>I</span>牌组</h3>
          <div className="dv-decks">
            {DECK_OPTIONS.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className="dv-tile"
                aria-pressed={deckId === deck.id}
                onClick={() => setDeckId(deck.id)}
              >
                <div className="dv-fan">
                  {(DECK_PREVIEW[deck.id] || []).map(([seed, tone]) => (
                    <DivinationMiniCard key={seed} seed={seed} tone={tone} />
                  ))}
                </div>
                <span className="dv-tile-title">{deck.label}</span>
                <span className="dv-tile-desc">{deck.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="dv-step">
          <h3 className="dv-step-label"><span>II</span>牌阵</h3>
          <div className="dv-spreads">
            {SPREAD_OPTIONS.map((spread) => (
              <button
                key={spread.id}
                type="button"
                className="dv-tile"
                aria-pressed={spreadId === spread.id}
                onClick={() => setSpreadId(spread.id)}
              >
                <div className="dv-diagram" aria-hidden="true">
                  {(SPREAD_DIAGRAM[spread.id] || [false]).map((raised, index) => (
                    <span
                      key={index}
                      className={`dv-dslot${raised ? ' is-raised' : ''}`}
                    />
                  ))}
                </div>
                <span className="dv-tile-title">{spread.label}</span>
                <span className="dv-tile-desc">{spread.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="dv-step">
          <h3 className="dv-step-label"><span>III</span>你的问题</h3>
          <textarea
            className="dv-question-input"
            rows={3}
            maxLength={MAX_DIVINATION_QUESTION_LENGTH}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="写下你想问的问题，什么主题都可以"
          />
          <span className="dv-question-count">
            {question.length} / {MAX_DIVINATION_QUESTION_LENGTH}
          </span>
        </section>

        <button
          type="button"
          className="dv-submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <Sparkle />
          {isSubmitting ? '抽牌中' : '抽牌'}
          <Sparkle />
        </button>
      </div>
    </div>
  );
};

export default DivinationSetupModal;