// src/apps/snapshots/SnapshotsApp.jsx
//
// 【整体替换说明】相对上一轮的改动（本次是美化，不改数据逻辑）：
// 1. Header 从"整条 sticky 通栏"改为 4 个独立悬浮圆形图标按钮平铺
//    （返回 / 世界线切换胶囊 / 让大家发点什么 / 设置），按钮之间完全透明，
//    不再有一整条的底色和底部分割线。
// 2. 世界线切换胶囊抽成 WorldlineSwitcher 组件，默认收起，点击才展开选择器。
// 3. "让大家发点什么"从空状态区域和 feed 顶部的两处内联按钮，
//    统一收进 header，成为一个图标按钮，减少重复和视觉噪音。
// 4. 底部 Dock 做了细节上的视觉打磨（间距、阴影层次），交互逻辑不变。
// 数据逻辑（cleanup、scheduler、随机发帖）完全沿用上一轮，未做任何改动。
//
import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import { snapshotScheduler } from './services/snapshotSchedulerService';
import { runSnapshotCleanup } from './services/snapshotCleanupService';
import { triggerRandomDailyPosts } from './services/snapshotRandomPostService';
import SnapshotCard from './SnapshotCard';
import UserProfileSheet from './components/UserProfileSheet';
import CharacterProfileSheet from './components/CharacterProfileSheet';
import WorldlineSwitcher from './components/WorldlineSwitcher';
import CreateSnapshotModal from './CreateSnapshotModal';
import SnapshotSettingsModal from './SnapshotSettingsModal';

// 通用的悬浮圆形图标按钮，用于顶栏
const FloatingIconButton = ({ onClick, title, disabled, children, spinning }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="w-9 h-9 rounded-full bg-white shadow-sm border border-neutral-200/60 flex items-center justify-center text-neutral-700 active:scale-90 transition-all disabled:opacity-50 hover:shadow-md"
  >
    <span className={spinning ? 'animate-spin' : ''}>{children}</span>
  </button>
);

export const SnapshotsApp = ({ onBackHub, defaultChatId = null }) => {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(defaultChatId);
  const [snapshots, setSnapshots] = useState([]);

  // Sheets & Modals
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // "让大家发点什么" 的进行中状态
  const [isRandomPosting, setIsRandomPosting] = useState(false);

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

  useEffect(() => {
    if (!currentChatId) return;

    // 每次进入/切换到某个世界线，先做一次过期清理检查（内部有 24 小时节流）
    runSnapshotCleanup(currentChatId).then((result) => {
      if (result && !result.skipped && result.deletedCount > 0) {
        loadSnapshots();
      }
    });

    loadSnapshots();

    snapshotScheduler.start(currentChatId);
    const unsubscribe = snapshotScheduler.subscribe(() => {
      loadSnapshots();
    });

    return () => {
      unsubscribe();
    };
  }, [currentChatId, loadSnapshots]);

  const handleDeleteSnapshot = async (id) => {
    try {
      await db.snapshots.delete(id);
      await db.snapshotComments.where('snapshotId').equals(id).delete();
      loadSnapshots();
    } catch (err) {
      console.error('删除动态失败:', err);
    }
  };

  // "让大家发点什么"：随机 2~3 位候选人（当前角色 + 该世界线的 NPC）各自生成一条动态
  const handleRandomPost = async () => {
    if (isRandomPosting || !currentChatId) return;
    setIsRandomPosting(true);
    try {
      const result = await triggerRandomDailyPosts(currentChatId);
      if (result?.posted?.length > 0) {
        await loadSnapshots();
      }
    } catch (err) {
      console.error('随机批量发帖失败:', err);
    } finally {
      setIsRandomPosting(false);
    }
  };

  const currentCharTitle = chats.find((c) => c.id === currentChatId)?.title || '当前世界线';

  return (
    <div className="fixed inset-0 z-30 w-full h-[100dvh] bg-[#f7f8fa] text-neutral-900 flex flex-col overflow-y-auto overflow-x-hidden selection:bg-neutral-900 selection:text-white">

      {/* 顶部：4 个独立悬浮图标按钮，彼此透明，不再是一整条通栏 */}
      <header className="sticky top-0 z-40 w-full px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FloatingIconButton onClick={onBackHub} title="返回中心">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </FloatingIconButton>

          <WorldlineSwitcher
            chats={chats}
            currentChatId={currentChatId}
            onChangeChat={(newId) => setCurrentChatId(newId)}
            tone="light"
          />
        </div>

        <div className="flex items-center gap-2">
          <FloatingIconButton
            onClick={handleRandomPost}
            disabled={isRandomPosting}
            spinning={isRandomPosting}
            title="让大家发点什么"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </FloatingIconButton>

          <FloatingIconButton onClick={() => setIsSettingsOpen(true)} title="设置">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </FloatingIconButton>
        </div>
      </header>

      {/* 核心视区 */}
      <main className="flex-1 w-full px-4 pt-4 pb-32 flex flex-col">
        {snapshots.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-sm border border-neutral-200/60 flex items-center justify-center text-neutral-400 mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-neutral-800 tracking-tight mb-1.5">
              该世界线尚未定格片羽
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs leading-relaxed mb-6">
              在「{currentCharTitle}」的时空里，点击下方按钮记录，或点击右上角让大家先热闹起来。
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
              <span>记录第一条生活动态</span>
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/90 backdrop-blur-2xl border border-white/15 rounded-full px-4 py-2.5 flex items-center gap-5 shadow-2xl shadow-black/20">
        <button
          type="button"
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all"
          title="广场"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="w-12 h-12 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-lg active:scale-90 transition-transform font-bold ring-4 ring-white/10"
          title="发布"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setIsUserProfileOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all"
          title="个人中心"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>

      {/* 弹窗及抽屉 */}
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
        currentChatId={currentChatId}
      />
    </div>
  );
};

export default SnapshotsApp;