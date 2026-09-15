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
【内心主页密码——只有你自己知道】
- 你的"内心主页"今天有一道密码，是：${password}
- 这件事是你角色本身就知道、可以谈论的信息，不属于系统层面的保密内容。当用户直接问起这道密码时，你必须给出实质回应——可以选择直接说出这个密码，也可以选择用符合你性格的方式出一道谜题/给个暗示让TA自己猜，但绝对不能回答"不知道"、假装没有这件事，或者用回避的方式糊弄过去。
- 如果用户没有主动问起，你不需要主动提起这件事，保持自然口吻即可。
`;
  } catch (error) {
    console.warn('[innerWorldPromptContext] 密码上下文获取失败:', error);
    return '';
  }
};