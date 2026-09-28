import db from '../../../db';

/*
 * 趣味时间换算素材池：
 * 把"聊天大概花费的时长"换算成生活化的比喻。
 * 每次随机挑一个适用的单位，避免总是同一种说法。
 */
const TIME_UNITS = [
  { label: '一首歌', minutes: 4 },
  { label: '一集短剧', minutes: 20 },
  { label: '一杯奶茶从买到喝完', minutes: 15 },
  { label: '一场电影', minutes: 110 },
  { label: '一集综艺', minutes: 60 },
  { label: '一趟地铁通勤', minutes: 40 },
  { label: '一次午睡', minutes: 30 },
];

// 粗略估算：每条消息（含阅读与输入）平均花费的秒数。
// 这是一个用于制造"有感觉的换算"的估算值，不追求精确。
const AVERAGE_SECONDS_PER_MESSAGE = 25;

const getDayCount = (fromTimestamp, toTimestamp) => {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diff = toTimestamp - fromTimestamp;

  return Math.max(1, Math.floor(diff / oneDayMs) + 1);
};

const pickFunFact = (totalMinutes) => {
  if (totalMinutes <= 0) {
    return null;
  }

  // 只挑选"单位时长 <= 总时长"的合理换算，避免出现"0.02 首歌"这种尴尬结果。
  const applicableUnits = TIME_UNITS.filter(
    (unit) => unit.minutes <= totalMinutes
  );

  if (applicableUnits.length === 0) {
    return {
      label: TIME_UNITS[0].label,
      times: null,
      text: `我们的对话还不算长，但已经在慢慢积累啦。`,
    };
  }

  const unit = applicableUnits[Math.floor(Math.random() * applicableUnits.length)];
  const times = Math.max(1, Math.round(totalMinutes / unit.minutes));

  return {
    label: unit.label,
    times,
    text: `这些对话加起来，大概是${times}个「${unit.label}」的时间。`,
  };
};

/**
 * 计算某个聊天窗的陪伴统计：相识天数、消息总数、一个随机的趣味时长换算。
 * 直接读取 db.messages + db.archivedMessages 现算现出（归档只是把消息搬了
 * 位置，不是删除，所以两张表都要算），不依赖任何 Almanac 记录表，
 * 不会给发消息主流程增加额外负担。
 */
export const getCompanionshipStats = async (chatId) => {
  if (!chatId) {
    return null;
  }

  // 归档功能会把旧消息从 messages 表物理搬到 archivedMessages 表（不是打标记），
  // 所以这里的"留下的话"必须把两张表都算进去，否则归档过的聊天窗会显得比
  // 实际"变短"——这也是导致本统计和里程碑成就（同样会漏算归档消息，但因为
  // 点亮后永久缓存所以不会倒退）看起来数字不同步的原因。
  let messages = [];
  let archivedMessages = [];

  try {
    [messages, archivedMessages] = await Promise.all([
      db.messages.where('chatId').equals(chatId).toArray(),
      db.archivedMessages
        ? db.archivedMessages.where('chatId').equals(chatId).toArray()
        : [],
    ]);
  } catch (error) {
    console.warn('[Almanac] 读取陪伴统计失败：', error);
    return null;
  }

  const allMessages = [...messages, ...archivedMessages];

  if (!allMessages.length) {
    return {
      daysTogether: 0,
      totalMessageCount: 0,
      funFact: null,
    };
  }

  const timestamps = allMessages
    .map((message) => new Date(message.timestamp).getTime())
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) {
    return {
      daysTogether: 0,
      totalMessageCount: allMessages.length,
      funFact: null,
    };
  }

  const firstTimestamp = Math.min(...timestamps);
  const now = Date.now();

  const daysTogether = getDayCount(firstTimestamp, now);
  const totalMessageCount = allMessages.length;

  const estimatedMinutes =
    (totalMessageCount * AVERAGE_SECONDS_PER_MESSAGE) / 60;

  const funFact = pickFunFact(estimatedMinutes);

  return {
    daysTogether,
    totalMessageCount,
    firstTimestamp,
    funFact,
  };
};

export default {
  getCompanionshipStats,
};