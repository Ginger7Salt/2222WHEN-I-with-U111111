// src/apps/hub/widgets/widgetRegistry.js
//
// 首页小组件类型注册表。以后新增一种小组件类型，只需要在这里加一条
// 定义——"+"添加面板（AddWidgetModal.jsx）按这份列表展示可选类型，
// 首页渲染时也是按 type 从这里查到该用哪个组件画。
//
// 两类小组件：
//   - 数据类（workflowCountdown / importantDateCountdown）：内容来自
//     app 里已有的数据，点击跳转去对应 app，没有 ConfigStep 之外的
//     二次编辑入口。
//   - 装饰类（musicCard / quoteCard）：内容完全是用户自己填的文字/
//     图片，没有真实数据源，点击（在非编辑模式下）会弹出 ConfigStep
//     直接改内容，而不是跳转。EditWidgetModal.jsx 靠这里的 ConfigStep
//     实现"重新编辑"，跟添加时用的是同一份表单。

import React from 'react';
import WorkflowCountdownWidget from './WorkflowCountdownWidget';
import ImportantDateCountdownWidget from './ImportantDateCountdownWidget';
import ImportantDateWidgetConfigStep from './ImportantDateWidgetConfigStep';
import MusicCardWidget from './MusicCardWidget';
import MusicCardConfigStep from './MusicCardConfigStep';
import QuoteCardWidget from './QuoteCardWidget';
import QuoteCardConfigStep from './QuoteCardConfigStep';

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

  musicCard: {
    type: 'musicCard',
    label: '音乐卡片（装饰）',
    description: '仿正在播放样式的装饰卡片，标题/艺人/封面图都自己填',
    colSpan: 2,
    needsConfig: true,
    ConfigStep: MusicCardConfigStep,
    renderContent: ({ widget, onEditWidget }) => (
      <MusicCardWidget
        config={widget.config}
        onOpenEdit={() => onEditWidget(widget)}
      />
    ),
  },

  quoteCard: {
    type: 'quoteCard',
    label: '心语卡片（装饰）',
    description: '一个心形图标 + 两行自己写的话',
    colSpan: 1,
    needsConfig: true,
    ConfigStep: QuoteCardConfigStep,
    renderContent: ({ widget, onEditWidget }) => (
      <QuoteCardWidget
        config={widget.config}
        onOpenEdit={() => onEditWidget(widget)}
      />
    ),
  },
};

export const WIDGET_TYPE_LIST = Object.values(WIDGET_TYPES);

export default WIDGET_TYPES;