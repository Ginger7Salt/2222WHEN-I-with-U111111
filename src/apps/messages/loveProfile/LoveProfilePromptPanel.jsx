// src/apps/messages/loveProfile/LoveProfilePromptPanel.jsx
//
// 「已生成的行为指导」展示 + 反馈修改面板。全局设置页和单窗覆盖共用这一个
// 组件：显示当前 prompt（可直接手动改）、一个"告诉 AI 想怎么调整"的反馈
// 输入框、以及"恢复上一版"。自己不碰数据库、不调 AI，全部通过回调交给父组件。

import React, { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

export const LoveProfilePromptPanel = ({
  prompt,
  busy = false,
  error = '',
  canUndo = false,
  onUndo,
  onManualSave,
  onRevise,
}) => {
  const [draft, setDraft] = useState(prompt || '');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setDraft(prompt || '');
  }, [prompt]);

  const handleBlur = () => {
    const next = draft.trim();
    if (next && next !== String(prompt || '').trim()) {
      onManualSave?.(next);
    } else if (!next) {
      setDraft(prompt || '');
    }
  };

  const handleRevise = async () => {
    const text = feedback.trim();
    if (!text || busy) return;

    const ok = await onRevise?.(text);
    if (ok) setFeedback('');
  };

  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <p className="text-[11px] font-medium">当前生成的内容</p>
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          这是发给角色的行为指导，你可以直接修改文字，也可以在下面告诉 AI 想怎么调整。
        </p>
      </div>

      <textarea
        rows={9}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        className="w-full p-2.5 rounded-xl border outline-none text-[11px] leading-relaxed overflow-y-auto resize-y max-h-72 min-h-[140px] disabled:opacity-50"
        style={{
          background: 'var(--bg-main)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
        }}
      />

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium">有哪里不太对？</p>
        <textarea
          rows={3}
          value={feedback}
          disabled={busy}
          placeholder="例如：不用那么黏，我更喜欢偶尔分享一件小事；或者：难过的时候先别安慰我，让我自己待一会儿。"
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full p-2.5 rounded-xl border outline-none text-[11px] leading-relaxed resize-y min-h-[72px] disabled:opacity-50"
          style={{
            background: 'var(--bg-main)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)',
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !feedback.trim()}
            onClick={handleRevise}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent-color)', color: '#fff' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {busy ? '调整中...' : '按反馈调整'}
          </button>

          {canUndo && (
            <button
              type="button"
              disabled={busy}
              onClick={onUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--divider)', color: 'var(--text-main)' }}
            >
              <Check className="w-3.5 h-3.5" />
              恢复上一版
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-[10px] text-red-500 leading-relaxed">{error}</p>}
    </div>
  );
};

export default LoveProfilePromptPanel;