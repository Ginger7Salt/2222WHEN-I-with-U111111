// src/apps/hub/widgets/nextWorkflowRun.js
//
// 定时消息倒计时小组件用到的纯计算：给定一条工作流，算出它下一次
// 会真正触发的具体时间点。跟 workflowService.js 里 getDueWorkflows()
// 判断"现在算不算到期"用的是同一套规则（今天允许的星期 + 时间已到 +
// 今天没跑过），这里只是往前多算几天，找到下一次会触发的确切时刻，
// 而不是只判断布尔值。

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const getNextWorkflowOccurrence = (workflow, now = new Date()) => {
  if (!workflow?.enabled) return null;

  const match = TIME_PATTERN.exec(String(workflow.time || '').trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  const weekdays =
    Array.isArray(workflow.weekdays) && workflow.weekdays.length > 0
      ? workflow.weekdays
      : [0, 1, 2, 3, 4, 5, 6];

  const todayKey = now.toISOString().slice(0, 10);

  // 最多往后找 7 天，一定能碰到下一个符合星期设置的日子
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour,
      minute,
      0,
      0
    );

    if (!weekdays.includes(candidate.getDay())) continue;

    if (offset === 0) {
      const alreadyRanToday = workflow.lastRunDate === todayKey;
      if (candidate.getTime() <= now.getTime() || alreadyRanToday) continue;
    }

    return candidate;
  }

  return null;
};

// 在一批工作流里，找出下一次会最先触发的那一条
export const getNearestUpcomingWorkflow = (workflows = [], now = new Date()) => {
  let best = null;
  let bestOccurrence = null;

  workflows.forEach((workflow) => {
    const occurrence = getNextWorkflowOccurrence(workflow, now);
    if (occurrence && (!bestOccurrence || occurrence < bestOccurrence)) {
      best = workflow;
      bestOccurrence = occurrence;
    }
  });

  return best ? { workflow: best, occurrence: bestOccurrence } : null;
};

export const formatCountdownLabel = (targetDate, now = new Date()) => {
  const diffMs = targetDate.getTime() - now.getTime();
  if (diffMs <= 0) return '就是现在';

  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} 分钟后`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remMinutes = diffMinutes % 60;

  if (diffHours < 24) {
    return remMinutes > 0
      ? `${diffHours} 小时 ${remMinutes} 分后`
      : `${diffHours} 小时后`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天后`;
};

export default getNearestUpcomingWorkflow;