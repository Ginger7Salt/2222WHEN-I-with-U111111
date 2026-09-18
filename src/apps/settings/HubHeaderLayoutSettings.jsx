// src/apps/settings/HubHeaderLayoutSettings.jsx
//
// 设置页里的「主页版式」选择器：决定首页头部（资料卡 + 图片墙）区域
// 用哪种版式展示。目前只有「经典卡片」一种，后续新增版式时会自动
// 出现在这个列表里（见 hub/hubHeaderLayouts/registry.js）。

import React from 'react';
import { HUB_HEADER_LAYOUTS } from '../hub/hubHeaderLayouts/registry';

export const HubHeaderLayoutSettings = ({ value, onChange }) => (
  <div className="space-y-3">
    <div>
      <p className="font-medium">主页版式 (Homepage Layout)</p>
      <p className="mt-1 text-[10px] leading-relaxed opacity-50">
        决定首页头部（资料卡 + 图片墙）用哪种版式展示，资料内容共用一份，
        换版式不会丢失内容。后续会陆续加入更多版式。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      {HUB_HEADER_LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          onClick={() => onChange(layout.id)}
          className={`rounded-xl py-3 font-medium transition-all ${
            value === layout.id
              ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
              : 'bg-black/5 dark:bg-white/10 hover:bg-black/10'
          }`}
        >
          <span className="block">{layout.label}</span>
          <span
            className={`mt-0.5 block text-[10px] font-normal ${
              value === layout.id ? 'opacity-70' : 'opacity-40'
            }`}
          >
            {layout.hint}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default HubHeaderLayoutSettings;