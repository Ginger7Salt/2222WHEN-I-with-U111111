import {
  MEMORY_STATUSES
} from './memoryConstants';

import {
  isCompoundEmotion,
  isCompoundResolved
} from './memoryEmotionCompound';

/*
 * 角色的成长：叠加在人设上的一层变化，纯函数，不读写数据库，不调用 AI。
 *
 * 跟人设的关系：人设原文一个字都不改。成长是这个聊天里、因为共同经历慢慢形成的
 * 一组"倾向"，每一条都有一个强度（0 到 1）。强度会被新的事件推高，也会被相反的
 * 事件推低，推到很低就"回落"（不再生效），之后如果又出现同样的事，还可以再长出来。
 * 它不会随时间自己消失——只有新的经历才能改变它。
 *
 * 四个方面：
 *   trait     性格倾向（例如更容易不安、更愿意坦率表达）
 *   attitude  对用户的态度（例如更依赖、更信任、更小心）
 *   selfview  对自己的认识（例如觉得自己其实很在意这段关系）
 *   opinion   自己的主见（角色自己形成的想法，不是用户的）
 *
 * 数据存在这个聊天的 memoryJobs 记录的 growth 字段上（附加字段，不用升级数据库），
 * 所以每个聊天各有一份，同一个角色在不同聊天里成长得不一样。
 */

export const GROWTH_DIMENSIONS = {
  TRAIT: 'trait',
  ATTITUDE: 'attitude',
  SELFVIEW: 'selfview',
  OPINION: 'opinion'
};

export const GROWTH_DIMENSION_LABELS = {
  trait: '性格倾向',
  attitude: '对用户的态度',
  selfview: '对自己的认识',
  opinion: '自己的主见'
};

export const GROWTH_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  FADED: 'faded',
  DISMISSED: 'dismissed'
};

const DAY_MS = 24 * 60 * 60 * 1000;

// 强度低于这个值，这条成长就回落，不再生效。
export const ACTIVE_MIN_STRENGTH = 0.15;

// 同时生效的成长最多这么多条，超过时最弱的先回落。
export const MAX_ACTIVE_ITEMS = 10;

// 单条成长对情绪参数（衰减/平复/敏感）的最大影响，和所有成长加起来的最大影响。
export const MAX_NUDGE_PER_ITEM = 0.15;
export const MAX_NUDGE_TOTAL = 0.25;

// 一轮里单条成长强度最多变化多少；新增时的初始强度范围。
export const MIN_DELTA = 0.05;
export const MAX_DELTA = 0.3;
export const NEW_ITEM_MIN_STRENGTH = 0.2;
export const NEW_ITEM_MAX_STRENGTH = 0.5;

// 长期情绪状态要持续多少天，才算"长期"，可以触发一次成长判断。
export const LINGERING_DAYS = 3;

// 只有情绪触发（没有重大事件）的成长判断，两次之间至少间隔这么久。
export const EMOTION_TRIGGER_INTERVAL_MS = 6 * 60 * 60 * 1000;

const MAX_SEEN_KEYS = 300;
const MAX_HISTORY = 20;
const MAX_EVIDENCE = 8;
const MAX_ITEM_TEXT = 80;

const NUDGE_KEYS = ['decaySpeed', 'settleSpeed', 'sensitivity'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) && time > 0 ? time : 0;
};

const normalizeText = (value) => String(value || '').trim();

const isValidDimension = (value) => (
  Object.values(GROWTH_DIMENSIONS).includes(value)
);

export const normalizeNudge = (value) => {
  const nudge = {};

  for (const key of NUDGE_KEYS) {
    nudge[key] = clamp(
      toNumber(value?.[key], 0),
      -MAX_NUDGE_PER_ITEM,
      MAX_NUDGE_PER_ITEM
    );
  }

  return nudge;
};

const round2 = (value) => Math.round(value * 100) / 100;

/* ------------------------------------------------------------------ */
/* 状态                                                                */
/* ------------------------------------------------------------------ */

const normalizeItem = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const text = normalizeText(raw.text).slice(0, MAX_ITEM_TEXT);

  if (!text || !isValidDimension(raw.dimension)) return null;

  const status = Object.values(GROWTH_STATUSES).includes(raw.status)
    ? raw.status
    : GROWTH_STATUSES.PENDING;

  return {
    id: normalizeText(raw.id) || `growth_${Math.random().toString(36).slice(2, 10)}`,
    dimension: raw.dimension,
    text,
    strength: clamp(toNumber(raw.strength, 0), 0, 1),
    status,
    nudge: normalizeNudge(raw.nudge),
    evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(-MAX_EVIDENCE) : [],
    history: Array.isArray(raw.history) ? raw.history.slice(-MAX_HISTORY) : [],
    unseen: raw.unseen === true,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null
  };
};

export const normalizeGrowthState = (raw) => ({
  items: (Array.isArray(raw?.items) ? raw.items : [])
    .map(normalizeItem)
    .filter(Boolean),
  seenTriggerKeys: Array.isArray(raw?.seenTriggerKeys)
    ? raw.seenTriggerKeys.filter((key) => typeof key === 'string').slice(-MAX_SEEN_KEYS)
    : [],
  lastRunAt: raw?.lastRunAt || null
});

export const getActiveItems = (items = []) => (
  items.filter((item) => (
    item.status === GROWTH_STATUSES.ACTIVE &&
    item.strength >= ACTIVE_MIN_STRENGTH
  ))
);

/* ------------------------------------------------------------------ */
/* 对情绪参数的影响                                                     */
/* ------------------------------------------------------------------ */

/*
 * 成长对角色情绪参数（衰减速度 / 平复速度 / 敏感度）的微调：
 * 每条生效的成长按强度折算，加起来再限制在 ±MAX_NUDGE_TOTAL 内。
 * base 是人设生成出来的原始参数，不会被改写，只是读取时叠加。
 */
export const applyGrowthNudge = (base, items = []) => {
  const total = { decaySpeed: 0, settleSpeed: 0, sensitivity: 0 };

  for (const item of getActiveItems(items)) {
    const nudge = normalizeNudge(item.nudge);

    for (const key of NUDGE_KEYS) {
      total[key] += nudge[key] * item.strength;
    }
  }

  const result = { ...base };

  for (const key of NUDGE_KEYS) {
    const delta = clamp(total[key], -MAX_NUDGE_TOTAL, MAX_NUDGE_TOTAL);

    result[key] = clamp(toNumber(base?.[key], 0.5) + delta, 0, 1);
  }

  return result;
};

/* ------------------------------------------------------------------ */
/* 触发：什么情况下值得判断一次成长                                       */
/* ------------------------------------------------------------------ */

const MILESTONE_LABELS = {
  confession: '告白或确认关系',
  quarrel: '严重的争吵',
  reconcile: '争吵后和好',
  separation: '分别或疏远',
  reunion: '久别重逢',
  promise: '郑重的承诺',
  other: '关系里的大事'
};

const isLiveMemory = (memory) => (
  memory?.status === MEMORY_STATUSES.ACTIVE ||
  memory?.status === MEMORY_STATUSES.TEMPORARY
);

const describeMemory = (memory) => (
  `${normalizeText(memory.title)}：${normalizeText(memory.content)}`.slice(0, 200)
);

/*
 * 三类触发：
 *   milestone：关系里的重大事件（提炼时 AI 标出来的）；
 *   compound_lingering：复合情绪长期没有化解（难受的，或者开心的）；
 *   compound_resolved：复合情绪被安慰、被解释、被想通了——这是把成长往回推的信号。
 * 每个触发有唯一的 key，处理过就记下来，不会重复触发。
 */
export const collectGrowthTriggers = ({
  allMemories = [],
  seenKeys = [],
  now = Date.now()
} = {}) => {
  const seen = new Set(seenKeys);
  const triggers = [];

  for (const memory of allMemories) {
    if (memory?.milestone && isLiveMemory(memory)) {
      const key = `ms:${memory.memoryId}`;

      if (!seen.has(key)) {
        triggers.push({
          key,
          kind: 'milestone',
          memoryId: memory.memoryId,
          label: MILESTONE_LABELS[memory.milestone] || MILESTONE_LABELS.other,
          text: describeMemory(memory),
          at: memory.createdAt || null
        });
      }
    }

    if (!isCompoundEmotion(memory)) continue;

    if (isCompoundResolved(memory)) {
      const key = `cr:${memory.memoryId}`;

      if (!seen.has(key)) {
        triggers.push({
          key,
          kind: 'compound_resolved',
          memoryId: memory.memoryId,
          label: '长期的情绪被化解了',
          text: `${describeMemory(memory)}${memory.resolvedNote ? `（化解方式：${normalizeText(memory.resolvedNote).slice(0, 80)}）` : ''}`,
          valence: memory.emotionValence || null,
          at: memory.resolvedAt || null
        });
      }

      continue;
    }

    const startedAt = toTime(memory.compoundedAt || memory.createdAt);
    const ageDays = startedAt ? (now - startedAt) / DAY_MS : 0;

    if (
      isLiveMemory(memory) &&
      ageDays >= LINGERING_DAYS &&
      (memory.emotionValence === 'negative' || memory.emotionValence === 'positive')
    ) {
      const key = `cl:${memory.memoryId}`;

      if (!seen.has(key)) {
        triggers.push({
          key,
          kind: 'compound_lingering',
          memoryId: memory.memoryId,
          label: memory.emotionValence === 'negative'
            ? '难受的情绪持续了很多天'
            : '开心的情绪持续了很多天',
          text: describeMemory(memory),
          valence: memory.emotionValence,
          at: memory.compoundedAt || memory.createdAt || null
        });
      }
    }
  }

  return triggers;
};

/* ------------------------------------------------------------------ */
/* 应用 AI 给出的变化                                                   */
/* ------------------------------------------------------------------ */

const bigram = (text) => {
  const clean = normalizeText(text).replace(/[\s，。,.！？!?；;、]/g, '');
  const grams = new Set();

  for (let index = 0; index < clean.length - 1; index += 1) {
    grams.add(clean.slice(index, index + 2));
  }

  return grams;
};

export const textSimilarity = (left, right) => {
  const a = bigram(left);
  const b = bigram(right);

  if (!a.size || !b.size) return 0;

  let shared = 0;

  for (const gram of a) {
    if (b.has(gram)) shared += 1;
  }

  return shared / (a.size + b.size - shared);
};

const SAME_ITEM_SIMILARITY = 0.6;

const pushHistory = (item, entry) => {
  item.history = [...item.history, entry].slice(-MAX_HISTORY);
};

const pushEvidence = (item, evidence) => {
  const merged = [...item.evidence, ...evidence];
  const seen = new Set();
  const unique = [];

  for (const entry of merged) {
    const key = `${entry.kind}:${entry.memoryId}`;

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(entry);
  }

  item.evidence = unique.slice(-MAX_EVIDENCE);
};

const enforceActiveCap = (items, nowIso) => {
  const active = items.filter((item) => item.status === GROWTH_STATUSES.ACTIVE);

  if (active.length <= MAX_ACTIVE_ITEMS) return;

  active
    .sort((left, right) => left.strength - right.strength)
    .slice(0, active.length - MAX_ACTIVE_ITEMS)
    .forEach((item) => {
      item.status = GROWTH_STATUSES.FADED;
      item.updatedAt = nowIso;
      pushHistory(item, { at: nowIso, op: 'faded', note: '同时生效的成长太多，最弱的先回落。' });
    });
};

/*
 * ops：[{ op: 'add' | 'reinforce' | 'weaken', itemId, dimension, text, delta, nudge, reason, evidence }]
 * autoExecute：新出现的成长直接生效（true），还是先放待确认（false）。
 * 已经生效的成长的增强和减弱，无论开关如何都直接生效——它们小、可逆、
 * 而且"被新事件推回去"本来就该及时。
 *
 * 返回 { state, summary }，不修改传入的 state。
 */
export const applyGrowthOps = ({
  state,
  ops = [],
  triggers = [],
  autoExecute = false,
  now = new Date()
}) => {
  const nowIso = now.toISOString();

  const next = normalizeGrowthState(state);

  const summary = {
    added: 0,
    pending: 0,
    reinforced: 0,
    weakened: 0,
    faded: 0,
    revived: 0
  };

  for (const rawOp of ops) {
    let op = rawOp;

    const delta = clamp(Math.abs(toNumber(op.delta, 0.15)), MIN_DELTA, MAX_DELTA);
    const evidence = (op.evidence || []).map((trigger) => ({
      kind: trigger.kind,
      memoryId: trigger.memoryId,
      note: normalizeText(trigger.label || ''),
      at: trigger.at || nowIso
    }));

    const reason = normalizeText(op.reason).slice(0, 120);

    let target = op.itemId
      ? next.items.find((item) => item.id === op.itemId)
      : null;

    if (op.op === 'add') {
      const text = normalizeText(op.text).slice(0, MAX_ITEM_TEXT);

      if (!text || !isValidDimension(op.dimension) || !evidence.length) continue;

      // 已经有说的是同一件事的成长，当作增强，不新增重复的。
      target = target || next.items.find((item) => (
        item.dimension === op.dimension &&
        item.status !== GROWTH_STATUSES.DISMISSED &&
        textSimilarity(item.text, text) >= SAME_ITEM_SIMILARITY
      )) || null;

      if (!target) {
        const strength = clamp(delta, NEW_ITEM_MIN_STRENGTH, NEW_ITEM_MAX_STRENGTH);
        const status = autoExecute
          ? GROWTH_STATUSES.ACTIVE
          : GROWTH_STATUSES.PENDING;

        next.items.push({
          id: `growth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          dimension: op.dimension,
          text,
          strength,
          status,
          nudge: normalizeNudge(op.nudge),
          evidence: evidence.slice(-MAX_EVIDENCE),
          history: [{ at: nowIso, op: 'added', delta: strength, strengthAfter: strength, note: reason }],
          unseen: autoExecute,
          createdAt: nowIso,
          updatedAt: nowIso
        });

        if (autoExecute) summary.added += 1;
        else summary.pending += 1;

        continue;
      }

      // 落到"增强已有的"分支
      op = { ...op, op: 'reinforce' };
    }

    if (!target) continue;

    if (target.status === GROWTH_STATUSES.DISMISSED) continue;

    if (op.op === 'reinforce') {
      const wasFaded = target.status === GROWTH_STATUSES.FADED;
      const before = target.strength;

      target.strength = round2(clamp(before + delta, 0, 1));

      if (wasFaded && target.strength >= ACTIVE_MIN_STRENGTH) {
        // 回落过的成长，遇到同样的事又长出来了：重新生效，提醒用户。
        target.status = GROWTH_STATUSES.ACTIVE;
        target.unseen = true;
        summary.revived += 1;
      } else {
        summary.reinforced += 1;
      }

      target.updatedAt = nowIso;
      pushEvidence(target, evidence);
      pushHistory(target, {
        at: nowIso,
        op: wasFaded ? 'revived' : 'reinforced',
        delta: round2(target.strength - before),
        strengthAfter: target.strength,
        note: reason
      });

      continue;
    }

    if (op.op === 'weaken') {
      const before = target.strength;

      target.strength = round2(clamp(before - delta, 0, 1));
      target.updatedAt = nowIso;
      pushEvidence(target, evidence);

      let opName = 'weakened';

      if (target.strength < ACTIVE_MIN_STRENGTH) {
        if (target.status === GROWTH_STATUSES.ACTIVE) {
          target.status = GROWTH_STATUSES.FADED;
          target.unseen = true;
          summary.faded += 1;
          opName = 'faded';
        } else if (target.status === GROWTH_STATUSES.PENDING) {
          target.status = GROWTH_STATUSES.DISMISSED;
          opName = 'dismissed';
        }
      } else {
        summary.weakened += 1;
      }

      pushHistory(target, {
        at: nowIso,
        op: opName,
        delta: round2(target.strength - before),
        strengthAfter: target.strength,
        note: reason
      });
    }
  }

  enforceActiveCap(next.items, nowIso);

  next.lastRunAt = nowIso;

  const seen = new Set(next.seenTriggerKeys);

  for (const trigger of triggers) {
    seen.add(trigger.key);
  }

  next.seenTriggerKeys = [...seen].slice(-MAX_SEEN_KEYS);

  return { state: next, summary };
};

/* ------------------------------------------------------------------ */
/* 进入提示词                                                           */
/* ------------------------------------------------------------------ */

const describeStrength = (strength) => {
  if (strength < 0.35) return '隐约';
  if (strength < 0.65) return '比较明显';

  return '很明显';
};

const MAX_CONTEXT_ITEMS = 6;

export const buildGrowthContext = (items = []) => {
  const active = getActiveItems(items)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, MAX_CONTEXT_ITEMS);

  if (!active.length) return '';

  const sections = [
    GROWTH_DIMENSIONS.TRAIT,
    GROWTH_DIMENSIONS.ATTITUDE,
    GROWTH_DIMENSIONS.SELFVIEW,
    GROWTH_DIMENSIONS.OPINION
  ]
    .map((dimension) => {
      const lines = active
        .filter((item) => item.dimension === dimension)
        .map((item) => `- ${item.text}（${describeStrength(item.strength)}）`);

      return lines.length
        ? `${GROWTH_DIMENSION_LABELS[dimension]}：\n${lines.join('\n')}`
        : '';
    })
    .filter(Boolean);

  const hasOpinion = active.some((item) => (
    item.dimension === GROWTH_DIMENSIONS.OPINION
  ));

  return `
【角色在这段关系里的成长变化】
以下是角色在这个消息框里，因为共同的经历慢慢形成的变化，叠加在原本的人设之上，不是替换。
保持人设原有的说话方式和核心性格，这些变化只体现为倾向、态度和分寸上的细微差别，不要突然换了一个人。
不要向用户宣布自己“成长了”或“变了”，也不要提及记忆系统。新的经历会让这些变化自己回落。
${hasOpinion ? '“自己的主见”只是角色自己的想法，可以自然地表达，但不得用来说教、施压，或要求用户改变。\n' : ''}
${sections.join('\n')}
`;
};

/* ------------------------------------------------------------------ */
/* 手动操作（用户在记忆页里点按钮）                                       */
/* ------------------------------------------------------------------ */

const withItem = (state, itemId, mutate) => {
  const next = normalizeGrowthState(state);
  const item = next.items.find((entry) => entry.id === itemId);

  if (!item) return next;

  mutate(item);

  return next;
};

export const confirmGrowthItem = (state, itemId, now = new Date()) => (
  withItem(state, itemId, (item) => {
    if (item.status !== GROWTH_STATUSES.PENDING) return;

    item.status = GROWTH_STATUSES.ACTIVE;
    item.unseen = false;
    item.updatedAt = now.toISOString();
    pushHistory(item, { at: item.updatedAt, op: 'confirmed', strengthAfter: item.strength, note: '用户确认' });
  })
);

export const dismissGrowthItem = (state, itemId, now = new Date()) => (
  withItem(state, itemId, (item) => {
    if (item.status !== GROWTH_STATUSES.PENDING) return;

    item.status = GROWTH_STATUSES.DISMISSED;
    item.unseen = false;
    item.updatedAt = now.toISOString();
    pushHistory(item, { at: item.updatedAt, op: 'dismissed', strengthAfter: item.strength, note: '用户忽略' });
  })
);

// 用户主动让某条成长回退：立刻回落，但保留记录；以后遇到同样的事还可能再长出来。
export const revertGrowthItem = (state, itemId, now = new Date()) => (
  withItem(state, itemId, (item) => {
    if (item.status !== GROWTH_STATUSES.ACTIVE) return;

    item.status = GROWTH_STATUSES.FADED;
    item.strength = Math.min(item.strength, 0.1);
    item.unseen = false;
    item.updatedAt = now.toISOString();
    pushHistory(item, { at: item.updatedAt, op: 'reverted', strengthAfter: item.strength, note: '用户回退' });
  })
);

export const markGrowthSeen = (state) => {
  const next = normalizeGrowthState(state);

  next.items.forEach((item) => {
    item.unseen = false;
  });

  return next;
};