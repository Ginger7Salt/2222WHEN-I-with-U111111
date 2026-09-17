import db from '../../../db';
import { generateCompanionProactiveMessage } from '../../../services/aiService';

import {
  getAlmanacConfig,
  getAlmanacRecords,
  getDateKey,
  recordAlmanacEvent,
  ALMANAC_EVENT_TYPES,
} from './almanacService';

import { getDueReminder, markReminderFired } from './almanacReminderService';

const schedulerState = {
  timer: null,
  processing: false,
};

const parseTime = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute, totalMinutes: hour * 60 + minute };
};

const hasSuccessfulGreetingToday = (records, eventType, dateKey) =>
  records.some(
    (record) =>
      record.eventType === eventType &&
      record.dateKey === dateKey &&
      record.metadata?.status === 'sent'
  );

const hasUserMessageToday = (records, dateKey) =>
  records.some(
    (record) =>
      record.eventType === ALMANAC_EVENT_TYPES.USER_MESSAGE &&
      record.dateKey === dateKey
  );

const getGreetingType = (config, now) => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const morning = config.morningGreetingEnabled
    ? parseTime(config.morningGreetingTime)
    : null;

  const night = config.nightGreetingEnabled
    ? parseTime(config.nightGreetingTime)
    : null;

  if (morning && currentMinutes >= morning.totalMinutes) {
    return { type: 'morning', eventType: ALMANAC_EVENT_TYPES.MORNING_GREETING };
  }

  if (night && currentMinutes >= night.totalMinutes) {
    return { type: 'night', eventType: ALMANAC_EVENT_TYPES.NIGHT_GREETING };
  }

  return null;
};

const processGreetingForChat = async (chat, config, records, now, dateKey) => {
  if (!config?.morningGreetingEnabled && !config?.nightGreetingEnabled) {
    return;
  }

  const greeting = getGreetingType(config, now);

  if (!greeting) return;

  if (config.skipIfUserChattedToday && hasUserMessageToday(records, dateKey)) {
    return;
  }

  if (hasSuccessfulGreetingToday(records, greeting.eventType, dateKey)) {
    return;
  }

  const generatedId = await generateCompanionProactiveMessage(chat.id);

  if (!generatedId) return;

  await recordAlmanacEvent({
    chatId: chat.id,
    characterId: chat.characterId,
    eventType: greeting.eventType,
    metadata: {
      source: 'almanac',
      greetingType: greeting.type,
      dateKey,
      status: 'sent',
      generatedMessageId: generatedId,
    },
  });
};

/*
 * 轻提醒：到点后让角色用自己的语气自然提一句，
 * 不是机械打卡通知。
 *
 * generateCompanionProactiveMessage 的第二个参数 intentHint 是可选的，
 * 不传时行为和早晚安完全一样；传了则会引导 AI 围绕这个具体意图开口。
 */
const processReminderForChat = async (chat) => {
  const dueReminder = await getDueReminder(chat.id);

  if (!dueReminder) return;

  const generatedId = await generateCompanionProactiveMessage(chat.id, {
    intentHint: `自然、轻松地提一句关于这件事：${dueReminder.content}`,
  });

  if (!generatedId) return;

  await markReminderFired(dueReminder.id, dueReminder.dateKey);
};

const processChat = async (chat) => {
  const config = await getAlmanacConfig(chat.id);
  const records = await getAlmanacRecords(chat.id);
  const now = new Date();
  const dateKey = getDateKey(now);

  await processGreetingForChat(chat, config, records, now, dateKey);
  await processReminderForChat(chat);
};

export const checkAlmanacGreetings = async () => {
  if (schedulerState.processing) return;

  schedulerState.processing = true;

  try {
    const chats = await db.chats.toArray();

    for (const chat of chats) {
      try {
        await processChat(chat);
      } catch (error) {
        console.warn('[Almanac] 问候/提醒检查失败：', error);
      }
    }
  } finally {
    schedulerState.processing = false;
  }
};

export const startAlmanacGreetingScheduler = () => {
  if (schedulerState.timer) return;

  void checkAlmanacGreetings();

  schedulerState.timer = window.setInterval(
    () => void checkAlmanacGreetings(),
    3 * 60 * 1000
  );
};

export const stopAlmanacGreetingScheduler = () => {
  if (schedulerState.timer) {
    window.clearInterval(schedulerState.timer);
    schedulerState.timer = null;
  }
};

export default {
  checkAlmanacGreetings,
  startAlmanacGreetingScheduler,
  stopAlmanacGreetingScheduler,
};