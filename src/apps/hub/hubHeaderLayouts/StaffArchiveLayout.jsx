// src/apps/hub/hubHeaderLayouts/StaffArchiveLayout.jsx
//
// 主页头部区域的「员工档案卡 / 工牌叠放风」版式：
// - 顶部悬挂织带与迷你双吊牌 + 底层 ARCHIVE 档案卡 + 叠放 STAFF ID 工牌卡 + 条形码 + 底部按钮
// - 遵循中性极简玻璃风与 GlassCard 规范，强调色限定在主按钮上。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Edit2,
  Check,
  AlertCircle,
  FileText,
  Hash,
  Calendar,
  MapPin,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';

const PROFILE_ID = 'main';
const GALLERY_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'HEXALIA',
  handle: 'HX-9082-A',
  bio: 'SPECIAL ARCHIVE DIVISION // LEVEL 4 CLEARANCE',
  location: 'SECTOR-07',
  joined: '2026.09.20',
  avatar: '',
  banner: '',
  tagline: 'STAFF ARCHIVE',
  bigStatement: 'ARCHIVE',
  followLabel: 'VERIFY ID',
  messageLabel: 'ACCESS LOGS',
  socialLinks: [],
};

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Staff Gallery',
  caption: '',
  photos: [
    { id: 'pass-1', url: '', label: 'Mini Pass 1' },
    { id: 'pass-2', url: '', label: 'Mini Pass 2' },
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

export const StaffArchiveLayout = ({ delay = 100 }) => {
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
            while (paddedPhotos.length < 2) {
              paddedPhotos.push({
                id: createLocalId(),
                url: '',
                label: `Mini Pass ${paddedPhotos.length + 1}`,
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
        console.error('Failed to load staff archive layout data:', error);
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
      setStorageWarning('资料保存失败，可能是图片过大或存储空间不足。');
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
      setStorageWarning('图片保存失败，可能是图片过大或存储空间不足。');
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

  const handleMiniPhotoUpload = async (e, photoId) => {
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

  const miniPass1 = gallery.photos[0];
  const miniPass2 = gallery.photos[1];

  return (
    <GlassCard delay={delay} className="relative overflow-hidden p-3 sm:p-6">
      {/* 模式切换按钮 */}
      <button
        type="button"
        onClick={() => void handleEditingToggle()}
        className="absolute right-4 top-4 z-40 rounded-full bg-black/5 p-2 text-neutral-600 backdrop-blur-md transition-all hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20"
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

      {/* 顶层档案卡外框容器 */}
      <div className="relative mx-auto w-full max-w-xl">
        {/* ================= 悬挂挂带与双吊牌展示 ================= */}
        <div className="relative -mb-10 flex h-36 w-full items-start justify-end pr-8 pointer-events-none">
          {/* 挂带 1 */}
          <div className="relative mr-4 h-24 w-3.5 rounded-sm bg-neutral-300/80 shadow-md dark:bg-neutral-700/80">
            {/* 吊牌 1 */}
            <div className="pointer-events-auto absolute -bottom-10 -left-4 flex flex-col items-center rounded border border-black/10 bg-white p-1 shadow-lg dark:border-white/15 dark:bg-neutral-900">
              <div className="-mt-3 mb-0.5 h-3 w-2 rounded-sm bg-neutral-400 dark:bg-neutral-600" />
              <div className="relative h-12 w-9 overflow-hidden rounded-sm bg-black/5 dark:bg-white/5">
                               {miniPass1?.url ? (
                  <img
                    src={miniPass1.url}
                    alt="Mini pass 1"
                    className="h-full w-full object-cover"
                  />
                ) : (

                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    <ImageIcon className="h-3 w-3 opacity-50" />
                  </div>
                )}
                {isEditing && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-white">
                    <Camera className="h-2.5 w-2.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleMiniPhotoUpload(e, miniPass1.id)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* 挂带 2 */}
          <div className="relative h-32 w-4 rotate-2 rounded-sm bg-neutral-400/80 shadow-md dark:bg-neutral-600/80">
            {/* 吊牌 2 */}
            <div className="pointer-events-auto absolute -bottom-12 -left-4 flex flex-col items-center rounded border border-black/10 bg-white p-1 shadow-xl dark:border-white/15 dark:bg-neutral-900">
              <div className="-mt-3 mb-0.5 h-3 w-2 rounded-sm bg-neutral-400 dark:bg-neutral-600" />
              <div className="relative h-14 w-10 overflow-hidden rounded-sm bg-black/5 dark:bg-white/5">
                {miniPass2?.url ? (
                  <img
                    src={miniPass2.url}
                    alt="Mini pass 2"
                    className="h-full w-full object-cover"
                  />
                ) : (

                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    <ImageIcon className="h-3.5 w-3.5 opacity-50" />
                  </div>
                )}
                {isEditing && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-white">
                    <Camera className="h-2.5 w-2.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleMiniPhotoUpload(e, miniPass2.id)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 底层大卡片：ARCHIVE 档案仓 ================= */}
        <div className="relative rounded-3xl border border-black/10 bg-black/5 p-5 pb-8 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:p-6 sm:pb-10">
          <div className="flex items-baseline justify-between border-b border-black/5 pb-3 dark:border-white/5">
            <div>
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
                  placeholder="ARCHIVE"
                  className="bg-transparent font-mono text-2xl font-black tracking-tight text-neutral-800 outline-none dark:text-neutral-100 sm:text-3xl"
                />
              ) : (
                <h2 className="font-mono text-2xl font-black tracking-tight text-neutral-800 dark:text-neutral-100 sm:text-3xl">
                  {profile.bigStatement || 'ARCHIVE'}
                </h2>
              )}

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
                  placeholder="STAFF ARCHIVE"
                  className="mt-0.5 bg-transparent text-xs font-semibold tracking-wider text-neutral-500 outline-none dark:text-neutral-400"
                />
              ) : (
                <p className="mt-0.5 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">
                  {profile.tagline || 'STAFF ARCHIVE'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 font-mono text-[10px] text-neutral-400">
              <FileText className="h-3 w-3" />
              <span>OFFICIAL</span>
            </div>
          </div>

          {/* ================= 叠放工牌卡：STAFF ID CARD ================= */}
          <div className="relative -mt-2 rounded-2xl border border-black/10 bg-white/70 p-4 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-neutral-900/80 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[130px_1fr] sm:items-center">
              {/* 工牌照片 */}
              <div className="relative aspect-[3/4] w-full max-w-[130px] overflow-hidden rounded-lg border border-black/10 bg-neutral-900 shadow-inner dark:border-white/15">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (

                  <div className="flex h-full w-full items-center justify-center text-neutral-500">
                    <ImageIcon className="h-8 w-8 opacity-40" />
                  </div>
                )}
                {isEditing && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-white backdrop-blur-[1px]">
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

              {/* 工牌右侧参数排版 */}
              <div className="flex flex-col gap-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    IDENTIFICATION
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={profile.name || ''}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="姓名"
                      className="w-full bg-transparent font-mono text-xl font-black text-neutral-800 outline-none dark:text-neutral-100"
                    />
                  ) : (
                    <div className="font-mono text-xl font-black text-neutral-800 dark:text-neutral-100">
                      {profile.name || 'HEXALIA'}
                    </div>
                  )}
                </div>

                {/* 键值元数据 */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 font-bold text-neutral-400">
                      <Hash className="h-2.5 w-2.5" /> ID NO.
                    </span>
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
                        placeholder="ID"
                        className="bg-transparent font-mono font-bold text-neutral-700 outline-none dark:text-neutral-300"
                      />
                    ) : (
                      <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
                        {profile.handle || 'HX-9082-A'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 font-bold text-neutral-400">
                      <Calendar className="h-2.5 w-2.5" /> DATE
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={profile.joined || ''}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            joined: e.target.value,
                          }))
                        }
                        placeholder="日期"
                        className="bg-transparent font-mono font-bold text-neutral-700 outline-none dark:text-neutral-300"
                      />
                    ) : (
                      <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
                        {profile.joined || '2026.09.20'}
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 flex flex-col">
                    <span className="flex items-center gap-1 font-bold text-neutral-400">
                      <MapPin className="h-2.5 w-2.5" /> SECTOR
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={profile.location || ''}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        placeholder="部门/区域"
                        className="bg-transparent font-mono font-semibold text-neutral-700 outline-none dark:text-neutral-300"
                      />
                    ) : (
                      <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                        {profile.location || 'SECTOR-07'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 描述与签名印章区 */}
                <div className="pt-1">
                  {isEditing ? (
                    <textarea
                      rows={2}
                      value={profile.bio || ''}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          bio: e.target.value,
                        }))
                      }
                      placeholder="职权或简介说明..."
                      className="w-full resize-none rounded border border-black/10 bg-black/5 p-1.5 font-mono text-[10px] text-neutral-700 outline-none dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
                    />
                  ) : (
                    <p className="font-mono text-[10px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {profile.bio ||
                        'SPECIAL ARCHIVE DIVISION // LEVEL 4 CLEARANCE'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 条形码图形 */}
            <div className="mt-4 flex flex-col items-center border-t border-black/10 pt-2 dark:border-white/10">
              <svg
                viewBox="0 0 160 20"
                className="h-5 w-44 opacity-60 dark:invert"
              >
                <line x1="4" y1="0" x2="4" y2="20" stroke="currentColor" strokeWidth="2" />
                <line x1="10" y1="0" x2="10" y2="20" stroke="currentColor" strokeWidth="3" />
                <line x1="18" y1="0" x2="18" y2="20" stroke="currentColor" strokeWidth="1" />
                <line x1="24" y1="0" x2="24" y2="20" stroke="currentColor" strokeWidth="4" />
                <line x1="34" y1="0" x2="34" y2="20" stroke="currentColor" strokeWidth="2" />
                <line x1="42" y1="0" x2="42" y2="20" stroke="currentColor" strokeWidth="1" />
                <line x1="48" y1="0" x2="48" y2="20" stroke="currentColor" strokeWidth="3" />
                <line x1="58" y1="0" x2="58" y2="20" stroke="currentColor" strokeWidth="2" />
                <line x1="66" y1="0" x2="66" y2="20" stroke="currentColor" strokeWidth="4" />
                <line x1="76" y1="0" x2="76" y2="20" stroke="currentColor" strokeWidth="1" />
                <line x1="82" y1="0" x2="82" y2="20" stroke="currentColor" strokeWidth="2" />
                <line x1="90" y1="0" x2="90" y2="20" stroke="currentColor" strokeWidth="3" />
                <line x1="98" y1="0" x2="98" y2="20" stroke="currentColor" strokeWidth="1" />
                <line x1="106" y1="0" x2="106" y2="20" stroke="currentColor" strokeWidth="4" />
                <line x1="116" y1="0" x2="116" y2="20" stroke="currentColor" strokeWidth="2" />
                <line x1="124" y1="0" x2="124" y2="20" stroke="currentColor" strokeWidth="1" />
                <line x1="130" y1="0" x2="130" y2="20" stroke="currentColor" strokeWidth="3" />
                <line x1="140" y1="0" x2="140" y2="20" stroke="currentColor" strokeWidth="2" />
                <line x1="148" y1="0" x2="148" y2="20" stroke="currentColor" strokeWidth="3" />
                <line x1="156" y1="0" x2="156" y2="20" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className="mt-1 font-mono text-[9px] tracking-widest text-neutral-400">
                AUTH-78902-VALIDATED
              </span>
            </div>
          </div>

          {/* 底部双操作按钮 */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* 唯一强调色按钮 */}
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
                className="rounded-full py-2 text-center font-mono text-xs font-bold shadow-sm outline-none"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                }}
              />
            ) : (
              <button
                type="button"
                className="rounded-full py-2 text-center font-mono text-xs font-bold shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                }}
              >
                {profile.followLabel || 'VERIFY ID'}
              </button>
            )}

            {/* 辅助中性按钮 */}
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
                className="rounded-full border border-black/10 bg-black/5 py-2 text-center font-mono text-xs font-medium text-neutral-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
              />
            ) : (
              <button
                type="button"
                className="rounded-full border border-black/10 bg-black/5 py-2 text-center font-mono text-xs font-medium text-neutral-700 transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300"
              >
                {profile.messageLabel || 'ACCESS LOGS'}
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default StaffArchiveLayout;
