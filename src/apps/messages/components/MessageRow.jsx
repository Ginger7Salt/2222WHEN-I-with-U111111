import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Quote,
  Trash2,
  CheckCheck,
  Check,
  User,
} from 'lucide-react';

import ChatInteractionMessage from '../interactions/ChatInteractionMessage';
import OfflineInviteCard from '../../offline/OfflineInviteCard';
import RealVoiceCard from '../../../features/real-voice/components/RealVoiceCard';
import CallLogEntry from './CallLogEntry';

import LocationCard from './cards/LocationCard';

import MessageReactions from './MessageReactions';
import ReactionPickerPopover from './ReactionPickerPopover';
import { matchSpecialMessageEffect, RECENT_MESSAGE_EFFECT_WINDOW_MS } from './specialMessageEffects';
import { BubbleDecorationOverlay } from './bubbleDecorations';

import TextCard from './cards/TextCard';
import ImageCard from './cards/ImageCard';
import VoiceCard from './cards/VoiceCard';
import TransferCard from './cards/TransferCard';
import ArticleCard from './cards/ArticleCard';
import GiftCard from './cards/GiftCard';
import FoodDeliveryCard from './cards/FoodDeliveryCard';
import KinshipCard from './cards/KinshipCard';
import OrderRequestCard from './cards/OrderRequestCard';
import StickerCard from './cards/StickerCard';
import PhotoCard from './cards/PhotoCard';
import McpUsageTraceCard from './cards/McpUsageTraceCard';
import CompanionOfferCard from './cards/CompanionOfferCard';

import McdOrderCard from './cards/McdOrderCard';
import AppleHealthCard from './cards/AppleHealthCard';
import RobotActionCard from './cards/RobotActionCard';
import AppleCalendarCard from './cards/AppleCalendarCard';
import LuckinCoffeeCard from './cards/LuckinCoffeeCard';
import NeteaseMusicCard from './cards/NeteaseMusicCard';
import { DidiRideCard } from './cards/DidiRideCard';
import WeatherCard from './cards/WeatherCard';

// 长按多久才算"长按"、弹出反应面板。太短容易跟正常点击冲突，
// 太长又会显得迟钝，420ms 是比较常见的手感。
const REACTION_LONG_PRESS_MS = 420;

const MessageRow = ({
  msg,
  quoted,
  bubbleDecoration,
  character,
  activeUserAvatar,
  activeUserName,
  isAiTyping,
  onReroll,
  onDelete,
  onQuote,
  onSwitchVersion,
    onResolvedInteraction,
  onEnterOfflineScene,
  onToggleReaction,
  onOpenCompanionOffer,
  selectionMode,
  isSelected,
  onToggleSelected,
  onEnterSelectionMode,
}) => {
  const isUser = msg.sender === 'user';
  const versions = msg.versions || [];
  const versionIndex = msg.currentVersionIndex
    ?? (versions.length > 1 ? versions.length - 1 : 0);

  const isErrorMsg = (
    msg.type === 'error'
    || msg.metadata?.errorCode
  );

  // 特殊消息效果（比如"想你"飘小星星）：只在消息内容命中规则、
  // 且是这个会话打开期间刚刚到达的消息时才播放，翻旧消息历史
  // 不会反复重播。
  const specialEffectRule = msg.type === 'text'
    ? matchSpecialMessageEffect(msg.content)
    : null;

  const messageTimestampMs = new Date(
    msg.timestamp || msg.createdAt || 0
  ).getTime();

  const showSpecialEffect = Boolean(specialEffectRule)
    && Number.isFinite(messageTimestampMs)
    && (Date.now() - messageTimestampMs) < RECENT_MESSAGE_EFFECT_WINDOW_MS;

  const canReact = !isErrorMsg
    && msg.type !== 'interaction'
    && msg.type !== 'offline_invite'
    && msg.type !== 'call';

  // 长按消息气泡弹出反应选择面板：用 pointer 事件统一处理鼠标和
  // 触屏，按住超过 REACTION_LONG_PRESS_MS 才算长按，普通点击（比如
  // 点图片看大图、点链接）不会被误触发。
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPressTimerRef = useRef(null);

  const clearReactionPressTimer = useCallback(() => {
    if (reactionPressTimerRef.current) {
      window.clearTimeout(reactionPressTimerRef.current);
      reactionPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearReactionPressTimer(), [clearReactionPressTimer]);

  const handleBubblePointerDown = useCallback(() => {
    if (!canReact || selectionMode) return;

    clearReactionPressTimer();
    reactionPressTimerRef.current = window.setTimeout(() => {
      setShowReactionPicker(true);
    }, REACTION_LONG_PRESS_MS);
  }, [canReact, selectionMode, clearReactionPressTimer]);

  const handleBubblePointerRelease = useCallback(() => {
    clearReactionPressTimer();
  }, [clearReactionPressTimer]);

  const handleBubbleContextMenu = useCallback((event) => {
    if (canReact) {
      event.preventDefault();
    }
  }, [canReact]);

  const userReactionType = Array.isArray(msg.reactions)
    ? msg.reactions.find((reaction) => reaction.by === 'user')?.type
    : undefined;

  const handlePickReaction = useCallback((typeId) => {
    onToggleReaction(msg.id, typeId);
    setShowReactionPicker(false);
  }, [msg.id, onToggleReaction]);

  // 从反应面板里点"选择"：收起面板，把这条消息作为多选模式的
  // 第一条选中项交给 ChatRoom 去开启多选模式。
  const handleEnterSelect = useCallback(() => {
    setShowReactionPicker(false);
    onEnterSelectionMode?.(msg.id);
  }, [msg.id, onEnterSelectionMode]);

  // 多选模式下点一下消息本体（不是长按）就切换勾选，跟长按反应
  // 面板互斥——canReact 同时也是"这条消息允许被多选"的判定，
  // 两者复用同一份"普通内容消息"名单，不允许多选的消息类型
  // （互动/线下邀约/通话记录/错误消息）点击时什么都不做。
  const handleBubbleSelectClick = useCallback((event) => {
    if (!selectionMode || !canReact) return;

    event.preventDefault();
    event.stopPropagation();
    onToggleSelected?.(msg.id);
  }, [selectionMode, canReact, msg.id, onToggleSelected]);

  const messageMcpTrace = isUser
    ? null
    : msg.metadata?.mcpTrace;

  const messageOrderCard = isUser
    ? null
    : msg.metadata?.mcpCard;

  return (
    <div
      className={`flex items-start gap-1.5 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {selectionMode && (
        <button
          type="button"
          disabled={!canReact}
          onClick={() => onToggleSelected?.(msg.id)}
          className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all disabled:opacity-25"
          style={{
            background: isSelected
              ? 'var(--accent-color)'
              : 'var(--control-soft-bg)',
            borderColor: isSelected
              ? 'var(--accent-color)'
              : 'var(--card-border)',
          }}
          aria-label={isSelected ? '取消选择这条消息' : '选择这条消息'}
        >
          {isSelected && (
            <Check
              className="h-3 w-3"
              style={{ color: 'var(--accent-foreground)' }}
            />
          )}
        </button>
      )}

      <div
        className={`group flex flex-1 flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
        onClickCapture={handleBubbleSelectClick}
      >
      {quoted && (
        <div
          className="mb-1 max-w-[75%] rounded-xl border-l-2 px-3 py-1 text-[10px] opacity-60"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--divider)',
          }}
        >
          <span className="block font-bold">
            {quoted.sender === 'user'
              ? activeUserName
              : (character?.name || '伴侣')}
          </span>
          <p className="truncate">{quoted.content}</p>
        </div>
      )}

      <div
        className={`flex max-w-[85%] items-end gap-2 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {!isUser ? (
          character?.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
              style={{
                borderColor: 'var(--card-border)',
              }} loading="lazy" decoding="async" />
          ) : (
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: 'var(--control-soft-bg)',
              }}
            >
              {character?.name?.[0]}
            </div>
          )
        ) : activeUserAvatar ? (
          <img
            src={activeUserAvatar}
            alt={activeUserName}
            className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
            style={{
              borderColor: 'var(--card-border)',
            }} loading="lazy" decoding="async" />
        ) : (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: 'var(--control-soft-bg)',
            }}
          >
            <User className="h-3.5 w-3.5 opacity-60" />
          </div>
        )}

        <div className="flex flex-col gap-1">
          {isErrorMsg ? (
            <div
              className="space-y-2 rounded-2xl border p-3 shadow-sm chat-font"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: 'var(--text-main)',
              }}
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-red-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  API 报错: {msg.metadata?.errorCode || 'ERROR'}
                </span>
              </div>

              <p className="text-[11px] opacity-90">
                {msg.content}
              </p>

              <button
                type="button"
                onClick={() => onReroll(msg.id)}
                className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
              >
                <RotateCw className="h-3 w-3" />
                <span>重新尝试 (Re-roll)</span>
              </button>
            </div>
                    ) : msg.type === 'interaction' ? (
            <ChatInteractionMessage
              message={msg}
              character={character}
              onResolved={onResolvedInteraction}
            />
          ) : msg.type === 'offline_invite' ? (
            <OfflineInviteCard
              message={msg}
                            onEnterScene={onEnterOfflineScene}
              onRefresh={onResolvedInteraction}
            />
          ) : msg.type === 'companion_offer' ? (
            <CompanionOfferCard
              message={msg}
              chatId={msg.chatId}
              onAccept={() => onOpenCompanionOffer?.()}
            />
          ) : msg.type === 'call' ? (
            <CallLogEntry
              message={msg}
              isUser={isUser}
              character={character}
              userName={activeUserName}
              userAvatar={activeUserAvatar}
            />
          ) : (
            <div
              className={`relative p-3 shadow-sm transition-all chat-font ${
                isUser ? 'user-bubble' : 'ai-bubble'
              }`}
              onPointerDown={handleBubblePointerDown}
              onPointerUp={handleBubblePointerRelease}
              onPointerLeave={handleBubblePointerRelease}
              onPointerCancel={handleBubblePointerRelease}
              onContextMenu={handleBubbleContextMenu}
            >
              <BubbleDecorationOverlay decoration={bubbleDecoration} isUser={isUser} />
              {showSpecialEffect && <specialEffectRule.Effect />}

              <ReactionPickerPopover
                open={showReactionPicker}
                isUser={isUser}
                selectedType={userReactionType}
                onPick={handlePickReaction}
                onClose={() => setShowReactionPicker(false)}
                onEnterSelect={handleEnterSelect}

                            />

              {msg.type === 'text' && (
                <>
                  {msg.metadata?.autoReply && (
                    <div className="mb-1 text-[10px] opacity-60">自动回复</div>
                  )}
                  <TextCard content={msg.content} />
                </>
              )}

              {msg.type === 'image' && (
                <ImageCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'voice' && (
                <VoiceCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'realVoice' && (
                <RealVoiceCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'transfer' && (
                <TransferCard
                  content={msg.content}
                  metadata={msg.metadata}
                  sender={msg.sender}
                />
              )}

              {msg.type === 'article' && (
                <ArticleCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'gift' && (
                <GiftCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

              {msg.type === 'food' && (
                <FoodDeliveryCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

              {msg.type === 'kinship' && (
                <KinshipCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

              
              {msg.type === 'order_request' && (
                <OrderRequestCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

              {msg.type === 'sticker' && (
                <StickerCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

{msg.type === 'location' && (
  <LocationCard
    metadata={msg.metadata}
    isUser={isUser}
  />
)}

{msg.type === 'photo' && (
  <PhotoCard
    metadata={msg.metadata}
    messageId={msg.id}
    isUser={isUser}
  />
)}


            </div>
          )}

          {/* 消息反应展示条：长按气泡弹出的选择面板见上方 ReactionPickerPopover */}
          {canReact && (
            <MessageReactions
              reactions={msg.reactions}
              isUser={isUser}
            />
          )}

          {/* MCP 外接痕迹通用胶囊 */}
          {!isUser && messageMcpTrace && (
            <McpUsageTraceCard
              trace={messageMcpTrace}
            />
          )}

          {/* 麦当劳专属卡片 */}
          {!isUser && messageOrderCard?.kind === 'mcd' && (
            <McdOrderCard
              card={messageOrderCard}
            />
          )}

          {/* Apple Watch 健康体征卡片 */}
          {!isUser && messageOrderCard?.kind === 'health' && (
            <AppleHealthCard
              card={messageOrderCard}
            />
          )}

          {/* StackChan 桌面机器人专属卡片 */}
          {!isUser && messageOrderCard?.kind === 'robot' && (
            <RobotActionCard
              card={messageOrderCard}
            />
          )}

          {/*  Apple 日历专属卡片 */}
          {!isUser && messageOrderCard?.kind === 'apple_calendar' && (
            <AppleCalendarCard
              card={messageOrderCard}
            />
          )}

          {/* 瑞幸咖啡专属卡片 */}
          {!isUser && messageOrderCard?.kind?.startsWith('luckin_') && (
            <LuckinCoffeeCard
              card={messageOrderCard}
            />
          )}

          {/* 网易云音乐专属无框动效卡片 */}
          {!isUser && messageOrderCard?.kind === 'netease_music' && (
            <NeteaseMusicCard
              card={messageOrderCard}
            />
          )}
{/* 滴滴打车专属卡片 */}
{!isUser && messageOrderCard?.kind === 'didi_ride' && (
  <DidiRideCard card={messageOrderCard} />
)}

{/* 天气与天文环境专属卡片 */}
{!isUser && messageOrderCard?.kind === 'weather' && (
  <WeatherCard card={messageOrderCard} />
)}



        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isUser && (
            <button
              type="button"
              onClick={() => onReroll(msg.id)}
              disabled={isAiTyping}
              className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
              title="重 roll 此回复"
            >
              <RotateCw className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onQuote(msg)}
            className="p-1 opacity-50 hover:opacity-100"
            title="引用"
          >
            <Quote className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(msg.id)}
            className="p-1 opacity-50 hover:opacity-100"
            title="抹去"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div
        className={`mt-1 flex items-center gap-2 px-9 font-mono text-[9px] opacity-60 ${
          isUser ? 'justify-end' : 'justify-start'
        }`}
      >
        {versions.length > 1 && (
          <div
            className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            <button
              type="button"
              onClick={() => onSwitchVersion(msg, 'prev')}
              disabled={versionIndex === 0}
              className="p-0.5 hover:opacity-100 disabled:opacity-20"
              title="上一版本"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>

            <span className="px-1 text-[9px] font-bold">
              {versionIndex + 1} / {versions.length}
            </span>

            <button
              type="button"
              onClick={() => onSwitchVersion(msg, 'next')}
              disabled={versionIndex === versions.length - 1}
              className="p-0.5 hover:opacity-100 disabled:opacity-20"
              title="下一版本"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}

        <span>
          {new Date(msg.timestamp || msg.createdAt || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {isUser ? (
          <CheckCheck
            className="h-3 w-3"
            style={{
              color: 'var(--text-muted)',
            }}
          />
        ) : (
          <Check
            className="h-3 w-3"
            style={{
              color: 'var(--text-muted)',
            }}
          />
        )}
      </div>
    </div>
    </div>
  );
};

export default React.memo(MessageRow);