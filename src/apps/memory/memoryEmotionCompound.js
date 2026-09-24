import {
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

import {
  formatRelativeDayLabel
} from './memoryTimeContext';

/*
 * 复合情绪：同一类情绪反复出现，会累积成更重的情绪；不同类的情绪碰在一起，
 * 会变成更复杂的情绪。都是纯函数，不读写数据库。
 *
 * 命名参考两套心理学理论，但只借它们的结构，不追求学术上的严格：
 *   - Plutchik 情绪轮：同一类情绪有强弱层级（不安 -> 焦虑 -> 惶恐），
 *     相邻的基本情绪可以两两混合成新的情绪（开心 + 信任 = 安心的幸福）。
 *   - Sternberg 爱情三角：亲密（亲近、安心）、激情（心动）、承诺（珍惜、认定）
 *     三项里同时出现两项以上，就给这份"对关系的情绪"一个更贴切的名字。
 *
 * 什么时候合成、合成后留多久，都会随角色的情绪人格画像不同：
 *   - sensitivity 高：更容易累积（次数门槛低、观察的时间窗口更长）；
 *   - decaySpeed 低：难受的情绪散得更慢。
 *
 * 数字都是可以调的手感参数，集中放在这里。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_INTENSITY = 0.5;

/* ------------------------------------------------------------------ */
/* 情绪家族：自由标签 -> 家族 + 层级                                     */
/* ------------------------------------------------------------------ */

/*
 * levels 按强度从弱到强排列；每一层有自己的名字和关键词。
 * 识别时从最强的一层往下匹配，避免"惶恐"被当成"不安"。
 * 只有一层的家族（惊喜、心动、珍惜……）不会自己叠加升级，
 * 但可以参与"不同类情绪混合"。
 */
const FAMILIES = {
  fear: {
    valence: 'negative',
    levels: [
      { name: '不安', words: ['不安', '担心', '忐忑', '紧张', '慌', '害怕', '怕', '惴惴'] },
      { name: '焦虑', words: ['焦虑', '焦躁', '忧虑', '心神不宁'] },
      { name: '惶恐', words: ['惶恐', '恐慌', '恐惧', '惊惶'] }
    ]
  },
  sadness: {
    valence: 'negative',
    levels: [
      { name: '失落', words: ['失落', '难过', '低落', '伤心', '难受', '失望', '落寞', '郁闷'] },
      { name: '沮丧', words: ['沮丧', '消沉', '灰心', '颓'] },
      { name: '绝望', words: ['绝望', '心碎', '痛苦'] }
    ]
  },
  anger: {
    valence: 'negative',
    levels: [
      { name: '不满', words: ['不满', '烦躁', '心烦', '恼', '不爽', '烦'] },
      { name: '生气', words: ['生气', '气愤', '恼火'] },
      { name: '愤怒', words: ['愤怒', '暴怒', '怒'] }
    ]
  },
  joy: {
    valence: 'positive',
    levels: [
      { name: '开心', words: ['开心', '高兴', '愉快', '快乐', '愉悦', '雀跃', '轻松'] },
      { name: '幸福', words: ['幸福', '满足', '甜蜜', '知足', '感动'] },
      { name: '狂喜', words: ['狂喜', '喜极', '欣喜若狂'] }
    ]
  },
  trust: {
    valence: 'positive',
    levels: [
      { name: '安心', words: ['安心', '踏实', '放心', '信任', '温暖', '亲近', '被理解', '被接纳'] },
      { name: '依恋', words: ['依恋', '依赖', '离不开'] }
    ]
  },
  longing: {
    valence: 'mixed',
    levels: [
      { name: '想念', words: ['想念', '思念', '想你', '惦记'] },
      { name: '牵挂', words: ['牵挂', '挂念', '牵肠'] },
      { name: '思念难耐', words: ['难耐', '思之如狂'] }
    ]
  },
  lonely: {
    valence: 'negative',
    levels: [
      { name: '孤单', words: ['孤单', '孤零零', '空落', '落单'] },
      { name: '孤独', words: ['孤独', '寂寞'] }
    ]
  },
  hurt: {
    valence: 'negative',
    levels: [
      { name: '委屈', words: ['委屈', '被冷落', '被忽视', '冷落', '不被理解'] },
      { name: '心寒', words: ['心寒', '寒心', '伤透'] }
    ]
  },
  anticipation: {
    valence: 'positive',
    levels: [
      { name: '期待', words: ['期待', '盼', '等不及', '兴奋'] },
      { name: '憧憬', words: ['憧憬', '向往'] }
    ]
  },
  surprise: {
    valence: 'positive',
    levels: [
      { name: '惊喜', words: ['惊喜', '惊讶', '意外', '没想到'] }
    ]
  },
  passion: {
    valence: 'positive',
    love: 'passion',
    levels: [
      { name: '心动', words: ['心动', '悸动', '脸红', '小鹿乱撞', '迷恋', '心跳'] }
    ]
  },
  commitment: {
    valence: 'positive',
    love: 'commitment',
    levels: [
      { name: '珍惜', words: ['珍惜', '认定', '承诺', '守护', '想在一起', '在乎'] }
    ]
  }
};

// 爱情三角里，"亲密"这一项对应的家族就是 trust。
const LOVE_DIMENSION_BY_FAMILY = {
  trust: 'intimacy',
  passion: 'passion',
  commitment: 'commitment'
};

const FAMILY_ORDER = Object.keys(FAMILIES);

/*
 * 把一条情绪记忆归到某个家族和层级。
 * 优先看 emotionTag，没有就看标题；都对不上返回 null（交给 AI 兜底命名）。
 * 一个标签里同时含多个家族的词（比如"孤单又想念"）时，取出现位置最靠前的。
 */
export const classifyEmotion = (memory) => {
  const texts = [memory?.emotionTag, memory?.title]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const text of texts) {
    let best = null;

    for (const family of FAMILY_ORDER) {
      const levels = FAMILIES[family].levels;

      for (let index = levels.length - 1; index >= 0; index -= 1) {
        for (const word of levels[index].words) {
          const position = text.indexOf(word);

          if (position < 0) continue;

          if (
            !best ||
            position < best.position ||
            (position === best.position && index > best.level)
          ) {
            best = { family, level: index, position };
          }

          break;
        }
      }
    }

    if (best) {
      return { family: best.family, level: best.level };
    }
  }

  return null;
};

/* ------------------------------------------------------------------ */
/* 合成表                                                              */
/* ------------------------------------------------------------------ */

/*
 * 不同家族两两混合。键是两个家族名按字母排序后用 + 连接。
 * moodDelta 只在归属于角色（或共同关系）的复合情绪上才会被用到，
 * 用来轻微推动角色的实时心情，字段名见 memoryCharacterState.js 的 MOOD_KEYS。
 */
const DYADS = {
  'fear+sadness': {
    name: '患得患失', valence: 'negative',
    moodDelta: { security: -0.28, concern: 0.18, wronged: 0.1, calm: -0.12 }
  },
  'fear+hurt': {
    name: '患得患失', valence: 'negative',
    moodDelta: { security: -0.28, concern: 0.18, wronged: 0.12, calm: -0.12 }
  },
  'fear+longing': {
    name: '牵肠挂肚', valence: 'negative',
    moodDelta: { longing: 0.2, concern: 0.2, security: -0.15 }
  },
  'anger+sadness': {
    name: '心寒', valence: 'negative',
    moodDelta: { hurt: 0.25, security: -0.15, warmth: -0.1 }
  },
  'anger+hurt': {
    name: '心寒', valence: 'negative',
    moodDelta: { hurt: 0.25, security: -0.15, warmth: -0.1 }
  },
  'hurt+lonely': {
    name: '被冷落的难受', valence: 'negative',
    moodDelta: { hurt: 0.2, wronged: 0.2, loneliness: 0.15, joy: -0.1 }
  },
  'lonely+longing': {
    name: '思念难耐', valence: 'negative',
    moodDelta: { longing: 0.28, loneliness: 0.18, joy: -0.1 }
  },
  'lonely+sadness': {
    name: '孤寂', valence: 'negative',
    moodDelta: { loneliness: 0.25, hurt: 0.12, joy: -0.15 }
  },
  'joy+trust': {
    name: '安心的幸福', valence: 'positive',
    moodDelta: { joy: 0.2, security: 0.2, contentment: 0.2, warmth: 0.12 }
  },
  'anticipation+joy': {
    name: '憧憬', valence: 'positive',
    moodDelta: { anticipation: 0.25, joy: 0.12 }
  },
  'joy+surprise': {
    name: '喜出望外', valence: 'positive',
    moodDelta: { joy: 0.25, surprise: 0.2 }
  },
  'joy+longing': {
    name: '甜蜜的思念', valence: 'positive',
    moodDelta: { longing: 0.15, joy: 0.12, warmth: 0.15 }
  },
  'longing+trust': {
    name: '依恋', valence: 'positive',
    moodDelta: { warmth: 0.15, longing: 0.15, security: 0.1 }
  },
  'anticipation+fear': {
    name: '又期待又害怕', valence: 'mixed',
    moodDelta: { anticipation: 0.15, concern: 0.15, security: -0.1 }
  }
};

/*
 * 爱情三角：亲密 / 激情 / 承诺 里同时出现的项。
 * 键是三项里出现的那几项按固定顺序连接。
 */
const LOVE_COMBOS = {
  'intimacy+passion': {
    name: '浪漫的爱意', valence: 'positive',
    moodDelta: { warmth: 0.2, joy: 0.15, longing: 0.1 }
  },
  'intimacy+commitment': {
    name: '安稳的陪伴之爱', valence: 'positive',
    moodDelta: { warmth: 0.2, security: 0.2, contentment: 0.15 }
  },
  'passion+commitment': {
    name: '炽热的认定', valence: 'positive',
    moodDelta: { warmth: 0.15, joy: 0.1, anticipation: 0.15 }
  },
  'intimacy+passion+commitment': {
    name: '圆满的爱', valence: 'positive',
    moodDelta: { warmth: 0.25, security: 0.2, joy: 0.2, contentment: 0.2 }
  }
};

// 同类情绪反复出现，升到更强一层时，对角色心情的推动。
const CHAIN_MOOD_DELTAS = {
  '焦虑': { security: -0.25, concern: 0.2, calm: -0.15 },
  '惶恐': { security: -0.3, concern: 0.25, calm: -0.2 },
  '沮丧': { hurt: 0.25, joy: -0.2, fatigue: 0.1 },
  '绝望': { hurt: 0.3, joy: -0.25, fatigue: 0.12 },
  '生气': { hurt: 0.12, wronged: 0.15, calm: -0.18 },
  '愤怒': { hurt: 0.18, wronged: 0.2, calm: -0.25 },
  '幸福': { joy: 0.2, contentment: 0.2, warmth: 0.1 },
  '狂喜': { joy: 0.3, contentment: 0.15 },
  '依恋': { warmth: 0.15, longing: 0.15, security: 0.1 },
  '牵挂': { longing: 0.2, concern: 0.12 },
  '思念难耐': { longing: 0.3, loneliness: 0.15 },
  '孤独': { loneliness: 0.25, joy: -0.1 },
  '心寒': { hurt: 0.25, security: -0.15, wronged: 0.1 },
  '憧憬': { anticipation: 0.25, joy: 0.1 }
};

/* ------------------------------------------------------------------ */
/* 角色人格带来的差别                                                   */
/* ------------------------------------------------------------------ */

const clamp01 = (value, fallback = 0.5) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return Math.max(0, Math.min(1, numberValue));
};

/*
 * 同类情绪出现几次会合成一层更强的情绪：
 * 敏感的角色 2 次就够，迟钝的（sensitivity 低于 0.35）要 3 次。
 */
export const getRequiredCount = (sensitivity = 0.5) => (
  clamp01(sensitivity) >= 0.35 ? 2 : 3
);

// 往回看多少天里的情绪：敏感的角色记得更久，约 4 到 12 天。
export const getComposeWindowDays = (sensitivity = 0.5) => (
  4 + clamp01(sensitivity) * 8
);

// 不同家族混合时要求更贴近的时间：窗口的 60%。
const DYAD_WINDOW_RATIO = 0.6;

// decaySpeed 越低，情绪散得越慢；0.5 时系数为 1。
const getLingerFactor = (decaySpeed = 0.5) => (
  1.45 - clamp01(decaySpeed) * 0.9
);

/* ------------------------------------------------------------------ */
/* 复合情绪本身的状态                                                   */
/* ------------------------------------------------------------------ */

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) && time > 0 ? time : 0;
};

export const isCompoundEmotion = (memory) => (
  memory?.type === MEMORY_TYPES.EMOTION &&
  memory?.emotionCompound === true
);

export const isCompoundResolved = (memory) => (
  Boolean(memory?.resolvedAt)
);

const NEGATIVE_HALF_LIFE_DAYS = 21;
const POSITIVE_HALF_LIFE_DAYS = 30;
const OTHER_HALF_LIFE_DAYS = 14;

// 难受的复合情绪不会自己散尽，最低留这么多，直到被安慰或想通才真正消解。
const NEGATIVE_FLOOR = 0.35;

// 低于这个强度就不再作为背景情绪进入提示词。
export const LINGERING_MIN_INTENSITY = 0.3;

// 开心一类的复合情绪淡到这个程度就认为已经过去了。
const POSITIVE_FADE_CUTOFF = 0.15;

const getBaseIntensity = (compound) => {
  const raw = compound?.emotionIntensity;

  const numberValue = (
    raw === null || raw === undefined || raw === ''
  )
    ? DEFAULT_INTENSITY
    : Number(raw);

  return clamp01(numberValue, DEFAULT_INTENSITY);
};

/*
 * 此刻这份复合情绪还剩多强（0 到 1）。
 *   - 已消解：0；
 *   - 负面：半衰期约三周，但有底（NEGATIVE_FLOOR），不会自己散尽；
 *   - 正面：半衰期约一个月，最终会淡去（幸福感比普通情绪留得久）；
 *   - 其他：半衰期约两周。
 * reliefFactor 是被安慰、被解释后已经缓解的比例（0 到 1）。
 */
export const getCompoundIntensity = (
  compound,
  now = Date.now(),
  { decaySpeed = 0.5 } = {}
) => {
  if (!isCompoundEmotion(compound) || isCompoundResolved(compound)) {
    return 0;
  }

  const relief = clamp01(compound.reliefFactor, 0);
  const base = getBaseIntensity(compound) * (1 - relief);

  const startedAt = toTime(
    compound.lastReinforcedAt || compound.compoundedAt || compound.createdAt
  );

  const ageDays = startedAt
    ? Math.max(0, (now - startedAt) / DAY_MS)
    : 0;

  const linger = getLingerFactor(decaySpeed);

  const valence = compound.emotionValence;

  const halfLife = (
    valence === 'negative'
      ? NEGATIVE_HALF_LIFE_DAYS
      : valence === 'positive'
        ? POSITIVE_HALF_LIFE_DAYS
        : OTHER_HALF_LIFE_DAYS
  ) * linger;

  const decayed = base * (0.5 ** (ageDays / halfLife));

  if (valence === 'negative') {
    return Math.max(decayed, Math.min(base, NEGATIVE_FLOOR));
  }

  return decayed;
};

export const isCompoundActive = (compound) => (
  isCompoundEmotion(compound) &&
  !isCompoundResolved(compound) &&
  (
    compound.status === MEMORY_STATUSES.ACTIVE ||
    compound.status === MEMORY_STATUSES.TEMPORARY
  )
);

// 非负面的复合情绪淡到足够低，可以收起来了（负面的有底，不会走到这里）。
export const isCompoundFaded = (
  compound,
  now = Date.now(),
  options = {}
) => (
  isCompoundEmotion(compound) &&
  !isCompoundResolved(compound) &&
  compound.emotionValence !== 'negative' &&
  getCompoundIntensity(compound, now, options) < POSITIVE_FADE_CUTOFF
);

/* ------------------------------------------------------------------ */
/* 合成：从一批零散的情绪记忆里找出该合成的                             */
/* ------------------------------------------------------------------ */

const getEmotionSubject = (memory) => (
  memory?.emotionSubject || (
    memory?.subject === 'character' ? 'character'
      : memory?.subject === 'user' ? 'user'
        : 'shared'
  )
);

const getIntensity = (memory) => {
  const raw = memory?.emotionIntensity;

  if (raw === null || raw === undefined || raw === '') {
    return DEFAULT_INTENSITY;
  }

  const numberValue = Number(raw);

  return Number.isFinite(numberValue)
    ? Math.max(0, Math.min(1, numberValue))
    : DEFAULT_INTENSITY;
};

const average = (values) => (
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : DEFAULT_INTENSITY
);

// 合成后的强度：成员的平均强度，每多一条再加一点，封顶 0.95，至少 0.4。
const composeIntensity = (members) => (
  Math.max(
    0.4,
    Math.min(0.95, average(members.map(getIntensity)) + 0.12 * (members.length - 1))
  )
);

const getSubjectLabel = (subject) => ({
  user: '用户',
  character: '角色',
  shared: '两人之间'
}[subject] || '');

const pairKey = (left, right) => [left, right].sort().join('+');

const LOVE_DIMENSION_ORDER = ['intimacy', 'passion', 'commitment'];

const describeMembers = (members) => (
  [...new Set(
    members
      .map((memory) => memory.emotionTag || memory.title)
      .filter(Boolean)
  )].slice(0, 4).join('、')
);

const buildContent = ({ subject, name, members }) => {
  const who = getSubjectLabel(subject);
  const parts = describeMembers(members);

  return `${who}近期接连出现${parts ? `“${parts}”` : '几种相关的情绪'}，累积成了“${name}”。`;
};

/*
 * 找出这一批情绪记忆里该合成或该叠加的。
 *
 * emotions：候选的情绪记忆（已过滤成生效中、没被合成过、不是复合情绪本身）。
 * compounds：已经存在的、还没消解的复合情绪。
 * sensitivity：角色的情绪敏感度（用户的情绪固定用 0.5）。
 *
 * 返回 { proposals, unclassified }：
 *   proposals 每项 action 为 create（新建复合情绪）或 absorb（并入已有的）；
 *   unclassified 是认不出家族的情绪，交给 AI 兜底命名。
 */
export const findCompoundProposals = ({
  emotions = [],
  compounds = [],
  sensitivity = 0.5,
  now = Date.now(),
  subject = 'user'
} = {}) => {
  const windowMs = getComposeWindowDays(sensitivity) * DAY_MS;
  const dyadWindowMs = windowMs * DYAD_WINDOW_RATIO;
  const required = getRequiredCount(sensitivity);

  const inWindow = emotions
    .filter((memory) => (
      getEmotionSubject(memory) === subject &&
      now - toTime(memory.createdAt) <= windowMs
    ))
    .map((memory) => ({ memory, cls: classifyEmotion(memory) }));

  const unclassified = inWindow
    .filter((item) => !item.cls)
    .map((item) => item.memory);

  let pool = inWindow.filter((item) => item.cls);

  const proposals = [];

  const consume = (ids) => {
    const set = new Set(ids);

    pool = pool.filter((item) => !set.has(item.memory.memoryId));
  };

  const activeCompounds = compounds.filter((compound) => (
    isCompoundActive(compound) &&
    getEmotionSubject(compound) === subject
  ));

  /* 1. 并入已有的复合情绪：同家族的新情绪只是让它更重、更新。 */
  for (const compound of activeCompounds) {
    const families = Array.isArray(compound.compoundFamilies)
      ? compound.compoundFamilies
      : [];

    const matched = pool.filter((item) => families.includes(item.cls.family));

    if (!matched.length) continue;

    const componentCount = (
      Number(compound.compoundComponentCount)
      || (compound.compoundComponentIds || []).length
      || required
    ) + matched.length;

    const proposal = {
      action: 'absorb',
      compoundId: compound.memoryId,
      componentIds: matched.map((item) => item.memory.memoryId),
      intensity: Math.min(
        0.95,
        getBaseIntensity(compound) + 0.08 * matched.length
      ),
      componentCount
    };

    // 单一家族叠加的复合情绪，可能升到更强的一层。
    if (compound.compoundKind === 'repeat' && families.length === 1) {
      const chain = FAMILIES[families[0]]?.levels || [];
      const index = Math.min(chain.length - 1, Math.floor(componentCount / required));

      if (index > 0 && chain[index] && chain[index].name !== compound.emotionTag) {
        proposal.name = chain[index].name;
        proposal.moodDelta = CHAIN_MOOD_DELTAS[chain[index].name] || null;
      }
    }

    proposals.push(proposal);
    consume(proposal.componentIds);
  }

  const hasActiveNamed = (name) => activeCompounds.some(
    (compound) => compound.emotionTag === name
  );

  /* 2. 爱情三角：亲密 / 激情 / 承诺 里同时出现两项以上。 */
  const loveGroups = {};

  for (const item of pool) {
    const dimension = LOVE_DIMENSION_BY_FAMILY[item.cls.family];

    if (!dimension) continue;

    if (!loveGroups[dimension]) loveGroups[dimension] = [];

    loveGroups[dimension].push(item.memory);
  }

  const presentDimensions = LOVE_DIMENSION_ORDER.filter(
    (dimension) => loveGroups[dimension]?.length
  );

  if (presentDimensions.length >= 2) {
    const combo = LOVE_COMBOS[presentDimensions.join('+')];

    if (combo && !hasActiveNamed(combo.name)) {
      const members = presentDimensions.flatMap((dimension) => loveGroups[dimension]);

      proposals.push({
        action: 'create',
        kind: 'love',
        subject,
        name: combo.name,
        valence: combo.valence,
        families: [...new Set(members.map((memory) => classifyEmotion(memory).family))],
        members,
        intensity: composeIntensity(members),
        moodDelta: combo.moodDelta
      });

      consume(members.map((memory) => memory.memoryId));
    }
  }

  /* 3. 同类情绪反复出现，升一层。 */
  const byFamily = {};

  for (const item of pool) {
    if (!byFamily[item.cls.family]) byFamily[item.cls.family] = [];

    byFamily[item.cls.family].push(item);
  }

  for (const [family, items] of Object.entries(byFamily)) {
    const chain = FAMILIES[family].levels;

    if (chain.length < 2 || items.length < required) continue;

    const strongestLevel = Math.max(...items.map((item) => item.cls.level));

    const index = Math.min(
      chain.length - 1,
      Math.max(strongestLevel + 1, Math.floor(items.length / required))
    );

    const name = chain[index].name;

    if (hasActiveNamed(name)) continue;

    const members = items.map((item) => item.memory);

    proposals.push({
      action: 'create',
      kind: 'repeat',
      subject,
      name,
      valence: FAMILIES[family].valence,
      families: [family],
      members,
      intensity: composeIntensity(members),
      moodDelta: CHAIN_MOOD_DELTAS[name] || null
    });

    consume(members.map((memory) => memory.memoryId));
  }

  /* 4. 不同家族混合：两种情绪在较短的时间里先后出现。 */
  const recent = pool.filter(
    (item) => now - toTime(item.memory.createdAt) <= dyadWindowMs
  );

  const recentFamilies = [...new Set(recent.map((item) => item.cls.family))];

  for (let i = 0; i < recentFamilies.length; i += 1) {
    for (let j = i + 1; j < recentFamilies.length; j += 1) {
      const dyad = DYADS[pairKey(recentFamilies[i], recentFamilies[j])];

      if (!dyad || hasActiveNamed(dyad.name)) continue;

      const families = [recentFamilies[i], recentFamilies[j]];

      const members = recent
        .filter((item) => families.includes(item.cls.family))
        .map((item) => item.memory)
        .filter((memory) => pool.some((item) => item.memory.memoryId === memory.memoryId));

      if (members.length < 2) continue;

      proposals.push({
        action: 'create',
        kind: 'dyad',
        subject,
        name: dyad.name,
        valence: dyad.valence,
        families,
        members,
        intensity: composeIntensity(members),
        moodDelta: dyad.moodDelta
      });

      consume(members.map((memory) => memory.memoryId));
    }
  }

  return {
    proposals: proposals.map((proposal) => (
      proposal.action === 'create'
        ? {
          ...proposal,
          title: proposal.name,
          content: buildContent({
            subject,
            name: proposal.name,
            members: proposal.members
          })
        }
        : proposal
    )),
    unclassified
  };
};

/* ------------------------------------------------------------------ */
/* 进入提示词：还没化开的情绪                                          */
/* ------------------------------------------------------------------ */

const MAX_LINGERING_ITEMS = 3;

const getStrengthLabel = (intensity) => {
  if (intensity >= 0.7) return '很重';
  if (intensity >= 0.5) return '明显';

  return '淡淡的';
};

const buildLingeringLine = (compound, intensity, now) => {
  const subject = getEmotionSubject(compound);

  const who = subject === 'character'
    ? '角色心里'
    : subject === 'user'
      ? '用户近来'
      : '两人之间';

  const since = compound.compoundedAt || compound.createdAt;

  const sinceLabel = since
    ? `，${formatRelativeDayLabel(new Date(since), new Date(now))}起`
    : '';

  const note = compound.emotionValence === 'negative'
    ? '还没化开'
    : '还留着余温';

  return `- ${who}：${compound.title}（${getStrengthLabel(intensity)}${sinceLabel}，${note}）${compound.content ? `：${compound.content}` : ''}`;
};

/*
 * 未消解、且还够强的复合情绪，作为背景情绪进入提示词。
 * 它们不走普通的关键词召回：一份难受不会因为用户没提到就消失，
 * 但也只是语气上的底色，不是要拿出来说的话题。
 */
export const buildLingeringEmotionContext = (
  memories = [],
  now = Date.now(),
  { decaySpeed = 0.5 } = {}
) => {
  const items = memories
    .filter(isCompoundActive)
    .map((compound) => ({
      compound,
      intensity: getCompoundIntensity(
        compound,
        now,
        {
          decaySpeed: getEmotionSubject(compound) === 'user'
            ? 0.5
            : decaySpeed
        }
      )
    }))
    .filter((item) => item.intensity >= LINGERING_MIN_INTENSITY)
    .sort((left, right) => right.intensity - left.intensity)
    .slice(0, MAX_LINGERING_ITEMS);

  if (!items.length) return '';

  return `
【近期积累的情绪状态】
以下是角色或用户近来一点点累积起来、还没有真正消散的情绪。它们只是语气和关心的底色，不是需要被提起的话题。
${items.map((item) => buildLingeringLine(item.compound, item.intensity, now)).join('\n')}

使用规则：
- 不要每句话都提，也不要解释这些情绪是怎么来的；当前用户说的话永远优先。
- 不得用角色心里的情绪要求用户安慰、道歉或产生愧疚。
- 用户对“用户近来”的情绪，可以更耐心、更温柔一点，但不要反复追问。
- 当对方温柔地关心、说明原因或安慰时，可以自然地放松下来，不必硬撑着继续难受。
`;
};

export const EMOTION_COMPOUND_FAMILIES = FAMILIES;