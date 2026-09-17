// src/apps/snapshots/components/CharacterProfileSheet.jsx
//
// 【整体替换说明】相对上一版的修正：配色从深色玄武岩玻璃换回浅色液态玻璃，
// 与 UserProfileSheet 保持统一。结构（全屏背景图、Hero 卡片、直接生成动态
// 的按钮、编辑模式点击换图）完全保留，未做逻辑改动。
//
import React, { useState, useEffect, useRef } from 'react';
import db from '../../../db';
import { getCharSnapshotProfile, saveCharSnapshotProfile } from '../services/snapshotProfileService';
import { compressImageFile } from '../services/snapshotMediaService';
import { generateCharacterPost } from '../services/snapshotAiService';

export const CharacterProfileSheet = ({
  isOpen,
  onClose,
  currentChatId,
  characterId
}) => {
  const [profile, setProfile] = useState(null);
  const [charPosts, setCharPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [editTagsText, setEditTagsText] = useState('');
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);

  const bannerInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !characterId || !currentChatId) return;
    loadData();
  }, [isOpen, characterId, currentChatId]);

  const loadData = async () => {
    try {
      const p = await getCharSnapshotProfile(currentChatId, characterId);
      setProfile(p);
      setEditBio(p.bio);
      setEditHandle(p.handle);
      setEditBanner(p.banner);
      setEditTagsText(p.tags.join(', '));

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
        handle: editHandle,
        banner: editBanner,
        tags: editTagsText
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
      const dataUrl = await compressImageFile(file, 1200, 1600, 0.82);
      setEditBanner(dataUrl);
    } catch (err) {
      console.error('封面压缩失败:', err);
    }
  };

  const handleGeneratePost = async () => {
    if (isGeneratingPost) return;
    setIsGeneratingPost(true);
    try {
      const postData = await generateCharacterPost(characterId, Number(currentChatId));
      const now = Date.now();
      await db.snapshots.add({
        chatId: Number(currentChatId),
        authorType: 'character',
        characterId: Number(characterId),
        authorName: profile.name,
        authorAvatar: profile.avatar || '',
        mediaUrl: '',
        imagePrompt: postData.imagePrompt,
        content: postData.content,
        location: postData.location,
        likes: 0,
        isLiked: false,
        timestamp: now,
        createdAt: now
      });
      await loadData();
    } catch (err) {
      console.error('生成角色动态失败:', err);
    } finally {
      setIsGeneratingPost(false);
    }
  };

  if (!isOpen || !profile) return null;

  const displayBanner = isEditing ? editBanner : profile.banner;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex flex-col justify-end animate-fade-in text-left">
      <div className="w-full h-[92vh] rounded-t-[36px] shadow-2xl flex flex-col overflow-hidden relative bg-neutral-50">

        {/* 全屏通栏背景图 + 浅色渐变遮罩 */}
        <div className="absolute inset-0">
          {displayBanner ? (
            <img src={displayBanner} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/60 to-neutral-50" />
        </div>

        {/* 顶部悬浮控制 */}
        <div className="relative z-10 px-5 pt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white/60 flex items-center justify-center text-neutral-800 hover:bg-white active:scale-90 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <span className="text-xs font-bold tracking-tight text-neutral-800 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white/60">
            伴侣档案空间
          </span>

          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white/60 flex items-center justify-center text-neutral-800 hover:bg-white active:scale-90 transition-all"
          >
            {isEditing ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            )}
          </button>
        </div>

        {/* 内容 */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 pt-6 pb-12 space-y-5">
          {isEditing ? (
            /* ============ 编辑模式 ============ */
            <div className="bg-white/75 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 space-y-5 shadow-xl animate-fade-in">
              <h4 className="text-sm font-bold text-neutral-900 pb-3 border-b border-neutral-200/60">
                微调 {profile.name} 在此世界的设定
              </h4>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-2">专属背景封面</label>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="relative w-full h-28 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200/70 flex items-center justify-center group"
                >
                  {editBanner ? (
                    <img src={editBanner} alt="Banner preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-neutral-400 text-xs">点击选择封面图</span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-neutral-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </span>
                  </div>
                </button>
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">@handle（可选）</label>
                <input
                  type="text"
                  placeholder="@handle"
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">在此世界线的心境签名</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none h-20 resize-none text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">个性标签（用逗号分隔，最多8个）</label>
                <input
                  type="text"
                  placeholder="例：晨型人, 猫派, 手冲爱好者"
                  value={editTagsText}
                  onChange={(e) => setEditTagsText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="w-full py-3 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
              >
                保存资料
              </button>
            </div>
          ) : (
            /* ============ 展示模式：浅色液态玻璃 Hero 卡片 ============ */
            <div className="bg-white/75 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex justify-center">
                <div className="w-10 h-1 rounded-full bg-neutral-300" />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-200/70">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-neutral-500 text-lg">
                      {profile.name[0]}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 tracking-tight">{profile.name}</h2>
                  {profile.handle && <p className="text-xs text-neutral-400 font-medium mt-0.5">@{profile.handle}</p>}
                </div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed font-serif italic">
                "{profile.bio}"
              </p>

              {profile.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] text-neutral-600 font-medium">
                      @{tag}
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleGeneratePost}
                disabled={isGeneratingPost}
                className="w-full py-3 rounded-full bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${isGeneratingPost ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {isGeneratingPost ? (
                    <path d="M21 12a9 9 0 1 1-9-9" />
                  ) : (
                    <><path d="M12 2v20M2 12h20"/></>
                  )}
                </svg>
                <span>{isGeneratingPost ? '正在创作...' : `邀约 ${profile.name} 创作动态`}</span>
              </button>
            </div>
          )}

          {/* 角色动态列表 */}
          {!isEditing && (
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-neutral-400 px-1 uppercase tracking-widest">由 {profile.name} 定格的瞬间</h4>
              {charPosts.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-10">Ta 还没有在此世界线发布过动态</p>
              ) : (
                charPosts.map((item) => (
                  <div key={item.id} className="p-4 rounded-3xl bg-white/70 border border-white/60 shadow-sm space-y-2">
                    <div className="text-[10px] text-neutral-400">
                      {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {item.imagePrompt && (
                      <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/50 text-[11px] font-serif italic text-neutral-600">
                        "{item.imagePrompt}"
                      </div>
                    )}
                    {item.content && <p className="text-xs text-neutral-800 leading-relaxed">{item.content}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterProfileSheet;