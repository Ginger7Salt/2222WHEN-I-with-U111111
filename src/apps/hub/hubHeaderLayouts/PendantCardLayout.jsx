// src/apps/hub/hubHeaderLayouts/PendantCardLayout.jsx
//
// 主页头部区域的「挂坠卡片风」版式：banner 当海报式大图，头像叠加，
// 大号名字压在图上，下面是关系宣言、按钮、进度条和一条链接货架。
// 三个新版式里这个跟"情侣主页"最贴：可以把 identityTags 当成一句
// 关系宣言（比如"I love you my best home"），进度条可以填"在一起
// 多久"之类的东西。颜色继续是中性玻璃语言 + 主题强调色，不用参考图
// 里的纯黑白。
//
// 数据来源：
// - name / handle / avatar / banner / identityTags / followLabel /
//   messageLabel / socialLinks 复用 db.profile 里已有的字段。
// - progressLabel / progressPercent 是这个版式新增的可选字段（进度条
//   的文案和百分比），加在 db.profile 对象上，其它版式会直接忽略。

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
  bio: '',
  location: 'City, Earth',
  joined: 'Aug 2026',
  avatar: '',
  banner: '',
  tagline: '',
  followLabel: 'Favorite person',
  messageLabel: 'Detail',
  extraNote: '',
  socialLinks: [],
  identityTags: 'I love you my best home',
  progressLabel: 'together',
  progressPercent: 60,
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

const clampPercent = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
};

export const PendantCardLayout = ({ delay = 100 }) => {
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
            progressPercent: clampPercent(
              savedProfile.progressPercent ?? DEFAULT_PROFILE.progressPercent
            ),
          });
        }
      } catch (error) {
        console.error('Failed to load pendant card layout data:', error);

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
        <div className="h-80 animate-pulse rounded-[1.5rem] bg-black/5 dark:bg-white/5" />
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
        className="absolute right-5 top-5 z-10 rounded-full bg-white/20 p-1.5 text-white opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 active:scale-95"
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

      {/* 海报式 banner + 头像 + 大号名字 */}
      <div className="relative h-44 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/10 dark:bg-white/5">
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

        {/* 底部渐暗遮罩，让名字压在图上依然可读 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />

        <div className="absolute inset-x-4 bottom-3 flex items-end gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-black/20 shadow-md">
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
                <Camera className="h-4 w-4 text-white/70" />
              </div>
            )}

            {isEditing && (
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white">
                <Camera className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-0.5">
            {isEditing ? (
              <input
                type="text"
                value={profile.name}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Name"
                className="w-full rounded-lg bg-white/20 px-2.5 py-1 text-lg font-black text-white outline-none placeholder:text-white/60"
              />
            ) : (
              <h2 className="truncate text-2xl font-black tracking-tight text-white drop-shadow">
                {profile.name}
              </h2>
            )}
          </div>
        </div>
      </div>

      {/* 关系宣言 */}
      {isEditing ? (
        <input
          type="text"
          value={profile.identityTags}
          onChange={(event) =>
            setProfile((prev) => ({
              ...prev,
              identityTags: event.target.value,
            }))
          }
          placeholder="I love you my best home"
          className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-center font-serif text-sm italic outline-none dark:bg-white/10"
        />
      ) : (
        profile.identityTags && (
          <p className="text-center font-serif text-sm italic leading-relaxed opacity-70">
            {profile.identityTags}
          </p>
        )
      )}

      {/* 按钮 */}
      <div className="space-y-2">
        {isEditing ? (
          <input
            type="text"
            value={profile.followLabel}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                followLabel: event.target.value,
              }))
            }
            placeholder="Favorite person"
            className="w-full rounded-full px-4 py-2 text-center text-sm font-bold outline-none"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          />
        ) : (
          <div
            className="w-full rounded-full px-4 py-2 text-center text-sm font-bold"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            {profile.followLabel || 'Favorite person'}
          </div>
        )}

        {isEditing ? (
          <input
            type="text"
            value={profile.messageLabel}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                messageLabel: event.target.value,
              }))
            }
            placeholder="Detail"
            className="mx-auto block w-1/2 rounded-full border border-black/10 bg-transparent px-4 py-1.5 text-center text-xs font-semibold outline-none dark:border-white/15"
          />
        ) : (
          <div className="mx-auto w-1/2 rounded-full border border-black/10 py-1.5 text-center text-xs font-semibold dark:border-white/15">
            {profile.messageLabel || 'Detail'}
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider opacity-50">
          {isEditing ? (
            <>
              <input
                type="text"
                value={profile.progressLabel}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    progressLabel: event.target.value,
                  }))
                }
                placeholder="together"
                className="w-1/2 rounded bg-black/5 px-1.5 py-0.5 normal-case outline-none dark:bg-white/10"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={profile.progressPercent}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    progressPercent: clampPercent(event.target.value),
                  }))
                }
                className="w-14 rounded bg-black/5 px-1.5 py-0.5 text-right outline-none dark:bg-white/10"
              />
            </>
          ) : (
            <>
              <span>{profile.progressLabel || 'together'}</span>
              <span>{profile.progressPercent}%</span>
            </>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${profile.progressPercent}%`,
              backgroundColor: 'var(--accent-color)',
            }}
          />
        </div>
      </div>

      {/* 链接货架 */}
      {(isEditing || visibleSocialLinks.length > 0) && (
        <div className="space-y-1.5">
          {profile.socialLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10"
            >
              {isEditing ? (
                <>
                  <input
                    type="text"
                    placeholder="名称"
                    value={link.label}
                    onChange={(event) =>
                      updateSocialLink(link.id, 'label', event.target.value)
                    }
                    className="w-1/3 rounded bg-white/60 px-1.5 py-1 text-[11px] outline-none dark:bg-black/30"
                  />
                  <input
                    type="text"
                    placeholder="链接"
                    value={link.url}
                    onChange={(event) =>
                      updateSocialLink(link.id, 'url', event.target.value)
                    }
                    className="flex-1 rounded bg-white/60 px-1.5 py-1 text-[11px] outline-none dark:bg-black/30"
                  />
                  <button
                    type="button"
                    onClick={() => removeSocialLink(link.id)}
                    className="shrink-0 text-rose-500 opacity-70 hover:opacity-100"
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {link.label}
                  </span>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 opacity-60 hover:opacity-100"
                      title={link.url}
                      aria-label={`打开 ${link.label}`}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link2 className="h-3.5 w-3.5 shrink-0 opacity-30" />
                  )}
                </>
              )}
            </div>
          ))}

          {isEditing && (
            <button
              type="button"
              onClick={addSocialLink}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/10 py-2 text-xs opacity-60 hover:opacity-100 dark:border-white/10"
            >
              <Plus className="h-4 w-4" />
              添加一条
            </button>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default PendantCardLayout;