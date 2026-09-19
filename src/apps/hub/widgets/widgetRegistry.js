// src/apps/hub/widgets/widgetRegistry.js
//
// 首页小组件类型注册表。以后新增一种小组件类型，只需要在这里加一条
// 定义——"+"添加面板（AddWidgetModal.jsx）按这份列表展示可选类型，
// 首页渲染时也是按 type 从这里查到该用哪个组件画。

import React from 'react';
import WorkflowCountdownWidget from './WorkflowCountdownWidget';
import ImportantDateCountdownWidget from './ImportantDateCountdownWidget';
import ImportantDateWidgetConfigStep from './ImportantDateWidgetConfigStep';

export const WIDGET_TYPES = {
  workflowCountdown: {
    type: 'workflowCountdown',
    label: '定时消息倒计时',
    description: '显示离最近一条会主动发消息的例程还有多久',
    colSpan: 1,
    needsConfig: false,
    renderContent: ({ onOpenApp }) => (
      <WorkflowCountdownWidget onOpenApp={onOpenApp} />
    ),
  },

  importantDateCountdown: {
    type: 'importantDateCountdown',
    label: '纪念日倒数',
    description: '绑定一个具体的纪念日/生日，显示还剩几天',
    colSpan: 1,
    needsConfig: true,
    ConfigStep: ImportantDateWidgetConfigStep,
    renderContent: ({ widget, onOpenApp }) => (
      <ImportantDateCountdownWidget config={widget.config} onOpenApp={onOpenApp} />
    ),
  },
};

export const WIDGET_TYPE_LIST = Object.values(WIDGET_TYPES);

export default WIDGET_TYPES;