// src/apps/hub/widgets/WidgetModalShell.jsx
//
// 添加/编辑小组件两个弹层共用的外壳（蒙层+卡片+标题+关闭按钮），
// 抽出来避免两处重复维护同一套样式。视觉沿用 ConfirmModal.jsx 的
// 风格，保持首页弹层观感一致。

import React from 'react';
import { X } from 'lucide-react';

export const WidgetModalShell = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
    <div
      className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5"
      onClick={onClose}
    />

    <div
      className="relative z-10 max-h-[85vh] w-full max-w-xs space-y-4 overflow-y-auto rounded-[2rem] p-5 shadow-2xl"
      style={{
        background: 'var(--card-bg-gradient)',
        border: '1px solid var(--card-border)',
        color: 'var(--text-main)',
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-sm font-bold">{title}</h4>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 opacity-50 hover:opacity-100"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {children}
    </div>
  </div>
);

export default WidgetModalShell;