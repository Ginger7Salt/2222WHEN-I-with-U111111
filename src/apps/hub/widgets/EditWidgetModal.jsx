// src/apps/hub/widgets/EditWidgetModal.jsx
//
// 装饰性小组件（音乐卡片、心语卡片）在首页正常浏览模式下被点击时
// 弹出的编辑面板，跟添加时用的是同一个 ConfigStep 组件，靠
// initialConfig 带出已有内容。数据类小组件（定时消息倒计时、纪念日
// 倒数）没有配这个能力，点它们走的是原来"跳转去对应 app"的逻辑，
// 不会打开这个弹层。

import React from 'react';
import WidgetModalShell from './WidgetModalShell';
import { WIDGET_TYPES } from './widgetRegistry';

export const EditWidgetModal = ({ widget, onSave, onClose }) => {
  const definition = widget ? WIDGET_TYPES[widget.type] : null;

  if (!widget || !definition?.ConfigStep) {
    return null;
  }

  return (
    <WidgetModalShell title={`编辑 · ${definition.label}`} onClose={onClose}>
      <definition.ConfigStep
        initialConfig={widget.config}
        onConfirm={(config) => onSave(widget.id, config)}
        onCancel={onClose}
      />
    </WidgetModalShell>
  );
};

export default EditWidgetModal;