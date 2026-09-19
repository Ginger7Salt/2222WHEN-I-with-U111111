// src/apps/hub/widgets/AddWidgetModal.jsx
//
// 首页编辑模式里点"+"弹出的添加小组件面板。先选类型；需要额外配置
// 的类型会再进一步显示配置界面。

import React, { useState } from 'react';
import WidgetModalShell from './WidgetModalShell';
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
    <WidgetModalShell
      title={selectedType ? selectedType.label : '添加小组件'}
      onClose={onClose}
    >
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
    </WidgetModalShell>
  );
};

export default AddWidgetModal;