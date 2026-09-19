// src/apps/hub/widgets/QuoteCardConfigStep.jsx
//
// "心语卡片"小组件的编辑表单：就两行文字，新增和之后重新编辑复用
// 同一份，靠 initialConfig 预填当前内容。

import React, { useState } from 'react';

const inputStyle = {
  backgroundColor: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const DEFAULT_CONFIG = { mainText: '', subText: '' };

export const QuoteCardConfigStep = ({ initialConfig, onConfirm, onCancel }) => {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, ...initialConfig });

  const canConfirm = Boolean(config.mainText.trim());

  return (
    <div className="space-y-3 text-left text-xs">
      <label className="block space-y-1.5">
        <span className="opacity-60">主要文字</span>
        <textarea
          value={config.mainText}
          onChange={(event) =>
            setConfig((current) => ({ ...current, mainText: event.target.value }))
          }
          placeholder="比如：An orange flower blooming"
          rows={2}
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs"
          style={inputStyle}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="opacity-60">副标题文字（可选）</span>
        <input
          type="text"
          value={config.subText}
          onChange={(event) =>
            setConfig((current) => ({ ...current, subText: event.target.value }))
          }
          placeholder="比如：like warm sunlight"
          className="w-full rounded-lg border px-3 py-2 text-xs"
          style={inputStyle}
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border py-2 text-center opacity-80"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)',
          }}
        >
          取消
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm(config)}
          className="flex-1 rounded-xl py-2 text-center font-semibold disabled:opacity-40"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
};

export default QuoteCardConfigStep;