// 反应类型 -> 中文标签的对照表，是唯一的真源。
// src/apps/messages/components/reactionTypes.jsx（UI 图标定义）和
// src/services/aiService.js（喂给 AI 的历史文本）都从这里取标签，
// 避免同一份文案抄两遍、改一个忘了改另一个。
export const REACTION_LABELS = {
  heart: '心动',
  like: '支持',
  laugh: '好笑',
  flame: '绝了',
  sad: '心疼',
};

export const getReactionLabel = (typeId) => REACTION_LABELS[typeId] || null;