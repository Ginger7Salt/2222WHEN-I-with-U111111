// src/apps/badges/BadgeRegularPlaceholder.jsx
//
// "常规徽章" tab——不限月份、常驻可兑换的徽章。这一轮只搭 UI 占位，具体兑换
// 条件还没想好（门槛要比月度限定更高，但高多少、考什么，之后再定），所以
// 这里只画锁住的占位格子，不接任何真实数据/判定逻辑。

import React from 'react';
import { Lock } from 'lucide-react';

const PLACEHOLDER_SLOTS = [1, 2, 3, 4];

export const BadgeRegularPlaceholder = () => (
  <section className="badge-season badge-regular">
    <div className="badge-season-header">
      <h3>常规徽章</h3>
      <span className="badge-season-archived-tag">敬请期待</span>
    </div>

    <p className="badge-conditions-hint">
      不挑月份、常驻可兑换的一组徽章。
    </p>

    <div className="badge-grid badge-grid--placeholder">
      {PLACEHOLDER_SLOTS.map((slot) => (
        <div className="badge-tile badge-tile--placeholder" key={slot} aria-hidden="true">
          <span className="badge-tile-image-wrap">
            <Lock size={18} strokeWidth={1.4} />
          </span>
          <span className="badge-tile-title">敬请期待</span>
        </div>
      ))}
    </div>
  </section>
);

export default BadgeRegularPlaceholder;