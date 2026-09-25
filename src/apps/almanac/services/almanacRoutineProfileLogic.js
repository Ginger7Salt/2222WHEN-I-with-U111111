/*
 * 「TA 眼中的你」的纯逻辑部分：统计、作息类型判断、观察生成、合并、提示词拼装。
 * 这个文件不 import 任何东西（没有数据库、没有 React），所以可以在 node 里直接跑测试。
 * 读写数据库的部分在 almanacRoutineProfileService.js。
 *
 * 数据来源：almanacRecords 里 eventType === 'user_message' 的按天聚合记录，
 * 用到 dateKey 和 localHourBuckets（按小时的消息数）。不读任何消息正文。
 */

export const MIN_DAYS = 7;
export const MIN_MESSAGES = 20;

// ---------------------------------------------
// 作息类型表：id、名称、默认的"所以 TA 会这样对你"
// ---------------------------------------------

export const ROUTINE_TYPES = [
  {
    id: 'daytime_regular',
    label: '日间规律',
    hint: '主要在白天到晚上活跃，深夜很少出现',
    guidance: '深夜你还在的话，TA 会轻轻提一句，不会唠叨。',
  },
  {
    id: 'early_bird',
    label: '早起型',
    hint: '清晨就会出现，晚上早早安静下来',
    guidance: '早上 TA 会更主动地打招呼，晚上不会拖着你聊。',
  },
  {
    id: 'night_owl',
    label: '夜猫子',
    hint: '深夜最活跃，白天出现得比较晚',
    guidance: 'TA 不会催你早睡，你的“晚上”按你自己的节奏算。',
  },
  {
    id: 'night_shift',
    label: '夜班或昼夜颠倒',
    hint: '夜里是你的白天，白天大段时间安静',
    guidance: 'TA 绝不催你早睡，会把你的夜晚当作白天对待，白天不去打扰你。',
  },
  {
    id: 'student',
    label: '学生作息',
    hint: '上课时段安静，课后和晚上更常出现',
    guidance: '上课的时间 TA 不打扰你，等你下课再来找你。',
  },
  {
    id: 'rotating',
    label: '轮班或倒班',
    hint: '每周之内有规律，但周与周之间会整体挪动',
    guidance: 'TA 不会假设你“平时”几点睡，先看你今天是什么状态。',
  },
  {
    id: 'flexible',
    label: '居家或自由安排',
    hint: '全天分散出现，没有明显的长时间安静',
    guidance: 'TA 不会按固定的时间点等你出现。',
  },
  {
    id: 'weekend_shift',
    label: '周末型',
    hint: '工作日和周末的节奏差别很大',
    guidance: '周末 TA 不催你起床，平日再按平日的节奏陪你。',
  },
  {
    id: 'irregular',
    label: '不规律',
    hint: '暂时看不出稳定的模式',
    guidance: 'TA 不拿规律作息要求你，顺着你当下的状态来。',
  },
];

export const getRoutineType = (id) =>
  ROUTINE_TYPES.find((item) => item.id === id) || null;

// ---------------------------------------------
// 小工具
// ---------------------------------------------

export const formatHour = (hour) => {
  const h = ((Math.round(hour) % 24) + 24) % 24;

  if (h === 0) return '凌晨 0 点';
  if (h < 5) return `凌晨 ${h} 点`;
  if (h < 11) return `早上 ${h} 点`;
  if (h < 13) return `中午 ${h} 点`;
  if (h < 18) return `下午 ${h - 12} 点`;

  return `晚上 ${h > 12 ? h - 12 : h} 点`;
};

const dayOfWeekFromKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));

  if (!match) return null;

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
};

const dayIndexFromKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));

  if (!match) return null;

  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000
  );
};

const sumHours = (hourly, hours) =>
  hours.reduce((total, hour) => total + (hourly[hour] || 0), 0);

const range = (from, to) => {
  const list = [];
  for (let h = from; h <= to; h += 1) list.push(h);
  return list;
};

const resultantLength = (hourly) => {
  let x = 0;
  let y = 0;
  let total = 0;

  hourly.forEach((count, hour) => {
    const angle = (2 * Math.PI * hour) / 24;
    x += count * Math.cos(angle);
    y += count * Math.sin(angle);
    total += count;
  });

  if (!total) return { r: 0, x: 0, y: 0 };

  return { r: Math.sqrt(x * x + y * y) / total, x: x / total, y: y / total };
};

// ---------------------------------------------
// 统计
// ---------------------------------------------

const readBuckets = (record) => {
  const buckets = record?.localHourBuckets;

  if (buckets && typeof buckets === 'object') {
    const entries = Object.entries(buckets)
      .map(([hour, count]) => [Number(hour), Number(count)])
      .filter(
        ([hour, count]) =>
          Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isFinite(count) && count > 0
      );

    if (entries.length) return entries;
  }

  if (Number.isInteger(record?.localHour) && record.localHour >= 0 && record.localHour < 24) {
    const count = Number(record.count);
    return [[record.localHour, Number.isFinite(count) && count > 0 ? count : 1]];
  }

  return [];
};

export const analyzeUserRecords = (records = []) => {
  const hourly = new Array(24).fill(0);
  const byDay = new Map();

  (Array.isArray(records) ? records : []).forEach((record) => {
    if (record?.eventType !== 'user_message' || !record.dateKey) return;

    const entries = readBuckets(record);
    if (!entries.length) return;

    const day = byDay.get(record.dateKey) || { dateKey: record.dateKey, hours: new Array(24).fill(0), total: 0 };

    entries.forEach(([hour, count]) => {
      hourly[hour] += count;
      day.hours[hour] += count;
      day.total += count;
    });

    byDay.set(record.dateKey, day);
  });

  const days = Array.from(byDay.values()).sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  const total = hourly.reduce((a, b) => a + b, 0);
  const share = (hours) => (total ? sumHours(hourly, hours) / total : 0);

  // 最安静的连续 6 小时（首尾相接）
  let quietStart = 0;
  let quietSum = Infinity;

  for (let s = 0; s < 24; s += 1) {
    let sum = 0;
    for (let i = 0; i < 6; i += 1) sum += hourly[(s + i) % 24];
    if (sum < quietSum) {
      quietSum = sum;
      quietStart = s;
    }
  }

  const quietShare = total ? quietSum / total : 0;
  const quietCenter = (quietStart + 3) % 24;

  // 第二安静时段：找一段和上面这段不挨着的连续 2 小时，用来区分"睡觉"和
  // "短暂休息、在忙别的事"——比如午休或者上班时间，跟夜里睡觉是两回事，
  // 不应该被同一句话糊在一起。
  const REST_LEN = 2;
  const EXCLUDE_PAD = 1;

  const isExcluded = (hour) => {
    for (let i = -EXCLUDE_PAD; i < 6 + EXCLUDE_PAD; i += 1) {
      if (((quietStart + i) % 24 + 24) % 24 === hour) return true;
    }
    return false;
  };

  let restStart = null;
  let restSum = Infinity;

  for (let s = 0; s < 24; s += 1) {
    let sum = 0;
    let overlaps = false;

    for (let i = 0; i < REST_LEN; i += 1) {
      const hour = (s + i) % 24;
      if (isExcluded(hour)) overlaps = true;
      sum += hourly[hour];
    }

    if (!overlaps && sum < restSum) {
      restSum = sum;
      restStart = s;
    }
  }

  const restShare = total && restStart !== null ? restSum / total : 1;

  let peakHour = 0;
  hourly.forEach((count, hour) => {
    if (count > hourly[peakHour]) peakHour = hour;
  });

  // 每天的"重心"：凌晨 0-3 点算作前一天晚上的延续（+24）
  const dayCenters = days.map((day) => {
    let weighted = 0;
    day.hours.forEach((count, hour) => {
      weighted += count * (hour < 4 ? hour + 24 : hour);
    });
    const dow = dayOfWeekFromKey(day.dateKey);
    return {
      dateKey: day.dateKey,
      center: day.total ? weighted / day.total : null,
      isWeekend: dow === 0 || dow === 6,
      index: dayIndexFromKey(day.dateKey),
      hours: day.hours,
      hasAfterMidnight: sumHours(day.hours, range(0, 4)) > 0,
    };
  });

  return {
    dayCount: days.length,
    total,
    hourly,
    share,
    quietStart,
    quietShare,
    quietCenter,
    restStart,
    restShare,
    peakHour,
    dayCenters,
    firstDateKey: days[0]?.dateKey || null,
    lastDateKey: days[days.length - 1]?.dateKey || null,
  };
};

// ---------------------------------------------
// 作息类型：统计推断
// ---------------------------------------------

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

const weekendDifference = (stats) => {
  const weekend = stats.dayCenters.filter((d) => d.isWeekend && d.center !== null).map((d) => d.center);
  const weekday = stats.dayCenters.filter((d) => !d.isWeekend && d.center !== null).map((d) => d.center);

  if (weekend.length < 2 || weekday.length < 4) return null;

  return {
    diff: average(weekend) - average(weekday),
    weekendDays: weekend.length,
    weekdayDays: weekday.length,
  };
};

const isRotating = (stats) => {
  if (stats.dayCount < 14) return false;

  const weeks = new Map();

  stats.dayCenters.forEach((day) => {
    if (day.index === null) return;
    const week = Math.floor(day.index / 7);
    const hourly = weeks.get(week) || new Array(24).fill(0);
    day.hours.forEach((count, hour) => {
      hourly[hour] += count;
    });
    weeks.set(week, hourly);
  });

  const usable = Array.from(weeks.values()).filter((hourly) => hourly.reduce((a, b) => a + b, 0) >= 8);

  if (usable.length < 3) return false;

  const within = usable.map((hourly) => resultantLength(hourly));
  const avgWithin = average(within.map((item) => item.r));

  const mx = average(within.map((item) => (item.r ? item.x / item.r : 0)));
  const my = average(within.map((item) => (item.r ? item.y / item.r : 0)));
  const between = Math.sqrt(mx * mx + my * my);

  return avgWithin >= 0.5 && between < 0.5;
};

export const classifyFromStats = (stats) => {
  if (!stats || stats.dayCount < MIN_DAYS || stats.total < MIN_MESSAGES) {
    return null;
  }

  const { share } = stats;

  const nightShare = share(range(0, 4));
  const lateShare = share([22, 23, 0, 1, 2]);
  const earlyShare = share([5, 6]);
  const dayShare = share(range(7, 21));
  const morningShare = share(range(6, 10));
  const lateNightAll = share([22, 23, 0, 1, 2, 3, 4]);

  if (
    stats.quietCenter >= 8 &&
    stats.quietCenter <= 17 &&
    stats.quietShare <= 0.08 &&
    nightShare >= 0.2
  ) {
    return 'night_shift';
  }

  if (isRotating(stats)) return 'rotating';

  if (lateShare >= 0.3 && morningShare <= 0.15) return 'night_owl';

  const weekend = weekendDifference(stats);
  if (weekend && Math.abs(weekend.diff) >= 2.5) return 'weekend_shift';

  if (earlyShare >= 0.12 && lateNightAll <= 0.06) return 'early_bird';

  if (dayShare >= 0.8 && nightShare <= 0.08) return 'daytime_regular';

  if (stats.quietShare >= 0.12) return 'flexible';

  return 'irregular';
};

// ---------------------------------------------
// 作息类型：Rhythm 里已有的日程（课表 / 工作）
// ---------------------------------------------

const toMinutes = (text) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const detectFromSchedules = (schedules = []) => {
  const list = Array.isArray(schedules) ? schedules : [];

  const nightWork = list.filter((item) => {
    if (item?.category !== 'work') return false;
    const start = toMinutes(item.startTime);
    const end = toMinutes(item.endTime);
    if (start === null || end === null) return false;
    return start >= 19 * 60 || end <= 7 * 60 || end < start;
  });

  if (nightWork.length >= 2) return 'night_shift';

  const courses = list.filter((item) => item?.category === 'course');

  if (courses.length >= 2) return 'student';

  return null;
};

// ---------------------------------------------
// 观察记录：由统计生成的候选
// ---------------------------------------------

const confidenceFor = (days) => (days >= 21 ? 'high' : days >= 12 ? 'medium' : 'low');

export const buildObservationCandidates = (stats) => {
  if (!stats || stats.dayCount < MIN_DAYS || stats.total < MIN_MESSAGES) {
    return [];
  }

  const list = [];
  const days = stats.dayCount;
  const confidence = confidenceFor(days);

  list.push({
    id: 'peak_hour',
    category: 'rhythm',
    text: `TA 猜你最常在${formatHour(stats.peakHour)}前后出现。`,
    evidenceDays: days,
    confidence,
  });

  const lateDays = stats.dayCenters.filter((d) => d.hasAfterMidnight).length;
  const lateRatio = lateDays / days;

  if (lateRatio >= 0.2) {
    list.push({
      id: 'late_night',
      category: 'rhythm',
      text: `大约有 ${Math.round(lateRatio * 100)}% 的日子，你过了 0 点还在。TA 猜你${lateRatio >= 0.7 ? '是夜里更清醒的人' : '偶尔会是夜里更清醒的人'}。`,
      evidenceDays: days,
      confidence,
    });
  }

  // 睡眠时段：先看统计有没有算出一段干净的安静时间；算不出来（比如活跃时间
  // 铺得很开，没有明显的长空档）就用"大多数人 0 点到 8 点睡觉"这个默认猜测
  // 兜底，等以后数据更多、更明确了再换成真实统计出来的时段。
  const hasCleanSleepGap = stats.quietShare <= 0.08;
  const sleepStart = hasCleanSleepGap ? stats.quietStart : 0;
  const sleepEnd = hasCleanSleepGap ? (stats.quietStart + 6) % 24 : 8;

  list.push({
    id: 'sleep_window',
    category: 'rhythm',
    text: hasCleanSleepGap
      ? `每天大概 ${sleepStart} 点到 ${sleepEnd} 点，你几乎不出现。TA 猜这段时间你大概率是在睡觉。`
      : '还没摸出你固定的睡眠时间，TA 先猜你大概 0 点到 8 点前后是在睡觉，等了解得更清楚了会跟着调整。',
    evidenceDays: days,
    confidence: hasCleanSleepGap ? confidence : 'low',
  });

  // 休息时段：跟睡眠时段错开的另一段小空档（比如午休、上班时间），
  // 明确说不一定是睡觉，避免和上面那条混在一起。
  if (stats.restStart !== null && stats.restShare <= 0.05) {
    const restEnd = (stats.restStart + 2) % 24;

    list.push({
      id: 'rest_window',
      category: 'rhythm',
      text: `另外每天大概 ${stats.restStart} 点到 ${restEnd} 点你也不太出现，但这段更像是短暂休息或者在忙别的事，不一定是在睡觉。`,
      evidenceDays: days,
      confidence,
    });
  }

  const weekend = days >= 14 ? weekendDifference(stats) : null;

  if (weekend && Math.abs(weekend.diff) >= 1.5) {
    const hours = Math.round(Math.abs(weekend.diff) * 10) / 10;

    list.push({
      id: 'weekend_shift',
      category: 'rhythm',
      text: `周末你比平时${weekend.diff > 0 ? '晚' : '早'}约 ${hours} 小时才出现。TA 猜周末是你更放松的节奏。`,
      evidenceDays: days,
      confidence,
    });
  }

  const firstIndex = stats.dayCenters[0]?.index;
  const lastIndex = stats.dayCenters[stats.dayCenters.length - 1]?.index;

  if (days >= 14 && firstIndex !== null && lastIndex !== null && lastIndex > firstIndex) {
    const span = lastIndex - firstIndex + 1;
    const missingRatio = 1 - days / span;

    if (missingRatio >= 0.3) {
      list.push({
        id: 'skip_days',
        category: 'rhythm',
        text: '你不是每天都会来，隔一两天不出现也很正常。TA 猜你的生活里有不少别的事要忙。',
        evidenceDays: days,
        confidence,
      });
    }
  }

  return list;
};

/*
 * 把新算出来的候选和已存的观察合并。
 * - 用户确认过 / 改过 / 关闭过的：一律不动，保留用户的决定。
 * - 还只是"TA 猜的"：用最新的文字和依据天数刷新；如果这次不再成立就去掉。
 * - 新出现的候选：加进来，状态为"TA 猜的"。
 */
export const mergeObservations = (existing = [], candidates = [], now = new Date().toISOString()) => {
  const saved = Array.isArray(existing) ? existing : [];
  const byId = new Map(candidates.map((item) => [item.id, item]));
  const result = [];
  const seen = new Set();

  saved.forEach((item) => {
    if (!item || !item.id) return;

    if (item.status && item.status !== 'guess') {
      result.push(item);
      seen.add(item.id);
      return;
    }

    const fresh = byId.get(item.id);

    if (fresh) {
      const changed =
        item.text !== fresh.text ||
        item.evidenceDays !== fresh.evidenceDays ||
        item.confidence !== fresh.confidence;

      result.push(
        changed
          ? {
              ...item,
              text: fresh.text,
              evidenceDays: fresh.evidenceDays,
              confidence: fresh.confidence,
              updatedAt: now,
            }
          : item
      );
      seen.add(item.id);
    }
  });

  candidates.forEach((item) => {
    if (seen.has(item.id)) return;

    result.push({
      id: item.id,
      text: item.text,
      category: item.category,
      source: 'inferred',
      evidenceDays: item.evidenceDays,
      confidence: item.confidence,
      status: 'guess',
      enabled: true,
      updatedAt: now,
    });
  });

  return result;
};

// ---------------------------------------------
// 汇总：给页面和提示词用的一份画像
// ---------------------------------------------

export const resolveRoutineProfile = ({ stored = null, stats = null, schedules = [] } = {}) => {
  const profile = stored && typeof stored === 'object' ? stored : {};
  const dayCount = stats?.dayCount || 0;

  let typeId = null;
  let source = null;

  if (profile.chronotypeSource === 'declared' && getRoutineType(profile.chronotype)) {
    typeId = profile.chronotype;
    source = 'declared';
  }

  if (!typeId) {
    const fromSchedule = detectFromSchedules(schedules);
    if (fromSchedule) {
      typeId = fromSchedule;
      source = 'schedule';
    }
  }

  if (!typeId) {
    const inferred = classifyFromStats(stats);
    if (inferred) {
      typeId = inferred;
      source = 'inferred';
    }
  }

  const type = getRoutineType(typeId);
  const customGuidance = typeof profile.guidance === 'string' ? profile.guidance.trim() : '';

  const observations = mergeObservations(
    profile.observations,
    buildObservationCandidates(stats)
  );

  const rawPortrait = profile.characterPortrait && typeof profile.characterPortrait === 'object'
    ? profile.characterPortrait
    : null;

  return {
    enabled: profile.enabled !== false,
    typeId: type ? type.id : null,
    typeLabel: type ? type.label : null,
    source: type ? source : null,
    guidance: type ? customGuidance || type.guidance : '',
    guidanceIsCustom: Boolean(type && customGuidance),
    declaredNote: typeof profile.declaredNote === 'string' ? profile.declaredNote.trim() : '',
    observations,
    dayCount,
    requiredDays: MIN_DAYS,
    daysLeft: Math.max(0, MIN_DAYS - dayCount),
    enoughMessages: (stats?.total || 0) >= MIN_MESSAGES,
    totalUserMessages: stats?.total || 0,
    peakHour: stats && stats.total ? stats.peakHour : null,
    // "更深一层的印象"：需要 AI 读聊天内容才能写出来，默认关闭，用户自己开启。
    portraitEnabled: rawPortrait?.enabled === true,
    portrait: rawPortrait?.trait
      ? {
          trait: rawPortrait.trait,
          reason: typeof rawPortrait.reason === 'string' ? rawPortrait.reason : '',
          status: rawPortrait.status || 'guess',
          generatedAt: rawPortrait.generatedAt || null,
          basedOnMessageCount: Number(rawPortrait.basedOnMessageCount) || 0,
        }
      : null,
  };
};

const SOURCE_TEXT = {
  declared: 'user 自己选的',
  schedule: '根据 user 记下的日程判断',
  inferred: '根据近期相处的时间分布推测，只是猜测',
};

const STATUS_TEXT = {
  guess: '猜测，尚未确认',
  confirmed: 'user 已确认',
  edited: 'user 亲自修改过',
};

export const buildRoutinePromptLines = (view) => {
  if (!view || !view.enabled) return [];

  const hasType = Boolean(view.typeId);
  const activeObservations = (view.observations || []).filter(
    (item) => item.enabled !== false && item.status !== 'closed' && item.text
  );

  const hasPortrait = Boolean(view.portraitEnabled && view.portrait?.trait);

  if (!view.declaredNote && !hasType && !hasPortrait) return [];

  const lines = ['【Almanac：user 的作息与相处方式】'];

  if (view.declaredNote) {
    lines.push(
      `user 亲口补充的说明（优先级最高，高于下面所有推测）：${view.declaredNote}`
    );
  }

  if (hasType) {
    lines.push(`作息类型：${view.typeLabel}（${SOURCE_TEXT[view.source] || '推测'}）`);

    if (view.guidance) {
      lines.push(`相处时请这样对待 user：${view.guidance}`);
    }
  }

  if (activeObservations.length) {
    lines.push('一些零散的观察：');
    activeObservations.forEach((item) => {
      lines.push(`- ${item.text}（${STATUS_TEXT[item.status] || STATUS_TEXT.guess}）`);
    });
  }

  if (view.portraitEnabled && view.portrait?.trait) {
    lines.push(
      `你（角色）自己对 user 的印象：${view.portrait.trait}${
        view.portrait.reason ? `（${view.portrait.reason}）` : ''
      }`,
      '这份印象是你自己写下的，请自然地保持这份印象的口吻，不要说"我记录过你是……"这类话。'
    );
  }

  lines.push(
    '这些只是帮助你更懂 user 的背景，请用自然的行动体现，比如说话的时机、语气和分寸。',
    '不要说出“我知道你的作息”“我观察到”“数据显示”这类话，也不要让 user 觉得被监视或被分析。',
    '推测只是推测；如果 user 此刻说的情况和这里不一样，以 user 当下说的为准。',
    '不要据此给出健康诊断或医学建议。'
  );

  return lines;
};

export default {
  ROUTINE_TYPES,
  MIN_DAYS,
  MIN_MESSAGES,
  getRoutineType,
  formatHour,
  analyzeUserRecords,
  classifyFromStats,
  detectFromSchedules,
  buildObservationCandidates,
  mergeObservations,
  resolveRoutineProfile,
  buildRoutinePromptLines,
};