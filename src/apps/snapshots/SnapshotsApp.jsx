// src/apps/snapshots/SnapshotsApp.jsx
//
// 【整体替换说明】这轮新增的是 feed 顶部的"故事条 + 筛选chip"：
// 1. 故事条：User（点击发帖）+ 官配角色 + 该世界线的 NPC，头像下方显示名字，
//    右上角小圆点徽章显示这个人在本世界线发过的动态数。点击角色头像打开
//    角色主页（之前只能从已发布的动态点进去，现在有了专门入口）；
//    点击某个 NPC 头像直接把 feed 筛选到这个 NPC 的动态。
// 2. 筛选 chip：全部 / 伴侣 / NPC / 我的动态，纯前端过滤，不改数据库查询。
// 3. Feed 卡片改为错位淡入（每张卡片延迟一点点再淡入），配合 SnapshotCard
//    自身的 animate-fade-in，让列表刷新时有真实 App 常见的那种轻微动感。
// 其余（cleanup、scheduler、随机发帖、header悬浮按钮、Dock）沿用上一轮不变。
//
import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import { snapshotScheduler } from './services/snapshotSchedulerService';
import { runSnapshotCleanup } from './services/snapshotCleanupService';
import { triggerRandomDailyPosts } from './services/snapshotRandomPostService';
import { getNpcsByChatId } from './services/snapshotNpcService';
import SnapshotCard from './SnapshotCard';
import UserProfileSheet from './components/UserProfileSheet';
import CharacterProfileSheet from './components/CharacterProfileSheet';
import WorldlineSwitcher from './components/WorldlineSwitcher';
import CreateSnapshotModal from './CreateSnapshotModal';
import SnapshotSettingsModal from './SnapshotSettingsModal';

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

const FILTER_KEYS = ['all', 'character', 'npc', 'user'];
const DEFAULT_FILTER_LABELS = { all: '全部', character: '伴侣', npc: 'NPC', user: '我的动态' };

export const SnapshotsApp = ({ onBackHub, defaultChatId = null }) => {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(defaultChatId);
  const [snapshots, setSnapshots] = useState([]);

  // 故事条数据
  const [storyChar, setStoryChar] = useState(null);
  const [storyNpcs, setStoryNpcs] = useState([]);
  const [userStoryInfo, setUserStoryInfo] = useState({ name: '我', avatar: '' });

  // 筛选：{ type: 'all'|'character'|'npc'|'user', npcId: number|null }
  const [activeFilter, setActiveFilter] = useState({ type: 'all', npcId: null });

  // 筛选 chip 自定义文字
  const [filterLabels, setFilterLabels] = useState(DEFAULT_FILTER_LABELS);
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [editingLabelKey, setEditingLabelKey] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');

  // Sheets & Modals
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const loadStoryBar = useCallback(async () => {
    if (!currentChatId) return;
    try {
      const chat = await db.chats.get(Number(currentChatId));

      if (chat?.characterId) {
        const char = await db.characters.get(Number(chat.characterId));
        setStoryChar(char || null);
      } else {
        setStoryChar(null);
      }

      const npcs = await getNpcsByChatId(Number(currentChatId));
      setStoryNpcs(npcs);

      const profileKey = `user_${currentChatId}`;
      const customProfile = await db.snapshotProfiles.get(profileKey);
      setUserStoryInfo({
        name: customProfile?.name || chat?.userName || '我',
        avatar: customProfile?.avatar || chat?.userAvatar || ''
      });
    } catch (err) {
      console.error('加载故事条数据失败:', err);
    }
  }, [currentChatId]);

  const loadFilterLabels = useCallback(async () => {
    if (!currentChatId) return;
    try {
      const saved = await db.snapshotSettings.get(`filterLabels_${currentChatId}`);
      setFilterLabels({ ...DEFAULT_FILTER_LABELS, ...(saved?.value || {}) });
    } catch (err) {
      console.error('加载筛选标签失败:', err);
      setFilterLabels(DEFAULT_FILTER_LABELS);
    }
  }, [currentChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!currentChatId) return;

    runSnapshotCleanup(currentChatId).then((result) => {
      if (result && !result.skipped && result.deletedCount > 0) {
        loadSnapshots();
      }
    });

    setActiveFilter({ type: 'all', npcId: null });
    setIsEditingLabels(false);
    setEditingLabelKey(null);
    loadSnapshots();
    loadStoryBar();
    loadFilterLabels();

    snapshotScheduler.start(currentChatId);
    const unsubscribe = snapshotScheduler.subscribe(() => {
      loadSnapshots();
      loadStoryBar();
    });

    return () => {
      unsubscribe();
    };
  }, [currentChatId, loadSnapshots, loadStoryBar, loadFilterLabels]);

  const startEditLabel = (key) => {
    setEditingLabelKey(key);
    setLabelDraft(filterLabels[key]);
  };

  const saveEditLabel = async () => {
    if (!editingLabelKey || !currentChatId) {
      setEditingLabelKey(null);
      return;
    }
    const key = editingLabelKey;
    const trimmed = labelDraft.trim();
    const nextLabels = { ...filterLabels, [key]: trimmed || DEFAULT_FILTER_LABELS[key] };
    setFilterLabels(nextLabels);
    setEditingLabelKey(null);
    try {
      await db.snapshotSettings.put({ key: `filterLabels_${currentChatId}`, value: nextLabels });
    } catch (err) {
      console.error('保存筛选标签失败:', err);
    }
  };

  const handleDeleteSnapshot = async (id) => {
    try {
      await db.snapshots.delete(id);
      await db.snapshotComments.where('snapshotId').equals(id).delete();
      loadSnapshots();
    } catch (err) {
      console.error('删除动态失败:', err);
    }
  };

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

  // 各故事条头像的发帖数徽章
  const charPostCount = snapshots.filter((s) => s.authorType === 'character').length;
  const npcPostCount = (npcId) =>
    snapshots.filter((s) => s.authorType === 'npc' && Number(s.npcId) === Number(npcId)).length;

  const filteredSnapshots = snapshots.filter((s) => {
    if (activeFilter.type === 'all') return true;
    if (activeFilter.type === 'user') return s.authorType === 'user';
    if (activeFilter.type === 'character') return s.authorType === 'character';
    if (activeFilter.type === 'npc') {
      if (!activeFilter.npcId) return s.authorType === 'npc';
      return s.authorType === 'npc' && Number(s.npcId) === Number(activeFilter.npcId);
    }
    return true;
  });

  const isFilterActive = (chipKey) => {
    if (chipKey === 'npc') return activeFilter.type === 'npc' && !activeFilter.npcId;
    return activeFilter.type === chipKey;
  };

  return (
    <div className="fixed inset-0 z-30 w-full h-[100dvh] bg-[#f7f8fa] text-neutral-900 flex flex-col overflow-hidden selection:bg-neutral-900 selection:text-white">

      {/* 顶部：4 个独立悬浮图标按钮（固定，不参与滚动） */}
      <header className="flex-shrink-0 z-40 w-full px-4 pt-4 pb-2 flex items-center justify-between bg-[#f7f8fa]/0">
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

      {/* 故事条：User + 官配角色 + NPC（不参与整页滚动，只有横向滚动） */}
      <div className="flex-shrink-0 w-full px-4 pt-2.5 pb-2.5 flex items-center gap-4 overflow-x-auto overflow-y-visible">
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-90 transition-transform"
        >
          {/* 徽章挪到 overflow-hidden 容器外面，避免被头像自身的裁切吞掉 */}
          <div className="relative w-14 h-14">
            <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-neutral-200/60 flex items-center justify-center overflow-hidden">
              {userStoryInfo.avatar ? (
                <img src={userStoryInfo.avatar} alt="You" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-neutral-400">{userStoryInfo.name[0]}</span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-neutral-900 border-2 border-white flex items-center justify-center pointer-events-none">
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-neutral-500">You</span>
        </button>

        {storyChar && (
          <button
            type="button"
            onClick={() => setSelectedCharId(storyChar.id)}
            className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-90 transition-transform"
          >
            <div className="relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-neutral-300 to-neutral-400 shadow-sm">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                {storyChar.avatar ? (
                  <img src={storyChar.avatar} alt={storyChar.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-neutral-400">{storyChar.name[0]}</span>
                )}
              </div>
              {charPostCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-neutral-900 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#f7f8fa]">
                  {charPostCount > 9 ? '9+' : charPostCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 max-w-[56px] truncate">@{storyChar.name}</span>
          </button>
        )}

        {storyNpcs.map((npc) => {
          const count = npcPostCount(npc.id);
          const active = activeFilter.type === 'npc' && Number(activeFilter.npcId) === Number(npc.id);
          return (
            <button
              key={npc.id}
              type="button"
              onClick={() => setActiveFilter(
                active ? { type: 'all', npcId: null } : { type: 'npc', npcId: npc.id }
              )}
              className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-90 transition-transform"
            >
              <div className={`relative w-14 h-14 rounded-full p-[2px] shadow-sm transition-all ${
                active ? 'bg-neutral-900' : 'bg-gradient-to-tr from-neutral-200 to-neutral-300'
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                  {npc.avatar ? (
                    <img src={npc.avatar} alt={npc.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-neutral-400">{npc.name[0]}</span>
                  )}
                </div>
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-neutral-900 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#f7f8fa]">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-neutral-500 max-w-[56px] truncate">@{npc.name}</span>
            </button>
          );
        })}
      </div>

      {/* 筛选 chip：文字可自定义，点右侧铅笔进入编辑态 */}
      <div className="flex-shrink-0 w-full px-4 pb-3 flex items-center gap-2 overflow-x-auto">
        {FILTER_KEYS.map((key) => {
          const active = isFilterActive(key);
          const isEditingThis = isEditingLabels && editingLabelKey === key;

          if (isEditingThis) {
            return (
              <input
                key={key}
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={saveEditLabel}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                maxLength={6}
                className="w-16 px-2 py-1.5 rounded-full text-xs font-semibold text-center bg-white border border-neutral-900 outline-none flex-shrink-0"
              />
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (isEditingLabels) startEditLabel(key);
                else setActiveFilter({ type: key, npcId: null });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all active:scale-95 ${
                active
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white text-neutral-500 border border-neutral-200/60 hover:bg-neutral-50'
              } ${isEditingLabels ? 'ring-2 ring-offset-1 ring-neutral-300' : ''}`}
            >
              {filterLabels[key]}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => { setIsEditingLabels((v) => !v); setEditingLabelKey(null); }}
          title={isEditingLabels ? '完成编辑' : '自定义标签文字'}
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
            isEditingLabels ? 'bg-neutral-900 text-white' : 'text-neutral-300 hover:text-neutral-500'
          }`}
        >
          {isEditingLabels ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          )}
        </button>
      </div>

      {/* 核心视区：唯一可垂直滚动的区域，min-h-0 让 flex 容器真正收敛高度而不是被内容撑开 */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain w-full px-4 pt-1 pb-32 flex flex-col">
        {filteredSnapshots.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-sm border border-neutral-200/60 flex items-center justify-center text-neutral-400 mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-neutral-800 tracking-tight mb-1.5">
              {snapshots.length === 0 ? '该世界线尚未定格片羽' : '这个筛选下还没有动态'}
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
            {filteredSnapshots.map((item, idx) => (
              <div key={item.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                <SnapshotCard
                  snapshot={item}
                  currentChatId={currentChatId}
                  onDelete={handleDeleteSnapshot}
                  onOpenUserProfile={() => setIsUserProfileOpen(true)}
                  onOpenCharProfile={(charId) => setSelectedCharId(charId)}
                />
              </div>
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