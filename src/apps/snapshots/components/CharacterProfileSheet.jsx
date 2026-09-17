// src/apps/snapshots/components/CharacterProfileSheet.jsx
import React, { useState, useEffect } from 'react';
import db from '../../db';
import { getCharSnapshotProfile, saveCharSnapshotProfile } from './services/snapshotProfileService';
import { compressImageFile } from './services/snapshotMediaService';

export const CharacterProfileSheet = ({
  isOpen,
  onClose,
  currentChatId,
  characterId,
  onInvitePost
}) => {
  const [profile, setProfile] = useState(null);
  const [charPosts, setCharPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editBanner, setEditBanner] = useState('');

  useEffect(() => {
    if (!isOpen || !characterId || !currentChatId) return;
    loadData();
  }, [isOpen, characterId, currentChatId]);

  const loadData = async () => {
    try {
      const p = await getCharSnapshotProfile(currentChatId, characterId);
      setProfile(p);
      setEditBio(p.bio);
      setEditBanner(p.banner);

      const list = await db.snapshots
        .where('chatId')
        .equals(Number(currentChatId))
        .and((s) => s.authorType === 'character' && Number(s.characterId) === Number(characterId))
        .reverse()
        .sortBy('timestamp');
      setCharPosts(list);
    } catch (err) {
      console.error('加载角色主页失败:', err);
    }
  };

  const handleSave = async () => {
    try {
      await saveCharSnapshotProfile(currentChatId, characterId, {
        name: profile.name,
        avatar: profile.avatar,
        bio: editBio,
        banner: editBanner
      });
      setIsEditing(false);
      loadData();
    } catch (err) {
      console.error('保存角色资料失败:', err);
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

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xl flex flex-col justify-end animate-fade-in text-left">
      <div className="w-full h-[90vh] bg-white rounded-t-[40px] shadow-2xl flex flex-col overflow-hidden relative border-t border-white/60">
        {/* Banner */}
        <div className="absolute top-0 left-0 right-0 h-52 overflow-hidden bg-neutral-200">
          {profile.banner ? (
            <img src={profile.banner} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-200 via-neutral-300 to-neutral-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white" />
        </div>

        {/* 顶部通透控制 */}
        <div className="relative z-10 px-5 pt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm flex items-center justify-center text-neutral-800 hover:bg-white transition-all active:scale-95"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <span className="text-xs font-bold tracking-tight text-neutral-800 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md shadow-sm">
            伴侣档案空间
          </span>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm flex items-center justify-center text-neutral-800 hover:bg-white transition-all active:scale-95"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 pt-14 pb-12 space-y-6">
          {isEditing ? (
            <div className="bg-neutral-50/90 backdrop-blur-md p-5 rounded-3xl border border-neutral-200/70 space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold text-neutral-900 pb-2 border-b border-neutral-200/50">
                微调 {profile.name} 在此世界的设定
              </h4>
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">专属背景封面</label>
                <input type="file" accept="image/*" onChange={handleBannerUpload} className="text-xs text-neutral-500" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">在此世界线的心境签名</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none h-20 resize-none"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95"
              >
                保存资料
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-[26px] p-1 bg-white shadow-xl -mt-6">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover rounded-[22px]" />
                ) : (
                  <div className="w-full h-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-500 text-xl rounded-[22px]">
                    {profile.name[0]}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-black text-neutral-900">{profile.name}</h2>
                <p className="text-xs text-neutral-600 max-w-xs leading-relaxed font-serif italic mt-1">
                  "{profile.bio}"
                </p>
              </div>

              {/* 动作按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInvitePost && onInvitePost(characterId);
                  }}
                  className="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95 transition-transform flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
                  <span>邀约 Ta 创作动态</span>
                </button>
              </div>
            </div>
          )}

          {/* 角色动态列表 */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-neutral-900 px-1">由 {profile.name} 定格的瞬间</h4>
            {charPosts.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-8">Ta 还没有在此世界线发布过动态</p>
            ) : (
              charPosts.map((item) => (
                <div key={item.id} className="p-4 rounded-3xl bg-neutral-50/80 border border-neutral-200/50 space-y-2">
                  <div className="text-[10px] text-neutral-400">
                    {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {item.imagePrompt && (
                    <div className="p-3 bg-white rounded-2xl border border-neutral-200/40 text-[11px] font-serif italic text-neutral-600">
                      "{item.imagePrompt}"
                    </div>
                  )}
                  {item.content && <p className="text-xs text-neutral-800 leading-relaxed">{item.content}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterProfileSheet;
