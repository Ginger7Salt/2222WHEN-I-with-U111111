// src/apps/bubble/BubbleMessageRow.jsx
//
// 泡泡模式的消息渲染——一个轻量、专用的组件，不是整个复用
// messages/components/MessageRow.jsx（682行，深度耦合了MCP工具卡片/
// 戳一戳/线下邀约/长按反应面板/消息多选转发等一大堆跟泡泡模式无关的
// 机制）。整体复用的集成成本和风险都远超"最小核心链路"这一轮该有的
// 范围，所以这一轮改成自己写一个更简单的。
//
// 但富媒体卡片本身是复用的：TextCard/VoiceCard/ImageCard/TransferCard
// 这几个组件在 messages 那边就已经是完全通用、跟chat解耦的（只吃
// content/metadata/sender），直接拿来用，不重新写一套。
//
// 折叠：同一次AI回复用 ||| 拆出来的好几条消息，写入 bubbleMessages 时
// 共享同一个 groupId（见 bubbleAiService.js），这里按 groupId 分组
// 渲染——同一组只显示一次头像/名字，气泡紧凑堆叠，不需要额外的时间
// 窗口判断。

import React from 'react';
import { TextCard } from '../messages/components/cards/TextCard';
import { VoiceCard } from '../messages/components/cards/VoiceCard';
import { ImageCard } from '../messages/components/cards/ImageCard';
import { TransferCard } from '../messages/components/cards/TransferCard';

const renderCardContent = (msg) => {
  switch (msg.type) {
    case 'voice':
      return <VoiceCard content={msg.content} metadata={msg.metadata} />;
    case 'image':
      return <ImageCard content={msg.content} metadata={msg.metadata} />;
    case 'transfer':
      return (
        <TransferCard
          content={msg.content}
          metadata={msg.metadata}
          sender={msg.senderType === 'user' ? 'user' : 'character'}
        />
      );
    case 'error':
      return <span className="italic opacity-70">{msg.content}</span>;
    case 'text':
    default:
      return <TextCard content={msg.content} />;
  }
};

// 把按时间排好序的消息数组，按 groupId（同一次回复的 |||分段共享同一个）
// 折叠成一组一组，方便渲染时只显示一次头像/名字。
const groupMessages = (messages) => {
  const groups = [];
  let current = null;

  messages.forEach((msg) => {
    const key = msg.groupId || `single-${msg.id}`;

    if (current && current.key === key) {
      current.items.push(msg);
    } else {
      current = {
        key,
        senderId: msg.senderId,
        senderType: msg.senderType,
        items: [msg],
      };
      groups.push(current);
    }
  });

  return groups;
};

/**
 * @param {Array} messages 按时间正序排好的 bubbleMessages 记录
 * @param {Object} membersById 房间成员 { [characterId]: characterDoc }，
 *   用于渲染角色头像/名字
 */
const BubbleMessageRow = ({ messages, membersById }) => {
  const groups = groupMessages(messages);

  return (
    <>
      {groups.map((group) => {
        const isUser = group.senderType === 'user';
        const character = !isUser ? membersById[group.senderId] : null;

        return (
          <div
            key={group.key}
            className={`flex gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}
          >
            {!isUser && (
              <div
                className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-semibold"
                style={{ backgroundColor: 'var(--control-soft-bg)' }}
              >
                {character?.avatar ? (
                  <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{(character?.name || '?').slice(0, 1)}</span>
                )}
              </div>
            )}

            <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
              {!isUser && (
                <span className="text-[10px] opacity-50 px-1">
                  {character?.name || '未知角色'}
                </span>
              )}

              {group.items.map((msg) => (
                <div
                  key={msg.id}
                  className={`px-3 py-2 text-xs chat-font ${isUser ? 'user-bubble' : 'ai-bubble'}`}
                >
                  {renderCardContent(msg)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default BubbleMessageRow;