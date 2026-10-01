/*
 * 「TA 眼中的你」里"更深一层的印象"（角色用自己的口吻，写 user 是个什么样的人，
 * 并说明理由）的纯逻辑部分：只负责判断"现在能不能生成/重新生成"、维度表这类
 * 静态数据，不碰数据库、不发请求。这个文件不 import 任何东西，可以直接在
 * node 里测试。
 *
 * 这是一个需要真的调用 AI、会消耗 user 自己配置的 API 额度的功能，所以默认关闭，
 * 需要 user 自己打开。打开之后支持两种触发方式：
 *   - 手动点一下立即生成，有 12 小时冷却；
 *   - 后台每 5 天自动生成一次（不需要 user 盯着）。
 * 这两种触发方式共用同一个 generatedAt 时间戳：不管是手动还是自动触发成功，
 * 都会把这个时间戳往后推，所以手动点一次之后，5 天的自动计时器也会跟着
 * 从这一刻重新算，不会出现"手动刚点完没多久又被自动触发覆盖"的情况。
 *
 * 下面几个参数是这一轮实现时选的默认值，user 没有明确指定，可以随时调整：
 *   PORTRAIT_MIN_MESSAGES        生成一次画像至少需要多少条 user 说过的话，太少的话
 *                                 AI 只能瞎编，没有意义。
 *   PORTRAIT_MANUAL_COOLDOWN_MS   两次手动重新生成之间的最短间隔。
 *   PORTRAIT_AUTO_INTERVAL_MS     没有手动触发的情况下，后台自动生成的间隔。
 *   PORTRAIT_SAMPLE_LIMIT         生成时最多取多少条 user 的历史消息给 AI 参考。
 */

export const PORTRAIT_MIN_MESSAGES = 30;
export const PORTRAIT_MANUAL_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 小时
export const PORTRAIT_AUTO_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000; // 5 天
export const PORTRAIT_SAMPLE_LIMIT = 40;

/*
 * 多维度观察的维度表。一开始画像只是一条总体印象（mode: 'summary'），
 * 等 AI 自己判断信息量足够、能从不止一个角度看出 user 的样子时，
 * 会自己决定转成分维度（mode: 'dimensions'），往后按维度各自演变。
 * 维度集合是固定的四个，不由 AI 自己发明新维度。
 */
export const PORTRAIT_DIMENSIONS = [
  { id: 'personality', label: '性格倾向' },
  { id: 'communication', label: '沟通风格' },
  { id: 'preference', label: '喜好偏好' },
  { id: 'emotion', label: '情绪模式' },
];

export const isValidPortraitDimensionId = (id) =>
  PORTRAIT_DIMENSIONS.some((dimension) => dimension.id === id);

export const getPortraitDimensionLabel = (id) =>
  PORTRAIT_DIMENSIONS.find((dimension) => dimension.id === id)?.label || id;

const toMs = (value) => {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * 判断现在能不能（手动）生成或重新生成一次画像。
 *
 * enabled           这一项功能有没有被 user 打开
 * totalUserMessages 目前这个聊天里 user 说过的消息总数
 * portrait          已经存的画像对象（可能是 null），需要用到它的 generatedAt
 * now               当前时间戳，测试时可以传固定值
 *
 * 返回 { allowed, reason, retryAfterMs }：
 *   reason 为 null 表示允许；否则是 'disabled' | 'not_enough_messages' | 'cooldown'
 */
export const canManuallyRegeneratePortrait = ({
  enabled = true,
  totalUserMessages = 0,
  portrait = null,
  now = Date.now(),
} = {}) => {
  if (!enabled) {
    return { allowed: false, reason: 'disabled', retryAfterMs: 0 };
  }

  if (totalUserMessages < PORTRAIT_MIN_MESSAGES) {
    return { allowed: false, reason: 'not_enough_messages', retryAfterMs: 0 };
  }

  const generatedAt = toMs(portrait?.generatedAt);

  if (generatedAt !== null && now - generatedAt < PORTRAIT_MANUAL_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterMs: PORTRAIT_MANUAL_COOLDOWN_MS - (now - generatedAt),
    };
  }

  return { allowed: true, reason: null, retryAfterMs: 0 };
};

/**
 * 判断现在能不能自动（后台定时）生成一次画像。
 * 跟手动的区别只是冷却时间不同（5 天 vs 12 小时），判断依据是同一个
 * generatedAt——手动触发过之后，这里也会顺带被推迟到 5 天后。
 *
 * 返回形状同 canManuallyRegeneratePortrait，reason 多一种 'too_soon'。
 */
export const canAutoRegeneratePortrait = ({
  enabled = true,
  totalUserMessages = 0,
  portrait = null,
  now = Date.now(),
} = {}) => {
  if (!enabled) {
    return { allowed: false, reason: 'disabled', retryAfterMs: 0 };
  }

  if (totalUserMessages < PORTRAIT_MIN_MESSAGES) {
    return { allowed: false, reason: 'not_enough_messages', retryAfterMs: 0 };
  }

  const generatedAt = toMs(portrait?.generatedAt);

  if (generatedAt !== null && now - generatedAt < PORTRAIT_AUTO_INTERVAL_MS) {
    return {
      allowed: false,
      reason: 'too_soon',
      retryAfterMs: PORTRAIT_AUTO_INTERVAL_MS - (now - generatedAt),
    };
  }

  return { allowed: true, reason: null, retryAfterMs: 0 };
};

export default {
  PORTRAIT_MIN_MESSAGES,
  PORTRAIT_MANUAL_COOLDOWN_MS,
  PORTRAIT_AUTO_INTERVAL_MS,
  PORTRAIT_SAMPLE_LIMIT,
  PORTRAIT_DIMENSIONS,
  isValidPortraitDimensionId,
  getPortraitDimensionLabel,
  canManuallyRegeneratePortrait,
  canAutoRegeneratePortrait,
};