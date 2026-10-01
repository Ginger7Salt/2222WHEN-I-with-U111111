// src/apps/messages/work/workKaomojiDirective.js
//
// work 聊天窗的头像兜底：没有传头像图片时，用一个颜文字代表助理当前的
// 状态/心情，顶在头像的坑位上，跟着每次回复变化——这是强制行为，不是
// "概率+冷却"的可选项（参考 avatarHistoryDirective.js 那种），所以这里
// 没有 offered/cooldown 这一套，只要是 work 模式就一定要求它带这个标签。
//
// 写法仍然是隐藏标签模式：提示词让 AI 在正文最后单独一行写
// [KAOMOJI: 颜文字本身]，解析时把这一行从正文里去掉，再把颜文字存到
// chat.statusKaomoji 上（按聊天窗独立，不是全局共享的助理身份字段）。

import db from '../../../db';

const KAOMOJI_TAG_PATTERN = /\s*\[KAOMOJI:\s*([^\]]{1,12})\]\s*/i;

// 解析失败/模型没遵守格式时的兜底颜文字，避免头像坑位直接空着。
export const DEFAULT_WORK_KAOMOJI = '(・ω・)';

export const WORK_KAOMOJI_PROMPT_NOTE = `
【必须行为：用颜文字表示你当前的状态】
你没有头像图片，你的"脸"是一个颜文字。请在本次回复正文的最后单独一行，
写上一个能代表你此刻状态/心情的颜文字（比如专注、放松、有点好笑、略显
无奈等等，根据这次对话的内容和情绪自己选），格式如下（用户不会看到这行
原始文字，只会看到它被渲染成你的头像）：
[KAOMOJI: 颜文字本身]

只写颜文字本身，不要加任何说明文字，长度控制在 1-8 个字符以内。这是每次
回复都必须做的事，不是可选项。`;

/**
 * 从角色回复里取出 [KAOMOJI: ...] 标签，一律从正文去掉；
 * work 模式下才会真的落库（其它模式不会被喂这条提示词，理论上不会
 * 命中，但这里仍然加一道 isWorkMode 校验，避免误触发）。
 */
export const applyWorkKaomojiDirective = async ({ chatId, content, isWorkMode }) => {
  const original = String(content || '');
  const match = original.match(KAOMOJI_TAG_PATTERN);
  const strippedContent = original.replace(KAOMOJI_TAG_PATTERN, '').trim();

  if (!isWorkMode || !chatId) {
    return { content: strippedContent };
  }

  const kaomoji = match?.[1]?.trim();

  try {
    await db.chats.update(chatId, {
      statusKaomoji: kaomoji || DEFAULT_WORK_KAOMOJI,
    });
  } catch (error) {
    console.error('[WorkKaomoji] 更新状态颜文字失败:', error);
  }

  return { content: strippedContent };
};

export default {
  WORK_KAOMOJI_PROMPT_NOTE,
  DEFAULT_WORK_KAOMOJI,
  applyWorkKaomojiDirective,
};