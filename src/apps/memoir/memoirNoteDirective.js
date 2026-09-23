// src/apps/memoir/memoirNoteDirective.js
//
// 隐藏 tag 模式（写法照抄 companionOfferService.js）：
// 提示词里说明用法 -> 从回复正文里把标签取出、一律 strip 掉 -> 调用方决定
// 这份感受要挂在哪一条回忆上。
//
// 和"要不要生效"的邀请类标签不同：这个功能里，事件本身（是否点了外卖、
// 是否转了账、是否用了 MCP）完全由代码判定，不依赖这个标签；标签只负责
// "如果角色这次顺带交代了心情，就把它接住"，没写标签完全不影响回忆本身
// 被记下来，也不会因为漏写而少了一条回忆。

import { MEMOIR_EMOTION_LABEL_TO_ID, isValidMemoirEmotion } from './memoirEmotions';

const MEMORY_NOTE_TAG_PATTERN = /\s*\[MEMORY_NOTE:\s*([^\]]*)\]\s*/i;

export const MEMOIR_NOTE_PROMPT = `
【可选：共同经历的心情（回忆录）】
当这次互动里发生了下面任意一种"共同经历"：
- 你在这条回复里发送了心意转账卡片或代点外卖卡片；
- 你刚使用了某个外部工具（MCP）帮用户办成了一件事；
- 上一条用户消息是TA给你的转账或外卖；
可以在回复正文的最后单独一行，写下你此刻真实的心情（用户不会看到这行原始
文字，系统会把它转成回忆录里的一张卡片）：
[MEMORY_NOTE: 情绪=温暖/感动/开心/害羞/抱歉/担心/雀跃中选一个; 感受=一句话，20字以内]
如果这次没有发生以上任何一种情况，就不要写这个标签，正常回复即可。一次回复
最多只写一次该标签。`;

/**
 * 从回复正文中提取 [MEMORY_NOTE: 情绪=...; 感受=...] 标签，一律从正文去掉。
 * 没有标签、或标签格式不完整时，情绪/感受返回空值，调用方按"这次没有额外
 * 心情"处理，不影响回忆事件本身的记录。
 */
export const applyMemoirNoteDirective = (content) => {
  const original = String(content || '');
  const match = MEMORY_NOTE_TAG_PATTERN.exec(original);
  const strippedContent = original.replace(MEMORY_NOTE_TAG_PATTERN, '').trim();

  if (!match) {
    return { content: strippedContent, emotion: null, feeling: '' };
  }

  const raw = match[1] || '';
  const parts = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  let emotionLabel = '';
  let feeling = '';

  parts.forEach((part) => {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    const normalizedKey = (key || '').trim();

    if (normalizedKey === '情绪') emotionLabel = value;
    if (normalizedKey === '感受') feeling = value;
  });

  const emotionId = MEMOIR_EMOTION_LABEL_TO_ID.get(emotionLabel) || null;

  return {
    content: strippedContent,
    emotion: isValidMemoirEmotion(emotionId) ? emotionId : null,
    feeling: feeling.slice(0, 40),
  };
};