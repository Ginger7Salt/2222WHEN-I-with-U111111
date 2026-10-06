/**
 * badgeData.js
 *
 * 「连续天数收藏卡片」的静态配置：门槛天数 + 文案 + 卡面图片 URL。
 * 纯数据，不碰 Dexie、不碰 React。
 *
 * 门槛按"连续天数"算，用的是聊天窗的火花 streak——跟顶栏已经在显示的
 * 那个连续天数是同一个数字，CompanionFortuneModal 本来就有
 * streakCount 这个 prop，不用再另外去查一次。
 *
 * 关于"满月"：五档卡片原话给的顺序是 七天/满月/15天/50天/100天，
 * 按 7/15/30/50/100 这组此前就定下的常见档位推断，"满月"对应的是
 * 30 天（中文语境里"满月"常指"整一个月"）。如果实际门槛不是 30，
 * 改这一个文件里对应的 days 字段即可，不用动组件代码。
 */

export const BADGE_MILESTONES = [
  {
    days: 7,
    label: '七天',
    imageUrl: 'https://img.pagehost.cn/autoupload/amqnh/20261006/zFIN/1280X1280/kapian_%281%29.png/webp',
  },
  {
    days: 15,
    label: '十五天',
    imageUrl: 'https://img.pagehost.cn/autoupload/amqnh/20261006/dnEq/1280X1280/kapian_%285%29.png/webp',
  },
  {
    days: 30,
    label: '满月',
    imageUrl: 'https://img.pagehost.cn/autoupload/amqnh/20261006/CK3u/1280X1280/kapian_%284%29.png/webp',
  },
  {
    days: 50,
    label: '五十天',
    imageUrl: 'https://img.pagehost.cn/autoupload/amqnh/20261006/a47j/1280X1280/kapian_%283%29.png/webp',
  },
  {
    days: 100,
    label: '百天',
    imageUrl: 'https://img.pagehost.cn/autoupload/amqnh/20261006/A1en/1280X1280/kapian_%282%29.png/webp',
  },
];

/** 当前连续天数已经解锁的卡片（由低到高） */
export function unlockedMilestones(streakCount) {
  return BADGE_MILESTONES.filter((m) => streakCount >= m.days);
}