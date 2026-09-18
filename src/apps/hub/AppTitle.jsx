// src/apps/hub/AppTitle.jsx
//
// 统一的应用名称展示组件：根据「应用名称显示模式」设置，决定标题只显示
// 英文，还是把中文名称一起拼接展示（"Snapshots 快照" 这种组合形式）。

import React from 'react';
import { APP_NAME_DISPLAY_BILINGUAL } from './useAppNameDisplayMode';

export const AppTitle = ({ en, zh, mode, className = 'text-sm font-bold' }) => (
  <h4 className={className}>
    {en}
    {mode === APP_NAME_DISPLAY_BILINGUAL && zh && (
      <span className="ml-1.5 font-normal opacity-50">{zh}</span>
    )}
  </h4>
);

export default AppTitle;