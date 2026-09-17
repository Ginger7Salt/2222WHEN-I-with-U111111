import { getSafeTimestamp, getAlmanacConfig } from './almanacService';

const MINIMUM_DAYS = 7;

/*
 * 每个时段准备一组不同风格的比喻（动物、植物、自然现象、物件混搭），
 * 每次随机挑一个，避免观察结果总是同一种表达，显得千篇一律。
 *
 * 这里只提供"素材"，不负责生成最终说给用户听的话——
 * 真正的语气和表达交给主对话的 AI 自己去发挥，
 * 这样既有趣多变，又不需要额外调用 AI 接口，保持这个功能本身的稳定性。
 */
const PERIOD_METAPHOR_POOL = {
  morning: [
    '云雀',
    '晨光',
    '第一班地铁',
    '刚煮好的咖啡',
    '拉开窗帘的那一下',
  ],
  afternoon: [
    '向阳的猫',
    '午后的风',
    '一杯温热的茶',
    '慢慢转动的吊扇',
    '晒着太阳的绿植',
  ],
  evening: [
    '路灯刚亮起的那一刻',
    '收工回家的脚步',
    '晚风',
    '厨房飘出的饭菜香',
    '窗外渐暗的天色',
  ],
  lateNight: [
    '猫头鹰',
    '深夜便利店的灯',
    '还没睡的星星',
    '安静运转的电脑风扇',
    '夜行的猫',
  ],
};

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

const getPeriodInfo = (hour) => {
  if (hour >= 5 && hour < 11) {
    return { key: 'morning', label: '早晨' };
  }

  if (hour >= 11 && hour < 18) {
    return { key: 'afternoon', label: '下午' };
  }

  if (hour >= 18 && hour < 24) {
    return { key: 'evening', label: '夜间' };
  }

  return { key: 'lateNight', label: '深夜' };
};

/**
 * 基于用户在这个聊天窗里活跃的小时分布，
 * 判断用户更常出现在哪个时段，并附带一个随机挑选的趣味比喻，
 * 供 AI 上下文自然使用（不直接生成成句，只提供素材）。
 */
export const getRhythmObservation = async ({ chatId, records = [] }) => {
  const config = await getAlmanacConfig(chatId);

  if (!config?.rhythmInferenceEnabled) {
    return {
      enabled: false,
      ready: false,
      message: '作息观察尚未开启。',
    };
  }

  const userRecords = records.filter(
    (record) => record.eventType === 'user_message'
  );

  const days = new Set(userRecords.map((record) => record.dateKey).filter(Boolean));

  if (days.size < MINIMUM_DAYS) {
    return {
      enabled: true,
      ready: false,
      sampleDays: days.size,
      requiredDays: MINIMUM_DAYS,
      message: `再相处 ${MINIMUM_DAYS - days.size} 天，才会形成较初步的观察。`,
    };
  }

  const hourCounts = new Map();

  userRecords.forEach((record) => {
    if (!Number.isInteger(record.localHour)) return;

    hourCounts.set(
      record.localHour,
      (hourCounts.get(record.localHour) || 0) + (Number(record.count) || 1)
    );
  });

  const rankedHours = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1]);
  const dominantHour = rankedHours[0]?.[0];

  const periodInfo = getPeriodInfo(dominantHour);
  const metaphor = pickRandom(PERIOD_METAPHOR_POOL[periodInfo.key]);

  const confidence = Math.min(
    0.95,
    0.35 + days.size / 30 + (rankedHours[0]?.[1] || 0) / 100
  );

  return {
    enabled: true,
    ready: true,
    sampleDays: days.size,
    dominantHour,
    period: periodInfo.label,
    metaphor,
    confidence: Number(confidence.toFixed(2)),
    observationStart:
      userRecords
        .map((record) => getSafeTimestamp(record.timestamp))
        .filter(Boolean)
        .sort((a, b) => a - b)[0] || null,
    message: `最近的相遇记录里，你似乎更常在${periodInfo.label}来到这里，像「${metaphor}」一样。`,
  };
};

export default {
  getRhythmObservation,
};