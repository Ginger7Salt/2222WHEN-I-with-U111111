// src/apps/settings/AppNameDisplaySettings.jsx
//
// 设置页里的「应用名称显示」开关：只显示英文名，还是英文+中文结合展示。
// 影响首页「各种 app」滑块里每个应用卡片的标题（页边注、岁时纪这类本身
// 就是中文设计的入口不受此项影响）。

import React from 'react';
import {
  APP_NAME_DISPLAY_EN,
  APP_NAME_DISPLAY_BILINGUAL,
} from '../hub/useAppNameDisplayMode';

const OPTIONS = [
  { id: APP_NAME_DISPLAY_EN, label: 'English', hint: 'Snapshots' },
  {
    id: APP_NAME_DISPLAY_BILINGUAL,
    label: 'English + 中文',
    hint: 'Snapshots 快照',
  },
];

export const AppNameDisplaySettings = ({ value, onChange }) => (
  <div className="space-y-3">
    <div>
      <p className="font-medium">应用名称显示 (App Name Display)</p>
      <p className="mt-1 text-[10px] leading-relaxed opacity-50">
        决定首页各个应用卡片的标题，只显示英文名，还是英文与中文名结合展示。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-xl py-3 font-medium transition-all ${
            value === option.id
              ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
              : 'bg-black/5 dark:bg-white/10 hover:bg-black/10'
          }`}
        >
          <span className="block">{option.label}</span>
          <span
            className={`mt-0.5 block text-[10px] font-normal ${
              value === option.id ? 'opacity-70' : 'opacity-40'
            }`}
          >
            {option.hint}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default AppNameDisplaySettings;