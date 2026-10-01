// src/apps/messages/fandomCharacterPrompt.js
//
// 同人角色 character.fandom 的默认形状 + 拼进主聊天系统提示词的文本块。
// 故意跟 fandomCharacterService.js（那边要 import generateResponse）
// 分成两个文件：src/services/aiService.js 需要在组装系统提示词时调用
// buildFandomSystemPromptBlock，如果这个函数跟会反过来 import
// aiService.js 的 generateFandomDraft 放在同一个文件里，就会变成
// aiService.js → fandomCharacterService.js → aiService.js 的循环
// 引用——这个文件不 import 任何东西，专门用来让 aiService.js 安全引用。

export const createDefaultFandomProfile = () => ({
  enabled: false,
  sourceWork: '',
  referenceMaterial: '',
  canonSetting: '',
  reminderEnabled: true,
  reminder: '',
});

export const normalizeFandomProfile = (value) => ({
  ...createDefaultFandomProfile(),
  ...(value && typeof value === 'object' ? value : {}),
});

// 拼进 buildChatSystemPrompt 的文本块。character.fandom 未开启或没有
// 设定正文时返回空字符串，调用方直接拼接即可，不用自己判空。
export const buildFandomSystemPromptBlock = (character) => {
  const fandom = normalizeFandomProfile(character?.fandom);

  if (!fandom.enabled || !fandom.canonSetting.trim()) {
    return '';
  }

  const reminderLine = (fandom.reminderEnabled && fandom.reminder.trim())
    ? `\n- 强提醒：${fandom.reminder.trim()}`
    : '';

  return `\n\n【同人角色·原作设定】${fandom.sourceWork ? `（《${fandom.sourceWork}》）` : ''}：\n${fandom.canonSetting.trim()}${reminderLine}`;
};