import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { REACTION_TYPES, getReactionTypeById } from './reactionTypes';

// 单个反应徽标：小图标 + 可选的来源角标（AI / 用户），
// 用样式区分来源而不是加文字，保持画面干净。
const ReactionBadge = ({ type, tone }) => {
  const reactionType = getReactionTypeById(type);
  if (!reactionType) return null;

  const { Icon, label } = reactionType;
  const isAiTone = tone === 'ai';

  return (
    <span
      title={isAiTone ? `TA：${label}` : `我：${label}`}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
      style={{
        background: isAiTone ? 'var(--accent-color)' : 'var(--control-soft-bg)',
        borderColor: isAiTone ? 'var(--accent-color)' : 'var(--card-border)',
        color: isAiTone ? 'var(--accent-foreground)' : 'var(--text-muted)',
      }}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
};

// 消息反应：展示这条消息已有的反应（我方 / TA 方各最多一个），
// 加一个小小的"+"触发按钮，点开后弹出反应类型选择。
// 再点一次已经选过的类型会取消，跟大多数聊天软件的"点反应"手感一致。
const MessageReactions = ({ reactions, isUser, onToggle }) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const safeReactions = Array.isArray(reactions) ? reactions : [];
  const userReaction = safeReactions.find((reaction) => reaction.by === 'user');
  const aiReaction = safeReactions.find((reaction) => reaction.by === 'ai');

  const handlePick = (typeId) => {
    onToggle(typeId);
    setPickerOpen(false);
  };

  return (
    <div
      tabIndex={-1}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPickerOpen(false);
        }
      }}
      className={`mt-0.5 flex items-center gap-1 px-9 outline-none ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {(userReaction || aiReaction) && (
        <div className="flex items-center gap-1">
          {aiReaction && <ReactionBadge type={aiReaction.type} tone="ai" />}
          {userReaction && <ReactionBadge type={userReaction.type} tone="user" />}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((previous) => !previous)}
          className="p-1 rounded-full opacity-30 transition-opacity hover:opacity-90"
          title="给这条消息一个反应"
          aria-label="给这条消息一个反应"
        >
          <SmilePlus className="h-3 w-3" />
        </button>

        {pickerOpen && (
          <div
            className={`absolute z-10 bottom-full mb-1.5 flex items-center gap-0.5 rounded-full border p-1 shadow-sm ${
              isUser ? 'right-0' : 'left-0'
            }`}
            style={{
              background: 'var(--card-bg-gradient)',
              borderColor: 'var(--card-border)',
            }}
          >
            {REACTION_TYPES.map((reactionType) => {
              const isSelected = userReaction?.type === reactionType.id;

              return (
                <button
                  key={reactionType.id}
                  type="button"
                  onClick={() => handlePick(reactionType.id)}
                  title={reactionType.label}
                  className="p-1.5 rounded-full transition-transform hover:scale-110"
                  style={{
                    color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                  }}
                >
                  <reactionType.Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageReactions;