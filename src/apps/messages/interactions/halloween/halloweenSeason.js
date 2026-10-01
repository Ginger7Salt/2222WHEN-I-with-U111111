// src/apps/messages/interactions/halloween/halloweenSeason.js
//
// 四个万圣节彩蛋（恶作剧按钮、关键词粒子、深夜彩蛋、蜘蛛）共用同一个
// 季节开关：只在十月自动生效，其余月份这几个彩蛋的入口/触发检查都会
// 直接短路返回 false，不需要额外的用户设置来关闭。明年要改时间段，
// 改这一个文件就够了。

// 月份用 JS Date 的 0-11 记法：9 = 十月。
const HALLOWEEN_MONTH_INDEX = 9;

export const isHalloweenSeasonActive = (date = new Date()) => (
  date.getMonth() === HALLOWEEN_MONTH_INDEX
);