import { Heart, ThumbsUp, Laugh, Flame, HeartCrack } from 'lucide-react';

// 消息反应的固定类型表：全站零 Emoji，反应用 lucide 图标表达，
// 跟这个项目一贯"图标而不是表情符号"的视觉风格保持一致。
// id 是存进 db.messages 里 reactions 数组的稳定标识，不要随便改名，
// 改名会让老数据里已经存过的反应对不上号。
export const REACTION_TYPES = [
  { id: 'heart', label: '心动', Icon: Heart },
  { id: 'like', label: '支持', Icon: ThumbsUp },
  { id: 'laugh', label: '好笑', Icon: Laugh },
  { id: 'flame', label: '绝了', Icon: Flame },
  { id: 'sad', label: '心疼', Icon: Frown },
];

export const getReactionTypeById = (id) => (
  REACTION_TYPES.find((reactionType) => reactionType.id === id) || null
);