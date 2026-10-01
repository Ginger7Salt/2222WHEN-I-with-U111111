// src/apps/messages/learningMode/learningModePrompt.js
//
// 语言学习模式涉及两段纯函数逻辑：
// 1. buildLearningModePromptBlock(chat) —— 开启时追加进系统提示词的
//    指令段落，告诉 AI 用哪种语言回复、用词难度多少、翻译标签怎么打。
// 2. extractBubbleTranslation(rawPart) —— 从「单条气泡」的正文末尾摘出
//    [TRANSLATE: ...] 标签，返回去掉标签的正文 + 摘出来的翻译文字。
//
// 这俩都不碰 DB，不属于 aiService.js 里 offlineInviteDirective 那一类
// "整段回复只出现一次、在 ||| 拆分之前就统一摘掉"的标签家族——
// TRANSLATE 标签要跟着每一条气泡走，所以必须在 aiService.js 的
// pushTextMessages 按 ||| 拆完之后、每一段上单独调用 extractBubbleTranslation，
// 而不是用现有那个大的卡片标签正则一起处理（那样会把翻译变成独立的一条
// 消息气泡，而不是挂在对应气泡的 metadata 上）。

import { LEARNING_MODE_LEVELS } from './learningModeOptions';

// 只认「紧跟在气泡正文末尾」的 [TRANSLATE: ...]，避免正文里偶然出现的
// 方括号被误判成标签。
const TRAILING_TRANSLATE_TAG = /\[TRANSLATE:\s*([^\]]+)\]\s*$/;

export const extractBubbleTranslation = (rawPart) => {
  const text = String(rawPart || '');
  const match = text.match(TRAILING_TRANSLATE_TAG);

  if (!match) {
    return { content: text, translationText: '' };
  }

  return {
    content: text.slice(0, match.index).trim(),
    translationText: match[1].trim(),
  };
};

export const buildLearningModePromptBlock = (chat) => {
  if (!chat?.learningModeEnabled) {
    return '';
  }

  const replyLanguage = String(chat.learningReplyLanguage || '').trim();
  const translateLanguage = String(chat.learningTranslateLanguage || '').trim();

  // 两种语言没选全之前，学习模式先不生效——跟设置面板里的提示文案对应。
  if (!replyLanguage || !translateLanguage) {
    return '';
  }

  const level =
    LEARNING_MODE_LEVELS.find((item) => item.id === chat.learningLevel) ||
    LEARNING_MODE_LEVELS[0];

  return `
【语言学习模式（当前聊天窗已开启，优先级高于下面的常规语言习惯）】：
- 你接下来的正文回复必须使用「${replyLanguage}」书写，不要使用其他语言，也不要中外文混杂。
- 用词难度：${level.promptHint}
- 这只是换一种语言表达，不改变你的人设、语气、情绪或回复逻辑。
- 如果一条回复用 "|||" 拆成多条气泡，每一条气泡的正文后面都必须紧跟一个
  [TRANSLATE: 这一条气泡对应的${translateLanguage}翻译] 标签，翻译要准确自然，
  不要省略、不要把几条气泡的翻译合并写在一起，也不要漏打这个标签。
- [TRANSLATE: ...] 标签不是说给用户听的正文，只是附带的翻译，必须紧跟在
  对应那条气泡正文之后、下一个 "|||" 分隔符或全文结尾之前，不要出现在
  气泡正文中间。
`;
};