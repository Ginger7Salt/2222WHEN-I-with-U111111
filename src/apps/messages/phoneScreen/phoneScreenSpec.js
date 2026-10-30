// src/apps/messages/phoneScreen/phoneScreenSpec.js
//
// 角色发"自己手机截图"这个功能的数据层：纯函数，不碰数据库、不碰 React。
//
// AI 在回复里写一个 [PHONESHOT: ...] 标签，这里负责把标签里的文字解析成
// 一份结构化的 spec，存进消息的 metadata.spec，卡片再根据 spec 实时渲染
// 成一张手机截图（见 PhoneScreenCard.jsx）。
//
// 为什么用 "|" 和 ";;" 分隔的文本，而不是 JSON：aiService.js 里匹配标签的
// 正则是 /\[(TAG):\s*([^\]]+)\]/，标签内容里一旦出现右方括号 "]" 就会被
// 提前截断，JSON 的数组天然带 "]"，所以这里刻意只用不含方括号的分隔符。
//
// 标签格式：前 5 项是所有画面通用的固定字段，第 6 项起是各画面自己的内容：
//   [PHONESHOT: 画面 | 手机风格 | 时间 | 电量 | 主色 | 内容]
// 三种画面（kind）：
//   lockscreen  内容 = 通知1 ;; 通知2 ...      每条：应用名::标题::正文::时间(可选)
//   browser     内容 = 搜索1 ;; 搜索2 ...      每条：搜索词::时间(可选)
//   music       内容 = 歌名::歌手::歌词::进度::状态     （只有一首）
// "主色"在锁屏里是壁纸颜色，在浏览器里是强调色，在音乐里是封面和背景色。
//
// 解析一律"宽容但不放过危险值"：缺字段就用默认值，颜色/数字严格校验，
// 文字内容只会作为 React 文本节点渲染，不会当 HTML 解释，所以不需要
// HTML 净化器。解析失败（比如根本没有可显示的内容）返回 null，调用方
// 直接丢掉这个标签，不插入任何消息。

export const PHONE_SCREEN_MESSAGE_TYPE = 'phone_screen';

export const PHONE_SCREEN_KIND_LOCKSCREEN = 'lockscreen';
export const PHONE_SCREEN_KIND_BROWSER = 'browser';
export const PHONE_SCREEN_KIND_MUSIC = 'music';

export const PHONE_SCREEN_STYLE_IOS = 'ios';
export const PHONE_SCREEN_STYLE_ANDROID = 'android';

export const DEFAULT_WALLPAPER_COLOR = '#3b4a6b';

const MAX_NOTIFICATIONS = 6;
const MAX_SEARCHES = 8;
const MAX_APP_LENGTH = 12;
const MAX_TITLE_LENGTH = 24;
const MAX_BODY_LENGTH = 70;
const MAX_NOTICE_TIME_LENGTH = 10;
const MAX_QUERY_LENGTH = 40;
const MAX_SONG_LENGTH = 30;
const MAX_ARTIST_LENGTH = 20;
const MAX_LYRIC_LENGTH = 40;
const DEFAULT_MUSIC_PROGRESS = 35;

// 按字符（而不是 UTF-16 码元）截断，避免把一个字符劈成两半。
const clean = (value, maxLength) => {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return Array.from(text).slice(0, maxLength).join('');
};

const splitItems = (text) =>
  String(text || '').split(/\s*(?:;;|；；)\s*/);

const splitFields = (text) =>
  String(text || '').split(/::|：：/).map((part) => part.trim());

const normalizeKind = (value) => {
  const text = clean(value, 20).toLowerCase();

  if (text === 'lockscreen' || text === 'lock' || text === '锁屏') {
    return PHONE_SCREEN_KIND_LOCKSCREEN;
  }

  if (text === 'browser' || text === 'search' || text === '浏览器' || text === '搜索') {
    return PHONE_SCREEN_KIND_BROWSER;
  }

  if (text === 'music' || text === 'player' || text === '音乐' || text === '播放器') {
    return PHONE_SCREEN_KIND_MUSIC;
  }

  return null;
};

const normalizeStyle = (value) => {
  const text = clean(value, 20).toLowerCase();

  if (text.includes('android') || text.includes('安卓')) {
    return PHONE_SCREEN_STYLE_ANDROID;
  }

  return PHONE_SCREEN_STYLE_IOS;
};

// 只接受 HH:MM（24小时制）；不合法就返回空串，由卡片退回用消息自己的时间。
const normalizeTime = (value) => {
  const match = clean(value, 10).match(/^(\d{1,2})[:：](\d{2})$/);

  if (!match) return '';

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return '';

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const normalizeBattery = (value) => {
  const digits = clean(value, 10).replace(/[^\d]/g, '');

  if (!digits) return null;

  const number = Number(digits);

  if (!Number.isFinite(number) || number < 1) return null;

  return Math.min(100, number);
};

// 严格只认 #rgb / #rrggbb，不让任何别的字符串进到 CSS 变量里。
const normalizeColor = (value) => {
  const text = clean(value, 12);

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return text;

  return DEFAULT_WALLPAPER_COLOR;
};

const parseNotifications = (itemsText) => {
  const result = [];

  splitItems(itemsText).forEach((rawItem) => {
    if (result.length >= MAX_NOTIFICATIONS) return;

    const parts = splitFields(rawItem);

    if (!parts.some(Boolean)) return;

    let app = '通知';
    let title = '';
    let body = '';
    let time = '';

    if (parts.length === 1) {
      [body] = parts;
    } else if (parts.length === 2) {
      [app, body] = parts;
    } else {
      [app, title, body, time = ''] = parts;
    }

    const notification = {
      app: clean(app, MAX_APP_LENGTH) || '通知',
      title: clean(title, MAX_TITLE_LENGTH),
      body: clean(body, MAX_BODY_LENGTH),
      time: clean(time, MAX_NOTICE_TIME_LENGTH),
    };

    if (!notification.title && !notification.body) return;

    result.push(notification);
  });

  return result;
};

const parseSearches = (itemsText) => {
  const result = [];

  splitItems(itemsText).forEach((rawItem) => {
    if (result.length >= MAX_SEARCHES) return;

    const [query = '', time = ''] = splitFields(rawItem);
    const cleanQuery = clean(query, MAX_QUERY_LENGTH);

    if (!cleanQuery) return;

    result.push({ query: cleanQuery, time: clean(time, MAX_NOTICE_TIME_LENGTH) });
  });

  return result;
};

// 音乐只取第一首：歌名::歌手::歌词::进度::状态
const parseTrack = (itemsText) => {
  const firstItem = splitItems(itemsText).find((item) => item.trim());

  if (!firstItem) return null;

  const [title = '', artist = '', lyric = '', progress = '', state = ''] =
    splitFields(firstItem);

  const cleanTitle = clean(title, MAX_SONG_LENGTH);

  if (!cleanTitle) return null;

  const progressDigits = clean(progress, 10).replace(/[^\d]/g, '');
  const progressNumber = progressDigits
    ? Math.min(100, Number(progressDigits))
    : DEFAULT_MUSIC_PROGRESS;

  const stateText = clean(state, 20).toLowerCase();
  const isPaused = stateText.includes('暂停') || stateText.includes('pause');

  return {
    title: cleanTitle,
    artist: clean(artist, MAX_ARTIST_LENGTH) || '未知歌手',
    lyric: clean(lyric, MAX_LYRIC_LENGTH),
    progress: progressNumber,
    playing: !isPaused,
  };
};

/**
 * 解析 [PHONESHOT: ...] 标签里的文字。
 * 返回 spec，或者 null（格式不对/没有可显示的内容）。
 */
export const parsePhoneScreenPayload = (rawPayload) => {
  const fields = String(rawPayload || '').split('|');

  // 前5项是固定字段，后面全部算"画面内容"（把误拆开的 "|" 拼回去）。
  if (fields.length < 6) return null;

  const kind = normalizeKind(fields[0]);

  if (!kind) return null;

  const itemsText = fields.slice(5).join('|');

  const spec = {
    version: 1,
    kind,
    style: normalizeStyle(fields[1]),
    time: normalizeTime(fields[2]),
    battery: normalizeBattery(fields[3]),
    wallpaper: normalizeColor(fields[4]),
  };

  if (kind === PHONE_SCREEN_KIND_LOCKSCREEN) {
    const notifications = parseNotifications(itemsText);
    if (notifications.length === 0) return null;
    return { ...spec, notifications };
  }

  if (kind === PHONE_SCREEN_KIND_BROWSER) {
    const searches = parseSearches(itemsText);
    if (searches.length === 0) return null;
    return { ...spec, searches };
  }

  const track = parseTrack(itemsText);
  if (!track) return null;
  return { ...spec, track };
};

/**
 * spec 是不是有足够的内容可以画出来（给卡片用，防止存档里的旧数据或
 * 损坏数据让卡片崩掉）。
 */
export const isPhoneScreenSpecRenderable = (spec) => {
  if (!spec || typeof spec !== 'object') return false;

  if (spec.kind === PHONE_SCREEN_KIND_LOCKSCREEN) {
    return Array.isArray(spec.notifications) && spec.notifications.length > 0;
  }

  if (spec.kind === PHONE_SCREEN_KIND_BROWSER) {
    return Array.isArray(spec.searches) && spec.searches.length > 0;
  }

  if (spec.kind === PHONE_SCREEN_KIND_MUSIC) {
    return Boolean(spec.track?.title);
  }

  return false;
};

/**
 * 把 spec 压成一段纯文字，写进消息的 content。
 * 记忆系统只要 content 非空就会收录（见 memorySignals.js 的
 * isUsableMessage），所以这段文字同时承担"让记忆知道发过什么"和
 * "喂给 AI 的历史"两件事，不需要给记忆系统加任何新代码。
 */
export const buildPhoneScreenSummary = (spec) => {
  if (!isPhoneScreenSpecRenderable(spec)) return '';

  const timePart = spec.time ? `手机时间 ${spec.time}，` : '';
  const batteryPart = spec.battery ? `电量 ${spec.battery}%，` : '';

  if (spec.kind === PHONE_SCREEN_KIND_LOCKSCREEN) {
    const notices = spec.notifications
      .map((item) => {
        const head = item.title ? `${item.app}·${item.title}` : item.app;
        return item.body ? `${head}：${item.body}` : head;
      })
      .join('；');

    return `[手机锁屏截图] ${timePart}${batteryPart}通知栏显示：${notices}`;
  }

  if (spec.kind === PHONE_SCREEN_KIND_BROWSER) {
    const searches = spec.searches
      .map((item) => (item.time ? `${item.query}（${item.time}）` : item.query))
      .join('；');

    return `[手机浏览器截图] ${timePart}${batteryPart}最近的搜索记录：${searches}`;
  }

  const { track } = spec;
  const stateText = track.playing ? '正在播放' : '已暂停';
  const lyricPart = track.lyric ? `，当前歌词栏：${track.lyric}` : '';

  return `[手机音乐播放器截图] ${timePart}${batteryPart}${stateText}《${track.title}》- ${track.artist}，进度 ${track.progress}%${lyricPart}`;
};

/**
 * 喂给 AI 的历史里，这类消息怎么描述（给 aiService.js 的
 * formatMsgContentForPrompt 用）。
 */
export const formatPhoneScreenForPrompt = (message) =>
  `[你给对方发了一张自己手机的截图。${message?.content || ''}]`;

export default {
  PHONE_SCREEN_MESSAGE_TYPE,
  parsePhoneScreenPayload,
  isPhoneScreenSpecRenderable,
  buildPhoneScreenSummary,
  formatPhoneScreenForPrompt,
};