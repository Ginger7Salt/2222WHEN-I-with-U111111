// src/apps/greeting/greetingFormat.js
//
// 贺卡展示用的小格式化函数。纯函数，无依赖。

export const hashId = (value) =>
  [...String(value ?? '')].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

// 序号：NO.005
export const formatCardNo = (id) => `NO.${String(id ?? 0).padStart(3, '0')}`;

const pad2 = (n) => String(n).padStart(2, '0');

// 今天 07:42 / 昨天 21:10 / 10.18
export const formatCardDate = (timestamp, now = new Date()) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  const hm = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (diffDays === 0) return `今天 ${hm}`;
  if (diffDays === 1) return `昨天 ${hm}`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
};
