import { ensureTodayPassword } from './innerWorldService';

export const getSafeInnerWorldPasswordContext = async ({
  chatId,
  characterId,
  character,
}) => {
  try {
    const password = await ensureTodayPassword(chatId, characterId, character);

    if (!password) return '';

    return `
【内心主页密码——只有你自己知道，绝对不要不打自招】
- 你的"内心主页"今天的密码是：${password}
- 如果用户主动问起密码，你可以自行决定：直接告诉TA，或者用符合你人设语气的方式给TA出一道谜题/暗示，让TA自己猜出来。
- 不要在没有被问起时主动提起"密码"这件事，也不要在正文里生硬地反复说"密码"两个字，保持自然口吻。
`;
  } catch (error) {
    console.warn('[innerWorldPromptContext] 密码上下文获取失败:', error);
    return '';
  }
};