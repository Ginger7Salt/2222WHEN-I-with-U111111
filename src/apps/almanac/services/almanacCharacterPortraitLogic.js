/*
 * 「TA 眼中的你」里"更深一层的印象"（角色用自己的口吻，写 user 是个什么样的人，
 * 并说明理由）的纯逻辑部分：只负责判断"现在能不能生成/重新生成"，不碰数据库、
 * 不发请求。这个文件不 import 任何东西，可以直接在 node 里测试。
 *
 * 这是一个需要真的调用 AI、会消耗 user 自己配置的 API 额度的功能，所以默认关闭，
 * 且只支持"手动点一下才生成"，不会在打开页面时自己偷偷调用 AI。
 *
 * 下面几个参数是这一轮实现时选的默认值，user 没有明确指定，可以随时调整：
 *   PORTRAIT_MIN_MESSAGES     生成一次画像至少需要多少条 user 说过的话，太少的话
 *                             AI 只能瞎编，没有意义。
 *   PORTRAIT_MANUAL_COOLDOWN_MS  两次手动重新生成之间的最短间隔，避免一分钟点好几
 *                             次、白白消耗 API 额度。
 *   PORTRAIT_SAMPLE_LIMIT     生成时最多取多少条 user 的历史消息给 AI 参考。
 */

export const PORTRAIT_MIN_MESSAGES = 30;
export const PORTRAIT_MANUAL_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 小时
export const PORTRAIT_SAMPLE_LIMIT = 40;

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

export default {
  PORTRAIT_MIN_MESSAGES,
  PORTRAIT_MANUAL_COOLDOWN_MS,
  PORTRAIT_SAMPLE_LIMIT,
  canManuallyRegeneratePortrait,
};