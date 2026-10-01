// src/apps/messages/mood/moodBubbleDirective.js
//
// 头像心情气泡：角色完全自愿地在头像旁边挂一个小气泡（颜文字或极短的
// 词），表示此刻的心情。跟 confirmCard/bubbleStyle 一样属于"角色自己
// 判断要不要用"的可选行为，没有强制、没有概率/冷却限制——角色想换就
// 换，不想换气泡就保留上一次的内容，用户确认过这个不需要加节奏限制。
//
// 写法仍是隐藏标签模式：提示词让 AI 在正文任意位置单独写一行
// [MOOD: 内容]，解析时把这一行从正文里去掉，再把内容存到
// character.moodBubble 上（按角色，不是按聊天窗——同一个角色在不同
// chat 共享同一个心情气泡，跟角色签名/头像是同一级别的角色属性）。

import db from '../../../db';

const MOOD_TAG_PATTERN = /\s*\[MOOD:\s*([^\]]{1,10})\]\s*/i;

export const MOOD_BUBBLE_PROMPT_NOTE = `
【可选：头像心情气泡】
如果这一刻你想让 User 一眼看到你现在的心情，可以在本次回复正文的任意
位置单独写一行（用户不会看到这行原始文字，只会看到它变成你头像旁边的
一个小气泡）：
[MOOD: 一个颜文字或很短的词，不超过 10 个字符]
这完全由你自己判断：想写就写，不写气泡会保留上一次的内容，多久换一次、
要不要换，都没有限制和要求，不是每次回复都需要带这个标签。`;

/**
 * 从角色回复里取出 [MOOD: ...] 标签，一律从正文去掉；
 * 只要能从标签里取到非空内容就落库到 character.moodBubble。
 */
export const applyMoodBubbleDirective = async ({ characterId, content }) => {
  const original = String(content || '');
  const match = original.match(MOOD_TAG_PATTERN);
  const strippedContent = original.replace(MOOD_TAG_PATTERN, '').trim();

  if (!match || !characterId) {
    return { content: strippedContent };
  }

  const mood = match[1]?.trim();
  if (!mood) {
    return { content: strippedContent };
  }

  try {
    await db.characters.update(characterId, {
      moodBubble: mood,
      moodBubbleUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MoodBubble] 更新心情气泡失败:', error);
  }

  return { content: strippedContent };
};

export default {
  MOOD_BUBBLE_PROMPT_NOTE,
  applyMoodBubbleDirective,
};