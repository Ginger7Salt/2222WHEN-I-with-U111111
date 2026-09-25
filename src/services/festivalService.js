// "今天有点不一样"判断服务：给 chatroom 用的节日日历 + 早安/晚安
// 时间段判断，纯函数、不依赖数据库。
//
// 节日日历先只放万圣节这一条；以后要加圣诞节或别的节日，直接往
// FESTIVALS 数组里加一条同样结构的记录就行，不用改调用方的代码。

const FESTIVALS = [
  {
    key: 'halloween',
    month: 10,
    day: 31,
    title: '万圣节快乐',
    subtitle: '南瓜灯亮起来了，今晚要不要一起玩点什么',
    accent: '#ff8a3d',
  },
];

// 传入的 date 按"设备本地时间"来判断月/日，跟人平时说"今天几号"是一致的。
export function getTodayFestival(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return FESTIVALS.find((item) => item.month === month && item.day === day) || null;
}

const MORNING_START_HOUR = 5; // [5, 10) 算早安时段
const MORNING_END_HOUR = 10;
const NIGHT_START_HOUR = 22; // [22, 24) 和 [0, 4) 算晚安时段
const NIGHT_END_HOUR = 4;

export function getGreetingPeriod(date = new Date()) {
  const hour = date.getHours();

  if (hour >= MORNING_START_HOUR && hour < MORNING_END_HOUR) return 'morning';
  if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) return 'night';

  return null;
}

const GREETING_CONTENT = {
  morning: {
    title: '早安',
    subtitle: '新的一天，想先聊点什么呢',
    accent: '#ffb648',
  },
  night: {
    title: '晚安',
    subtitle: '再晚一点也没关系，我在这里陪你',
    accent: '#8c7bff',
  },
};

export function getGreetingCardContent(period) {
  return GREETING_CONTENT[period] || null;
}

// 按本地日期生成一个 "YYYY-MM-DD" 的去重用 key。
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}