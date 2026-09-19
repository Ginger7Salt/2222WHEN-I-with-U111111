import { Heart, ThumbsUp, Laugh, Flame, Frown } from 'lucide-react';
import { REACTION_LABELS } from '../reactionLabels';

// 消息反应的固定类型表：全站零 Emoji，反应用 lucide 图标表达，
// 跟这个项目一贯"图标而不是表情符号"的视觉风格保持一致。
// id 是存进 db.messages 里 reactions 数组的稳定标识，不要随便改名，
// 改名会让老数据里已经存过的反应对不上号。
// color 是这个反应类型自己的专属颜色（不是统一的 accent-color），
// 让长按弹出的反应面板一眼就能看出每种情绪，不是清一色的灰调图标。
export const REACTION_TYPES = [
  { id: 'heart', label: REACTION_LABELS.heart, Icon: Heart, color: '#FF5D8F' },
  { id: 'like', label: REACTION_LABELS.like, Icon: ThumbsUp, color: '#4D96FF' },
  { id: 'laugh', label: REACTION_LABELS.laugh, Icon: Laugh, color: '#FFB020' },
  { id: 'flame', label: REACTION_LABELS.flame, Icon: Flame, color: '#FF7A45' },
  { id: 'sad', label: REACTION_LABELS.sad, Icon: Frown, color: '#7C93C3' },
];

export const getReactionTypeById = (id) => (
  REACTION_TYPES.find((reactionType) => reactionType.id === id) || null
);