// src/apps/messages/work/workGreetingService.js
//
// work 聊天窗的"主动开场白"：纯本地计算，不调用 AI，每次进入聊天窗都
// 触发（不走"一天一次"去重）。内容 = 时段问候语 + 工作本本摘要（待办/
// 提醒数量）。
//
// 工作本本摘要目前按 characterId（全局共享的 work 助理身份）统计，
// 没有按 chatId 再细分——这是跟现有 todos 表的既有用法（AI 系统提示词
// 里的 todoText 也是按 characterId 过滤，见 aiService.js）保持一致的
// 简化，不是"每个 work 聊天窗各自一份待办"的完整实现；如果以后要做到
// 聊天窗级隔离，需要先给 todos 表补上 chatId 字段并改掉这里和
// aiService.js 两处的过滤逻辑。

import db from '../../../db';

const GREETING_VARIANTS = {
  earlyMorning: ['这么早就醒了，今天也要加油', '早起的效率感觉不错'],
  morning: ['上午好，效率感觉还不错的样子', '早上好，今天有什么计划'],
  noon: ['中午好，记得吃饭', '午间好，歇一会儿再继续也行'],
  afternoon: ['下午好，进度怎么样了', '下午这个点，正好推进一下'],
  evening: ['晚上好，今天过得如何', '傍晚好，还有精力处理点事吗'],
  night: ['这么晚还在忙呀', '夜深了，别太拼'],
};

const pickVariant = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * 按当前小时数挑一句问候语。纯本地计算，不走 AI。
 */
export const getGreetingLine = (now = new Date()) => {
  const hour = now.getHours();

  if (hour >= 5 && hour < 8) return pickVariant(GREETING_VARIANTS.earlyMorning);
  if (hour >= 8 && hour < 11) return pickVariant(GREETING_VARIANTS.morning);
  if (hour >= 11 && hour < 13) return pickVariant(GREETING_VARIANTS.noon);
  if (hour >= 13 && hour < 18) return pickVariant(GREETING_VARIANTS.afternoon);
  if (hour >= 18 && hour < 22) return pickVariant(GREETING_VARIANTS.evening);
  return pickVariant(GREETING_VARIANTS.night);
};

/**
 * 工作本本摘要：逾期数 / 今天到期数 / 待处理总数。
 */
export const getWorkNotebookSummary = async (characterId) => {
  if (!characterId) {
    return { overdueCount: 0, dueTodayCount: 0, pendingCount: 0 };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  try {
    const allTodos = await db.todos
      .where('characterId')
      .equals(characterId)
      .toArray();

    const pending = allTodos.filter((todo) => !todo.isCompleted);

    let overdueCount = 0;
    let dueTodayCount = 0;

    for (const todo of pending) {
      if (!todo.dueDate) continue;
      const due = new Date(todo.dueDate);
      if (Number.isNaN(due.getTime())) continue;

      if (due < now) {
        overdueCount += 1;
      } else if (due >= startOfToday && due < startOfTomorrow) {
        dueTodayCount += 1;
      }
    }

    return {
      overdueCount,
      dueTodayCount,
      pendingCount: pending.length,
    };
  } catch (error) {
    console.error('[WorkGreeting] 读取工作本本摘要失败：', error);
    return { overdueCount: 0, dueTodayCount: 0, pendingCount: 0 };
  }
};

/**
 * 拼成一行摘要文案，overdueCount 部分单独返回，方便外面用强调色标出来。
 * 没有任何待办/提醒时返回 null，调用方据此决定要不要整行都不显示。
 */
export const buildSummaryParts = ({ overdueCount, dueTodayCount, pendingCount }) => {
  if (!pendingCount) return null;

  const notDueSoonCount = Math.max(pendingCount - overdueCount - dueTodayCount, 0);

  const segments = [];
  if (overdueCount > 0) {
    segments.push({ text: `${overdueCount} 件逾期`, hot: true });
  }
  if (dueTodayCount > 0) {
    segments.push({ text: `今天还有 ${dueTodayCount} 件要做`, hot: false });
  }
  if (overdueCount === 0 && dueTodayCount === 0 && notDueSoonCount > 0) {
    segments.push({ text: `共 ${notDueSoonCount} 件待处理`, hot: false });
  }

  return segments.length > 0 ? segments : null;
};

export default {
  getGreetingLine,
  getWorkNotebookSummary,
  buildSummaryParts,
};