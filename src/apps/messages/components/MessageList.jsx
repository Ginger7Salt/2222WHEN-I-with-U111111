import React from 'react';

import TypingIndicator from './TypingIndicator';
import McpToolUsageIndicator from './McpToolUsageIndicator';
import MessageRow from './MessageRow';
import DateDivider, { toDayKey } from './DateDivider';

const MessageList = ({
  visibleMessages,
  messagesById,
  bubbleDecoration,
  character,
  activeUserAvatar,
  activeUserName,
  isAiTyping,
  mcpTrace,
  typingText,
  typingStyle,
  hasMoreOlderMessages,
  onReroll,
  onDelete,
  onQuote,
    onSwitchVersion,
      onResolvedInteraction,
  onEnterOfflineScene,
  onToggleReaction,
  onOpenCompanionOffer,
  onRespondToConfirmCard,
  onPokeAvatar,
  onOpenProfileCard,
  selectionMode,
  selectedMessageIds,
  onToggleSelected,
  onEnterSelectionMode,
}) => {
  // 心情气泡只跟着"当前这一屏里最新那条角色消息"的头像出现一次——
  // 它展示的是 character.moodBubble 这个实时字段，不是每条历史消息
  // 自己的属性，所以不能让每一条角色消息的头像旁边都弹一个（那样
  // 翻旧消息历史时会显得到处都在重复弹同一句话）。
  let lastCharacterMessageId = null;
  for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
    if (visibleMessages[i]?.sender !== 'user') {
      lastCharacterMessageId = visibleMessages[i].id;
      break;
    }
  }

  return (
  <div className="space-y-4 pb-2">
    {visibleMessages.length === 0 && (
      <div className="space-y-2 py-16 text-center opacity-40">
        <p className="font-serif text-xs italic">
          此刻停在这里，等待你们的对话...
        </p>
      </div>
    )}

    {hasMoreOlderMessages && visibleMessages.length > 0 && (
      <div className="py-2 text-center text-[10px] opacity-40">
        向上滚动加载更早的消息...
      </div>
    )}

    {/*
      心情气泡只跟着"当前这一屏里最新那条角色消息"的头像出现一次，
      见上面 lastCharacterMessageId 的计算。
    */}

      {visibleMessages.map((msg, index) => {
      const quoted = msg.quotedMessageId
        ? messagesById.get(msg.quotedMessageId)
        : null;

      const prevMsg = visibleMessages[index - 1];
      const dayKey = toDayKey(msg.timestamp);
      const showDateDivider = dayKey !== null
        && dayKey !== toDayKey(prevMsg?.timestamp);

      return (
        <React.Fragment key={msg.id}>
          {showDateDivider && <DateDivider timestamp={msg.timestamp} />}

          <MessageRow
          msg={msg}
          quoted={quoted}
          bubbleDecoration={bubbleDecoration}
          character={character}
          activeUserAvatar={activeUserAvatar}
          activeUserName={activeUserName}
          isAiTyping={isAiTyping}
          onReroll={onReroll}
          onDelete={onDelete}
          onQuote={onQuote}
                    onSwitchVersion={onSwitchVersion}
                onResolvedInteraction={onResolvedInteraction}
          onEnterOfflineScene={onEnterOfflineScene}
          onToggleReaction={onToggleReaction}
                  onOpenCompanionOffer={onOpenCompanionOffer}
          onRespondToConfirmCard={onRespondToConfirmCard}
          onPokeAvatar={onPokeAvatar}
          onOpenProfileCard={onOpenProfileCard}
          showMoodBubble={msg.id === lastCharacterMessageId}
          selectionMode={selectionMode}
          isSelected={selectedMessageIds ? selectedMessageIds.has(msg.id) : false}
                  onToggleSelected={onToggleSelected}
          onEnterSelectionMode={onEnterSelectionMode}
          />
        </React.Fragment>
      );
    })}


    {isAiTyping && (
      <>
        {mcpTrace && (
          <McpToolUsageIndicator
            trace={mcpTrace}
          />
        )}

        <TypingIndicator
          customText={typingText}
          styleType={typingStyle}
        />
      </>
    )}
  </div>
  );
};

export default React.memo(MessageList);