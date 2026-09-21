// 角色"暂时不在线"状态的纯计算。
//
// 离线只由角色在聊天里自己决定（回复末尾带一个隐藏标签），离线多久由代码随机取，
// 没有固定时间表。所有函数都只依赖聊天窗（chat 记录）上的字段和当前时间：
// 不读写数据库、不启动定时器、不订阅任何事件，可以放心地在任何地方频繁调用。
//
// chat 记录上相关的字段：
//   awaySettings        { allowCharacterAway: boolean }  用户是否允许这个角色自己离线，默认关
//   awayUntil           ISO 字符串，这一次离线到什么时候结束；没有离线时为空
//   awayAutoReplyText   这一次离线期间的自动回复（角色自己写的）
//   awayLog             [{ start, end }]  最近几次离线的记录，用来限制频率
//   awayLastAutoReplyFor 这一次离线是否已经出过自动回复（用 awayUntil 当标识）

export const AWAY_RETURN_TYPE = 'away_return';
export const AWAY_TEXT_MAX_LENGTH = 60;
export const DEFAULT_AUTO_REPLY_TEXT = '现在暂时不在线，晚点回你。';

// 离线时长：在这个范围内随机，偏短的更常见。
export const AWAY_MIN_MINUTES = 20;
export const AWAY_MAX_MINUTES = 120;

// 频率限制（每个聊天窗单独计算）。
export const AWAY_MAX_PER_DAY = 2;            // 任意连续 24 小时内最多几次
export const AWAY_MIN_GAP_MINUTES = 240;      // 上一次结束后，至少隔多久才能再离线
export const AWAY_LOG_LIMIT = 8;              // 最多保留几条离线记录

// 每次回复时，"把离线这个选项交给角色"的概率。
// 大多数回复根本不会提到离线，提示词里也就一个字都不多。
export const AWAY_OFFER_PROBABILITY = 0.25;

// 上线后自动回复时，附加在这一次请求提示词末尾的说明。
export const AWAY_RETURN_SYSTEM_NOTE = '【状态提示】你刚结束了一段暂时不方便回复的时间，现在回到了聊天里。'
  + '用户在你不在线的时候发来了消息，请像刚忙完回来那样，自然地回复这些消息。'
  + '聊天记录里标注为“自动回复”的内容是系统按设置自动发出的，并不是你亲口说的话，'
  + '不需要逐句回应，也不必大篇幅解释自己刚才在忙什么。';

// 允许角色自己离线、并且这一次被选中时，附加在提示词里的说明。
export const AWAY_OFFER_NOTE = [
  '【可选行为：暂时离线】',
  '如果聊到某个很自然的地方，你确实要去忙自己的事（比如开会、洗澡、吃饭、开车、睡一小会儿），你可以让自己暂时离线一段时间。',
  '做法：在这次回复的最后另起一行，写 [AWAY: 一句自动回复]。例如：[AWAY: 在忙，晚点回你]',
  '规则：',
  '1. 这是很少使用的行为。大多数时候不要用，只有情境自然需要时才用；拿不准就不用。',
  '2. 括号里是你离线期间，用户再发消息时系统代你发出的一句话。要用你自己的口吻，说明你去忙什么就行，不要写具体多久或几点回来（离线多久由系统决定）。',
  '3. 正文里也不要说具体的时长或几点回来，只说你要去忙什么、晚点再找对方就好。',
  '4. 一次回复最多用一次，并且不能与 SCHEDULE_MESSAGE、OFFLINE_INVITE 同时使用。',
  '5. 这行标签不会被用户看到。',
].join('\n');

const NOT_AWAY = Object.freeze({ away: false, until: null, source: null });

const pad = (value) => String(value).padStart(2, '0');

export const normalizeAwaySettings = (raw) => ({
  allowCharacterAway: Boolean(raw && typeof raw === 'object' && raw.allowCharacterAway === true),
});

export const isAwayAllowed = (chat) => normalizeAwaySettings(chat?.awaySettings).allowCharacterAway;

/**
 * 角色现在是不是"暂时不在线"。
 * 返回 { away, until, source }；until 是恢复在线的时刻（Date）。
 */
export const getAwayState = (chat, now = new Date()) => {
  if (!chat?.awayUntil) return NOT_AWAY;

  const until = new Date(chat.awayUntil);

  if (Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) return NOT_AWAY;

  return { away: true, until, source: 'character' };
};

/**
 * 随机取一个离线时长（分钟）：范围 AWAY_MIN_MINUTES 到 AWAY_MAX_MINUTES，
 * 对随机数取平方让偏短的更常见（中位数大约 45 分钟），并取整到 5 分钟。
 */
export const pickAwayMinutes = (random = Math.random) => {
  const unit = Math.min(Math.max(Number(random()) || 0, 0), 1);
  const raw = AWAY_MIN_MINUTES + (AWAY_MAX_MINUTES - AWAY_MIN_MINUTES) * unit * unit;
  const rounded = Math.round(raw / 5) * 5;

  return Math.min(Math.max(rounded, AWAY_MIN_MINUTES), AWAY_MAX_MINUTES);
};

// 同一时间最多允许几个聊天窗离线：开启数量的一半（向下取整），至少允许 1 个。
export const maxSimultaneousAway = (enabledCount) => (
  Math.max(1, Math.floor(Math.max(0, Number(enabledCount) || 0) / 2))
);

const normalizeAwayLog = (raw) => (
  (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      start: new Date(item?.start).getTime(),
      end: new Date(item?.end).getTime(),
    }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end))
);

/** 追加一条离线记录，只保留最近 AWAY_LOG_LIMIT 条。 */
export const appendAwayLog = (rawLog, start, end) => (
  [
    ...(Array.isArray(rawLog) ? rawLog : []),
    { start: start.toISOString(), end: end.toISOString() },
  ].slice(-AWAY_LOG_LIMIT)
);

/**
 * 现在这个聊天窗能不能开始一次新的离线（不含随机概率和用户情绪判断）。
 * allChats 是所有聊天窗，用来判断"同一时间不会全部离线"。
 * 返回 { ok, reason }。
 */
export const checkAwayLimits = ({ chat, allChats = [], now = new Date() }) => {
  if (!isAwayAllowed(chat)) return { ok: false, reason: 'not_allowed' };
  if (getAwayState(chat, now).away) return { ok: false, reason: 'already_away' };

  const nowMs = now.getTime();
  const log = normalizeAwayLog(chat.awayLog);
  const dayAgo = nowMs - 24 * 60 * 60 * 1000;

  if (log.filter((item) => item.start >= dayAgo).length >= AWAY_MAX_PER_DAY) {
    return { ok: false, reason: 'daily_limit' };
  }

  const lastEnd = log.reduce((latest, item) => Math.max(latest, item.end), 0);

  if (lastEnd && nowMs - lastEnd < AWAY_MIN_GAP_MINUTES * 60 * 1000) {
    return { ok: false, reason: 'cooldown' };
  }

  const others = allChats.filter((item) => item && item.id !== chat.id && isAwayAllowed(item));
  const enabledCount = others.length + 1;
  const awayOthers = others.filter((item) => getAwayState(item, now).away).length;

  if (awayOthers >= maxSimultaneousAway(enabledCount)) {
    return { ok: false, reason: 'too_many_away' };
  }

  return { ok: true, reason: '' };
};

const AWAY_TAG_PATTERN = /\[\s*AWAY\s*(?:[:：]\s*([^\]]*))?\]/gi;

/**
 * 从回复里取出 [AWAY: 自动回复] 标签。标签一律从正文里去掉（不管这次有没有生效），
 * 避免标签文字漏给用户。返回 { content, away }，away 为 null 或 { autoReplyText }。
 */
export const extractAwayDirective = (rawText) => {
  let matched = null;

  const content = String(rawText || '')
    .replace(AWAY_TAG_PATTERN, (fullMatch, payload = '') => {
      if (!matched) {
        matched = {
          autoReplyText: String(payload || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, AWAY_TEXT_MAX_LENGTH),
        };
      }

      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { content, away: matched };
};

/** 这一次离线的自动回复：角色自己写的；没有则用通用文案。 */
export const getAutoReplyText = (chat) => (
  String(chat?.awayAutoReplyText || '').trim().slice(0, AWAY_TEXT_MAX_LENGTH) || DEFAULT_AUTO_REPLY_TEXT
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