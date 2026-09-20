// src/apps/hub/hubHeaderLayouts/GothicGrungeLayout.jsx
//
// 主页头部区域的「暗色海报风」版式：
// - 顶部海报海报/大标 + 浮动凹槽徽标工具栏 + 音频进度条 + 3联相册 + 圆环标记 + 底部双按钮
// - 遵循中性极简玻璃风与 GlassCard 规范，图片保持自然原色（无黑白滤镜），去除了冗余装饰性文字印章。
// - 强调色限定在主按钮上。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Edit2,
  Check,
  AlertCircle,
  Search,
  Play,
  SkipBack,
  SkipForward,
  Plus,
  Trash2,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';

const PROFILE_ID = 'main';
const GALLERY_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'User Name',
  handle: '@username',
  bio: 'We are all in the gutter, but some of us are looking at the stars.',
  location: 'Earth',
  joined: '2026',
  avatar: '',
  banner: '',
  tagline: 'vozteur on ig',
  bigStatement: 'ABOUT;',
  followLabel: 'Editar perfil',
  messageLabel: 'Compartilhar',
  progressPercent: 55,
  activityItems: [
    { id: 'hl-1', name: '#001 μn', avatar: '' },
    { id: 'hl-2', name: '96. † Z/', avatar: '' },
    { id: 'hl-3', name: ') [...]', avatar: '' },
    { id: 'hl-4', name: 'R - 👁 7', avatar: '' },
    { id: 'hl-5', name: '† CVK', avatar: '' },
  ],
  socialLinks: [],
};

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Gallery',
  caption: '',
  photos: [
    { id: 'p1', url: '', label: '01' },
    { id: 'p2', url: '', label: '02' },
    { id: 'p3', url: '', label: '03' },
  ],
};

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 图片读取通用 Promise 辅助函数
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

export const GothicGrungeLayout = ({ delay = 100 }) => {
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
              activityItems: Array.isArray(savedProfile.activityItems)
                ? savedProfile.activityItems
                : DEFAULT_PROFILE.activityItems,
            });
          }

          if (savedGallery) {
            const loadedPhotos = Array.isArray(savedGallery.photos)
              ? savedGallery.photos
              : [];
            // 保持三联画卡片结构
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
        console.error('Failed to load layout data:', error);
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
      // Handled in readImageFile
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
      // Handled in readImageFile
    } finally {
      e.target.value = '';
    }
  };

  const handlePhotoUpload = async (e, photoId) => {
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
      // Handled in readImageFile
    } finally {
      e.target.value = '';
    }
  };

  const handleHighlightUpload = async (e, itemId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readImageFile(file, { onWarning: setStorageWarning });
      const nextItems = profile.activityItems.map((item) =>
        item.id === itemId ? { ...item, avatar: base64 } : item
      );
      const nextProfile = { ...profile, activityItems: nextItems };
      setProfile(nextProfile);
      await saveProfile(nextProfile);
    } catch {
      // Handled in readImageFile
    } finally {
      e.target.value = '';
    }
  };

  const updateHighlightName = (itemId, newName) => {
    setProfile((prev) => ({
      ...prev,
      activityItems: prev.activityItems.map((item) =>
        item.id === itemId ? { ...item, name: newName } : item
      ),
    }));
  };

  const addHighlightItem = () => {
    setProfile((prev) => ({
      ...prev,
      activityItems: [
        ...prev.activityItems,
        {
          id: createLocalId(),
          name: `#${prev.activityItems.length + 1}`,
          avatar: '',
        },
      ],
    }));
  };

  const removeHighlightItem = (itemId) => {
    setProfile((prev) => ({
      ...prev,
      activityItems: prev.activityItems.filter((item) => item.id !== itemId),
    }));
  };

  if (isLoading) {
    return (
      <GlassCard delay={delay} className="relative overflow-hidden p-6">
        <div className="h-96 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
      </GlassCard>
    );
  }

  const primaryPhotos = gallery.photos.slice(0, 3);

  return (
    <GlassCard delay={delay} className="relative overflow-hidden p-0">
      {/* 编辑 / 保存 悬浮切换按钮 */}
      <button
        type="button"
        onClick={() => void handleEditingToggle()}
        className="absolute right-4 top-4 z-30 rounded-full bg-black/30 p-2 text-white backdrop-blur-md transition-all hover:bg-black/50 active:scale-95"
        title={isEditing ? '保存版式' : '编辑版式'}
        aria-label={isEditing ? '保存版式' : '编辑版式'}
      >
        {isEditing ? (
          <Check className="h-4 w-4" />
        ) : (
          <Edit2 className="h-4 w-4" />
        )}
      </button>

      {/* 存储错误提示 */}
      {storageWarning && (
        <div className="m-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* 顶部海报区（自然原色，无滤镜） */}
      <div className="relative flex h-56 w-full flex-col items-center justify-center overflow-hidden rounded-b-[2rem] bg-black/5 dark:bg-white/5">
        {profile.banner ? (
          <img
            src={profile.banner}
            alt="Header banner"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" />
        )}

        {/* 保证文字可读性的柔和中性半透遮罩 */}
        <div className="pointer-events-none absolute inset-0 bg-black/25 dark:bg-black/40" />

        {/* 顶部小角标 */}
        <div className="absolute left-4 top-4 z-10">
          {isEditing ? (
            <input
              type="text"
              value={profile.location || ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, location: e.target.value }))
              }
              placeholder="位置"
              className="rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[10px] tracking-wide text-white backdrop-blur-md outline-none"
            />
          ) : (
            <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] tracking-wider text-white backdrop-blur-md">
              {profile.location || 'location'}
            </span>
          )}
        </div>

        <div className="absolute right-14 top-4 z-10">
          {isEditing ? (
            <input
              type="text"
              value={profile.joined || ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, joined: e.target.value }))
              }
              placeholder="标记/年份"
              className="rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[10px] tracking-wide text-white backdrop-blur-md outline-none"
            />
          ) : (
            <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] tracking-wider text-white backdrop-blur-md">
              {profile.joined || 'feed'}
            </span>
          )}
        </div>

        {/* Banner 更换按钮 */}
        {isEditing && (
          <label className="absolute bottom-4 right-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-md hover:bg-black/80">
            <Camera className="h-3.5 w-3.5" />
            <span>更换海报</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
            />
          </label>
        )}

        {/* 中心标题文字排版（去除粗白线条） */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-8 text-[11px] font-bold tracking-[0.25em] text-white/90 drop-shadow">
            <span>KNOW</span>
            <span>ME</span>
          </div>

          {isEditing ? (
            <input
              type="text"
              value={profile.bigStatement || ''}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  bigStatement: e.target.value,
                }))
              }
              placeholder="ABOUT;"
              className="mt-1 bg-transparent text-center text-4xl font-extrabold uppercase tracking-widest text-white drop-shadow-md outline-none sm:text-5xl"
            />
          ) : (
            <h1 className="mt-1 text-4xl font-black uppercase tracking-widest text-white drop-shadow-lg sm:text-5xl">
              {profile.bigStatement || 'ABOUT;'}
            </h1>
          )}
        </div>
      </div>

      {/* 凹槽浮动工具栏 */}
      <div className="relative z-20 -mt-6 flex items-center justify-between px-4">
        {/* 搜索胶囊 / Handle */}
        <div className="flex max-w-[42%] items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/80">
          {isEditing ? (
            <input
              type="text"
              value={profile.handle || ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, handle: e.target.value }))
              }
              placeholder="@handle"
              className="w-full bg-transparent text-[11px] text-neutral-800 outline-none dark:text-neutral-200"
            />
          ) : (
            <span className="truncate text-[11px] text-neutral-800 dark:text-neutral-200">
              {profile.handle || 'vozteur on ig'}
            </span>
          )}
          <Search className="h-3 w-3 flex-shrink-0 text-neutral-400" />
        </div>

        {/* 中心头像徽章（自然原色） */}
        <div className="relative -mt-2">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white/80 bg-neutral-100 p-0.5 shadow-md dark:border-neutral-700 dark:bg-neutral-800">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-black/5 text-neutral-400 dark:bg-white/5 dark:text-neutral-500">
                <ImageIcon className="h-5 w-5" />
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
        </div>

        {/* 右侧进度条 */}
        <div className="flex h-6 w-20 overflow-hidden rounded-full border border-black/10 bg-black/5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div
            className="h-full bg-black/10 dark:bg-white/10"
            style={{ width: `${100 - (profile.progressPercent ?? 55)}%` }}
          />
          <div
            className="h-full bg-neutral-700 dark:bg-neutral-300"
            style={{ width: `${profile.progressPercent ?? 55}%` }}
          />
        </div>
      </div>

      {/* 音乐播放条 */}
      <div className="mx-4 mt-4 flex items-center gap-2.5 border-b border-black/5 py-2.5 text-[10px] text-neutral-500 dark:border-white/5 dark:text-neutral-400">
        <SkipBack className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100" />
        <Play className="h-3 w-3 cursor-pointer fill-current opacity-70 hover:opacity-100" />
        <SkipForward className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100" />
        <span className="font-mono text-[9px]">0:19</span>
        <div className="relative h-1 flex-1 rounded-full bg-black/10 dark:bg-white/10">
          <div className="relative h-full w-[48%] rounded-full bg-neutral-700 dark:bg-neutral-300">
            <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-neutral-700 dark:bg-neutral-300" />
          </div>
        </div>
        <span className="font-mono text-[9px]">-0:19</span>
      </div>

      {/* 简介展示与编辑 */}
      <div className="px-5 pt-3">
        {isEditing ? (
          <textarea
            rows={2}
            value={profile.bio || ''}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, bio: e.target.value }))
            }
            placeholder="填写简介..."
            className="w-full resize-none rounded-xl border border-black/10 bg-black/5 p-2 text-xs text-neutral-800 outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
          />
        ) : (
          profile.bio && (
            <p className="text-center text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              {profile.bio}
            </p>
          )
        )}
      </div>

      {/* 三联画相册（已去除 HOBBIES 贴字与黑白滤镜） */}
      <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-2 px-4 pt-3">
        {primaryPhotos.map((photo, index) => (
          <div
            key={photo.id || index}
            className="relative h-32 overflow-hidden rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt={photo.label || `Gallery photo ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-400 dark:text-neutral-600">
                <ImageIcon className="h-6 w-6 opacity-40" />
              </div>
            )}

            {/* 编辑覆层 */}
            {isEditing && (
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-white backdrop-blur-[1px]">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handlePhotoUpload(e, photo.id)}
                />
              </label>
            )}
          </div>
        ))}
      </div>

      {/* 故事徽章圆环（自然原色） */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto px-4 pb-2 pt-4 scrollbar-none">
        {profile.activityItems.map((item) => (
          <div
            key={item.id}
            className="flex flex-shrink-0 flex-col items-center gap-1.5"
          >
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-black/5 p-0.5 shadow-sm dark:border-white/10 dark:bg-white/5">
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-black/10 dark:bg-white/10" />
              )}

              {isEditing && (
                <>
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-white">
                    <Camera className="h-3 w-3" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleHighlightUpload(e, item.id)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeHighlightItem(item.id)}
                    className="absolute -right-1 -top-1 rounded-full bg-rose-500 p-0.5 text-white"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </>
              )}
            </div>

            {isEditing ? (
              <input
                type="text"
                value={item.name || ''}
                onChange={(e) => updateHighlightName(item.id, e.target.value)}
                className="w-12 bg-transparent text-center text-[9px] text-neutral-500 outline-none dark:text-neutral-400"
              />
            ) : (
              <span className="max-w-[50px] truncate text-[9px] font-medium text-neutral-500 dark:text-neutral-400">
                {item.name}
              </span>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            type="button"
            onClick={addHighlightItem}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-black/20 text-neutral-400 hover:border-black/40 hover:text-neutral-600 dark:border-white/20 dark:hover:border-white/40 dark:hover:text-neutral-200"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 底部双按钮操作区 */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-5 pt-2">
        {/* 唯一强调色主按钮 */}
        {isEditing ? (
          <input
            type="text"
            value={profile.followLabel || ''}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, followLabel: e.target.value }))
            }
            className="rounded-full py-2 text-center text-xs font-semibold shadow-sm outline-none"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          />
        ) : (
          <button
            type="button"
            className="rounded-full py-2 text-center text-xs font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            {profile.followLabel || 'Editar perfil'}
          </button>
        )}

        {/* 辅助中性风按钮 */}
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
            className="rounded-full border border-black/10 bg-black/5 py-2 text-center text-xs font-medium text-neutral-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
          />
        ) : (
          <button
            type="button"
            className="rounded-full border border-black/10 bg-black/5 py-2 text-center text-xs font-medium text-neutral-700 transition-colors hover:bg-black/10 active:scale-[0.98] dark:border-white/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
          >
            {profile.messageLabel || 'Compartilhar'}
          </button>
        )}
      </div>
    </GlassCard>
  );
};

export default GothicGrungeLayout;
