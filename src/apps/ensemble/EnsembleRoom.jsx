import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Sliders,
  Send,
  Sparkles,
  Smile,
  Image as ImageIcon,
  Cat
} from 'lucide-react';
import db from '../../db';
import {
  generateEnsembleAiResponse,
  getRecentEnsembleMessagesWindow,
  getOlderEnsembleMessagesBefore
} from './ensembleService';
import { EnsembleUserSelector } from './components/EnsembleUserSelector';
import { EnsembleMessageItem } from './components/EnsembleMessageItem';
import { EnsembleSettingsModal } from './components/EnsembleSettingsModal';
import { EnsembleImagePromptModal } from './components/EnsembleImagePromptModal';
import StickerPickerModal from '../messages/components/StickerPickerModal';

// 首屏只加载最近这么多条消息，上滑到顶部再按同样的批量增量加载，
// 不再每次都把整个大群的历史消息读出来。数值跟主聊天 ChatRoom.jsx
// 保持一致，方便以后统一调整。
const INITIAL_VISIBLE_MESSAGE_COUNT = 200;
const LOAD_MORE_MESSAGE_BATCH = 200;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 150;
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 80;

export const EnsembleRoom = ({
  chatId,
  onBack,
  onChatRoomStateChange
}) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiError, setAiError] = useState('');
  const [quotedMessage, setQuotedMessage] = useState(null);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(true);

  const [userIdentities, setUserIdentities] = useState([]);
  const [currentIdentityId, setCurrentIdentityId] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // 分页相关的记账用 ref：当前已加载条数、是否正在加载更早消息、
  // 加载更早消息前的滚动高度（用于加载完成后把视口钉在原位置，
  // 不因为顶部插入了新内容而"跳"一下）、当前是否贴在底部。
  const loadedMessageCountRef = useRef(INITIAL_VISIBLE_MESSAGE_COUNT);
  const isLoadingMoreRef = useRef(false);
  const previousScrollHeightRef = useRef(null);
  const isPinnedToBottomRef = useRef(true);

  useEffect(() => {
    onChatRoomStateChange?.(true);

    setHasMoreOlderMessages(true);
    loadedMessageCountRef.current = INITIAL_VISIBLE_MESSAGE_COUNT;
    previousScrollHeightRef.current = null;
    isLoadingMoreRef.current = false;
    isPinnedToBottomRef.current = true;

    void loadRoomData();

    return () => {
      onChatRoomStateChange?.(false);
    };
  }, [chatId]);

  const loadRoomData = async () => {
    const chatDoc = await db.ensembleChats.get(chatId);

    if (!chatDoc) return;

    const identities =
      chatDoc.userIdentities?.length > 0
        ? chatDoc.userIdentities
        : [
            {
              id: 'u_default',
              name: '我',
              avatar: '',
              persona: '主视角'
            }
          ];

    setChat(chatDoc);
    setUserIdentities(identities);
    setCurrentIdentityId(
      chatDoc.currentIdentityId || identities[0]?.id || 'u_default'
    );

    await loadMessages();
  };

  /*
   * 只取"最近 loadedMessageCountRef.current 条"这一窗口，而不是整个
   * 大群的历史消息。loadedMessageCountRef 会随着用户上滑加载更早消息
   * 而增大，所以刷新（发消息/删消息/AI 回复后）时不会把已经展开的
   * 那部分丢掉，也不会因此退化回整表读取。
   */
  const loadMessages = async () => {
    const limit = Math.max(
      loadedMessageCountRef.current,
      INITIAL_VISIBLE_MESSAGE_COUNT
    );

    const records = await getRecentEnsembleMessagesWindow(chatId, limit);

    const messageMap = new Map(records.map((item) => [item.id, item]));

    const enrichedMessages = records.map((item) => ({
      ...item,
      quotedMessage: item.quotedMessageId
        ? messageMap.get(item.quotedMessageId) || null
        : null
    }));

    setMessages(enrichedMessages);
    loadedMessageCountRef.current = enrichedMessages.length;
    setHasMoreOlderMessages(enrichedMessages.length >= limit);

    if (isPinnedToBottomRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      });
    }
  };

  /*
   * 上滑到顶部时，增量加载"比当前最早一条消息还要更早"的一批。
   * 走 [chatId+timestamp] 复合索引，只读这一批，不会把已加载的部分
   * 重新读一遍，也不会去扫整个大群的历史。
   */
  const handleLoadOlderMessages = async () => {
    if (isLoadingMoreRef.current || !hasMoreOlderMessages) return;

    const oldestLoaded = messages[0];
    if (!oldestLoaded) return;

    isLoadingMoreRef.current = true;

    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      previousScrollHeightRef.current = scrollArea.scrollHeight;
    }

    try {
      const olderBatch = await getOlderEnsembleMessagesBefore(
        chatId,
        oldestLoaded.timestamp,
        LOAD_MORE_MESSAGE_BATCH
      );

      if (olderBatch.length > 0) {
        setMessages((previous) => {
          // 引用解析用"这一批 + 已加载的部分"合并出的 map，
          // 这样更早消息里引用的对象即便在已加载区间里也能对上。
          const messageMap = new Map(
            [...olderBatch, ...previous].map((item) => [item.id, item])
          );

          const enrichedOlder = olderBatch.map((item) => ({
            ...item,
            quotedMessage: item.quotedMessageId
              ? messageMap.get(item.quotedMessageId) || null
              : null
          }));

          return [...enrichedOlder, ...previous];
        });

        loadedMessageCountRef.current += olderBatch.length;
      }

      setHasMoreOlderMessages(olderBatch.length >= LOAD_MORE_MESSAGE_BATCH);
    } catch (error) {
      console.error('Ensemble 加载更早消息失败：', error);
      isLoadingMoreRef.current = false;
      return;
    }

    if (!scrollArea) {
      isLoadingMoreRef.current = false;
    }
  };

  const handleMessagesScroll = (event) => {
    const scrollArea = event.currentTarget;

    isPinnedToBottomRef.current =
      scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight
      <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

    if (
      isLoadingMoreRef.current
      || scrollArea.scrollTop > LOAD_MORE_SCROLL_THRESHOLD_PX
      || !hasMoreOlderMessages
    ) {
      return;
    }

    void handleLoadOlderMessages();
  };

  // 加载更早消息、往顶部插入之后，把视口滚动位置钉住，不因为顶部
  // 多了一截内容而让画面"跳"一下。
  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current;

    if (!scrollArea || previousScrollHeightRef.current === null) {
      return;
    }

    const newScrollHeight = scrollArea.scrollHeight;

    scrollArea.scrollTop += newScrollHeight - previousScrollHeightRef.current;

    previousScrollHeightRef.current = null;
    isLoadingMoreRef.current = false;
  }, [messages]);

  const getCurrentIdentity = () => {
    return (
      userIdentities.find((item) => item.id === currentIdentityId) ||
      userIdentities[0] || {
        id: 'u_default',
        name: '我',
        avatar: '',
        persona: '主视角'
      }
    );
  };

  const persistUserIdentities = async (
    nextIdentities,
    nextCurrentIdentityId = currentIdentityId
  ) => {
    setUserIdentities(nextIdentities);
    setCurrentIdentityId(nextCurrentIdentityId);

    await db.ensembleChats.update(chatId, {
      userIdentities: nextIdentities,
      currentIdentityId: nextCurrentIdentityId,
      updatedAt: Date.now()
    });

    setChat((previous) =>
      previous
        ? {
            ...previous,
            userIdentities: nextIdentities,
            currentIdentityId: nextCurrentIdentityId
          }
        : previous
    );
  };

  const handleInputTextChange = (event) => {
    setInputText(event.target.value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const writeUserMessage = async ({
    type = 'text',
    content = '',
    metadata = {}
  }) => {
    const identity = getCurrentIdentity();

    const message = {
      chatId,
      senderId: identity.id,
      senderName: identity.name || '我',
      senderAvatar: identity.avatar || '',
      senderType: 'user',
      type,
      content,
      metadata,
      quotedMessageId: quotedMessage?.id || null,
      isRead: true,
      timestamp: Date.now()
    };

    const messageId = await db.ensembleMessages.add(message);

    await db.ensembleChats.update(chatId, {
      updatedAt: Date.now()
    });

    setQuotedMessage(null);

    // 用户自己发消息时始终强制滚到底部，不管之前是否已经上滑到别处
    // 在看历史消息——跟主聊天 ChatRoom.jsx 发消息时的行为保持一致。
    isPinnedToBottomRef.current = true;

    return {
      ...message,
      id: messageId
    };
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const content = inputText.trim();
    if (!content) return;

    await writeUserMessage({
      type: 'text',
      content,
      metadata: {}
    });

    setInputText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await loadMessages();
  };

  const handleTriggerAi = async (targetCharacterId = null) => {
    if (isAiThinking) return;

    setIsAiThinking(true);
    setAiError('');

    try {
      await generateEnsembleAiResponse(chatId, {
        targetCharacterId
      });

      await loadRoomData();
    } catch (error) {
      console.error('Ensemble AI generation failed:', error);
      setAiError(error?.message || '角色回应生成失败，请稍后重试');
    } finally {
      setIsAiThinking(false);
    }
  };

  /*
   * StickerPickerModal 回传的是完整 sticker 对象：
   * {
   *   id,
   *   name,
   *   url,
   *   category,
   *   createdAt
   * }
   *
   * StickerCard 读取 metadata.url 与 metadata.name，
   * 所以必须按这个协议存储。
   */
  const handleSelectSticker = async (sticker) => {
    if (!sticker?.url) {
      console.warn('Sticker selection is invalid:', sticker);
      return;
    }

    await writeUserMessage({
      type: 'sticker',
      content: '',
      metadata: {
        url: sticker.url,
        name: sticker.name || '表情包',
        stickerId: sticker.id ?? null,
        category: sticker.category || 'default'
      }
    });

    setShowStickerPicker(false);
    await loadMessages();
  };

  /*
   * 图片按钮不上传真实图片。
   * 它发送项目既有 ImageCard 所使用的图片叙事卡：
   * - content: 正面简述
   * - metadata.description: 翻面细节
   */
  const handleSendImageNarrativeCard = async (cardData) => {
    if (!cardData?.content?.trim()) return;

    await writeUserMessage({
      type: 'image',
      content: cardData.content.trim(),
      metadata: {
        description:
          cardData.metadata?.description?.trim() ||
          '静谧的画面细节停留在此刻。'
      }
    });

    setShowImagePromptModal(false);
    await loadMessages();
  };

  const handleQuoteMessage = (message) => {
    setQuotedMessage(message);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleDeleteMessage = async (messageId) => {
    await db.ensembleMessages.delete(messageId);

    if (quotedMessage?.id === messageId) {
      setQuotedMessage(null);
    }

    // 本地直接摘掉这一条即可，不用为了删一条消息重新查一遍数据库；
    // 分页计数同步减一，保持跟"已加载条数"一致。写法同主聊天 ChatRoom.jsx。
    setMessages((previous) => previous.filter((message) => message.id !== messageId));
    loadedMessageCountRef.current = Math.max(0, loadedMessageCountRef.current - 1);
  };

  const handleRegenerateMessage = async (message) => {
    if (!message || message.senderType === 'user') return;

    // 必须先检查是否已有生成在进行中，再决定要不要删除这条消息。
    // 之前的写法是先无条件删除、再调用生成函数、生成函数内部才检查"是否正在生成中"——
    // 如果这时候正好有另一次生成在进行（比如刚点了"召唤角色"），
    // 这条消息会被立刻删掉，但重新生成会因为"正在生成中"直接静默跳过，消息就彻底没了。
    if (isAiThinking) {
      setAiError('已有角色正在组织发言，请等它说完再重新生成这条消息');
      return;
    }

    setIsAiThinking(true);
    setAiError('');

    // 记住原消息的时间戳，让重新生成的消息留在原来的位置，
    // 而不是因为用当前时间戳而排到聊天末尾、打乱对话顺序。
    const originalTimestamp = message.timestamp;

    // 保留一份原消息快照 (去掉 id 与 loadMessages 拼接出的 quotedMessage)，
    // 如果重新生成失败，把它加回去，避免用户这句话彻底丢失、又没有任何提示。
    const { id: _discardId, quotedMessage: _discardQuoted, ...originalMessageSnapshot } = message;

    try {
      await db.ensembleMessages.delete(message.id);
      await loadMessages();

      await generateEnsembleAiResponse(chatId, {
        targetCharacterId: message.characterId || message.senderId,
        baseTimestamp: originalTimestamp
      });

      await loadRoomData();
    } catch (error) {
      console.error('Ensemble AI regenerate failed:', error);
      setAiError(error?.message ? `重新生成失败：${error.message}（原消息已恢复）` : '重新生成失败，原消息已恢复');

      await db.ensembleMessages.add(originalMessageSnapshot);
      await loadMessages();
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleAddTemporaryIdentity = async (identity) => {
    const nextIdentities = [...userIdentities, identity];
    await persistUserIdentities(nextIdentities, identity.id);
  };

  const handleUpdateIdentity = async (identityId, patch) => {
    const nextIdentities = userIdentities.map((identity) =>
      identity.id === identityId
        ? {
            ...identity,
            ...patch
          }
        : identity
    );

    await persistUserIdentities(nextIdentities);
  };

  const handleSelectIdentity = async (identityId) => {
    await persistUserIdentities(userIdentities, identityId);
  };

  if (!chat) return null;

  return (
    <div className="ensemble-container relative flex h-[100dvh] w-full flex-col overflow-hidden">
      {chat.bgImage && (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `url(${chat.bgImage})`,
            opacity: chat.bgOpacity ?? 0.2
          }}
        />
      )}

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回群聊列表"
          className="pointer-events-auto rounded-full border p-2.5 shadow-md backdrop-blur-md transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          className="max-w-[180px] truncate rounded-full border px-3.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-md"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          {chat.title}
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label="打开群聊档案"
          className="pointer-events-auto rounded-full border p-2.5 shadow-md backdrop-blur-md transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>

      <section
        ref={scrollAreaRef}
        onScroll={handleMessagesScroll}
        className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 pt-14 no-scrollbar"
      >
        {hasMoreOlderMessages && messages.length > 0 && (
          <div
            className="py-2 text-center text-[10px] opacity-40"
            style={{ color: 'var(--text-muted)' }}
          >
            向上滚动加载更早的消息...
          </div>
        )}

        {messages.map((message) => (
          <EnsembleMessageItem
            key={message.id}
            msg={message}
            onQuote={handleQuoteMessage}
            onRegenerate={handleRegenerateMessage}
            onDelete={handleDeleteMessage}
            onSummonChar={handleTriggerAi}
          />
        ))}

        {isAiThinking && (
          <div
            className="my-3 flex w-fit items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-sm backdrop-blur-md"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Cat className="h-3.5 w-3.5 animate-bounce" />
            <span>角色正在组织下一段回应</span>
          </div>
        )}

        {!isAiThinking && aiError && (
          <div
            className="my-3 flex w-fit max-w-full items-start gap-2 rounded-2xl border px-3 py-2 text-xs shadow-sm backdrop-blur-md"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-main)'
            }}
          >
            <span className="min-w-0 break-words">{aiError}</span>
            <button
              type="button"
              onClick={() => setAiError('')}
              aria-label="关闭提示"
              className="shrink-0 opacity-60 hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              ×
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </section>

      <section className="relative z-20 w-full px-3 pb-3 pt-1">
        <EnsembleUserSelector
          userIdentities={userIdentities}
          currentIdentityId={currentIdentityId}
          onSelectIdentity={handleSelectIdentity}
          onAddTempIdentity={handleAddTemporaryIdentity}
          onUpdateIdentity={handleUpdateIdentity}
        />

        {quotedMessage && (
          <div
            className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs backdrop-blur-md"
            style={{
              backgroundColor: 'var(--modal-bg)',
              borderColor: 'var(--modal-border)',
              color: 'var(--text-main)'
            }}
          >
            <span className="min-w-0 truncate opacity-80">
              引用 {quotedMessage.senderName || '消息'}：
              {quotedMessage.type === 'text'
                ? quotedMessage.content
                : '媒体消息'}
            </span>

            <button
              type="button"
              onClick={() => setQuotedMessage(null)}
              className="shrink-0 text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              取消
            </button>
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-1.5 rounded-3xl border p-2 shadow-xl backdrop-blur-xl"
          style={{
            backgroundColor: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)'
          }}
        >
          <button
            type="button"
            onClick={() => setShowStickerPicker(true)}
            aria-label="打开表情包库"
            className="shrink-0 rounded-full p-2 transition-transform active:scale-95"
            style={{ color: 'var(--text-main)' }}
          >
            <Smile className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowImagePromptModal(true)}
            aria-label="发送图片叙事卡"
            className="shrink-0 rounded-full p-2 transition-transform active:scale-95"
            style={{ color: 'var(--text-main)' }}
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputTextChange}
            placeholder="输入对话或动作描述..."
            className="ensemble-textarea-scroll max-h-32 flex-1 resize-none bg-transparent px-3 py-1.5 text-xs outline-none"
            style={{ color: 'var(--text-main)' }}
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            aria-label="发送消息"
            className="shrink-0 rounded-full p-2.5 shadow-sm transition-transform active:scale-95 disabled:opacity-30"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Send className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleTriggerAi()}
            disabled={isAiThinking}
            aria-label="触发角色回应"
            className="shrink-0 rounded-full border p-2.5 shadow-sm transition-transform active:scale-95 disabled:opacity-40"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </form>
      </section>

      <StickerPickerModal
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={handleSelectSticker}
      />

      {showImagePromptModal && (
        <EnsembleImagePromptModal
          onClose={() => setShowImagePromptModal(false)}
          onSubmit={handleSendImageNarrativeCard}
        />
      )}

      {showSettings && (
        <EnsembleSettingsModal
          chatId={chatId}
          onClose={() => setShowSettings(false)}
          onUpdated={loadRoomData}
        />
      )}
    </div>
  );
};

export default EnsembleRoom;