// 角色"暂时不在线"状态的纯计算。
//
// 只依赖聊天窗（chat 记录）上的 awaySettings 和当前时间：
// 不读写数据库、不启动定时器、不订阅任何事件，所以可以放心地在
// 任何地方频繁调用（发消息、拨号、来电调度……）。
//
// chat.awaySettings 的形状：
// {
//   enabled: boolean,
//   windows: [{ id, days: [0-6], start: 'HH:MM', end: 'HH:MM' }],
//   autoReplyText: string
// }
// days 用 JS 的 getDay() 约定：0 = 周日，1 = 周一 ... 6 = 周六。
// end 早于 start 表示跨午夜（例如 22:00 到 07:00），归属于 start 所在的那一天。

export const AWAY_RETURN_TYPE = 'away_return';
export const AWAY_MAX_WINDOWS = 3;
export const AWAY_TEXT_MAX_LENGTH = 60;
export const DEFAULT_AUTO_REPLY_TEXT = '现在暂时不在线，晚点回你。';

// 上线后自动回复时，附加在这一次请求提示词末尾的说明。
export const AWAY_RETURN_SYSTEM_NOTE = '【状态提示】你刚结束了一段暂时不方便回复的时间，现在回到了聊天里。'
  + '用户在你不在线的时候发来了消息，请像刚忙完回来那样，自然地回复这些消息。'
  + '聊天记录里标注为“自动回复”的内容是系统按设置自动发出的，并不是你亲口说的话，'
  + '不需要逐句回应，也不必大篇幅解释自己刚才在忙什么。';

// 首尾相接的时段（09:00-12:00 和 12:00-18:00）要顺延到真正空出来的时刻，
// 这里限制最多顺延几次，防止异常数据造成死循环。
const CHAIN_LIMIT = 8;

const NOT_AWAY = Object.freeze({ away: false, until: null, source: null });

const HM_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const pad = (value) => String(value).padStart(2, '0');

export const parseHm = (value) => {
  const matched = HM_PATTERN.exec(String(value || '').trim());
  if (!matched) return null;
  return Number(matched[1]) * 60 + Number(matched[2]);
};

const createWindowId = () => `w_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const createEmptyAwayWindow = () => ({
  id: createWindowId(),
  days: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '18:00',
});

const normalizeWindow = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const days = Array.from(new Set(
    (Array.isArray(raw.days) ? raw.days : [])
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )).sort((a, b) => a - b);

  const start = parseHm(raw.start);
  const end = parseHm(raw.end);

  if (days.length === 0 || start === null || end === null || start === end) {
    return null;
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createWindowId(),
    days,
    start: `${pad(Math.floor(start / 60))}:${pad(start % 60)}`,
    end: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
  };
};

export const normalizeAwaySettings = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};

  return {
    enabled: source.enabled === true,
    windows: (Array.isArray(source.windows) ? source.windows : [])
      .map(normalizeWindow)
      .filter(Boolean)
      .slice(0, AWAY_MAX_WINDOWS),
    autoReplyText: String(source.autoReplyText || '').trim().slice(0, AWAY_TEXT_MAX_LENGTH),
  };
};

const atMinutes = (base, dayOffset, minutes) => {
  const result = new Date(base);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + dayOffset);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
};

// 在 date 这一刻，返回"当前所处离线时段的结束时间"；不在任何时段内返回 null。
// 多个时段重叠时取结束最晚的那个。
const evaluateAt = (windows, date) => {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const today = date.getDay();
  const yesterday = (today + 6) % 7;

  let latestEnd = null;

  for (const win of windows) {
    const start = parseHm(win.start);
    const end = parseHm(win.end);

    if (start === null || end === null || start === end) continue;

    let endDate = null;

    if (start < end) {
      if (win.days.includes(today) && minutes >= start && minutes < end) {
        endDate = atMinutes(date, 0, end);
      }
    } else if (win.days.includes(today) && minutes >= start) {
      endDate = atMinutes(date, 1, end);
    } else if (win.days.includes(yesterday) && minutes < end) {
      endDate = atMinutes(date, 0, end);
    }

    if (endDate && (!latestEnd || endDate > latestEnd)) {
      latestEnd = endDate;
    }
  }

  return latestEnd;
};

/**
 * 角色现在是不是"暂时不在线"。
 * 返回 { away, until, source }；until 是真正恢复在线的时刻（Date）。
 * 以后如果增加"角色自己设为离线"，在这里再加一个来源分支即可。
 */
export const getAwayState = (chat, now = new Date()) => {
  if (!chat?.awaySettings?.enabled) return NOT_AWAY;

  const settings = normalizeAwaySettings(chat.awaySettings);

  if (!settings.enabled || settings.windows.length === 0) return NOT_AWAY;

  let end = evaluateAt(settings.windows, now);

  if (!end) return NOT_AWAY;

  for (let index = 0; index < CHAIN_LIMIT; index += 1) {
    const next = evaluateAt(settings.windows, end);
    if (!next) break;
    end = next;
  }

  return { away: true, until: end, source: 'schedule' };
};

export const getAutoReplyText = (awaySettings) => (
  normalizeAwaySettings(awaySettings).autoReplyText || DEFAULT_AUTO_REPLY_TEXT
);

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

// 把"恢复在线的时刻"写成一句短文案：同一天只写 18:00，第二天写"明天 08:00"。
export const formatAwayUntil = (until, now = new Date()) => {
  if (!(until instanceof Date) || Number.isNaN(until.getTime())) return '';

  const hm = `${pad(until.getHours())}:${pad(until.getMinutes())}`;
  const dayDiff = Math.round((startOfDay(until) - startOfDay(now)) / 86400000);

  if (dayDiff <= 0) return hm;
  if (dayDiff === 1) return `明天 ${hm}`;

  return `${until.getMonth() + 1}/${until.getDate()} ${hm}`;
};