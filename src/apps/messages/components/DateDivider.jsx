// src/apps/messages/components/DateDivider.jsx
//
// 消息流里的日期分隔条：仿 Line/Reddit 那种，日期变化时在消息中间插一条
// 居中的小胶囊，其余时间不出现——跟每条消息自己显示的时间互不冲突，
// 时间还是原来的时间，只是多了"这是哪一天"的上下文。

import React from 'react';

export const toDayKey = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatDividerDate = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';

  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
};

const DateDivider = ({ timestamp }) => {
  const label = formatDividerDate(timestamp);

  if (!label) return null;

  return (
    <div className="flex justify-center py-1">
      <span
        className="rounded-full px-3 py-1 text-[10px] tracking-wide"
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default DateDivider;