import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  ArrowLeft,
  Trash2,
  Settings,
  Music2,
  Send,
  CheckCircle2,
  Circle,
  X,
} from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import ConfirmModal from '../../components/ConfirmModal';
import db from '../../db';
import { subscribeAiEvents } from '../../services/aiService';
import { destroyChatWithMemories } from '../memory/memoryService';
import { triggerGlobalToast } from '../../components/NotificationToast';

import ChatRoom from './ChatRoom';
import CharacterLibrary from './CharacterLibrary';
import CharacterEditor from './CharacterEditor';
import NewChatModal from './NewChatModal';
import CheckInSettings from './check-in/CheckInSettings';
import CompanionshipPage from './companionship/CompanionshipPage';
import BroadcastComposer from './components/BroadcastComposer';
import './check-in/check-in.css';

// "群发"一次最多能选几个目标聊天窗。
const MAX_BROADCAST_TARGETS = 5;

export const MessagesApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [view, setView] = useState('chats');
  const [activeChatId, setActiveChatId] = useState(null);
  const [editingChar, setEditingChar] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [deletingChatTarget, setDeletingChatTarget] = useState(null);
  const [showCheckInSettings, setShowCheckInSettings] = useState(false);

  // "群发"：会话列表自己的多选模式，跟 ChatRoom 里"选择消息"是两码事——
  // 这里选的是聊天窗本身，选完之后现写新内容一次发给最多 5 个目标。
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [broadcastSelectedIds, setBroadcastSelectedIds] = useState(() => new Set());
  const [showBroadcastComposer, setShowBroadcastComposer] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    onChatRoomStateChange?.(view === 'chat_room');
  }, [view, onChatRoomStateChange]);

  useEffect(() => {
    const unsubscribe = subscribeAiEvents(() => {
      loadData();
    });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    try {
      const chatList = await db.chats.orderBy('updatedAt').reverse().toArray();
      const charList = await db.characters.toArray();

      setChats(Array.isArray(chatList) ? chatList : []);
      setCharacters(Array.isArray(charList) ? charList : []);
    } catch (err) {
      console.error('[MessagesApp] loadData failed safely:', err);
    }
  };

  const handleOpenChat = (chatId) => {
    setActiveChatId(chatId);
    setView('chat_room');
  };

  const handleOpenCharEditor = (charData) => {
    setEditingChar(charData);
    setView('char_editor');
  };

  const handleDeleteChatEntity = async (chatId) => {
    if (!chatId) return;

    try {
      await destroyChatWithMemories(chatId);
      setDeletingChatTarget(null);
      await loadData();
    } catch (error) {
      console.error(
        '[MessagesApp] destroy chat with memories failed:',
        error
      );
    }
  };

  const filteredChats = chats.filter((c) =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEnterBroadcastMode = () => {
    setBroadcastMode(true);
    setBroadcastSelectedIds(new Set());
  };

  const handleExitBroadcastMode = () => {
    setBroadcastMode(false);
    setBroadcastSelectedIds(new Set());
  };

  const handleToggleBroadcastChat = (chatId) => {
    setBroadcastSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(chatId)) {
        next.delete(chatId);
        return next;
      }

      if (next.size >= MAX_BROADCAST_TARGETS) {
        triggerGlobalToast({
          title: '最多选 5 个',
          content: `一次最多群发给 ${MAX_BROADCAST_TARGETS} 个聊天窗`,
          iconType: 'bell',
          duration: 2200,
        });
        return previous;
      }

      next.add(chatId);
      return next;
    });
  };

  const broadcastTargets = chats
    .filter((chatItem) => broadcastSelectedIds.has(chatItem.id))
    .map((chatItem) => ({
      chat: chatItem,
      character: characters.find((c) => c.id === chatItem.characterId),
    }));

  if (view === 'chat_room' && activeChatId) {
    return (
      <ChatRoom
        chatId={activeChatId}
        onOpenChat={(nextChatId) => {
          if (!nextChatId) return;

          setActiveChatId(nextChatId);
          setView('chat_room');
          void loadData();
        }}
        onBack={() => {
          setView('chats');
          loadData();
        }}
        onRoomStateChange={(inRoom) =>
          onChatRoomStateChange?.(inRoom)
        }
        onOpenCharacterEditor={() => {
          const currentChat = chats.find(
            (c) => c.id === activeChatId
          );
          const char = characters.find(
            (ch) => ch.id === currentChat?.characterId
          );

          if (char) {
            handleOpenCharEditor(char);
          }
        }}
      />
    );
  }

  if (view === 'companionship') {
    return (
      <CompanionshipPage
        chats={chats}
        characters={characters}
        onBack={() => setView('chats')}
      />
    );
  }

  if (view === 'char_editor') {
    return (
      <CharacterEditor
        characterData={editingChar}
        onBack={() => setView('characters')}
        onSaved={() => loadData()}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-12 text-xs text-left">
      {broadcastMode ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleExitBroadcastMode}
            className="flex items-center gap-1 text-xs font-semibold opacity-80 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
            <span>取消</span>
          </button>

          <span className="text-xs opacity-70">
            已选择 {broadcastSelectedIds.size}/{MAX_BROADCAST_TARGETS}
          </span>

          <button
            type="button"
            disabled={broadcastSelectedIds.size === 0}
            onClick={() => setShowBroadcastComposer(true)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-30"
            style={{
              background: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Send className="h-3.5 w-3.5" />
            <span>群发</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHub}
            className="flex items-center gap-2 font-semibold opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-main)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回主页</span>
          </button>

          <div className="flex items-center gap-2">
            {view === 'chats' && filteredChats.length > 0 && (
              <button
                type="button"
                onClick={handleEnterBroadcastMode}
                className="flex items-center gap-1 rounded-full px-2.5 py-2 transition-opacity opacity-75 hover:opacity-100"
                style={{
                  background: 'var(--control-soft-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--card-border)',
                }}
                title="群发消息"
                aria-label="进入群发模式"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">群发</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCheckInSettings(true)}
              className="rounded-full p-2 transition-opacity opacity-75 hover:opacity-100"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)',
              }}
              title="角色来讯设置"
              aria-label="打开角色来讯设置"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setView('companionship')}
              className="rounded-full p-2 transition-opacity opacity-75 hover:opacity-100"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)',
              }}
              title="长期陪伴"
              aria-label="打开长期陪伴"
            >
              <Music2 className="w-3.5 h-3.5" />
            </button>

            <div
              className="flex items-center gap-1 p-1 rounded-full border shadow-sm"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setView('chats')}
                className="px-3 py-1 rounded-full transition-all text-xs"
                style={{
                  background:
                    view === 'chats'
                      ? 'var(--accent-color)'
                      : 'transparent',
                  color:
                    view === 'chats'
                      ? 'var(--accent-foreground)'
                      : 'var(--text-sub)',
                  fontWeight: view === 'chats' ? 600 : 400,
                }}
              >
                对话
              </button>

              <button
                type="button"
                onClick={() => setView('characters')}
                className="px-3 py-1 rounded-full transition-all text-xs"
                style={{
                  background:
                    view === 'characters'
                      ? 'var(--accent-color)'
                      : 'transparent',
                  color:
                    view === 'characters'
                      ? 'var(--accent-foreground)'
                      : 'var(--text-sub)',
                  fontWeight: view === 'characters' ? 600 : 400,
                }}
              >
                角色
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'chats' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl border"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              <Search className="w-3.5 h-3.5 opacity-40" />

              <input
                type="text"
                placeholder="搜索心绪对话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-xs"
                style={{ color: 'var(--text-main)' }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="p-2.5 rounded-2xl active:scale-95 transition-transform shadow-sm"
              style={{
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
              }}
              title="开启新对话"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {filteredChats.length === 0 ? (
            <GlassCard className="py-12 text-center space-y-2 opacity-60">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30" />

              <p
                className="text-xs"
                style={{ color: 'var(--text-sub)' }}
              >
                风停在这里，点击右上角 + 开始第一段浪漫陪伴。
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2.5">
              {filteredChats.map((chatItem) => {
                const char = characters.find(
                  (c) => c.id === chatItem.characterId
                );
                const isBroadcastSelected = broadcastSelectedIds.has(chatItem.id);

                return (
                  <GlassCard
                    key={chatItem.id}
                    className="flex items-center justify-between p-4 group hover:opacity-95 transition-all relative"
                  >
                    <div
                      onClick={() => (
                        broadcastMode
                          ? handleToggleBroadcastChat(chatItem.id)
                          : handleOpenChat(chatItem.id)
                      )}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      {broadcastMode && (
                        isBroadcastSelected ? (
                          <CheckCircle2
                            className="h-5 w-5 shrink-0"
                            style={{ color: 'var(--accent-color)' }}
                          />
                        ) : (
                          <Circle
                            className="h-5 w-5 shrink-0 opacity-30"
                          />
                        )
                      )}

                      {char?.avatar ? (
                        <img
                          src={char.avatar}
                          alt={chatItem.title}
                          className="w-11 h-11 rounded-full object-cover border border-white/20 shrink-0 shadow-sm" loading="lazy" decoding="async" />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm"
                          style={{
                            background: 'var(--control-soft-bg)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {chatItem.title?.[0] || 'C'}
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <h4
                            className="font-serif font-bold text-sm truncate"
                            style={{ color: 'var(--text-main)' }}
                          >
                            {chatItem.title}
                          </h4>

                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-mono border"
                            style={{
                              borderColor: 'var(--divider)',
                              background: 'var(--control-soft-bg)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {chatItem.mode === 'rp' ? 'RP' : 'Real'}
                          </span>
                        </div>

                        <p
                          className="text-[11px] opacity-60 truncate"
                          style={{ color: 'var(--text-sub)' }}
                        >
                          {(() => {
                            const s = chatItem.summary;

                            if (!s) {
                              return `开启与 ${
                                char?.name || '伴侣'
                              } 的独处时刻`;
                            }

                            // 1. 如果是纯文本
                            if (typeof s === 'string' && s.trim()) {
                              return s;
                            }

                            // 2. 如果是数组 (阶段性总结条目)
                            if (Array.isArray(s) && s.length > 0) {
                              const lastItem = s[s.length - 1];

                              if (typeof lastItem === 'string') {
                                return lastItem;
                              }

                              if (
                                typeof lastItem === 'object' &&
                                lastItem !== null
                              ) {
                                return (
                                  lastItem.text ||
                                  lastItem.content ||
                                  lastItem.summary ||
                                  `开启与 ${
                                    char?.name || '伴侣'
                                  } 的独处时刻`
                                );
                              }
                            }

                            // 3. 如果单条总结是个对象
                            if (
                              typeof s === 'object' &&
                              s !== null
                            ) {
                              return (
                                s.text ||
                                s.content ||
                                s.summary ||
                                `开启与 ${
                                  char?.name || '伴侣'
                                } 的独处时刻`
                              );
                            }

                            return `开启与 ${
                              char?.name || '伴侣'
                            } 的独处时刻`;
                          })()}
                        </p>
                      </div>
                    </div>

                    {!broadcastMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingChatTarget(chatItem);
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--control-soft-bg)] rounded-full"
                        title="抹去此对话实体"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'characters' && (
        <CharacterLibrary
          onSelectCharacter={(char) => handleOpenCharEditor(char)}
          onCreateNew={() => handleOpenCharEditor(null)}
        />
      )}

      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onCreated={(newChat) => {
            setShowNewChatModal(false);
            handleOpenChat(newChat.id);
          }}
          onCreateNewCharacter={() => {
            setShowNewChatModal(false);
            handleOpenCharEditor(null);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deletingChatTarget}
        title="抹去对话实体"
        message={`确定要彻底销毁“${deletingChatTarget?.title}”吗？此操作不可逆。本消息框的聊天记录、阶段性总结、长期记忆、待确认候选与修订记录都会一并永久删除。`}
        confirmText="彻底抹去"
        cancelText="留存"
        onCancel={() => setDeletingChatTarget(null)}
        onConfirm={() =>
          handleDeleteChatEntity(deletingChatTarget.id)
        }
      />

      <CheckInSettings
        isOpen={showCheckInSettings}
        onClose={() => setShowCheckInSettings(false)}
        chats={chats}
        characters={characters}
      />

      {showBroadcastComposer && (
        <BroadcastComposer
          targets={broadcastTargets}
          onClose={() => setShowBroadcastComposer(false)}
          onSent={() => {
            setShowBroadcastComposer(false);
            handleExitBroadcastMode();
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default MessagesApp;