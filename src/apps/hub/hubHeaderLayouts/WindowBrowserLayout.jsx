// src/apps/hub/hubHeaderLayouts/WindowBrowserLayout.jsx
//
// 主页头部区域的「窗口卡片风」版式：复古浏览器/桌面窗口壳的结构感，
// 但颜色描边全部换成跟其它版式一致的中性玻璃语言，不用参考图里的
// 蓝白像素配色。
//
// 结构：地址栏装饰条 -> banner -> 头像/名字 -> 编号导航列表 + 说明
// 面板 -> 主图与图注 -> 大字宣言横幅 + 关注/私信按钮。
//
// 数据来源：
// - name / handle / bio / avatar / banner / tagline / followLabel /
//   messageLabel / socialLinks 复用 db.profile 里已有的字段。
// - bigStatement 是这个版式新增的可选字段（大字宣言横幅的文案），
//   加在 db.profile 对象上，其它版式会直接忽略。
// - 主图复用 db.pinnedGallery.photos 的第一张，photo.label 当图注
//   （跟社群卡片风版式的 label 字段是同一个）。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';

const PROFILE_ID = 'main';
const GALLERY_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'User Name',
  handle: '@username',
  bio: '写点简介，会显示在右边的说明面板里。',
  location: 'City, Earth',
  joined: 'Aug 2026',
  avatar: '',
  banner: '',
  tagline: '',
  followLabel: 'Follow me!',
  messageLabel: 'Message me!',
  extraNote: '',
  socialLinks: [],
  bigStatement: 'THANK YOU FOR BEING HERE',
};

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Pinned Moment',
  caption: '',
  photos: [{ id: 1, url: '', label: '' }],
};

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const readImageFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('NOT_IMAGE'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({
          dataUrl: reader.result,
          oversized: file.size > 2 * 1024 * 1024,
        });
      } else {
        reject(new Error('READ_FAILED'));
      }
    };

    reader.onerror = () => reject(new Error('READ_FAILED'));

    reader.readAsDataURL(file);
  });

export const WindowBrowserLayout = ({ delay = 100 }) => {
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
              socialLinks: Array.isArray(savedProfile.socialLinks)
                ? savedProfile.socialLinks
                : DEFAULT_PROFILE.socialLinks,
            });
          }

          if (savedGallery) {
            setGallery({
              ...DEFAULT_GALLERY,
              ...savedGallery,
              id: GALLERY_ID,
              photos: Array.isArray(savedGallery.photos) && savedGallery.photos.length
                ? savedGallery.photos
                : DEFAULT_GALLERY.photos,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load window browser layout data:', error);

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
      setStorageWarning('资料保存失败，可能是图片文件过大或浏览器存储空间不足。');
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
      console.error('Failed to save pinned gallery:', error);
      setStorageWarning('图片保存失败，可能是图片文件过大或浏览器存储空间不足。');
    }
  };

  const applyUpload = (file, onSuccess) => {
    readImageFile(file)
      .then(({ dataUrl, oversized }) => {
        setStorageWarning(
          oversized
            ? '图片超过 2MB，仍会尝试保存，但建议使用较小的图片以避免 IndexedDB 存储空间不足。'
            : ''
        );
        onSuccess(dataUrl);
      })
      .catch((error) => {
        setStorageWarning(
          error.message === 'NOT_IMAGE'
            ? '请选择图片文件。'
            : '图片读取失败，请重新选择。'
        );
      });
  };

  const handleBannerUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    applyUpload(file, (dataUrl) => {
      const nextProfile = { ...profile, banner: dataUrl };
      setProfile(nextProfile);
      void saveProfile(nextProfile);
    });

    event.target.value = '';
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    applyUpload(file, (dataUrl) => {
      const nextProfile = { ...profile, avatar: dataUrl };
      setProfile(nextProfile);
      void saveProfile(nextProfile);
    });

    event.target.value = '';
  };

  const mainPhoto = gallery.photos[0] || { id: 'main', url: '', label: '' };

  const handleMainPhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    applyUpload(file, (dataUrl) => {
      const nextGallery = {
        ...gallery,
        photos: gallery.photos.length
          ? gallery.photos.map((photo, index) =>
              index === 0 ? { ...photo, url: dataUrl } : photo
            )
          : [{ id: createLocalId(), url: dataUrl, label: '' }],
      };

      setGallery(nextGallery);
      void saveGallery(nextGallery);
    });

    event.target.value = '';
  };

  const updateMainPhotoLabel = (value) => {
    const nextGallery = {
      ...gallery,
      photos: gallery.photos.length
        ? gallery.photos.map((photo, index) =>
            index === 0 ? { ...photo, label: value } : photo
          )
        : [{ id: createLocalId(), url: '', label: value }],
    };

    setGallery(nextGallery);
  };

  const addSocialLink = () => {
    setProfile((prev) => ({
      ...prev,
      socialLinks: [
        ...prev.socialLinks,
        { id: createLocalId(), label: '', url: '' },
      ],
    }));
  };

  const updateSocialLink = (id, field, value) => {
    setProfile((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      ),
    }));
  };

  const removeSocialLink = (id) => {
    setProfile((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((link) => link.id !== id),
    }));
  };

  const handleEditingToggle = async () => {
    if (isEditing) {
      await saveProfile(profile);
      await saveGallery(gallery);
    }

    setIsEditing((value) => !value);
  };

  if (isLoading) {
    return (
      <GlassCard delay={delay} className="relative overflow-hidden">
        <div className="h-64 animate-pulse rounded-[1.5rem] bg-black/5 dark:bg-white/5" />
      </GlassCard>
    );
  }

  const visibleSocialLinks = isEditing
    ? profile.socialLinks
    : profile.socialLinks.filter((link) => link.label.trim());

  return (
    <GlassCard delay={delay} className="relative space-y-3">
      {/* 编辑 / 保存 */}
      <button
        type="button"
        onClick={() => void handleEditingToggle()}
        className="absolute right-5 top-5 z-10 rounded-full bg-black/5 p-1.5 opacity-30 transition-opacity hover:opacity-100 focus:opacity-100 active:scale-95 dark:bg-white/10"
        title={isEditing ? '保存主页' : '编辑主页'}
        aria-label={isEditing ? '保存主页' : '编辑主页'}
      >
        {isEditing ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Edit2 className="h-3.5 w-3.5" />
        )}
      </button>

      {storageWarning && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* 地址栏装饰条 */}
      <div className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/25" />
          <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/25" />
          <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/25" />
        </span>
        <span className="truncate font-mono text-[10px] opacity-50">
          https://www.{(profile.handle || '@username').replace('@', '')}.com
        </span>
      </div>

      {/* Banner */}
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/5 dark:bg-white/5">
        {profile.banner ? (
          <img
            src={profile.banner}
            alt="Banner"
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <Camera className="h-6 w-6 opacity-30" />
        )}

        {isEditing && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center gap-1 bg-black/30 text-xs font-medium text-white opacity-90 backdrop-blur-sm">
            <Camera className="h-4 w-4" />
            <span>Upload Banner</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
            />
          </label>
        )}
      </div>

      {/* 头像 + 名字 */}
      <div className="-mt-8 flex items-end gap-3 pl-1 pr-8">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-4 border-white/80 bg-black/10 shadow-md backdrop-blur-md dark:border-slate-800">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt="Avatar"
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Camera className="h-5 w-5 opacity-40" />
            </div>
          )}

          {isEditing && (
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white">
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

        <div className="min-w-0 flex-1 pb-1">
          {isEditing ? (
            <div className="space-y-1.5 text-xs">
              <input
                type="text"
                placeholder="Name"
                value={profile.name}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 font-bold outline-none dark:bg-white/10"
              />
              <input
                type="text"
                placeholder="@handle"
                value={profile.handle}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    handle: event.target.value,
                  }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 outline-none dark:bg-white/10"
              />
            </div>
          ) : (
            <>
              <h2 className="truncate text-lg font-bold tracking-tight">
                {profile.name}
              </h2>
              <p className="truncate text-xs font-medium opacity-50">
                {profile.handle}
              </p>
            </>
          )}
        </div>
      </div>

      {/* 编号导航列表 + 说明面板 */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2 space-y-1 rounded-xl bg-black/5 p-2.5 dark:bg-white/5">
          {visibleSocialLinks.map((link, index) => (
            <div key={link.id} className="flex items-center gap-1.5">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    placeholder="名称"
                    value={link.label}
                    onChange={(event) =>
                      updateSocialLink(link.id, 'label', event.target.value)
                    }
                    className="w-2/3 rounded-lg bg-black/5 px-1.5 py-1 text-[10px] outline-none dark:bg-white/10"
                  />
                  <input
                    type="text"
                    placeholder="链接"
                    value={link.url}
                    onChange={(event) =>
                      updateSocialLink(link.id, 'url', event.target.value)
                    }
                    className="flex-1 rounded-lg bg-black/5 px-1.5 py-1 text-[10px] outline-none dark:bg-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeSocialLink(link.id)}
                    className="shrink-0 text-rose-500 opacity-70 hover:opacity-100"
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              ) : (
                link.label.trim() && (
                  <>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                    {link.url ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[11px] opacity-70 hover:opacity-100"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="truncate text-[11px] opacity-70">
                        {link.label}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[9px] font-mono opacity-30">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </>
                )
              )}
            </div>
          ))}

          {isEditing && (
            <button
              type="button"
              onClick={addSocialLink}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-black/10 py-1 text-[10px] opacity-60 hover:opacity-100 dark:border-white/15"
            >
              <Plus className="h-3 w-3" />
              添加
            </button>
          )}
        </div>

        <div className="col-span-3 rounded-xl border border-black/10 p-2.5 text-[11px] leading-relaxed dark:border-white/15">
          {isEditing ? (
            <textarea
              value={profile.bio}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, bio: event.target.value }))
              }
              className="h-full min-h-[64px] w-full resize-none bg-transparent outline-none"
              placeholder="写点简介..."
            />
          ) : (
            <p className="opacity-70">{profile.bio}</p>
          )}
        </div>
      </div>

      {/* 主图 + 图注 */}
      <div className="group/item relative h-40 overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/5 dark:bg-white/5">
        {mainPhoto.url ? (
          <img
            src={mainPhoto.url}
            alt={mainPhoto.label || 'Pinned'}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-5 w-5 opacity-40" />
          </div>
        )}

        {isEditing && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 text-white opacity-0 transition-opacity group-hover/item:opacity-100">
            <Camera className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleMainPhotoUpload}
            />
          </label>
        )}

        {isEditing ? (
          <input
            type="text"
            value={mainPhoto.label || ''}
            onChange={(event) => updateMainPhotoLabel(event.target.value)}
            placeholder="touch for more"
            className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1.5 text-[11px] text-white outline-none placeholder:text-white/60"
          />
        ) : (
          <div className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1.5 text-center text-[11px] text-white">
            {mainPhoto.label || 'touch for more'}
          </div>
        )}
      </div>

      {/* 大字宣言横幅 */}
      <div className="space-y-2 rounded-[1.25rem] bg-black/5 p-4 text-center dark:bg-white/10">
        {isEditing ? (
          <input
            type="text"
            value={profile.bigStatement}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                bigStatement: event.target.value,
              }))
            }
            placeholder="THANK YOU FOR BEING HERE"
            className="w-full rounded-lg bg-black/5 px-2.5 py-2 text-center text-lg font-black uppercase tracking-tight outline-none dark:bg-white/10"
          />
        ) : (
          <p className="text-xl font-black uppercase leading-tight tracking-tight">
            {profile.bigStatement}
          </p>
        )}

        <div className="flex items-center justify-center gap-2 pt-1">
          {isEditing ? (
            <>
              <input
                type="text"
                value={profile.followLabel}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    followLabel: event.target.value,
                  }))
                }
                className="w-1/2 rounded-full bg-black/5 px-3 py-1.5 text-center text-xs font-semibold outline-none dark:bg-white/10"
              />
              <input
                type="text"
                value={profile.messageLabel}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    messageLabel: event.target.value,
                  }))
                }
                className="w-1/2 rounded-full bg-black/5 px-3 py-1.5 text-center text-xs font-semibold outline-none dark:bg-white/10"
              />
            </>
          ) : (
            <>
              <span
                className="rounded-full px-4 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                }}
              >
                {profile.followLabel || 'Follow me!'}
              </span>
              <span className="rounded-full bg-black/10 px-4 py-1.5 text-xs font-semibold dark:bg-white/15">
                {profile.messageLabel || 'Message me!'}
              </span>
            </>
          )}
        </div>
      </div>

      {isEditing && visibleSocialLinks.length === 0 && (
        <p className="text-center text-[10px] opacity-40">
          <ExternalLink className="mr-1 inline h-3 w-3" />
          编号列表复用的是社交链接数据，跟其它版式共用。
        </p>
      )}
    </GlassCard>
  );
};

export default WindowBrowserLayout;