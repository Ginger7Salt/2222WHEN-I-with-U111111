// src/apps/hub/widgets/buildHomeWidgetItems.js
//
// 把 db.homeWidgets 里的小组件记录，转成跟 appGridItems.jsx 里
// 应用图标完全同一种形状的网格项（{ id, colSpan, content }），这样
// 首页那一套拖拽排序（gridLayout.js / EditableAppGrid.jsx /
// AppSwiper.jsx）完全不用区分"这一项是应用还是小组件"，混在同一个
// 数组里排序即可。
//
// 小组件的 id 会加一个 "widget:" 前缀，跟应用图标固定的字符串 id
// （比如 'rhythm'、'memory'）区分开，删除小组件时靠这个前缀识别出
// 「这是一个可以被移除的小组件」，反解出它在 db.homeWidgets 里的
// 真实数字 id。

import { WIDGET_TYPES } from './widgetRegistry';

export const WIDGET_ID_PREFIX = 'widget:';

export const toWidgetItemId = (widgetRecordId) =>
  `${WIDGET_ID_PREFIX}${widgetRecordId}`;

export const parseWidgetRecordId = (itemId) => {
  if (typeof itemId !== 'string' || !itemId.startsWith(WIDGET_ID_PREFIX)) {
    return null;
  }

  const raw = itemId.slice(WIDGET_ID_PREFIX.length);
  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : null;
};

export const buildHomeWidgetItems = (widgetRecords, { onOpenApp, onEditWidget }) =>
  widgetRecords
    .map((widget) => {
      const definition = WIDGET_TYPES[widget.type];
      if (!definition) return null; // 类型已下线/未知，安静跳过

      return {
        id: toWidgetItemId(widget.id),
        colSpan: definition.colSpan,
        removable: true,
        content: definition.renderContent({ widget, onOpenApp, onEditWidget }),
      };
    })
    .filter(Boolean);

export default buildHomeWidgetItems;