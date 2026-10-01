// src/apps/messages/components/cards/ConfirmCard.jsx
//
// 通用"确认/选择/填写卡"的展示组件。AI 用 [CONFIRM_CARD: ...] 指令
// （见 ../../confirmCardDirective.js）生成这张卡片消息之后，三种模式
// 分别渲染成：
//   confirm —— 两个按钮（确认 / 取消）
//   select  —— 一排选项按钮，点一个就是选了它
//   form    —— 若干输入框 + 一个提交按钮
//
// 用户操作一次之后，这张卡片就转入"已回应"的只读展示状态——不是本地
// state 临时隐藏按钮，而是读 message.metadata.respondedAt /
// responseSummary（由 ChatRoom.jsx 的 handleRespondToConfirmCard 写回
// 这条消息本身），这样刷新/重新打开聊天窗之后卡片依然是已回应的样子，
// 不会变回可以重复点击。

import React, { useState } from 'react';
import { Check, ClipboardList, ListChecks } from 'lucide-react';

const MODE_ICON = {
  confirm: Check,
  select: ListChecks,
  form: ClipboardList,
};

const MODE_LABEL = {
  confirm: '请确认',
  select: '请选择',
  form: '请填写',
};

export const ConfirmCard = ({ message, onRespond }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const metadata = message?.metadata || {};
  const mode = metadata.mode || 'confirm';
  const title = metadata.title || message?.content || '';
  const isResponded = Boolean(metadata.respondedAt);

  const [formValues, setFormValues] = useState(() => (
    (metadata.fields || []).reduce((acc, field) => {
      acc[field.name] = '';
      return acc;
    }, {})
  ));

  const Icon = MODE_ICON[mode] || Check;

  const handleRespond = async (responseText) => {
    if (isSubmitting || isResponded || !responseText) return;

    setIsSubmitting(true);

    try {
      await onRespond?.(responseText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();

    const fields = metadata.fields || [];
    const filled = fields
      .map((field) => `${field.name}：${(formValues[field.name] || '').trim() || '（未填）'}`)
      .join('\n');

    void handleRespond(filled);
  };

  return (
    <div className="my-1 w-full max-w-sm select-none">
      <div
        className="rounded-[1.5rem] p-4 space-y-3"
        style={{
          backgroundColor: 'var(--control-soft-bg)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-75">
          <Icon className="h-3.5 w-3.5" />
          <span>{MODE_LABEL[mode] || '请确认'}</span>
        </div>

        <p className="text-sm font-semibold leading-relaxed">{title}</p>

        {isResponded ? (
          <div
            className="flex items-start gap-1.5 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-sub)' }}
          >
            <Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: 'var(--accent-color)' }} />
            <span className="whitespace-pre-wrap">{metadata.responseSummary}</span>
          </div>
        ) : mode === 'confirm' ? (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRespond(metadata.confirmLabel || '好的')}
              className="flex-1 rounded-full py-1.5 text-[11px] font-bold transition-transform active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              {metadata.confirmLabel || '好的'}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRespond(metadata.cancelLabel || '先不用')}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-sub)' }}
            >
              {metadata.cancelLabel || '先不用'}
            </button>
          </div>
        ) : mode === 'select' ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(metadata.options || []).map((option) => (
              <button
                key={option}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleRespond(option)}
                className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-50"
                style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-2 pt-1">
            {(metadata.fields || []).map((field) => (
              <input
                key={field.name}
                value={formValues[field.name] || ''}
                onChange={(event) => (
                  setFormValues((previous) => ({
                    ...previous,
                    [field.name]: event.target.value,
                  }))
                )}
                placeholder={`${field.name}${field.placeholder ? ` · ${field.placeholder}` : ''}`}
                disabled={isSubmitting}
                className="w-full rounded-xl border bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:opacity-50 disabled:opacity-50"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            ))}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full py-1.5 text-[11px] font-bold transition-transform active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              提交
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConfirmCard;