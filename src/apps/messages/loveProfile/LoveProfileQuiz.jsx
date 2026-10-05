// src/apps/messages/loveProfile/LoveProfileQuiz.jsx
//
// 问卷答题界面：按 section 分页，每页若干题，支持 单选 / 多选 / 量表 / 文字
// 四种题型。纯受控组件——答案由父组件持有，这里只负责渲染和把改动回调出去。

import React, { useState } from 'react';
import { getUnansweredRequired } from './loveProfileSchema';

const selectedStyle = {
  background: 'var(--accent-color)',
  color: '#fff',
  borderColor: 'var(--accent-color)',
};

const idleStyle = {
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
  borderColor: 'var(--card-border)',
};

const QuestionBlock = ({ question, answer, onChange }) => {
  const value = answer?.value;

  const setValue = (next) => onChange({ ...(answer || {}), value: next });
  const setNote = (note) => onChange({ ...(answer || {}), note });

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium leading-relaxed">
          {question.prompt}
          {question.required === false && (
            <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
              选填
            </span>
          )}
        </p>
        {question.hint && (
          <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {question.hint}
          </p>
        )}
      </div>

      {question.type === 'single' && (
        <div className="space-y-1.5">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setValue(opt.id)}
              className="w-full text-left px-3 py-2 rounded-xl border text-[11px] leading-relaxed transition-colors"
              style={value === opt.id ? selectedStyle : idleStyle}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {question.type === 'multi' && (
        <div className="space-y-1.5">
          {question.options.map((opt) => {
            const picked = Array.isArray(value) && value.includes(opt.id);
            const reachedMax =
              question.maxSelect &&
              Array.isArray(value) &&
              value.length >= question.maxSelect &&
              !picked;

            return (
              <button
                key={opt.id}
                type="button"
                disabled={reachedMax}
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  setValue(picked ? current.filter((id) => id !== opt.id) : [...current, opt.id]);
                }}
                className="w-full text-left px-3 py-2 rounded-xl border text-[11px] leading-relaxed transition-colors disabled:opacity-40"
                style={picked ? selectedStyle : idleStyle}
              >
                {opt.label}
              </button>
            );
          })}
          {question.maxSelect ? (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              最多选 {question.maxSelect} 项
            </p>
          ) : null}
        </div>
      )}

      {question.type === 'scale' && (
        <div className="space-y-1">
          <div className="flex gap-1.5">
            {Array.from(
              { length: question.scale.max - question.scale.min + 1 },
              (_, i) => question.scale.min + i
            ).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(n)}
                className="flex-1 py-2 rounded-xl border text-[11px] font-medium transition-colors"
                style={value === n ? selectedStyle : idleStyle}
              >
                {n}
              </button>
            ))}
          </div>
          <div
            className="flex justify-between text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{question.scale.minLabel || ''}</span>
            <span>{question.scale.maxLabel || ''}</span>
          </div>
        </div>
      )}

      {question.type === 'text' && (
        <textarea
          rows={3}
          value={typeof value === 'string' ? value : ''}
          placeholder={question.placeholder || ''}
          onChange={(e) => setValue(e.target.value)}
          className="w-full p-2.5 rounded-xl border outline-none text-[11px] leading-relaxed resize-y min-h-[72px]"
          style={{
            background: 'var(--bg-main)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)',
          }}
        />
      )}

      {question.allowNote && question.type !== 'text' && (
        <input
          type="text"
          value={answer?.note || ''}
          placeholder="补充一句（可选）"
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-xl border outline-none text-[11px]"
          style={{
            background: 'var(--bg-main)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)',
          }}
        />
      )}
    </div>
  );
};

export const LoveProfileQuiz = ({
  sections,
  answers,
  submitting = false,
  onChangeAnswer,
  onSubmit,
  onCancel,
}) => {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [showMissing, setShowMissing] = useState(false);

  const section = sections[sectionIndex];
  const isLast = sectionIndex === sections.length - 1;
  const missing = getUnansweredRequired(section, answers);

  const goNext = () => {
    if (missing.length > 0) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);

    if (isLast) {
      onSubmit?.();
    } else {
      setSectionIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    setShowMissing(false);
    setSectionIndex((i) => Math.max(0, i - 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
          {sectionIndex + 1} / {sections.length}
        </span>
        <button
          type="button"
          disabled={submitting}
          onClick={onCancel}
          className="text-[10px] hover:underline disabled:opacity-40"
          style={{ color: 'var(--text-muted)' }}
        >
          先保存退出
        </button>
      </div>

      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--divider)' }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${((sectionIndex + 1) / sections.length) * 100}%`,
            background: 'var(--accent-color)',
          }}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-bold">{section.title}</p>
        {section.desc && (
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {section.desc}
          </p>
        )}
      </div>

      <div className="space-y-5">
        {section.questions.map((q) => (
          <QuestionBlock
            key={q.id}
            question={q}
            answer={answers?.[q.id]}
            onChange={(next) => onChangeAnswer(q.id, next)}
          />
        ))}
      </div>

      {showMissing && missing.length > 0 && (
        <p className="text-[10px] text-red-500">还有 {missing.length} 道必答题没有回答。</p>
      )}

      <div className="flex gap-2">
        {sectionIndex > 0 && (
          <button
            type="button"
            disabled={submitting}
            onClick={goPrev}
            className="px-4 py-2 rounded-xl text-[11px] font-medium disabled:opacity-40"
            style={{ background: 'var(--divider)', color: 'var(--text-main)' }}
          >
            上一页
          </button>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={goNext}
          className="flex-1 px-4 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent-color)', color: '#fff' }}
        >
          {isLast ? (submitting ? '生成中...' : '完成并生成') : '下一页'}
        </button>
      </div>
    </div>
  );
};

export default LoveProfileQuiz;