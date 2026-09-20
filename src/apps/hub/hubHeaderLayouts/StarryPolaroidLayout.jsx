// src/apps/hub/hubHeaderLayouts/StarryPolaroidLayout.jsx
//
// 主页头部区域的「双栏星空拍立得风」版式：
// - 左栏：头像 + 导航项 + 搜索胶囊 + 功能图标 + 胶囊三联相册 + 简介
// - 右栏：极简拍立得大相框（Banner/大片） + 线性互动栏 + Caption
// - 遵循中性极简玻璃风与 GlassCard 规范，强调色限定在主按钮上。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Edit2,
  Check,
  AlertCircle,
  Search,
  Users,
  Compass,
  Music,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';

const PROFILE_ID = 'main';
const GALLERY_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'User Name',
  handle: '@woonie_',
  bio: "So, why can't you see? You belong with me...",
  location: 'Earth',
  joined: '2026',
  avatar: '',
  banner: '',
  tagline: "I'm feeling lucky today...",
  followLabel: 'edit profile',
  messageLabel: 'share profile',
  extraNote: 'settings',
  socialLinks: [],
};

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Polaroid Moment',
  caption:
    'El fondo de esto es neutro y elegante. Puede cubrirlo y usar este espacio para agregar una caption a su post.',
  photos: [
    { id: 'p1', url: '', label: 'capsule-1' },
    { id: 'p2', url: '', label: 'capsule-2' },
    { id: 'p3', url: '', label: 'capsule-3' },
  ],
};

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 图片上传辅助函数
const readImageFile = (file, { onWarning } = {}) =>
  new Promise((resolve, reject) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (onWarning) onWarning('请选择图片文件。');
      reject(new Error('INVALID_TYPE'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      if (onWarning) {
        onWarning(
          '图片超过 2MB，仍会尝试保存，但建议使用较小图片以避免存储空间不足。'
        );
      }
    } else if (onWarning) {
      onWarning('');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        if (onWarning) onWarning('图片读取失败，请重新选择。');
        reject(new Error('READ_FAILED'));
      }
    };
    reader.onerror = () => {
      if (onWarning) onWarning('图片读取失败，请重新选择。');
      reject(new Error('READ_ERROR'));
    };
    reader.readAsDataURL(file);
  });

export const StarryPolaroidLayout = ({ delay = 100 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [gallery, setGallery] = useState(DEFAULT_GALLERY);
  const [storageWarning, setStorageWarning] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      try {
        const [savedProfile, savedGallery] = await Promise.all([
          db.profile.get(PROFILE_ID),
          db.pinnedGallery.get(GALLERY_ID),
        ]);

        if (isMounted) {
          if (savedProfile) {
            setProfile({
              ...DEFAULT_PROFILE,
              ...savedProfile,
              id: PROFILE_ID,
            });
          }

          if (savedGallery) {
            const loadedPhotos = Array.isArray(savedGallery.photos)
              ? savedGallery.photos
              : [];
            const paddedPhotos = [...loadedPhotos];
            while (paddedPhotos.length < 3) {
              paddedPhotos.push({
                id: createLocalId(),
                url: '',
                label: `0${paddedPhotos.length + 1}`,
              });
            }
            setGallery({
              ...DEFAULT_GALLERY,
              ...savedGallery,
              id: GALLERY_ID,
              photos: paddedPhotos,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load starry polaroid layout data:', error);
        if (isMounted) {
          setStorageWarning('资料读取失败，请稍后重试。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAll();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveProfile = async (nextProfile = profile) => {
    try {
      await db.profile.put({
        ...DEFAULT_PROFILE,
        ...nextProfile,
        id: PROFILE_ID,
      });
      setStorageWarning('');
    } catch (error) {
      console.error('Failed to save profile:', error);
      setStorageWarning('资料保存失败，可能是图片过大或浏览器存储空间不足。');
    }
  };

  const saveGallery = async (nextGallery = gallery) => {
    try {
      await db.pinnedGallery.put({
        ...DEFAULT_GALLERY,
        ...nextGallery,
        id: GALLERY_ID,
      });
      setStorageWarning('');
    } catch (error) {
      console.error('Failed to save gallery:', error);
      setStorageWarning('图片保存失败，可能是图片过大或浏览器存储空间不足。');
    }
  };

  const handleEditingToggle = async () => {
    if (isEditing) {
      await Promise.all([saveProfile(profile), saveGallery(gallery)]);
    }
    setIsEditing((prev) => !prev);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readImageFile(file, { onWarning: setStorageWarning });
      const nextProfile = { ...profile, avatar: base64 };
      setProfile(nextProfile);
      await saveProfile(nextProfile);
    } catch {
      // handled
    } finally {
      e.target.value = '';
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readImageFile(file, { onWarning: setStorageWarning });
      const nextProfile = { ...profile, banner: base64 };
      setProfile(nextProfile);
      await saveProfile(nextProfile);
    } catch {
      // handled
    } finally {
      e.target.value = '';
    }
  };

  const handleCapsulePhotoUpload = async (e, photoId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readImageFile(file, { onWarning: setStorageWarning });
      const nextPhotos = gallery.photos.map((p) =>
        p.id === photoId ? { ...p, url: base64 } : p
      );
      const nextGallery = { ...gallery, photos: nextPhotos };
      setGallery(nextGallery);
      await saveGallery(nextGallery);
    } catch {
      // handled
    } finally {
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <GlassCard delay={delay} className="relative overflow-hidden p-6">
        <div className="h-96 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
      </GlassCard>
    );
  }

  const capsulePhotos = gallery.photos.slice(0, 3);
  const polaroidPhoto = profile.banner || capsulePhotos[0]?.url || '';

  return (
    <GlassCard delay={delay} className="relative overflow-hidden p-4 sm:p-6">
      {/* 模式切换按钮 */}
      <button
        type="button"
        onClick={() => void handleEditingToggle()}
        className="absolute right-4 top-4 z-30 rounded-full bg-black/5 p-2 text-neutral-600 backdrop-blur-md transition-all hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20"
        title={isEditing ? '保存版式' : '编辑版式'}
        aria-label={isEditing ? '保存版式' : '编辑版式'}
      >
        {isEditing ? (
          <Check className="h-4 w-4" />
        ) : (
          <Edit2 className="h-4 w-4" />
        )}
      </button>

      {/* 存储空间警告栏 */}
      {storageWarning && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* 主栅格：左控制栏 + 右侧拍立得卡 */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* ================= 左侧控制列 ================= */}
        <div className="flex flex-col gap-4">
          {/* 头像 + 导航链接 + 搜索胶囊 */}
          <div className="flex items-center gap-4">
            {/* 圆形头像 */}
            <div className="relative h-20 w-20 flex-shrink-0">
              <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-black/10 bg-black/5 shadow-sm dark:border-white/20 dark:bg-white/5">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="h-full w-full object-cover grayscale"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    <ImageIcon className="h-6 w-6 opacity-40" />
                  </div>
                )}
                {isEditing && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-white backdrop-blur-[1px]">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </label>
                )}
              </div>
              <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-black/70 text-xs font-bold text-white shadow dark:border-neutral-900 dark:bg-white/80 dark:text-black">
                +
              </div>
            </div>

            {/* 导航与搜索框 */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-3 text-[11px] font-bold tracking-wider text-neutral-600 dark:text-neutral-300">
                <span className="cursor-pointer hover:opacity-80">HOME</span>
                <span className="cursor-pointer hover:opacity-80">PROFILE</span>
                <span className="cursor-pointer hover:opacity-80">POSTS</span>
                <span className="cursor-pointer hover:opacity-80">SAVED</span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1.5 shadow-inner dark:border-white/10 dark:bg-white/5">
                <Search className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.tagline || ''}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        tagline: e.target.value,
                      }))
                    }
                    placeholder="输入搜索标语..."
                    className="w-full bg-transparent text-xs text-neutral-700 outline-none dark:text-neutral-300"
                  />
                ) : (
                  <span className="truncate text-xs text-neutral-600 dark:text-neutral-300">
                    {profile.tagline || "I'm feeling lucky today..."}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 次级图标入口行 */}
          <div className="flex items-center gap-6 pl-1 pt-1">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/5 text-neutral-600 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20">
                <Users className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] text-neutral-500">people</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/5 text-neutral-600 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20">
                <Compass className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] text-neutral-500">escape</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/5 text-neutral-600 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20">
                <Music className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] text-neutral-500">music</span>
            </div>
          </div>

          {/* 胶囊操作按钮行 */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* 主操作（唯一高亮色） */}
            {isEditing ? (
              <input
                type="text"
                value={profile.followLabel || ''}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    followLabel: e.target.value,
                  }))
                }
                className="rounded-full py-1.5 text-center text-[11px] font-semibold shadow-sm outline-none"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                }}
              />
            ) : (
              <button
                type="button"
                className="rounded-full py-1.5 text-center text-[11px] font-semibold shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                }}
              >
                {profile.followLabel || 'edit profile'}
              </button>
            )}

            {/* 辅助操作 1 */}
            {isEditing ? (
              <input
                type="text"
                value={profile.messageLabel || ''}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    messageLabel: e.target.value,
                  }))
                }
                className="rounded-full border border-black/10 bg-black/5 py-1.5 text-center text-[11px] font-medium text-neutral-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
              />
            ) : (
              <button
                type="button"
                className="rounded-full border border-black/10 bg-black/5 py-1.5 text-center text-[11px] font-medium text-neutral-700 transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
              >
                {profile.messageLabel || 'share profile'}
              </button>
            )}

            {/* 辅助操作 2 */}
            {isEditing ? (
              <input
                type="text"
                value={profile.extraNote || ''}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    extraNote: e.target.value,
                  }))
                }
                className="rounded-full border border-black/10 bg-black/5 py-1.5 text-center text-[11px] font-medium text-neutral-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
              />
            ) : (
              <button
                type="button"
                className="rounded-full border border-black/10 bg-black/5 py-1.5 text-center text-[11px] font-medium text-neutral-700 transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
              >
                {profile.extraNote || 'settings'}
              </button>
            )}
          </div>

          {/* 签名 Quote 引用句 */}
          <div className="pt-1">
            {isEditing ? (
              <textarea
                rows={2}
                value={profile.bio || ''}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="签名引用语..."
                className="w-full resize-none rounded-xl border border-black/10 bg-black/5 p-2 text-xs italic text-neutral-700 outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
              />
            ) : (
              <p className="text-xs italic text-neutral-600 dark:text-neutral-400">
                {profile.bio || "So, why can't you see? You belong with me..."}
              </p>
            )}
          </div>

          {/* 三联竖胶囊照片卡片 */}
          <div className="flex flex-col items-center rounded-3xl border border-black/10 bg-black/5 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex w-full items-center justify-between gap-2">
              <ChevronLeft className="h-4 w-4 cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" />
              <div className="flex flex-1 justify-center gap-2.5">
                {capsulePhotos.map((photo, index) => (
                  <div
                    key={photo.id || index}
                    className="relative h-36 w-16 overflow-hidden rounded-[24px] border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10 sm:h-40 sm:w-20"
                  >
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={`capsule-${index}`}
                        className="h-full w-full object-cover grayscale contrast-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-neutral-400">
                        <ImageIcon className="h-5 w-5 opacity-40" />
                      </div>
                    )}
                    {isEditing && (
                      <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-white backdrop-blur-[1px]">
                        <Camera className="h-3.5 w-3.5" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            void handleCapsulePhotoUpload(e, photo.id)
                          }
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <ChevronRight className="h-4 w-4 cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" />
            </div>

            {/* 胶囊底部小三点 */}
            <div className="mt-3 rounded-full border border-black/10 bg-black/10 px-3 py-0.5 text-[9px] font-bold tracking-widest text-neutral-600 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300">
              •••
            </div>
          </div>
        </div>

        {/* ================= 右侧拍立得相框 ================= */}
        <div className="relative">
          <div className="relative flex flex-col rounded-3xl border border-black/10 bg-black/5 p-4 shadow-md dark:border-white/10 dark:bg-white/5 sm:p-5">
            {/* 拍立得照片主框 */}
            <div className="relative aspect-[1/1.05] w-full overflow-hidden rounded-2xl border border-black/10 bg-neutral-900 shadow-inner dark:border-white/10">
              {polaroidPhoto ? (
                <img
                  src={polaroidPhoto}
                  alt="Polaroid Main"
                  className="h-full w-full object-cover grayscale contrast-115"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-500">
                  <ImageIcon className="h-10 w-10 opacity-30" />
                </div>
              )}

              {/* 编辑态主海报上传 */}
              {isEditing && (
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-white backdrop-blur-[1px]">
                  <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white">
                    <Camera className="h-4 w-4" />
                    <span>更换相框大图</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerUpload}
                  />
                </label>
              )}
            </div>

            {/* 互动图标栏 */}
            <div className="flex items-center justify-between pb-1 pt-3 text-neutral-600 dark:text-neutral-300">
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 cursor-pointer hover:scale-110 active:scale-95" />
                <MessageCircle className="h-4 w-4 cursor-pointer hover:scale-110 active:scale-95" />
                <Send className="h-4 w-4 cursor-pointer hover:scale-110 active:scale-95" />
              </div>
              <Bookmark className="h-4 w-4 cursor-pointer hover:scale-110 active:scale-95" />
            </div>

            {/* 账号名称 */}
            <div className="pt-1">
              {isEditing ? (
                <input
                  type="text"
                  value={profile.handle || ''}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      handle: e.target.value,
                    }))
                  }
                  placeholder="@handle"
                  className="rounded border border-black/10 bg-black/5 px-1.5 py-0.5 text-xs font-bold text-neutral-800 outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
                />
              ) : (
                <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  {profile.handle || '@woonie_'}
                </div>
              )}
            </div>

            {/* 描述正文 Caption */}
            <div className="pt-1">
              {isEditing ? (
                <textarea
                  rows={2}
                  value={gallery.caption || ''}
                  onChange={(e) =>
                    setGallery((prev) => ({
                      ...prev,
                      caption: e.target.value,
                    }))
                  }
                  placeholder="添加说明文字..."
                  className="w-full resize-none rounded-xl border border-black/10 bg-black/5 p-2 text-[11px] leading-relaxed text-neutral-600 outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-400"
                />
              ) : (
                <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {gallery.caption ||
                    'El fondo de esto es neutro y elegante. Puede usar este espacio para agregar una caption a su post.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default StarryPolaroidLayout;
