import React from 'react';
import { getReactionTypeById } from './reactionTypes';

// 单个反应徽标：用反应类型自己的颜色区分情绪，
// TA 点的用实心底色，我方点的用同色的半透明底，一眼能分清谁点的。
const ReactionBadge = ({ type, tone }) => {
  const reactionType = getReactionTypeById(type);
  if (!reactionType) return null;

  const { Icon, label, color } = reactionType;
  const isAiTone = tone === 'ai';
  // 图标的颜色/填色必须直接写在 <Icon> 自己身上——写在外层 <span>
  // 上不会可靠地继承下去（之前就是这么踩的坑，图标全变灰/黑）。
  const iconColor = isAiTone ? '#fff' : color;

  return (
    <span
      title={isAiTone ? `TA：${label}` : `我：${label}`}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
      style={{
        background: isAiTone ? color : `${color}26`,
        borderColor: color,
      }}
    >
      <Icon className="h-3 w-3" style={{ color: iconColor }} fill={iconColor} />
    </span>
  );
};

// 消息反应展示条：只负责显示这条消息已有的反应（我方 / TA 方各
// 最多一个），本身不带触发入口——触发入口是长按消息气泡弹出的
// ReactionPickerPopover，两者分开，这里保持纯展示、常驻可见。
const MessageReactions = ({ reactions, isUser }) => {
  const safeReactions = Array.isArray(reactions) ? reactions : [];
  const userReaction = safeReactions.find((reaction) => reaction.by === 'user');
  const aiReaction = safeReactions.find((reaction) => reaction.by === 'ai');

  if (!userReaction && !aiReaction) {
    return null;
  }

  return (
    <div
      className={`mt-0.5 flex items-center gap-1 px-9 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {aiReaction && <ReactionBadge type={aiReaction.type} tone="ai" />}
      {userReaction && <ReactionBadge type={userReaction.type} tone="user" />}
    </div>
  );
};

export default MessageReactions;