// src/apps/hub/hubHeaderLayouts/IgBlogLayout.jsx
//
// 主页头部区域的「博客 / IG 风」版式：单张头像 + handle + 关注/私信按钮 +
// 一句简介 + 图片长条 + 社交链接胶囊 + 一句附加信息，全部合并成一张
// 连续的卡片（不像经典版那样分成资料卡+图片墙两张卡）。
//
// 数据来源：
// - name / handle / bio / avatar 复用 db.profile（跟经典版共用同一份）。
// - tagline / followLabel / messageLabel / extraNote / socialLinks 是这个
//   版式新增的可选字段，同样存在 db.profile 里（Dexie 对象存储，加新字段
//   不需要动 schema 版本号，经典版式会直接忽略这些用不到的字段）。
// - photos 复用 db.pinnedGallery.photos（跟经典版共用同一份），这里展示
//   成横向滚动的图片长条，而不是经典版的两列网格。
//
// 视觉上刻意去掉了参考图里的装饰性元素（手绘小花、爱心贴纸、拟物打字机
// 按键），颜色也全部走 --text-main / --accent-color 这类主题变量，跟
// GlassCard、设置齿轮按钮保持同一套"高级感"基调，而不是参考图里固定的
// 黑白配色，这样切换应用内的主题色时这个版式也能跟着变。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Link2,
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
  bio: 'We are all in the gutter, but some of us are looking at the stars.',
  location: 'City, Earth',
  joined: 'Aug 2026',
  avatar: '',
  banner: '',
  tagline: '',
  followLabel: 'Follow me!',
  messageLabel: 'Message me!',
  extraNote: '',
  socialLinks: [],
};

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Pinned Moment',
  caption: '',
  photos: [
    { id: 1, url: '' },
    { id: 2, url: '' },
    { id: 3, url: '' },
  ],
};

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const IgBlogLayout = ({ delay = 100 }) => {
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
              photos: Array.isArray(savedGallery.photos)
                ? savedGallery.photos
                : DEFAULT_GALLERY.photos,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load ig blog layout data:', error);

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

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStorageWarning('请选择图片文件。');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStorageWarning(
        '图片超过 2MB，仍会尝试保存，但建议使用较小的图片以避免 IndexedDB 存储空间不足。'
      );
    } else {
      setStorageWarning('');
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const imageData = reader.result;

      if (typeof imageData !== 'string') {
        setStorageWarning('图片读取失败，请重新选择。');
        return;
      }

      const nextProfile = { ...profile, avatar: imageData };
      setProfile(nextProfile);
      await saveProfile(nextProfile);
    };

    reader.onerror = () => {
      setStorageWarning('图片读取失败，请重新选择。');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const addPhoto = () => {
    const nextGallery = {
      ...gallery,
      photos: [...gallery.photos, { id: createLocalId(), url: '' }],
    };

    setGallery(nextGallery);
    void saveGallery(nextGallery);
  };

  const removePhoto = (id) => {
    const nextGallery = {
      ...gallery,
      photos: gallery.photos.filter((photo) => photo.id !== id),
    };

    setGallery(nextGallery);
    void saveGallery(nextGallery);
  };

  const handlePhotoUpload = (event, id) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStorageWarning('请选择图片文件。');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStorageWarning(
        '图片超过 2MB，仍会尝试保存，但建议使用较小的图片以避免 IndexedDB 存储空间不足。'
      );
    } else {
      setStorageWarning('');
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const imageData = reader.result;

      if (typeof imageData !== 'string') {
        setStorageWarning('图片读取失败，请重新选择。');
        return;
      }

      const nextGallery = {
        ...gallery,
        photos: gallery.photos.map((photo) =>
          photo.id === id ? { ...photo, url: imageData } : photo
        ),
      };

      setGallery(nextGallery);
      await saveGallery(nextGallery);
    };

    reader.onerror = () => {
      setStorageWarning('图片读取失败，请重新选择。');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
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
    <GlassCard delay={delay} className="relative space-y-4">
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

      {/* 头像 + handle + 标签 */}
      <div className="flex items-start gap-3 pr-8">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/5 dark:bg-white/5">
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

        <div className="min-w-0 flex-1 pt-1">
          {isEditing ? (
            <div className="space-y-1.5 text-xs">
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
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 font-bold outline-none dark:bg-white/10"
              />
              <input
                type="text"
                placeholder="Name Placeholder"
                value={profile.name}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 outline-none dark:bg-white/10"
              />
              <input
                type="text"
                placeholder="一句标签，例如 always cozy"
                value={profile.tagline}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    tagline: event.target.value,
                  }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 outline-none dark:bg-white/10"
              />
            </div>
          ) : (
            <>
              <h2 className="truncate text-lg font-bold tracking-tight">
                {profile.handle}
              </h2>
              <p className="mt-0.5 truncate text-xs font-medium opacity-50">
                {profile.name}
              </p>
              {profile.tagline && (
                <span className="mt-1.5 inline-block rounded-full bg-black/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70 dark:bg-white/10">
                  {profile.tagline}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 关注 / 私信按钮 */}
      <div className="flex items-center gap-2">
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
              placeholder="Follow me!"
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
              placeholder="Message me!"
              className="w-1/2 rounded-full bg-black/5 px-3 py-1.5 text-center text-xs font-semibold outline-none dark:bg-white/10"
            />
          </>
        ) : (
          <>
            <span
              className="flex-1 rounded-full py-1.5 text-center text-xs font-semibold"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
              }}
            >
              {profile.followLabel || 'Follow me!'}
            </span>
            <span className="flex-1 rounded-full bg-black/5 py-1.5 text-center text-xs font-semibold dark:bg-white/10">
              {profile.messageLabel || 'Message me!'}
            </span>
          </>
        )}
      </div>

      {/* 简介 */}
      {isEditing ? (
        <textarea
          placeholder="Write your bio..."
          value={profile.bio}
          onChange={(event) =>
            setProfile((prev) => ({ ...prev, bio: event.target.value }))
          }
          className="h-16 w-full resize-none rounded-lg bg-black/5 p-2.5 font-serif text-xs italic outline-none dark:bg-white/10"
        />
      ) : (
        profile.bio && (
          <p className="font-serif text-xs italic leading-relaxed opacity-85">
            "{profile.bio}"
          </p>
        )
      )}

      {/* 图片长条 */}
      <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {gallery.photos.map((photo) => (
          <div
            key={photo.id}
            className="group/item relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/5 dark:bg-white/5"
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt="Pinned"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-4 w-4 opacity-40" />
              </div>
            )}

            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40">
                <label className="cursor-pointer rounded-full bg-white/20 p-1.5 text-white">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handlePhotoUpload(event, photo.id)}
                  />
                </label>

                {gallery.photos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="rounded-full bg-rose-500/80 p-1.5 text-white"
                    title="删除图片"
                    aria-label="删除图片"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            type="button"
            onClick={addPhoto}
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-black/10 opacity-60 hover:opacity-100 dark:border-white/10"
            title="添加图片"
            aria-label="添加图片"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* 社交链接 + 附加信息 */}
      {isEditing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-50">
              <Link2 className="h-3 w-3" />
              Socials
            </span>
            <button
              type="button"
              onClick={addSocialLink}
              className="rounded-full bg-black/5 p-1 opacity-60 hover:opacity-100 dark:bg-white/10"
              title="添加链接"
              aria-label="添加链接"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {profile.socialLinks.map((link) => (
            <div key={link.id} className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="名称，例如 Instagram"
                value={link.label}
                onChange={(event) =>
                  updateSocialLink(link.id, 'label', event.target.value)
                }
                className="w-1/3 rounded-lg bg-black/5 px-2 py-1.5 text-[11px] outline-none dark:bg-white/10"
              />
              <input
                type="text"
                placeholder="链接（可留空）"
                value={link.url}
                onChange={(event) =>
                  updateSocialLink(link.id, 'url', event.target.value)
                }
                className="flex-1 rounded-lg bg-black/5 px-2 py-1.5 text-[11px] outline-none dark:bg-white/10"
              />
              <button
                type="button"
                onClick={() => removeSocialLink(link.id)}
                className="rounded-full bg-black/5 p-1.5 text-rose-500 opacity-70 hover:opacity-100 dark:bg-white/10"
                title="删除"
                aria-label="删除链接"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <textarea
            placeholder="补充一句话（例如纪念日、口头禅）"
            value={profile.extraNote}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                extraNote: event.target.value,
              }))
            }
            className="h-12 w-full resize-none rounded-lg bg-black/5 p-2 text-[11px] outline-none dark:bg-white/10"
          />
        </div>
      ) : (
        (visibleSocialLinks.length > 0 || profile.extraNote) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-3 dark:border-white/10">
            {visibleSocialLinks.map((link) =>
              link.url ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-medium opacity-70 transition-opacity hover:opacity-100 dark:bg-white/10"
                >
                  {link.label}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <span
                  key={link.id}
                  className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-medium opacity-70 dark:bg-white/10"
                >
                  {link.label}
                </span>
              )
            )}

            {profile.extraNote && (
              <span className="ml-auto text-[10px] italic opacity-50">
                {profile.extraNote}
              </span>
            )}
          </div>
        )
      )}
    </GlassCard>
  );
};

export default IgBlogLayout;