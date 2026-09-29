// src/apps/messages/interactions/divination/DivinationSetupModal.jsx
//
// 占卜的设置面板：选牌组 -> 选牌阵 -> 写问题 -> 抽牌，都在同一个面板里
// 一次完成（三个区块从上到下排开，不做分页）。牌组与牌阵的选择在
// 组件不卸载期间会被记住，下次打开默认停在上次的选择；问题每次打开都清空。

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DECK_IDS, DECK_OPTIONS } from './divinationDecks';
import { SPREAD_IDS, SPREAD_OPTIONS } from './divinationSpreads';
import { MAX_DIVINATION_QUESTION_LENGTH } from './divinationService';
import './divination.css';

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
    <div className="divination-setup-backdrop" onClick={onClose}>
      <div
        className="divination-setup"
        role="dialog"
        aria-modal="true"
        aria-label="占卜"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="divination-setup-header">
          <div className="divination-setup-heading">
            <span className="interaction-kicker">DIVINATION</span>
            <h2 className="divination-setup-title">占卜</h2>
          </div>

          <button
            type="button"
            className="divination-setup-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="divination-setup-section">
          <h3 className="divination-setup-label">牌组</h3>
          <div className="divination-decks">
            {DECK_OPTIONS.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className="divination-option"
                aria-pressed={deckId === deck.id}
                onClick={() => setDeckId(deck.id)}
              >
                <span className="divination-option-title">{deck.label}</span>
                <span className="divination-option-desc">{deck.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="divination-setup-section">
          <h3 className="divination-setup-label">牌阵</h3>
          <div className="divination-spreads">
            {SPREAD_OPTIONS.map((spread) => (
              <button
                key={spread.id}
                type="button"
                className="divination-option"
                aria-pressed={spreadId === spread.id}
                onClick={() => setSpreadId(spread.id)}
              >
                <span className="divination-option-title">{spread.label}</span>
                <span className="divination-option-desc">{spread.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="divination-setup-section">
          <h3 className="divination-setup-label">你的问题</h3>
          <textarea
            className="divination-question-input"
            rows={3}
            maxLength={MAX_DIVINATION_QUESTION_LENGTH}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="写下你想问的问题，什么主题都可以"
          />
          <span className="divination-question-count">
            {question.length} / {MAX_DIVINATION_QUESTION_LENGTH}
          </span>
        </section>

        <button
          type="button"
          className="divination-submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? '抽牌中' : '抽牌'}
        </button>
      </div>
    </div>
  );
};

export default DivinationSetupModal;