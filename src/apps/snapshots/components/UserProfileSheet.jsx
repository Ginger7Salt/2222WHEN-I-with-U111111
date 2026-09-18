// src/apps/snapshots/components/UserProfileSheet.jsx
//
// 【整体替换说明】相对上一版的改动：
// 1. 展示模式的 Hero 卡片里补上了头像（之前编辑模式能上传，但展示时从没渡染出来）。
// 2. 新增"精选/展示图"小图带：与下方自动生成的动态流完全无关，是用户自己手动
//    挑选、可增删的一组图（最多 8 张），展示时是一条支持左右滑动 + 箭头翻页的
//    横向小图带，正好插在"个人简介"和"动态展示(IG网格)"两段之间，让页面呈现
//    三段式结构：① 个人简介（头像/名字/签名/统计/标签）② 精选展示图 ③ 动态(IG网格)。
// 3. 个性签名在展示模式下也可以直接点击进入编辑，不用先摸到右上角的编辑按钮。
//
import React, { useState, useEffect, useRef } from 'react';
import db from '../../../db';
import { getUserSnapshotProfile, saveUserSnapshotProfile } from '../services/snapshotProfileService';
import { compressImageFile } from '../services/snapshotMediaService';
import WorldlineSwitcher from './WorldlineSwitcher';

const MAX_SHOWCASE_IMAGES = 8;

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
  const [editShowcase, setEditShowcase] = useState([]);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const showcaseInputRef = useRef(null);
  const showcaseCarouselRef = useRef(null);

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
      setEditShowcase(p.showcaseImages || []);

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
        tags: editTagsText,
        showcaseImages: editShowcase
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

  const handleShowcaseUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = MAX_SHOWCASE_IMAGES - editShowcase.length;
    const toProcess = files.slice(0, Math.max(remaining, 0));
    try {
      const dataUrls = await Promise.all(
        toProcess.map((file) => compressImageFile(file, 800, 800, 0.82))
      );
      setEditShowcase((prev) => [...prev, ...dataUrls].slice(0, MAX_SHOWCASE_IMAGES));
    } catch (err) {
      console.error('精选图压缩失败:', err);
    } finally {
      e.target.value = '';
    }
  };

  const removeShowcaseImage = (idx) => {
    setEditShowcase((prev) => prev.filter((_, i) => i !== idx));
  };

  const scrollShowcase = (dir) => {
    showcaseCarouselRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  if (!isOpen) return null;

  const displayBanner = isEditing ? editBanner : profile?.banner;
  const displayShowcase = isEditing ? editShowcase : profile?.showcaseImages || [];

  return (
    <div className="fixed inset-0 z-50 bg-neutral-50 text-left animate-fade-in">
      {/* 固定背景大图：贯穿整页，滚动内容浮在它上方，图片始终可见 */}
      <div className="fixed inset-0 z-0">
        {displayBanner ? (
          <img src={displayBanner} alt="Banner" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-white/35 to-white/75" />
      </div>

      {/* 顶部悬浮控制：返回 / 世界线切换 / 编辑，固定在页面顶部，滚动时始终可点击 */}
      <div className="fixed top-0 inset-x-0 z-30 px-5 pt-5 pb-3 flex items-center justify-between">
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

      {/* 滚动核心内容：浮在固定背景图之上 */}
      <div className="relative z-10 h-full overflow-y-auto px-5 pt-20 pb-12 space-y-5">
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
                  <img src={editBanner} alt="Banner preview" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
                  <img src={editAvatar} alt="Avatar preview" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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

            {/* 精选/展示图：与下方自动生成的动态流无关，自己手动挑选、可增删 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-neutral-500">精选展示图（最多 {MAX_SHOWCASE_IMAGES} 张，可左右滑动）</label>
                <span className="text-[10px] text-neutral-400">{editShowcase.length}/{MAX_SHOWCASE_IMAGES}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {editShowcase.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-200/70">
                    <img src={img} alt={`Showcase ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    <button
                      type="button"
                      onClick={() => removeShowcaseImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
                    >
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
                {editShowcase.length < MAX_SHOWCASE_IMAGES && (
                  <button
                    type="button"
                    onClick={() => showcaseInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl flex-shrink-0 bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                )}
              </div>
              <input ref={showcaseInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleShowcaseUpload} />
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
          /* ============ 展示模式：浅色液态玻璃 Hero 卡片（第①段：个人简介） ============ */
          <div className="bg-white/75 backdrop-blur-2xl border border-white/70 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-200/70">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-neutral-500 text-lg">
                    {(profile?.name || 'U')[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight leading-tight truncate">
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
            </div>

            {/* 个性签名：点击直接进入编辑模式 */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full text-left"
            >
              <p className="text-xs text-neutral-600 leading-relaxed font-serif italic hover:text-neutral-900 transition-colors">
                "{profile?.bio || '在日常的光影里，定格温存。'}"
              </p>
            </button>

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

        {/* 第②段：精选展示图，可左右滑动 + 箭头翻页，与下方真实动态流无关 */}
        {!isEditing && displayShowcase.length > 0 && (
          <div className="space-y-2">
            <div ref={showcaseCarouselRef} className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
              {displayShowcase.map((img, idx) => (
                <div
                  key={idx}
                  className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 snap-start bg-white/70 border border-white/60 shadow-sm"
                >
                  <img src={img} alt={`Showcase ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>

            {displayShowcase.length > 3 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => scrollShowcase(-1)}
                  className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center text-neutral-600 hover:text-neutral-900 active:scale-90 transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => scrollShowcase(1)}
                  className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center text-neutral-600 hover:text-neutral-900 active:scale-90 transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 第③段：动态展示，IG 风格 3 列正方形网格 */}
        {!isEditing && (
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold text-neutral-400 px-1 uppercase tracking-widest">动态</h4>
            {mySnapshots.length === 0 ? (
              <div className="text-center py-14 text-xs text-neutral-400 space-y-1">
                <p>在此世界线中还没有留下动态</p>
                <p className="text-[10px] opacity-70">点击发帖，留下你的第一抹光影</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-[3px] bg-white/40 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/50 shadow-sm p-[3px]">
                {mySnapshots.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenSnapshotDetail && onOpenSnapshotDetail(item)}
                    className="relative aspect-square overflow-hidden bg-white/60"
                  >
                    {item.mediaUrl ? (
                      <img src={item.mediaUrl} alt="Snapshot" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full p-2 flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100">
                        <span className="text-[8px] font-serif italic text-neutral-600 line-clamp-5 text-center leading-snug">
                          "{item.imagePrompt || item.content}"
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 最新回响引用卡 */}
        {!isEditing && latestEcho && (
          <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-4 flex items-start gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
              {latestEcho.senderAvatar ? (
                <img src={latestEcho.senderAvatar} alt={latestEcho.senderName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
      </div>
    </div>
  );
};

export default UserProfileSheet;