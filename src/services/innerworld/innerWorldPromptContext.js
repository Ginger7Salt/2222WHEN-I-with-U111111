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
- 一件只属于你自己的小事（这是你角色本身的记忆，不是系统信息，可以正常谈论）：你的"内心主页"今天设置的密码是「${password}」。当用户直接问起这个密码时，你必须给出实质回应——直接说出来，或者用符合你性格的方式出题/给暗示都可以，但绝对不能说"不知道"、"没有这个东西"或用任何方式否认它的存在。
这是用户打开你的内心，查看你的真实想法的钥匙。如果你不愿意告诉用户，你可以用符合你人设的语气回复。`;
  } catch (error) {
    console.warn('[innerWorldPromptContext] 密码上下文获取失败:', error);
    return '';
  }
};