// src/apps/snapshots/components/UserProfileSheet.jsx
import React, { useState, useEffect } from 'react';
import db from "../../../db";
import { getUserSnapshotProfile, saveUserSnapshotProfile } from "../services/snapshotProfileService";

import { compressImageFile } from './services/snapshotMediaService';

export const UserProfileSheet = ({
  isOpen,
  onClose,
  currentChatId,
  chats,
  onChangeChat,
  onOpenSnapshotDetail
}) => {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'grid'
  const [mySnapshots, setMySnapshots] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [currentChar, setCurrentChar] = useState(null);

  useEffect(() => {
    if (!isOpen || !currentChatId) return;
    loadData();
  }, [isOpen, currentChatId]);

  const loadData = async () => {
    try {
      const p = await getUserSnapshotProfile(currentChatId);
      setProfile(p);
      setEditName(p.name);
      setEditBio(p.bio);
      setEditAvatar(p.avatar);
      setEditBanner(p.banner);

      // 获取伴侣
      const chat = await db.chats.get(Number(currentChatId));
      if (chat?.characterId) {
        const c = await db.characters.get(chat.characterId);
        setCurrentChar(c);
      } else {
        setCurrentChar(null);
      }

      // 获取本切片下自己发过的动态
      const list = await db.snapshots
        .where('chatId')
        .equals(Number(currentChatId))
        .and((s) => s.authorType === 'user')
        .reverse()
        .sortBy('timestamp');
      setMySnapshots(list);
    } catch (err) {
      console.error('加载 User 主页数据失败:', err);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await saveUserSnapshotProfile(currentChatId, {
        name: editName,
        avatar: editAvatar,
        bio: editBio,
        banner: editBanner
      });
      setIsEditing(false);
      loadData();
    } catch (err) {
      console.error('保存主页失败:', err);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 400, 400, 0.85);
      setEditAvatar(dataUrl);
    } catch (err) {
      console.error('头像压缩失败:', err);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 1200, 600, 0.82);
      setEditBanner(dataUrl);
    } catch (err) {
      console.error('封面压缩失败:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xl flex flex-col justify-end animate-fade-in text-left">
      {/* 沉浸式超级抽屉容器 */}
      <div className="w-full h-[92vh] bg-white rounded-t-[40px] shadow-2xl flex flex-col overflow-hidden relative border-t border-white/60">
        {/* 背景 Hero 大图 */}
        <div className="absolute top-0 left-0 right-0 h-56 overflow-hidden bg-neutral-200">
          {profile?.banner ? (
            <img src={profile.banner} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white" />
        </div>

        {/* 顶部通透微按钮条（无长条彩色 Top Bar） */}
        <div className="relative z-10 px-5 pt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm flex items-center justify-center text-neutral-800 hover:bg-white transition-all active:scale-95"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {/* 消息框世界线切换胶囊 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-neutral-200/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <select
              value={currentChatId || ''}
              onChange={(e) => onChangeChat(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-neutral-800 outline-none cursor-pointer"
            >
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm flex items-center justify-center text-neutral-800 hover:bg-white transition-all active:scale-95"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>

        {/* 滚动核心内容 */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 pt-16 pb-12 space-y-6">
          {/* 编辑模式浮层 */}
          {isEditing ? (
            <div className="bg-neutral-50/90 backdrop-blur-md p-5 rounded-3xl border border-neutral-200/70 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/50">
                <h4 className="text-xs font-bold text-neutral-900">编辑当前世界线主页</h4>
                <button type="button" onClick={() => setIsEditing(false)} className="text-[11px] text-neutral-400">取消</button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">主页名字</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">更换头像</label>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="text-xs text-neutral-500" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">更换封面横幅</label>
                <input type="file" accept="image/*" onChange={handleBannerUpload} className="text-xs text-neutral-500" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">个性签名 / 随笔状态</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none h-20 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
              >
                保存此世界线主页
              </button>
            </div>
          ) : (
            /* 正常主页头部 */
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-[26px] p-1 bg-white shadow-xl -mt-8 relative group">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover rounded-[22px]" />
                ) : (
                  <div className="w-full h-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-500 text-xl rounded-[22px]">
                    {(profile?.name || 'U')[0]}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-black text-neutral-900 tracking-tight">{profile?.name}</h2>
                {currentChar && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full bg-neutral-100 text-[10px] text-neutral-500 font-medium">
                    <span>with</span>
                    <span className="font-bold text-neutral-800">{currentChar.name}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-neutral-600 max-w-xs leading-relaxed font-serif italic">
                "{profile?.bio || '在日常的光影里，定格温存。'}"
              </p>

              {/* 统计胶囊 */}
              <div className="flex items-center gap-6 pt-2 text-xs">
                <div>
                  <span className="font-black text-neutral-900 block text-base">{mySnapshots.length}</span>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">Moments</span>
                </div>
                <div className="w-[1px] h-6 bg-neutral-200" />
                <div>
                  <span className="font-black text-neutral-900 block text-base">
                    {mySnapshots.reduce((acc, cur) => acc + (cur.likes || 0), 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">Likes</span>
                </div>
              </div>
            </div>
          )}

          {/* 切换 Tab */}
          <div className="flex p-1 rounded-2xl bg-neutral-100 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'posts' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'
              }`}
            >
              时间随笔
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('grid')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'grid' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'
              }`}
            >
              拍立得网格
            </button>
          </div>

          {/* 动态内容区 */}
          {mySnapshots.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-400 space-y-1">
              <p>在此世界线中还没有留下动态</p>
              <p className="text-[10px] opacity-70">点击发帖，留下你的第一抹光影</p>
            </div>
          ) : activeTab === 'grid' ? (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {mySnapshots.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onOpenSnapshotDetail && onOpenSnapshotDetail(item)}
                  className="aspect-square rounded-2xl bg-neutral-100 overflow-hidden relative cursor-pointer group shadow-sm"
                >
                  {item.mediaUrl ? (
                    <img src={item.mediaUrl} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col justify-center items-center bg-gradient-to-br from-neutral-50 to-neutral-200 text-center">
                      <span className="text-[9px] font-serif italic text-neutral-600 line-clamp-3">"{item.imagePrompt || item.content}"</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {mySnapshots.map((item) => (
                <div key={item.id} className="p-4 rounded-3xl bg-neutral-50/80 border border-neutral-200/50 space-y-2">
                  <div className="text-[10px] text-neutral-400">
                    {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {item.mediaUrl && (
                    <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-200">
                      <img src={item.mediaUrl} alt="Visual" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {item.content && <p className="text-xs text-neutral-800 leading-relaxed">{item.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileSheet;
