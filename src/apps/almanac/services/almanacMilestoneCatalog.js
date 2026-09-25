/*
 * 里程碑目录与判断（纯逻辑，不 import 任何东西，可以直接在 node 里测试）。
 *
 * 想加新的里程碑：在 MILESTONE_CATALOG 里加一行就行，格式如下——
 *   { id, type, threshold, building, title }
 * type 目前支持：
 *   'days'            相识第 threshold 天
 *   'messages'        累计第 threshold 条消息
 *   'streak'          连续聊天 threshold 天
 *   'first_night'     第一次在 0 点之后还在聊（不需要 threshold）
 *   'signal_timestamp' 某个"第一次"事件发生的时间，来自外部功能模块（比如回忆录、
 *                      日记、信箱），由调用方在 signals 里按 signalKey 传一个时间戳
 *                      进来，这里不知道、也不关心那个事件具体是什么
 *   'signal_count'    某类事件累计达到 threshold 次，signals[signalKey] 是一个
 *                      按时间升序排好的时间戳数组，第 threshold 个就是点亮时刻
 * building 决定路上画哪种建筑：tower1 tower2 tower3 tower4 hut gate bridge summit
 */

export const MILESTONE_CATALOG = [
  { id: 'days-1', type: 'days', threshold: 1, building: 'tower1', title: '相识的第 1 天' },
  { id: 'days-7', type: 'days', threshold: 7, building: 'tower2', title: '相识满 7 天' },
  { id: 'days-30', type: 'days', threshold: 30, building: 'tower3', title: '相识满 30 天' },
  { id: 'days-100', type: 'days', threshold: 100, building: 'tower4', title: '相识满 100 天' },
  { id: 'days-365', type: 'days', threshold: 365, building: 'summit', title: '一周年' },

  { id: 'messages-100', type: 'messages', threshold: 100, building: 'gate', title: '第 100 条消息' },
  { id: 'messages-500', type: 'messages', threshold: 500, building: 'gate', title: '第 500 条消息' },
  { id: 'messages-1000', type: 'messages', threshold: 1000, building: 'gate', title: '第 1000 条消息' },

  { id: 'streak-3', type: 'streak', threshold: 3, building: 'bridge', title: '连续聊天 3 天' },
  { id: 'streak-7', type: 'streak', threshold: 7, building: 'bridge', title: '连续聊天 7 天' },
  { id: 'streak-30', type: 'streak', threshold: 30, building: 'bridge', title: '连续聊天 30 天' },

  { id: 'first-night', type: 'first_night', threshold: 0, building: 'hut', title: '第一次深夜聊天' },

  {
    id: 'first-gift',
    type: 'signal_timestamp',
    signalKey: 'firstGiftAt',
    building: 'hut',
    title: '第一次收到心意',
  },
  {
    id: 'stickers-100',
    type: 'signal_count',
    signalKey: 'stickerTimestamps',
    threshold: 100,
    building: 'gate',
    title: '发出第 100 个表情包',
  },
  {
    id: 'first-diary',
    type: 'signal_timestamp',
    signalKey: 'firstDiaryAt',
    building: 'hut',
    title: '第一次写下日记',
  },
  {
    id: 'first-reaction',
    type: 'signal_timestamp',
    signalKey: 'firstReactionAt',
    building: 'hut',
    title: '第一次点了反应',
  },
  {
    id: 'first-mailbox',
    type: 'signal_timestamp',
    signalKey: 'firstMailboxAt',
    building: 'hut',
    title: '第一次投进信箱',
  },
];

const DAY_MS = 86400000;

const dayNumberFromKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));

  if (!match) return null;

  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS
  );
};

/**
 * 计算所有里程碑的当前状态。
 *
 * allTimes  : 该聊天所有消息的时间戳（毫秒），升序
 * userTimes : 其中 user 发的消息的时间戳，升序
 * helpers   : { getDateKey(ts), getLocalHour(ts) }，按用户时区取日期和小时
 * now       : 当前时间戳
 */
export const evaluateMilestones = ({
  allTimes = [],
  userTimes = [],
  helpers,
  now = Date.now(),
  catalog = MILESTONE_CATALOG,
  signals = {},
}) => {
  const total = allTimes.length;

  if (!total) {
    return { hasData: false, daysTogether: 0, totalMessages: 0, firstTimestamp: null, nodes: [] };
  }

  const firstTimestamp = allTimes[0];
  const firstDay = dayNumberFromKey(helpers.getDateKey(firstTimestamp));
  const todayDay = dayNumberFromKey(helpers.getDateKey(now));
  const daysTogether = Math.max(1, (todayDay ?? firstDay) - firstDay + 1);

  // 每天的第一条消息 + 连续天数
  const dayFirst = new Map();

  allTimes.forEach((ts) => {
    const key = helpers.getDateKey(ts);
    if (!dayFirst.has(key)) dayFirst.set(key, ts);
  });

  const sortedDays = Array.from(dayFirst.entries())
    .map(([key, ts]) => ({ key, ts, day: dayNumberFromKey(key) }))
    .filter((item) => item.day !== null)
    .sort((a, b) => a.day - b.day);

  const streakReachedAt = new Map(); // 连续 N 天 -> 达成那天的第一条消息时间
  let run = 0;
  let best = 0;
  let previousDay = null;

  sortedDays.forEach((item) => {
    run = previousDay !== null && item.day === previousDay + 1 ? run + 1 : 1;
    previousDay = item.day;
    best = Math.max(best, run);
    if (!streakReachedAt.has(run)) streakReachedAt.set(run, item.ts);
  });

  // 当前仍在延续的连续天数：最后一个有消息的日子必须是今天或昨天
  const last = sortedDays[sortedDays.length - 1];
  const currentStreak = last && todayDay !== null && todayDay - last.day <= 1 ? run : 0;

  const firstNightTs =
    userTimes.find((ts) => {
      const hour = helpers.getLocalHour(ts);
      return hour >= 0 && hour <= 4;
    }) ?? null;

  const nodes = catalog.map((entry, order) => {
    let lit = false;
    let unlockedAt = null;
    let fraction = 0;
    let hint = '';

    if (entry.type === 'days') {
      lit = daysTogether >= entry.threshold;
      unlockedAt = lit ? firstTimestamp + (entry.threshold - 1) * DAY_MS : null;
      fraction = Math.min(1, daysTogether / entry.threshold);
      hint = `还差 ${Math.max(0, entry.threshold - daysTogether)} 天`;
    } else if (entry.type === 'messages') {
      lit = total >= entry.threshold;
      unlockedAt = lit ? allTimes[entry.threshold - 1] : null;
      fraction = Math.min(1, total / entry.threshold);
      hint = `已聊 ${total} / ${entry.threshold} 条`;
    } else if (entry.type === 'streak') {
      lit = best >= entry.threshold;
      unlockedAt = lit ? streakReachedAt.get(entry.threshold) ?? null : null;
      fraction = Math.min(1, Math.max(currentStreak, lit ? entry.threshold : 0) / entry.threshold);
      hint = `当前连续 ${currentStreak} 天`;
    } else if (entry.type === 'first_night') {
      lit = firstNightTs !== null;
      unlockedAt = firstNightTs;
      fraction = lit ? 1 : 0;
      hint = '尚未发生';
    } else if (entry.type === 'signal_timestamp') {
      const raw = signals[entry.signalKey];
      const ts = raw ? new Date(raw).getTime() : null;
      lit = Number.isFinite(ts);
      unlockedAt = lit ? ts : null;
      fraction = lit ? 1 : 0;
      hint = '尚未发生';
    } else if (entry.type === 'signal_count') {
      const list = Array.isArray(signals[entry.signalKey]) ? signals[entry.signalKey] : [];
      lit = list.length >= entry.threshold;
      unlockedAt = lit ? list[entry.threshold - 1] : null;
      fraction = Math.min(1, list.length / entry.threshold);
      hint = `已经 ${list.length} / ${entry.threshold} 个`;
    }

    const unlockedDay =
      unlockedAt !== null && firstDay !== null
        ? dayNumberFromKey(helpers.getDateKey(unlockedAt)) - firstDay + 1
        : null;

    return {
      id: entry.id,
      type: entry.type,
      threshold: entry.threshold,
      building: entry.building,
      title: entry.title,
      order,
      lit,
      unlockedAt,
      unlockedDay,
      fraction,
      hint,
    };
  });

  return { hasData: true, daysTogether, totalMessages: total, firstTimestamp, bestStreak: best, currentStreak, nodes };
};

/**
 * 路上的顺序：先是已点亮的（按点亮时间从早到晚，从路的最下面往上），
 * 然后是没点亮的（离点亮最近的排在前面）。
 * storedTimes 是之前存下的点亮时间，优先用它，保证顺序和日期不会因为重新计算而跳动。
 */
export const orderMilestones = (nodes = [], storedTimes = {}) => {
  const timeOf = (node) => {
    const stored = storedTimes?.[node.id];
    const value = stored ? new Date(stored).getTime() : node.unlockedAt;
    return Number.isFinite(value) ? value : 0;
  };

  const lit = nodes.filter((node) => node.lit).sort((a, b) => timeOf(a) - timeOf(b) || a.order - b.order);
  const unlit = nodes.filter((node) => !node.lit).sort((a, b) => b.fraction - a.fraction || a.order - b.order);

  return [...lit, ...unlit];
};

export default { MILESTONE_CATALOG, evaluateMilestones, orderMilestones };