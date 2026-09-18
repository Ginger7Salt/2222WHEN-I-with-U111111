// src/apps/hub/hubHeaderLayouts/IdentityCardLayout.jsx
//
// 主页头部区域的「社群卡片风」版式：头像 + 身份标签 + 关注/私信按钮 +
// 笔记框 + 动态区块 + 歌单式图片网格 + 标签分组，全部合并成一张卡片。
//
// 这一版参考图里的「Friend Activity」「Public Playlists」在这个应用里
// 没有对应的真实数据源（没有好友系统，也没有歌单系统），所以全部做成
// 纯手动填写的展示区块——用户自己往里面写内容、传图片，不是真的去抓取
// 什么数据。跟 IgBlogLayout 一样，颜色和描边都走主题变量 / 中性玻璃色，
// 不使用参考图里的固定灰白配色。
//
// 数据来源：
// - name / handle / bio / avatar / tagline / followLabel / messageLabel
//   复用 db.profile 里已有的字段（跟经典版、博客/IG 版共用同一份）。
// - identityTags / activityLabel / playlistsLabel / topNoteBoxes /
//   bottomNoteBoxes / activityItems / tagGroups 是这个版式新增的可选
//   字段，同样加在 db.profile 对象上，其它版式会直接忽略。
// - photos 复用 db.pinnedGallery.photos，每张照片新增 label / updatedText
//   两个可选字段（歌单标题 / "Updated 3h Ago" 这种小字），同样是加法字段。

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  User,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';

const PROFILE_ID = 'main';
const GALLERY_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'User Name',
  handle: '@username',
  bio: '',
  location: 'City, Earth',
  joined: 'Aug 2026',
  avatar: '',
  banner: '',
  tagline: 'USER',
  followLabel: 'Following',
  messageLabel: 'Message',
  extraNote: '',
  socialLinks: [],
  identityTags: 'she / her · always curious',
  activityLabel: 'Friend Activity',
  playlistsLabel: 'Public Playlists',
  topNoteBoxes: [
    { id: 'top-1', lead: 'about!', text: '写点关于你自己的关键信息。' },
    { id: 'top-2', lead: 'note!', text: '再写一条你想让别人先知道的事。' },
  ],
  bottomNoteBoxes: [
    { id: 'bottom-1', lead: 'likes!', text: '喜欢的东西，随便列。' },
    { id: 'bottom-2', lead: 'loves!', text: '最爱的人或东西。' },
  ],
  activityItems: [],
  tagGroups: [],
};

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Pinned Moment',
  caption: '',
  photos: [
    { id: 1, url: '', label: '', updatedText: '' },
    { id: 2, url: '', label: '', updatedText: '' },
  ],
};

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 统一处理图片文件读取，避免三处上传逻辑（头像 / 歌单图 / 动态头像）
// 各写一遍 FileReader 样板代码。
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

export const IdentityCardLayout = ({ delay = 100 }) => {
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
              topNoteBoxes: Array.isArray(savedProfile.topNoteBoxes)
                ? savedProfile.topNoteBoxes
                : DEFAULT_PROFILE.topNoteBoxes,
              bottomNoteBoxes: Array.isArray(savedProfile.bottomNoteBoxes)
                ? savedProfile.bottomNoteBoxes
                : DEFAULT_PROFILE.bottomNoteBoxes,
              activityItems: Array.isArray(savedProfile.activityItems)
                ? savedProfile.activityItems
                : DEFAULT_PROFILE.activityItems,
              tagGroups: Array.isArray(savedProfile.tagGroups)
                ? savedProfile.tagGroups
                : DEFAULT_PROFILE.tagGroups,
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
        console.error('Failed to load identity card layout data:', error);

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

  const addPhoto = () => {
    const nextGallery = {
      ...gallery,
      photos: [
        ...gallery.photos,
        { id: createLocalId(), url: '', label: '', updatedText: '' },
      ],
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

  const updatePhotoField = (id, field, value) => {
    const nextGallery = {
      ...gallery,
      photos: gallery.photos.map((photo) =>
        photo.id === id ? { ...photo, [field]: value } : photo
      ),
    };

    setGallery(nextGallery);
  };

  const handlePhotoUpload = (event, id) => {
    const file = event.target.files?.[0];
    if (!file) return;

    applyUpload(file, (dataUrl) => {
      const nextGallery = {
        ...gallery,
        photos: gallery.photos.map((photo) =>
          photo.id === id ? { ...photo, url: dataUrl } : photo
        ),
      };

      setGallery(nextGallery);
      void saveGallery(nextGallery);
    });

    event.target.value = '';
  };

  // 通用的「一组带 lead/text 的笔记框」增删改，topNoteBoxes 和
  // bottomNoteBoxes 结构完全一样，共用同一套操作函数。
  const addNoteBox = (field) => {
    setProfile((prev) => ({
      ...prev,
      [field]: [...prev[field], { id: createLocalId(), lead: '', text: '' }],
    }));
  };

  const updateNoteBox = (field, id, key, value) => {
    setProfile((prev) => ({
      ...prev,
      [field]: prev[field].map((box) =>
        box.id === id ? { ...box, [key]: value } : box
      ),
    }));
  };

  const removeNoteBox = (field, id) => {
    setProfile((prev) => ({
      ...prev,
      [field]: prev[field].filter((box) => box.id !== id),
    }));
  };

  const addActivityItem = () => {
    setProfile((prev) => ({
      ...prev,
      activityItems: [
        ...prev.activityItems,
        {
          id: createLocalId(),
          avatar: '',
          name: '',
          timestamp: '',
          line1: '',
          line2: '',
          tag: '',
        },
      ],
    }));
  };

  const updateActivityItem = (id, field, value) => {
    setProfile((prev) => ({
      ...prev,
      activityItems: prev.activityItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeActivityItem = (id) => {
    setProfile((prev) => ({
      ...prev,
      activityItems: prev.activityItems.filter((item) => item.id !== id),
    }));
  };

  const handleActivityAvatarUpload = (event, id) => {
    const file = event.target.files?.[0];
    if (!file) return;

    applyUpload(file, (dataUrl) => {
      updateActivityItem(id, 'avatar', dataUrl);
    });

    event.target.value = '';
  };

  const addTagGroup = () => {
    setProfile((prev) => ({
      ...prev,
      tagGroups: [
        ...prev.tagGroups,
        { id: createLocalId(), title: '', text: '' },
      ],
    }));
  };

  const updateTagGroup = (id, field, value) => {
    setProfile((prev) => ({
      ...prev,
      tagGroups: prev.tagGroups.map((group) =>
        group.id === id ? { ...group, [field]: value } : group
      ),
    }));
  };

  const removeTagGroup = (id) => {
    setProfile((prev) => ({
      ...prev,
      tagGroups: prev.tagGroups.filter((group) => group.id !== id),
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

  const noteBoxFieldClass =
    'rounded-xl border border-black/10 p-3 text-[11px] leading-relaxed dark:border-white/15';

  const renderNoteBoxes = (field, boxes) => (
    <div className="grid grid-cols-2 gap-2">
      {boxes.map((box) => (
        <div key={box.id} className={`relative ${noteBoxFieldClass}`}>
          {isEditing ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="lead!"
                  value={box.lead}
                  onChange={(event) =>
                    updateNoteBox(field, box.id, 'lead', event.target.value)
                  }
                  className="w-full rounded-lg bg-black/5 px-2 py-1 text-[11px] font-bold outline-none dark:bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => removeNoteBox(field, box.id)}
                  className="shrink-0 rounded-full bg-black/5 p-1 text-rose-500 opacity-70 hover:opacity-100 dark:bg-white/10"
                  title="删除"
                  aria-label="删除笔记框"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <textarea
                placeholder="写点什么..."
                value={box.text}
                onChange={(event) =>
                  updateNoteBox(field, box.id, 'text', event.target.value)
                }
                className="h-16 w-full resize-none rounded-lg bg-black/5 p-2 text-[11px] outline-none dark:bg-white/10"
              />
            </div>
          ) : (
            <p>
              {box.lead && <span className="font-bold">{box.lead} </span>}
              {box.text}
            </p>
          )}
        </div>
      ))}

      {isEditing && (
        <button
          type="button"
          onClick={() => addNoteBox(field)}
          className="flex items-center justify-center rounded-xl border-2 border-dashed border-black/10 py-3 opacity-60 hover:opacity-100 dark:border-white/10"
          title="添加笔记框"
          aria-label="添加笔记框"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );

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

      {/* 头像 + 身份标签 */}
      <div className="flex items-start gap-3 pr-8">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/5 dark:bg-white/5">
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
              <User className="h-7 w-7 opacity-30" />
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
                placeholder="小标签，例如 USER"
                value={profile.tagline}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    tagline: event.target.value,
                  }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-[10px] uppercase tracking-wider outline-none dark:bg-white/10"
              />
              <input
                type="text"
                placeholder="Display Name"
                value={profile.name}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-base font-bold outline-none dark:bg-white/10"
              />
              <input
                type="text"
                placeholder="身份标签，用 · 分隔"
                value={profile.identityTags}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    identityTags: event.target.value,
                  }))
                }
                className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 outline-none dark:bg-white/10"
              />
            </div>
          ) : (
            <>
              {profile.tagline && (
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40">
                  {profile.tagline}
                </p>
              )}
              <h2 className="truncate text-2xl font-black tracking-tight">
                {profile.name}
              </h2>
              {profile.identityTags && (
                <p className="mt-1 text-[11px] leading-relaxed opacity-50">
                  {profile.identityTags}
                </p>
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
              placeholder="Following"
              className="w-1/2 rounded-full border border-black/10 bg-transparent px-3 py-1.5 text-center text-xs font-semibold outline-none dark:border-white/15"
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
              placeholder="Message"
              className="w-1/2 rounded-full border border-black/10 bg-transparent px-3 py-1.5 text-center text-xs font-semibold outline-none dark:border-white/15"
            />
          </>
        ) : (
          <>
            <span className="flex-1 rounded-full border border-black/10 py-1.5 text-center text-xs font-semibold dark:border-white/15">
              {profile.followLabel || 'Following'}
            </span>
            <span className="flex-1 rounded-full border border-black/10 py-1.5 text-center text-xs font-semibold dark:border-white/15">
              {profile.messageLabel || 'Message'}
            </span>
          </>
        )}
      </div>

      {/* 顶部笔记框（byf / dnfi 那种） */}
      {renderNoteBoxes('topNoteBoxes', profile.topNoteBoxes)}

      {/* 动态区块 */}
      {(isEditing ||
        profile.activityLabel ||
        profile.activityItems.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {isEditing ? (
              <input
                type="text"
                value={profile.activityLabel}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    activityLabel: event.target.value,
                  }))
                }
                placeholder="Friend Activity"
                className="flex-1 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-bold outline-none dark:bg-white/10"
              />
            ) : (
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold dark:bg-white/10">
                {profile.activityLabel}
              </span>
            )}

            {isEditing && (
              <button
                type="button"
                onClick={addActivityItem}
                className="ml-2 shrink-0 rounded-full bg-black/5 p-1.5 opacity-60 hover:opacity-100 dark:bg-white/10"
                title="添加动态"
                aria-label="添加动态"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {profile.activityItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 rounded-xl bg-black/5 p-2 dark:bg-white/5"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt={item.name || 'Activity'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-4 w-4 opacity-30" />
                    </div>
                  )}

                  {isEditing && (
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white">
                      <Camera className="h-3 w-3" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          handleActivityAvatarUpload(event, item.id)
                        }
                      />
                    </label>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="名字"
                        value={item.name}
                        onChange={(event) =>
                          updateActivityItem(item.id, 'name', event.target.value)
                        }
                        className="w-2/3 rounded-lg bg-black/5 px-2 py-1 text-[11px] font-bold outline-none dark:bg-white/10"
                      />
                      <input
                        type="text"
                        placeholder="28m"
                        value={item.timestamp}
                        onChange={(event) =>
                          updateActivityItem(
                            item.id,
                            'timestamp',
                            event.target.value
                          )
                        }
                        className="w-1/3 rounded-lg bg-black/5 px-2 py-1 text-[10px] outline-none dark:bg-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => removeActivityItem(item.id)}
                        className="shrink-0 rounded-full bg-black/5 p-1 text-rose-500 opacity-70 hover:opacity-100 dark:bg-white/10"
                        title="删除"
                        aria-label="删除动态"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="第一行内容"
                      value={item.line1}
                      onChange={(event) =>
                        updateActivityItem(item.id, 'line1', event.target.value)
                      }
                      className="w-full rounded-lg bg-black/5 px-2 py-1 text-[11px] outline-none dark:bg-white/10"
                    />
                    <input
                      type="text"
                      placeholder="第二行内容（可选）"
                      value={item.line2}
                      onChange={(event) =>
                        updateActivityItem(item.id, 'line2', event.target.value)
                      }
                      className="w-full rounded-lg bg-black/5 px-2 py-1 text-[10px] outline-none dark:bg-white/10"
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] font-bold">
                        {item.name}
                      </span>
                      {item.timestamp && (
                        <span className="shrink-0 text-[10px] opacity-40">
                          {item.timestamp}
                        </span>
                      )}
                    </div>
                    {item.line1 && (
                      <p className="truncate text-[11px] opacity-70">
                        {item.line1}
                      </p>
                    )}
                    {item.line2 && (
                      <p className="truncate text-[10px] opacity-50">
                        {item.line2}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 歌单式图片网格 */}
      <div className="space-y-2">
        {isEditing ? (
          <input
            type="text"
            value={profile.playlistsLabel}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                playlistsLabel: event.target.value,
              }))
            }
            placeholder="Public Playlists"
            className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-bold outline-none dark:bg-white/10"
          />
        ) : (
          <span className="block rounded-full bg-black/5 px-3 py-1 text-center text-xs font-bold dark:bg-white/10">
            {profile.playlistsLabel}
          </span>
        )}

        <div className="grid grid-cols-2 gap-2">
          {gallery.photos.map((photo) => (
            <div key={photo.id} className="space-y-1">
              <div className="group/item relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/5 dark:bg-white/5">
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.label || 'Playlist'}
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
                        onChange={(event) =>
                          handlePhotoUpload(event, photo.id)
                        }
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

              {isEditing ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="标题"
                    value={photo.label || ''}
                    onChange={(event) =>
                      updatePhotoField(photo.id, 'label', event.target.value)
                    }
                    className="w-full rounded-lg bg-black/5 px-2 py-1 text-[10px] font-bold outline-none dark:bg-white/10"
                  />
                  <input
                    type="text"
                    placeholder="Updated 3h Ago"
                    value={photo.updatedText || ''}
                    onChange={(event) =>
                      updatePhotoField(
                        photo.id,
                        'updatedText',
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg bg-black/5 px-2 py-1 text-[9px] outline-none dark:bg-white/10"
                  />
                </div>
              ) : (
                (photo.label || photo.updatedText) && (
                  <div>
                    {photo.label && (
                      <p className="truncate text-[10px] font-bold">
                        {photo.label}
                      </p>
                    )}
                    {photo.updatedText && (
                      <p className="truncate text-[9px] opacity-40">
                        {photo.updatedText}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          ))}
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={addPhoto}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-black/10 py-2.5 text-xs opacity-60 hover:opacity-100 dark:border-white/10"
            title="添加图片"
          >
            <Plus className="h-4 w-4" />
            添加一张
          </button>
        )}
      </div>

      {/* 底部笔记框（likes / loves 那种） */}
      {renderNoteBoxes('bottomNoteBoxes', profile.bottomNoteBoxes)}

      {/* 标签分组 */}
      {(isEditing || profile.tagGroups.length > 0) && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {profile.tagGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-black/10 p-2.5 dark:border-white/15"
              >
                {isEditing ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="分组标题"
                        value={group.title}
                        onChange={(event) =>
                          updateTagGroup(group.id, 'title', event.target.value)
                        }
                        className="w-full rounded-lg bg-black/5 px-2 py-1 text-[11px] font-bold outline-none dark:bg-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => removeTagGroup(group.id)}
                        className="shrink-0 rounded-full bg-black/5 p-1 text-rose-500 opacity-70 hover:opacity-100 dark:bg-white/10"
                        title="删除"
                        aria-label="删除分组"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <textarea
                      placeholder="内容，随便写"
                      value={group.text}
                      onChange={(event) =>
                        updateTagGroup(group.id, 'text', event.target.value)
                      }
                      className="h-14 w-full resize-none rounded-lg bg-black/5 p-2 text-[10px] outline-none dark:bg-white/10"
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-center text-[11px] font-bold uppercase tracking-wider">
                      {group.title}
                    </p>
                    {group.text && (
                      <p className="mt-1.5 text-[10px] leading-relaxed opacity-70">
                        {group.text}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={addTagGroup}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/10 py-2 text-xs opacity-60 hover:opacity-100 dark:border-white/10"
              title="添加标签分组"
            >
              <Plus className="h-4 w-4" />
              添加分组
            </button>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default IdentityCardLayout;