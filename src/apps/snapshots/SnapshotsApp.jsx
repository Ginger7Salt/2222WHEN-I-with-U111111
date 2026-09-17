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

    // 启动当前世界线的后台主动发帖调度
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
    <div className="w-full min-h-screen bg-[#f7f8fa] text-neutral-900 flex flex-col relative overflow-x-hidden selection:bg-neutral-900 selection:text-white">
      {/* 弥散柔和环境光底纹 */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-neutral-200/40 via-neutral-100/20 to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* 顶部悬浮控制栏（无彩色长条 Bar，清透通透微按钮） */}
      <div className="sticky top-0 z-40 px-5 pt-4 pb-2 flex items-center justify-between backdrop-blur-md bg-[#f7f8fa]/60">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackHub}
            className="w-10 h-10 rounded-2xl bg-white/80 backdrop-blur-lg border border-white/60 shadow-sm flex items-center justify-center text-neutral-800 hover:bg-white active:scale-95 transition-all"
            title="返回中心"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {/* 时空世界线切换下拉 */}
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/80 backdrop-blur-lg border border-white/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-neutral-900" />
            <select
              value={currentChatId || ''}
              onChange={(e) => setCurrentChatId(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-neutral-800 outline-none cursor-pointer tracking-tight"
            >
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 右侧关系与 NPC 设置 */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-10 h-10 rounded-2xl bg-white/80 backdrop-blur-lg border border-white/60 shadow-sm flex items-center justify-center text-neutral-700 hover:bg-white active:scale-95 transition-all"
          title="社交关系与 NPC 设置"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
        </button>
      </div>

      {/* Feed 流主视区 */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-2 pb-28 relative z-10 space-y-4">
        {snapshots.length === 0 ? (
          <div className="rounded-[36px] bg-white/70 backdrop-blur-xl p-12 text-center space-y-3 border border-white/60 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] mt-8">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 mx-auto flex items-center justify-center text-neutral-400">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <h3 className="text-sm font-bold text-neutral-800">该世界线尚未定格片羽</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
              在 {currentCharTitle} 的时空里，点击下方拍摄记录，或邀约伴侣写下一抹即时心境。
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-2.5 rounded-full bg-neutral-900 text-white text-xs font-bold shadow-md hover:bg-neutral-800 active:scale-95 transition-all mt-2"
            >
              留下第一条生活动态
            </button>
          </div>
        ) : (
          snapshots.map((item) => (
            <SnapshotCard
              key={item.id}
              snapshot={item}
              currentChatId={currentChatId}
              onDelete={handleDeleteSnapshot}
              onOpenUserProfile={() => setIsUserProfileOpen(true)}
              onOpenCharProfile={(charId) => setSelectedCharId(charId)}
            />
          ))
        )}
      </main>

      {/* 底部悬浮白色/微黑液态毛玻璃 Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/90 backdrop-blur-2xl border border-white/20 rounded-full px-3 py-2 flex items-center gap-4 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]">
        {/* Feed 广场 */}
        <button
          type="button"
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-colors"
          title="Feed 流"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </button>

        {/* 发帖按钮 (高亮灵动中心) */}
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="w-11 h-11 rounded-full bg-white text-neutral-900 flex items-center justify-center shadow-lg active:scale-90 transition-transform font-bold"
          title="记录 / 发帖"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>

        {/* User 个人主页 */}
        <button
          type="button"
          onClick={() => setIsUserProfileOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-colors"
          title="User 个人主页"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
      </div>

      {/* User 个人主页 Sheet */}
      <UserProfileSheet
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        currentChatId={currentChatId}
        chats={chats}
        onChangeChat={(newId) => setCurrentChatId(newId)}
      />

      {/* Character 个人主页 Sheet */}
      <CharacterProfileSheet
        isOpen={Boolean(selectedCharId)}
        onClose={() => setSelectedCharId(null)}
        currentChatId={currentChatId}
        characterId={selectedCharId}
        onInvitePost={() => setIsCreateOpen(true)}
      />

      {/* 发帖 Modal */}
      <CreateSnapshotModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        currentChatId={currentChatId}
        onPostCreated={loadSnapshots}
      />

      {/* 社交设置 Modal */}
      <SnapshotSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default SnapshotsApp;

