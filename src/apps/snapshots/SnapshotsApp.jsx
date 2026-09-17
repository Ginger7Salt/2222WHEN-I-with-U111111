// src/apps/snapshots/SnapshotsApp.jsx
//
// 【局部替换说明】整份文件内容如下（可直接整体覆盖，但改动只集中在几处，标注如下）：
// 1. import 区新增: runSnapshotCleanup, triggerRandomDailyPosts
// 2. 新增 state: isRandomPosting
// 3. 新增函数: handleRandomPost
// 4. 原有的 "if (!currentChatId) return; loadSnapshots(); snapshotScheduler.start..." 的
//    useEffect 里，追加一次 runSnapshotCleanup(currentChatId) 调用
// 5. 空状态区域和底部 Dock 分别新增一个"让大家发点什么"的入口按钮
//    (位置只是先放一个能跑通逻辑的地方，样式/位置在美化阶段再调整)
// 其余结构（Header、UserProfileSheet 等）本次未改动。
//
import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import { snapshotScheduler } from './services/snapshotSchedulerService';
import { runSnapshotCleanup } from './services/snapshotCleanupService';
import { triggerRandomDailyPosts } from './services/snapshotRandomPostService';
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

    // 每次进入/切换到某个世界线，先做一次过期清理检查（内部有 24 小时节流，不会每次都真的扫全表）
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
    // 关键改动：使用 fixed inset-0 强制占满整个手机屏幕视口，击穿任何父级的 max-w 或居中限制
    <div className="fixed inset-0 z-30 w-full h-[100dvh] bg-[#f7f8fa] text-neutral-900 flex flex-col overflow-y-auto overflow-x-hidden selection:bg-neutral-900 selection:text-white">

      {/* 顶部通栏导航 —— 本次未改动，美化阶段再处理胶囊动效等 */}
      <header className="sticky top-0 z-40 w-full px-4 pt-3 pb-3 flex items-center justify-between backdrop-blur-xl bg-[#f7f8fa]/80 border-b border-black/[0.04]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackHub}
            className="w-9 h-9 rounded-2xl bg-white shadow-sm border border-neutral-200/60 flex items-center justify-center text-neutral-700 active:scale-95 transition-all"
            title="返回中心"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* 时空世界线胶囊 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white shadow-sm border border-neutral-200/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <select
              value={currentChatId || ''}
              onChange={(e) => setCurrentChatId(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-neutral-800 outline-none cursor-pointer tracking-tight"
            >
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 社交设置 */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-9 h-9 rounded-2xl bg-white shadow-sm border border-neutral-200/60 flex items-center justify-center text-neutral-700 active:scale-95 transition-all"
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

      {/* 核心视区：彻底去掉 max-w 和 mx-auto，保证 100% 全屏铺满 */}
      <main className="flex-1 w-full px-4 pt-4 pb-32 flex flex-col">
        {snapshots.length === 0 ? (
          // 空状态居中自然展现
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
              在「{currentCharTitle}」的时空里，点击下方按钮记录，或让大家先热闹起来。
            </p>
            <div className="flex items-center gap-2">
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

              {/* "让大家发点什么" 入口 —— 位置先放这里，样式后续美化阶段再调 */}
              <button
                type="button"
                onClick={handleRandomPost}
                disabled={isRandomPosting}
                className="px-4 py-2.5 rounded-full bg-white border border-neutral-200/60 text-neutral-700 text-xs font-semibold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${isRandomPosting ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>{isRandomPosting ? '正在热闹...' : '让大家发点什么'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {/* 非空状态下也保留一个"让大家发点什么"的入口 */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRandomPost}
                disabled={isRandomPosting}
                className="px-4 py-2 rounded-full bg-white border border-neutral-200/60 text-neutral-700 text-[11px] font-semibold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className={`w-3 h-3 ${isRandomPosting ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>{isRandomPosting ? '正在热闹...' : '让大家发点什么'}</span>
              </button>
            </div>

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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/90 backdrop-blur-2xl border border-white/20 rounded-full px-3 py-2 flex items-center gap-4 shadow-2xl">
        <button
          type="button"
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          title="广场"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="w-11 h-11 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-lg active:scale-90 transition-transform font-bold"
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
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
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
        currentChatId={currentChatId}
      />
    </div>
  );
};

export default SnapshotsApp;