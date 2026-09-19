// src/apps/hub/widgets/AddWidgetModal.jsx
//
// 首页编辑模式里点"+"弹出的添加小组件面板。先选类型；需要额外配置
// 的类型（比如纪念日倒数要先选绑定哪个日期）会再进一步显示配置界面。
// 视觉上跟着 ConfirmModal.jsx 的样式走，保持首页弹层观感一致。

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { WIDGET_TYPE_LIST } from './widgetRegistry';

export const AddWidgetModal = ({ onAdd, onClose }) => {
  const [selectedType, setSelectedType] = useState(null);

  const handlePickType = (widgetType) => {
    if (!widgetType.needsConfig) {
      onAdd({ type: widgetType.type, config: {} });
      return;
    }
    setSelectedType(widgetType);
  };

  const handleConfigConfirm = (config) => {
    if (!selectedType) return;
    onAdd({ type: selectedType.type, config });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div
        className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-xs space-y-4 rounded-[2rem] p-5 shadow-2xl"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-bold">
            {selectedType ? selectedType.label : '添加小组件'}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 opacity-50 hover:opacity-100"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selectedType ? (
          <selectedType.ConfigStep
            onConfirm={handleConfigConfirm}
            onCancel={() => setSelectedType(null)}
          />
        ) : (
          <div className="space-y-2">
            {WIDGET_TYPE_LIST.map((widgetType) => (
              <button
                key={widgetType.type}
                type="button"
                onClick={() => handlePickType(widgetType)}
                className="w-full rounded-xl border p-3 text-left transition-transform active:scale-[0.98]"
                style={{
                  borderColor: 'var(--card-border)',
                  backgroundColor: 'var(--control-soft-bg)',
                }}
              >
                <p className="text-xs font-semibold">{widgetType.label}</p>
                <p className="mt-0.5 text-[10px] opacity-55">
                  {widgetType.description}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddWidgetModal;