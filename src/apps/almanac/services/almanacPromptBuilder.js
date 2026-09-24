import {
  getAlmanacConfig,
  getAlmanacRecords,
  filterAlmanacRecordsByConfig,
  getDeviceTimeZone,
  getUserTimeZone,
  isUsingDeviceTimeZone,
} from './almanacService';

import { getRhythmObservation } from './almanacRhythmService';
import { getRoutineProfilePromptLines } from './almanacRoutineProfileService';
import { getUpcomingImportantDateForPrompt } from './almanacImportantDateService';

const MAX_PROMPT_LENGTH = 3400;

const formatUserLocalDateTime = (date, timeZone) => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
};

const formatDaysRemaining = (daysRemaining) => {
  if (daysRemaining === 0) return '就是今天';
  if (daysRemaining === 1) return '明天';
  return `还有 ${daysRemaining} 天`;
};

const appendRhythmContext = async ({ lines, chatId, config, records }) => {
  if (!config?.rhythmInferenceEnabled) {
    return;
  }

  const observation = await getRhythmObservation({ chatId, records });

  if (!observation?.ready || !observation.message) {
    return;
  }

  lines.push(
    '【Almanac：作息观察】',
    'user 允许观察这个聊天窗口的相处节律。',
    `近期相处观察：${observation.message}`,
    '这是一份温和、非确定性的观察素材，可以帮助你更自然地理解和贴近 user 的生活节奏。',
    '可以用你自己的语气、风格去表达这份理解，不需要照搬上面的措辞，也不需要解释这是怎么统计出来的。',
    '不要把这份观察说成确定的健康结论、睡眠结论或人格结论。'
  );
};

const appendImportantDateContext = async ({ lines, chatId, config, now }) => {
  const upcoming = await getUpcomingImportantDateForPrompt(chatId, {
    now,
    leadDays: config?.importantDateReminderLeadDays,
  });

  if (!upcoming) {
    return;
  }

  lines.push(
    '【Almanac：可自然参考的重要日期】',
    `user 记录的重要日子：${upcoming.title}`,
    `距离这个日子：${formatDaysRemaining(upcoming.daysRemaining)}`,
    '这个日期可以作为当前对话的轻量背景参考。',
    '当话题自然涉及时，可以顺带、轻柔地提及；话题不涉及时，优先围绕 user 当前的话题展开。',
    '可以用自然对话的方式提及，不需要说明这是 Almanac 记录或数据库信息。'
  );
};

const limitPromptLength = (text) => {
  if (text.length <= MAX_PROMPT_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_PROMPT_LENGTH)}\n`;
};

/**
 * 组装塞进 AI 对话系统提示词里的 Almanac 上下文。
 * 对外签名保持不变：getAlmanacPromptContext(chatId)
 */
export const getAlmanacPromptContext = async (chatId) => {
  if (!chatId) {
    return '';
  }

  try {
    const config = await getAlmanacConfig(chatId);
    const allRecords = await getAlmanacRecords(chatId);
    const records = filterAlmanacRecordsByConfig(allRecords, config);

    const timeZone = getUserTimeZone(config);
    const now = new Date();

    const lines = [
      '【Almanac：正在了解 user】',
      `user 所在地时间：${formatUserLocalDateTime(now, timeZone)}`,
    ];

    if (isUsingDeviceTimeZone(config)) {
      lines.push(
        `当前参考时区为设备时区：${getDeviceTimeZone()}`,
        '可以在 Almanac 设置中确认或选择 user 的所在地时间。'
      );
    }

        const routineLines = await getRoutineProfilePromptLines(chatId);

    if (routineLines.length) {
      lines.push(...routineLines);
    }

    await appendRhythmContext({ lines, chatId, config, records });
    await appendImportantDateContext({ lines, chatId, config, now });

    lines.push(
      '可以根据这些相处观察调整语气、回应速度、陪伴节奏和话题展开方式。',
      '可以尊重 user 自己选择的生活节奏，让 user 按舒服的方式相处。',
      '请自然地使用这些理解，不需要向 user 解释观察来源，也不需要提及 Almanac、数据库、统计或记录这类字眼。'
    );

    return limitPromptLength(`\n\n${lines.join('\n')}\n`);
  } catch (error) {
    console.warn('[Almanac] Prompt context skipped safely:', error);
    return '';
  }
};

export default getAlmanacPromptContext;