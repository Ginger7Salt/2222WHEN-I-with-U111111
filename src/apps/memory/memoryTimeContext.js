/*
 * 时间感知的展示层：把记忆上的时间信息，变成提示词里角色一眼能看懂的说法。
 *
 * 原来记忆放进提示词时只有"[类型] 标题：内容"，没有任何时间，
 * 所以"昨天吃了海底捞"过几天再被翻出来，角色分不清是哪天的事。
 * 这里提供：
 *   - formatMemoryTimeLabel：单条记忆的时间标注，如"发生于昨天中午（9月22日）"
 *     或"记录于3天前"；
 *   - formatElapsedFine：更细的"多久以前"，给"角色刚做过的事"用；
 *   - buildCurrentTimeLine：当前时间行，让上面的相对说法有个明确的基准。
 *
 * 全部是纯函数，按设备本地时区计算，不读写数据库。
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const toDate = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) && date.getTime() > 0
    ? date
    : null;
};

const startOfLocalDay = (date) => (
  new Date(date.getFullYear(), date.getMonth(), date.getDate())
);

const pad2 = (value) => String(value).padStart(2, '0');

/*
 * 按本地日历天数计算的差值：0 是今天，-1 是昨天，1 是明天。
 * 用日历天数而不是"24 小时"，这样凌晨 1 点看昨晚 11 点的事，也是"昨天"。
 */
export const getLocalDayDiff = (date, now = new Date()) => (
  Math.round(
    (startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime())
    / DAY_MS
  )
);

export const getDayPeriodLabel = (hour) => {
  if (hour < 5) return '凌晨';
  if (hour < 9) return '早上';
  if (hour < 12) return '上午';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  if (hour < 20) return '傍晚';

  return '晚上';
};

export const formatRelativeDayLabel = (date, now = new Date()) => {
  const diff = getLocalDayDiff(date, now);

  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === -2) return '前天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';

  if (diff < 0) {
    if (diff >= -13) return `${-diff}天前`;
    if (diff >= -59) return `${Math.round(-diff / 7)}周前`;

    return `${Math.round(-diff / 30)}个月前`;
  }

  if (diff <= 13) return `${diff}天后`;
  if (diff <= 59) return `${Math.round(diff / 7)}周后`;

  return `${Math.round(diff / 30)}个月后`;
};

const formatMonthDay = (date, now) => {
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;

  return date.getFullYear() === now.getFullYear()
    ? monthDay
    : `${date.getFullYear()}年${monthDay}`;
};

/*
 * 单条记忆的时间标注。
 * - 有解析好的事件时间（且不模糊）：发生于/计划于 + 相对日期 + 时段 + 具体日期；
 * - 否则退回记录时间：记录于 + 相对日期。
 * 没有任何可用时间时返回空字符串，调用方不显示。
 */
export const formatMemoryTimeLabel = (memory, nowInput = new Date()) => {
  const now = toDate(nowInput) || new Date();
  const temporal = memory?.temporal;

  const start = toDate(temporal?.startAt);
  const end = toDate(temporal?.endAt);

  if (temporal && !temporal.isAmbiguous && start) {
    const verb = start.getTime() > now.getTime()
      ? '计划于'
      : '发生于';

    const spansWholeDay = !end || (
      end.getTime() - start.getTime() >= 20 * HOUR_MS
    );

    const sameDay = end
      && startOfLocalDay(start).getTime()
        === startOfLocalDay(end).getTime();

    let periodLabel = '';

    if (!spansWholeDay && sameDay) {
      const middle = new Date(
        (start.getTime() + end.getTime()) / 2
      );

      periodLabel = getDayPeriodLabel(middle.getHours());
    }

    return `${verb}${formatRelativeDayLabel(start, now)}${periodLabel}（${formatMonthDay(start, now)}）`;
  }

  const recorded = toDate(memory?.createdAt || memory?.updatedAt);

  if (!recorded) {
    return '';
  }

  return `记录于${formatRelativeDayLabel(recorded, now)}`;
};

/*
 * 更细的"多久以前"：几分钟内说"刚刚"，一天内说"N 小时前"，
 * 更早的按日历天数说"昨天/3 天前"。
 */
export const formatElapsedFine = (value, nowInput = new Date()) => {
  const now = toDate(nowInput) || new Date();
  const date = toDate(value);

  if (!date) {
    return '';
  }

  const elapsed = now.getTime() - date.getTime();

  if (elapsed < 0) {
    return formatRelativeDayLabel(date, now);
  }

  if (elapsed < 10 * 60 * 1000) return '刚刚';

  if (elapsed < HOUR_MS) {
    return `${Math.round(elapsed / 60000)}分钟前`;
  }

  if (elapsed < 20 * HOUR_MS && getLocalDayDiff(date, now) === 0) {
    return `${Math.max(1, Math.round(elapsed / HOUR_MS))}小时前`;
  }

  if (elapsed < 20 * HOUR_MS) {
    return `${Math.max(1, Math.round(elapsed / HOUR_MS))}小时前（${getDayPeriodLabel(date.getHours())}）`;
  }

  return formatRelativeDayLabel(date, now);
};

export const buildCurrentTimeLine = (nowInput = new Date()) => {
  const now = toDate(nowInput) || new Date();

  return `当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]} ${pad2(now.getHours())}:${pad2(now.getMinutes())}。下面记忆里的“昨天”“几天前”等都以这个时间为准。`;
};