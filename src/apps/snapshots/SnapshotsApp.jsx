// src/apps/snapshots/SnapshotsApp.jsx
import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import { snapshotScheduler } from './services/snapshotSchedulerService';
import SnapshotCard from './SnapshotCard';
import UserProfileSheet from './components/UserProfileSheet';
import CharacterProfileSheet from './components/CharacterProfileSheet';
import CreateSnapshotModal from './CreateSnapshotModal';
import SnapshotSettingsModal from './SnapshotSettingsModal';

export const SnapshotsApp = ({ onBackHub, defaultChatId = null }) => {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(defaultChatId);
  const [snapshots, setSnapshots] = useState([]);

  // Sheets & Modals
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 初始化加载所有 Chat 并选定当前 Chat
  const loadChats = useCallback(async () => {
    try {
      const list = await db.chats.toArray();
      setChats(list);
      if (!currentChatId && list.length > 0) {
        setCurrentChatId(list[0].id);
      }
    } catch (err) {
      console.error('加载对话列表失败:', err);
    }
  }, [currentChatId]);

  // 加载当前 Chat 对应的 Feed 广场动态
  const loadSnapshots = useCallback(async () => {
    if (!currentChatId) return;
    try {
      const list = await db.snapshots
        .where('chatId')
        .equals(Number(currentChatId))
        .reverse()
        .sortBy('timestamp');
      setSnapshots(list);
    } catch (err) {
      console.error('加载动态失败:', err);
    }
  }, [currentChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // 当 currentChatId 改变时，切换调度器世界线并加载动态
  useEffect(() => {
    if (!currentChatId) return;
    loadSnapshots();

    snapshotScheduler.start(currentChatId);
    const unsubscribe = snapshotScheduler.subscribe(() => {
      loadSnapshots();
    });

    return () => {
      unsubscribe();
    };
  }, [currentChatId, loadSnapshots]);

  // 删除动态
  const handleDeleteSnapshot = async (id) => {
    try {
      await db.snapshots.delete(id);
      await db.snapshotComments.where('snapshotId').equals(id).delete();
      loadSnapshots();
    } catch (err) {
      console.error('删除动态失败:', err);
    }
  };

  const currentCharTitle = chats.find((c) => c.id === currentChatId)?.title || '当前世界线';

  return (
    // 外层容器：使用 100dvh 全屏占满，消除外侧缝隙
    <div className="w-full min-h-[100dvh] bg-[#f5f7fa] text-neutral-900 flex flex-col relative overflow-x-hidden selection:bg-neutral-900 selection:text-white">
      {/* 顶部柔和环境弥散光 */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-gradient-to-b from-blue-100/40 via-purple-50/20 to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* 顶部导航栏：全宽通透贴合 */}
      <header className="sticky top-0 z-40 w-full px-4 pt-3 pb-2.5 flex items-center justify-between backdrop-blur-xl bg-[#f5f7fa]/75 border-b border-black/[0.03]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackHub}
            className="w-9 h-9 rounded-2xl bg-white/90 shadow-sm border border-neutral-200/50 flex items-center justify-center text-neutral-700 active:scale-95 transition-all"
            title="返回"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* 世界线切换胶囊 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/90 shadow-sm border border-neutral-200/50 max-w-[200px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <select
              value={currentChatId || ''}
              onChange={(e) => setCurrentChatId(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-neutral-800 outline-none cursor-pointer truncate pr-1"
            >
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 右侧设置按钮 */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-9 h-9 rounded-2xl bg-white/90 shadow-sm border border-neutral-200/50 flex items-center justify-center text-neutral-700 active:scale-95 transition-all"
          title="设置"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>
      </header>

      {/* Feed 流主视区：占满宽度，桌面端才限制宽度 */}
      <main className="flex-1 w-full sm:max-w-lg sm:mx-auto px-3.5 pt-3 pb-28 relative z-10 flex flex-col">
        {snapshots.length === 0 ? (
          // 空状态居中，不再是浮动的壳子
          <div className="my-auto flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-white/80 shadow-sm border border-neutral-200/50 flex items-center justify-center text-neutral-400 mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-neutral-800 tracking-tight mb-1">
              该世界线尚未定格片羽
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs leading-relaxed mb-6">
              在「{currentCharTitle}」的时空里，点击下方按钮记录生活，或邀约伴侣留下即时心境。
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-6 py-2.5 rounded-full bg-neutral-900 text-white text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>记录第一条瞬间</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {snapshots.map((item) => (
              <SnapshotCard
                key={item.id}
                snapshot={item}
                currentChatId={currentChatId}
                onDelete={handleDeleteSnapshot}
                onOpenUserProfile={() => setIsUserProfileOpen(true)}
                onOpenCharProfile={(charId) => setSelectedCharId(charId)}
              />
            ))}
          </div>
        )}
      </main>

      {/* 底部悬浮控制栏 Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/90 backdrop-blur-2xl border border-white/20 rounded-full px-3 py-2 flex items-center gap-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.35)]">
        {/* 回到顶部/Feed */}
        <button
          type="button"
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/75 hover:text-white active:scale-95 transition-all"
          title="广场"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </button>

        {/* 发布瞬间 */}
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="w-11 h-11 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-lg active:scale-90 transition-transform font-bold"
          title="记录瞬间"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* 个人主页 */}
        <button
          type="button"
          onClick={() => setIsUserProfileOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/75 hover:text-white active:scale-95 transition-all"
          title="个人中心"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>

      {/* Sheets & Modals */}
      <UserProfileSheet
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        currentChatId={currentChatId}
        chats={chats}
        onChangeChat={(newId) => setCurrentChatId(newId)}
      />

      <CharacterProfileSheet
        isOpen={Boolean(selectedCharId)}
        onClose={() => setSelectedCharId(null)}
        currentChatId={currentChatId}
        characterId={selectedCharId}
        onInvitePost={() => setIsCreateOpen(true)}
      />

      <CreateSnapshotModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        currentChatId={currentChatId}
        onPostCreated={loadSnapshots}
      />

      <SnapshotSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default SnapshotsApp;

