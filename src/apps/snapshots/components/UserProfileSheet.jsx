// src/apps/snapshots/components/UserProfileSheet.jsx
//
// 【整体替换说明】相对上一版的修正：
// 上一版把主页做成了深色玄武岩玻璃风格，但整个 app 实际是浅色液态玻璃风格
// （白色半透明 + 高斯模糊 + 深色文字），这版把配色体系换回浅色液态玻璃，
// 结构（全屏背景大图、悬浮 Hero 卡片、统计数字、标签 chip、横向图集、
// 最新回响卡、点击预览区换图的编辑模式）完全保留，只改配色。
//
import React, { useState, useEffect, useRef } from 'react';
import db from '../../../db';
import { getUserSnapshotProfile, saveUserSnapshotProfile } from '../services/snapshotProfileService';
import { compressImageFile } from '../services/snapshotMediaService';
import WorldlineSwitcher from './WorldlineSwitcher';

export const UserProfileSheet = ({
  isOpen,
  onClose,
  currentChatId,
  chats,
  onChangeChat,
  onOpenSnapshotDetail
}) => {
  const [profile, setProfile] = useState(null);
  const [mySnapshots, setMySnapshots] = useState([]);
  const [echoCount, setEchoCount] = useState(0);
  const [latestEcho, setLatestEcho] = useState(null);
  const [currentChar, setCurrentChar] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [editTagsText, setEditTagsText] = useState('');

  const carouselRef = useRef(null);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !currentChatId) return;
    loadData();
  }, [isOpen, currentChatId]);

  const loadData = async () => {
    try {
      const p = await getUserSnapshotProfile(currentChatId);
      setProfile(p);
      setEditName(p.name);
      setEditHandle(p.handle);
      setEditBio(p.bio);
      setEditAvatar(p.avatar);
      setEditBanner(p.banner);
      setEditTagsText(p.tags.join(', '));

      const chat = await db.chats.get(Number(currentChatId));
      if (chat?.characterId) {
        const c = await db.characters.get(chat.characterId);
        setCurrentChar(c);
      } else {
        setCurrentChar(null);
      }

      const list = await db.snapshots
        .where('chatId')
        .equals(Number(currentChatId))
        .and((s) => s.authorType === 'user')
        .reverse()
        .sortBy('timestamp');
      setMySnapshots(list);

      const myIds = new Set(list.map((s) => s.id));
      if (myIds.size > 0) {
        const allComments = await db.snapshotComments
          .where('chatId')
          .equals(Number(currentChatId))
          .and((c) => myIds.has(c.snapshotId))
          .sortBy('createdAt');
        setEchoCount(allComments.length);
        setLatestEcho(allComments.length > 0 ? allComments[allComments.length - 1] : null);
      } else {
        setEchoCount(0);
        setLatestEcho(null);
      }
    } catch (err) {
      console.error('加载 User 主页数据失败:', err);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await saveUserSnapshotProfile(currentChatId, {
        name: editName,
        handle: editHandle,
        avatar: editAvatar,
        bio: editBio,
        banner: editBanner,
        tags: editTagsText
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
      const dataUrl = await compressImageFile(file, 1200, 1600, 0.82);
      setEditBanner(dataUrl);
    } catch (err) {
      console.error('封面压缩失败:', err);
    }
  };

  const scrollCarousel = (dir) => {
    carouselRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  if (!isOpen) return null;

  const displayBanner = isEditing ? editBanner : profile?.banner;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex flex-col justify-end animate-fade-in text-left">
      <div className="w-full h-[94vh] rounded-t-[36px] shadow-2xl flex flex-col overflow-hidden relative bg-neutral-50">

        {/* 全屏通栏背景大图 + 浅色渐变遮罩（液态玻璃：图片透出，渐渐融入白色内容区） */}
        <div className="absolute inset-0">
          {displayBanner ? (
            <img src={displayBanner} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/60 to-neutral-50" />
        </div>

        {/* 顶部悬浮控制：返回 / 世界线切换 / 编辑 */}
        <div className="relative z-10 px-5 pt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white/60 flex items-center justify-center text-neutral-800 hover:bg-white active:scale-90 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <WorldlineSwitcher
            chats={chats}
            currentChatId={currentChatId}
            onChangeChat={onChangeChat}
            tone="light"
          />

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

        {/* 滚动核心内容 */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 pt-6 pb-12 space-y-5">
          {isEditing ? (
            /* ============ 编辑模式：浅色液态玻璃面板 ============ */
            <div className="bg-white/75 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 space-y-5 shadow-xl animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200/60">
                <h4 className="text-sm font-bold text-neutral-900">编辑当前世界线主页</h4>
              </div>

              {/* 封面预览：点击即可更换 */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-2">封面大图</label>
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

              {/* 头像 + 名字/handle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200/70 flex-shrink-0 flex items-center justify-center group"
                >
                  {editAvatar ? (
                    <img src={editAvatar} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-neutral-500 font-bold text-lg">{(editName || 'U')[0]}</span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="主页名字"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full text-sm font-bold p-2.5 rounded-xl bg-white border border-neutral-200 outline-none text-neutral-900 placeholder-neutral-400 focus:border-neutral-400 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="@handle（可选）"
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl bg-white border border-neutral-200 outline-none text-neutral-700 placeholder-neutral-400 focus:border-neutral-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 block mb-1">个性签名 / 随笔状态</label>
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
                  placeholder="例：书虫, 爱猫人士, 夜跑爱好者"
                  value={editTagsText}
                  onChange={(e) => setEditTagsText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-neutral-200 outline-none text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                className="w-full py-3 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
              >
                保存此世界线主页
              </button>
            </div>
          ) : (
            /* ============ 展示模式：浅色液态玻璃 Hero 卡片 ============ */
            <div className="bg-white/75 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 space-y-4 shadow-xl">
              {/* 顶部小拖拽把手（装饰性） */}
              <div className="flex justify-center">
                <div className="w-10 h-1 rounded-full bg-neutral-300" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight leading-tight">
                  {profile?.name}
                </h2>
                {profile?.handle && (
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">@{profile.handle}</p>
                )}
                {currentChar && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 rounded-full bg-neutral-100 text-[10px] text-neutral-500 font-medium">
                    <span>with</span>
                    <span className="font-bold text-neutral-800">{currentChar.name}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed font-serif italic">
                "{profile?.bio || '在日常的光影里，定格温存。'}"
              </p>

              {/* 统计数字 */}
              <div className="flex items-center gap-6">
                <div>
                  <span className="font-black text-neutral-900 block text-lg">{mySnapshots.length}</span>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">动态</span>
                </div>
                <div>
                  <span className="font-black text-neutral-900 block text-lg">
                    {mySnapshots.reduce((acc, cur) => acc + (cur.likes || 0), 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">获赞</span>
                </div>
                <div>
                  <span className="font-black text-neutral-900 block text-lg">{echoCount}</span>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">回响</span>
                </div>
              </div>

              {/* 个性标签 */}
              {profile?.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] text-neutral-600 font-medium">
                      @{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 横向图集 + 左右导航箭头 */}
          {!isEditing && mySnapshots.length > 0 && (
            <div className="space-y-2">
              <div ref={carouselRef} className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
                {mySnapshots.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenSnapshotDetail && onOpenSnapshotDetail(item)}
                    className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 snap-start bg-white/70 border border-white/60 shadow-sm"
                  >
                    {item.mediaUrl ? (
                      <img src={item.mediaUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full p-2 flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100">
                        <span className="text-[8px] font-serif italic text-neutral-600 line-clamp-4 text-center">
                          "{item.imagePrompt || item.content}"
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {mySnapshots.length > 3 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => scrollCarousel(-1)}
                    className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center text-neutral-600 hover:text-neutral-900 active:scale-90 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel(1)}
                    className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center text-neutral-600 hover:text-neutral-900 active:scale-90 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 最新回响引用卡 */}
          {!isEditing && latestEcho && (
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
                {latestEcho.senderAvatar ? (
                  <img src={latestEcho.senderAvatar} alt={latestEcho.senderName} className="w-full h-full object-cover" />
                ) : (
                  (latestEcho.senderName || '?')[0]
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-700 leading-relaxed">{latestEcho.content}</p>
                <p className="text-[10px] text-neutral-400 font-semibold mt-1.5">{latestEcho.senderName}</p>
              </div>
            </div>
          )}

          {/* 动态时间线 */}
          {!isEditing && (
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-neutral-400 px-1 uppercase tracking-widest">时间随笔</h4>
              {mySnapshots.length === 0 ? (
                <div className="text-center py-10 text-xs text-neutral-400 space-y-1">
                  <p>在此世界线中还没有留下动态</p>
                  <p className="text-[10px] opacity-70">点击发帖，留下你的第一抹光影</p>
                </div>
              ) : (
                mySnapshots.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenSnapshotDetail && onOpenSnapshotDetail(item)}
                    className="w-full text-left p-4 rounded-3xl bg-white/70 border border-white/60 shadow-sm space-y-2 hover:bg-white/90 transition-colors"
                  >
                    <div className="text-[10px] text-neutral-400">
                      {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {item.mediaUrl && (
                      <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100">
                        <img src={item.mediaUrl} alt="Visual" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {item.content && <p className="text-xs text-neutral-800 leading-relaxed">{item.content}</p>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileSheet;