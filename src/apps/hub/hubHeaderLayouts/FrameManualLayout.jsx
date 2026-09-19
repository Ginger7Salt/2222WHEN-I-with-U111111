// src/apps/hub/hubHeaderLayouts/FrameManualLayout.jsx
//
// 主页头部区域的「取景框说明书风」版式：深色标题栏 + 装饰菜单条 +
// 大图取景框 + 一列可点击的图标按钮 + 等宽字体信息读数条。
// 颜色继续走中性玻璃语言，深色标题栏用的是 --text-main（在浅色主题下
// 接近黑，在深色主题下接近白），不是参考图里固定的纯黑。
//
// 数据来源：
// - name / handle / bio / avatar / banner / tagline / location / joined /
//   socialLinks 复用 db.profile 里已有的字段，跟其它版式共用同一份。
// - banner 在这个版式里被当成取景框里的主图使用。
// - File / Action / Help 那一行菜单是纯装饰性的界面元素（不是用户内容），
//   保持静态文案，就跟"编辑/保存"按钮的文案一样不需要用户编辑。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Link2,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';

const PROFILE_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'User Name',
  handle: '@username',
  bio: 'We are all in the gutter, but some of us are looking at the stars.',
  location: 'City, Earth',
  joined: 'Aug 2026',
  avatar: '',
  banner: '',
  tagline: 'Virtual Picture',
  followLabel: 'Follow me!',
  messageLabel: 'Message me!',
  extraNote: '',
  socialLinks: [],
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

export const FrameManualLayout = ({ delay = 100 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [storageWarning, setStorageWarning] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const savedProfile = await db.profile.get(PROFILE_ID);

        if (isMounted && savedProfile) {
          setProfile({
            ...DEFAULT_PROFILE,
            ...savedProfile,
            id: PROFILE_ID,
            socialLinks: Array.isArray(savedProfile.socialLinks)
              ? savedProfile.socialLinks
              : DEFAULT_PROFILE.socialLinks,
          });
        }
      } catch (error) {
        console.error('Failed to load frame manual layout data:', error);

        if (isMounted) {
          setStorageWarning('资料读取失败，请稍后重试。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

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
        <div className="h-72 animate-pulse rounded-[1.5rem] bg-black/5 dark:bg-white/5" />
      </GlassCard>
    );
  }

  const visibleSocialLinks = profile.socialLinks.slice(0, 4);

  return (
    <GlassCard delay={delay} className="relative space-y-0 overflow-hidden !p-0">
      {/* 编辑 / 保存 */}
      <button
        type="button"
        onClick={() => void handleEditingToggle()}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/20 p-1.5 text-white opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 active:scale-95"
        title={isEditing ? '保存主页' : '编辑主页'}
        aria-label={isEditing ? '保存主页' : '编辑主页'}
      >
        {isEditing ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Edit2 className="h-3.5 w-3.5" />
        )}
      </button>

      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: 'var(--text-main)', color: 'var(--card-bg)' }}
      >
        {isEditing ? (
          <input
            type="text"
            value={profile.tagline}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, tagline: event.target.value }))
            }
            placeholder="Virtual Picture"
            className="w-2/3 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold text-white outline-none placeholder:text-white/50"
          />
        ) : (
          <span className="text-xs font-semibold tracking-wide">
            {profile.tagline || 'Virtual Picture'}
          </span>
        )}
        <span className="flex gap-1.5 opacity-60">
          <span className="h-2 w-2 rounded-sm border border-current" />
          <span className="h-2 w-2 rounded-sm border border-current" />
          <span className="h-2 w-2 rounded-sm border border-current" />
        </span>
      </div>

      {/* 装饰菜单条 */}
      <div className="flex gap-4 border-b border-black/5 bg-black/[0.03] px-4 py-1.5 text-[10px] font-medium opacity-40 dark:border-white/10 dark:bg-white/[0.03]">
        <span>File</span>
        <span>Action</span>
        <span>Help</span>
      </div>

      <div className="space-y-3 p-4">
        {storageWarning && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{storageWarning}</span>
          </div>
        )}

        {/* 取景框主图 + 图标按钮列 */}
        <div className="flex gap-2">
          <div className="group/item relative aspect-[4/5] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/5 dark:bg-white/5">
            {profile.banner ? (
              <img
                src={profile.banner}
                alt="Banner"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Camera className="h-6 w-6 opacity-30" />
              </div>
            )}

            {isEditing && (
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 text-white opacity-0 transition-opacity group-hover/item:opacity-100">
                <Camera className="h-5 w-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerUpload}
                />
              </label>
            )}
          </div>

          <div className="flex w-24 shrink-0 flex-col gap-1.5">
            {isEditing ? (
              <>
                {profile.socialLinks.map((link) => (
                  <div key={link.id} className="space-y-1 rounded-lg bg-black/5 p-1.5 dark:bg-white/10">
                    <input
                      type="text"
                      placeholder="名称"
                      value={link.label}
                      onChange={(event) =>
                        updateSocialLink(link.id, 'label', event.target.value)
                      }
                      className="w-full rounded bg-white/60 px-1 py-0.5 text-[9px] outline-none dark:bg-black/30"
                    />
                    <input
                      type="text"
                      placeholder="链接"
                      value={link.url}
                      onChange={(event) =>
                        updateSocialLink(link.id, 'url', event.target.value)
                      }
                      className="w-full rounded bg-white/60 px-1 py-0.5 text-[9px] outline-none dark:bg-black/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeSocialLink(link.id)}
                      className="flex w-full items-center justify-center rounded bg-rose-500/10 py-0.5 text-rose-500"
                      title="删除"
                      aria-label="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSocialLink}
                  className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-black/10 py-1.5 text-[9px] opacity-60 hover:opacity-100 dark:border-white/15"
                >
                  <Plus className="h-3 w-3" />
                  添加
                </button>
              </>
            ) : (
              visibleSocialLinks.map((link) =>
                link.label.trim() ? (
                  link.url ? (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-black/5 py-2 text-center text-[10px] font-medium dark:bg-white/10"
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </a>
                  ) : (
                    <span
                      key={link.id}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-black/5 py-2 text-center text-[10px] font-medium dark:bg-white/10"
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </span>
                  )
                ) : null
              )
            )}
          </div>
        </div>

        {/* 简介 */}
        {isEditing ? (
          <textarea
            value={profile.bio}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, bio: event.target.value }))
            }
            className="h-14 w-full resize-none rounded-lg bg-black/5 p-2 font-serif text-xs italic outline-none dark:bg-white/10"
          />
        ) : (
          profile.bio && (
            <p className="font-serif text-xs italic leading-relaxed opacity-85">
              "{profile.bio}"
            </p>
          )
        )}

        {/* 头像 + 名字，跟信息读数条放在一起 */}
        <div className="flex items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
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
                <Camera className="h-3 w-3 opacity-40" />
              </div>
            )}

            {isEditing && (
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white">
                <Camera className="h-3 w-3" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    applyUpload(file, (dataUrl) => {
                      const nextProfile = { ...profile, avatar: dataUrl };
                      setProfile(nextProfile);
                      void saveProfile(nextProfile);
                    });
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          {isEditing ? (
            <div className="grid flex-1 grid-cols-3 gap-1">
              <input
                type="text"
                value={profile.name}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Name"
                className="rounded bg-black/5 px-1.5 py-1 text-[10px] font-mono outline-none dark:bg-white/10"
              />
              <input
                type="text"
                value={profile.joined}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    joined: event.target.value,
                  }))
                }
                placeholder="Aug 2026"
                className="rounded bg-black/5 px-1.5 py-1 text-[10px] font-mono outline-none dark:bg-white/10"
              />
              <input
                type="text"
                value={profile.location}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                placeholder="City"
                className="rounded bg-black/5 px-1.5 py-1 text-[10px] font-mono outline-none dark:bg-white/10"
              />
            </div>
          ) : (
            <p className="min-w-0 flex-1 truncate font-mono text-[10px] opacity-50">
              {profile.name} · {profile.joined} · {profile.location}
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export default FrameManualLayout;