// src/apps/messages/mood/moodBubbleDirective.js
//
// 头像心情气泡：角色完全自愿地在头像旁边挂一个小气泡（颜文字或极短的
// 词），表示此刻的心情。跟 confirmCard/bubbleStyle 一样属于"角色自己
// 判断要不要用"的可选行为，没有强制、没有概率/冷却限制——角色想换就
// 换，不想换气泡就保留上一次的内容，用户确认过这个不需要加节奏限制。
//
// 写法仍是隐藏标签模式：提示词让 AI 在正文任意位置单独写一行
// [MOOD: 内容] 或 [MOOD: 内容|效果]，解析时把这一行从正文里去掉，
// 再把内容存到 character.moodBubble 上（按角色，不是按聊天窗——同一个
// 角色在不同 chat 共享同一个心情气泡，跟角色签名/头像是同一级别的角色
// 属性）。
//
// 2026-10 改版：除了更新气泡，这次还会一并生成一条 mood_update 系统
// 消息（真正落库由调用方 aiService.js 负责，参照 confirmCardMessage/
// companionOfferMessage 的既有写法），让聊天记录里也留下"心情是在这里
// 变的"这条痕迹，不再只靠 header 气泡单独存在。标签里可选的
// "|效果名" 后缀是角色自己选的这条提示出场方式（SPOTLIGHT 聚光灯 /
// BOUNCE 砰一下弹入），不写就是普通淡入，同样完全自愿。

import db from '../../../db';

const MOOD_TAG_PATTERN = /\s*\[MOOD:\s*([^\]|]{1,10})(?:\|\s*(SPOTLIGHT|BOUNCE)\s*)?\]\s*/i;

export const MOOD_BUBBLE_PROMPT_NOTE = `
【可选：头像心情气泡】
如果这一刻你想让 User 一眼看到你现在的心情，可以在本次回复正文的任意
位置单独写一行（用户不会看到这行原始文字，只会看到它变成你头像旁边的
一个小气泡，同时聊天记录里会留一条"你更新了心情"的提示）：
[MOOD: 一个颜文字或很短的词，不超过 10 个字符]
这完全由你自己判断：想写就写，不写气泡会保留上一次的内容，多久换一次、
要不要换，都没有限制和要求，不是每次回复都需要带这个标签。

如果你还想让聊天记录里那条提示出场的方式更有感觉，可以在心情内容后面
加一竖线和一个效果名（原始写法同样不会被 User 看到）：
[MOOD: 一个颜文字或很短的词|SPOTLIGHT]   -> 聚光灯：周围先暗下来，聚焦这条提示
[MOOD: 一个颜文字或很短的词|BOUNCE]      -> 砰一下：提示先放大再弹回原样
不写效果名就是普通淡入，这个选择也完全自愿，不是每次都要挑一个。`;

/**
 * 从角色回复里取出 [MOOD: ...] 或 [MOOD: ...|效果] 标签，一律从正文
 * 去掉；只要能从标签里取到非空内容就落库到 character.moodBubble，
 * 并返回一条待落库的 mood_update 消息描述（真正写入 db.messages 由
 * 调用方负责，这里只负责解析和算出文案，不直接碰 chatId）。
 */
export const applyMoodBubbleDirective = async ({ characterId, characterName, content }) => {
  const original = String(content || '');
  const match = original.match(MOOD_TAG_PATTERN);
  const strippedContent = original.replace(MOOD_TAG_PATTERN, '').trim();

  if (!match || !characterId) {
    return { content: strippedContent, moodMessage: null };
  }

  const mood = match[1]?.trim();
  if (!mood) {
    return { content: strippedContent, moodMessage: null };
  }

  const effect = match[2] ? match[2].trim().toUpperCase() : 'FADE';

  try {
    await db.characters.update(characterId, {
      moodBubble: mood,
      moodBubbleUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MoodBubble] 更新心情气泡失败:', error);
  }

  const moodMessage = {
    type: 'mood_update',
    content: `${characterName || '对方'} 更新了心情：${mood}`,
    metadata: { mood, effect },
  };

  return { content: strippedContent, moodMessage };
};

export default {
  MOOD_BUBBLE_PROMPT_NOTE,
  applyMoodBubbleDirective,
};