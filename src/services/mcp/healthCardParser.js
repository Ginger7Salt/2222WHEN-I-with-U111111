// src/services/mcp/healthCardParser.js
//
// 负责从 get_health_data 返回的 Markdown 文本中提取 Apple Health 关键指标

export const parseHealthMarkdown = (text = '') => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // 1. 睡眠数据
  //
  // 支持以下几种格式：
  //
  // · 2026-09-11 [01:14 ~ 07:28]: 睡眠 6.2小时 (深睡 0.8h, 核心 4.0h, REM 1.4h)
  // · 2026-09-11: 睡眠 6.2小时
  // · 2026-09-11 [01:14 ~ 07:28]: 睡眠 6.2小时 (深睡 0.8h, 核心 4.0h)
  //
  // 时间范围和括号内的分期都是可选的。
  const sleepLineRegex =
    /·\s*(\d{4}-\d{2}-\d{2})(?:\s*\[([^\]]+)\])?\s*:\s*睡眠\s*([\d.]+)\s*小时(?:\s*\(([^)]*)\))?/g;

  const sleepMatches = [
    ...text.matchAll(sleepLineRegex)
  ];

  let sleep = null;

  if (sleepMatches.length > 0) {
    // 后端已经按日期排序，这里取最后一条，也就是最近一天
    const latestMatch =
      sleepMatches[sleepMatches.length - 1];

    const date = latestMatch[1];
    const range = latestMatch[2] || '';
    const totalHours = Number.parseFloat(latestMatch[3]);
    const details = latestMatch[4] || '';

    const deepMatch =
      details.match(/深睡\s*([\d.]+)\s*h/);

    const coreMatch =
      details.match(/核心\s*([\d.]+)\s*h/);

    const remMatch =
      details.match(/REM\s*([\d.]+)\s*h/i);

    const unclassifiedMatch =
      details.match(/未分类睡眠\s*([\d.]+)\s*h/);

    const awakeMatch =
      details.match(/清醒\s*([\d.]+)\s*h/);

    sleep = {
      date,
      range,
      totalHours: Number.isFinite(totalHours)
        ? totalHours
        : null,
      deep: deepMatch
        ? Number.parseFloat(deepMatch[1])
        : 0,
      core: coreMatch
        ? Number.parseFloat(coreMatch[1])
        : 0,
      rem: remMatch
        ? Number.parseFloat(remMatch[1])
        : 0,
      unclassified: unclassifiedMatch
        ? Number.parseFloat(unclassifiedMatch[1])
        : 0,
      awake: awakeMatch
        ? Number.parseFloat(awakeMatch[1])
        : 0
    };
  }

  // 2. 心血管数据
  const hrMatch = text.match(
    /心率:\s*平均\s*([\d.]+).*?最高\s*(\d+).*?最低\s*(\d+)/
  );

  const restingHrMatch = text.match(
    /静息心率:\s*平均\s*([\d.]+)/
  );

  const hrvMatch = text.match(
    /心率变异性\(HRV\):\s*平均\s*([\d.]+)\s*ms/
  );

  const cardio = {
    avgHr: hrMatch
      ? Math.round(Number.parseFloat(hrMatch[1]))
      : null,

    maxHr: hrMatch
      ? Number.parseInt(hrMatch[2], 10)
      : null,

    minHr: hrMatch
      ? Number.parseInt(hrMatch[3], 10)
      : null,

    restingHr: restingHrMatch
      ? Math.round(Number.parseFloat(restingHrMatch[1]))
      : null,

    hrv: hrvMatch
      ? Math.round(Number.parseFloat(hrvMatch[1]))
      : null
  };

  // 3. 活动与能量
  //
  // 例如：
  // 每日步数: 2026-09-11: 7850 count
  const extractLastDailyValue = metricRegex => {
    const sectionMatch = text.match(metricRegex);

    if (!sectionMatch) {
      return null;
    }

    const pairs = sectionMatch[1].match(
      /\d{4}-\d{2}-\d{2}:\s*([\d.]+)/g
    );

    if (!pairs || pairs.length === 0) {
      return null;
    }

    const lastPair = pairs[pairs.length - 1];

    const valueMatch = lastPair.match(
      /:\s*([\d.]+)/
    );

    if (!valueMatch) {
      return null;
    }

    const value = Number.parseFloat(valueMatch[1]);

    return Number.isFinite(value)
      ? value
      : null;
  };

  const steps = extractLastDailyValue(
    /每日步数:\s*([^\n]+)/
  );

  const activeCalories = extractLastDailyValue(
    /活动能量\(千卡\):\s*([^\n]+)/
  );

  const exerciseMin = extractLastDailyValue(
    /锻炼时长\(分钟\):\s*([^\n]+)/
  );

  const standHours = extractLastDailyValue(
    /站立达标小时数:\s*([^\n]+)/
  );

  // 4. 生理与体征
  const spo2Match = text.match(
    /血氧饱和度:\s*平均\s*([\d.]+)\s*%/
  );

  const respMatch = text.match(
    /呼吸频率:\s*平均\s*([\d.]+)/
  );

  const wristTempMatch = text.match(
    /睡眠手腕温度:\s*平均\s*([\d.]+)\s*degC/
  );

  return {
    kind: 'health',
    timestamp: Date.now(),

    sleep,

    cardio,

    activity: {
      steps: steps !== null
        ? Math.round(steps)
        : null,

      activeCalories: activeCalories !== null
        ? Math.round(activeCalories)
        : null,

      exerciseMin: exerciseMin !== null
        ? Math.round(exerciseMin)
        : null,

      standHours: standHours !== null
        ? Math.round(standHours)
        : null
    },

    vitals: {
      spo2: spo2Match
        ? Number.parseFloat(spo2Match[1])
        : null,

      respRate: respMatch
        ? Number.parseFloat(respMatch[1])
        : null,

      wristTemp: wristTempMatch
        ? Number.parseFloat(wristTempMatch[1])
        : null
    }
  };
};
