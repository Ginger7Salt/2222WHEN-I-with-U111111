// src/apps/snapshots/services/snapshotProfileService.js
//
// 【整体替换说明】相对上一轮的改动：
// 新增 `showcaseImages`（主页第二段"精选/展示图"用的图片数组，最多 8 张，
// 与下方自动生成的动态流完全无关，是 user/char 自己手动挑选、可随时增删的
// 一组图，用来在主页上做一条可以左右滑动的小图带）。
// 其余字段（handle / tags）与上一轮保持一致。
//
import db from '../../../db';

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof tags === 'string') {
    return tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 8);
  }
  return [];
};

const normalizeShowcaseImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images.filter((img) => typeof img === 'string' && img.length > 0).slice(0, 8);
};

/**
 * 获取某个 Chat 对应的 User 在 Snapshots 中的专有主页资料
 */
export const getUserSnapshotProfile = async (chatId) => {
  if (!chatId) return null;

  const numericChatId = Number(chatId);
  const profileKey = `user_${numericChatId}`;
  const customProfile = await db.snapshotProfiles.get(profileKey);

  const chat = await db.chats.get(numericChatId);

  const defaultName = chat?.userName || '我';
  const defaultAvatar = chat?.userAvatar || '';
  const defaultBio = chat?.userPersona || '在日常的缝隙里，收纳温暖的光影。';

  return {
    profileKey,
    chatId: numericChatId,
    targetType: 'user',
    name: customProfile?.name || defaultName,
    handle: customProfile?.handle || '',
    avatar: customProfile?.avatar || defaultAvatar,
    bio: customProfile?.bio || defaultBio,
    banner: customProfile?.banner || '',
    tags: normalizeTags(customProfile?.tags),
    showcaseImages: normalizeShowcaseImages(customProfile?.showcaseImages),
    updatedAt: customProfile?.updatedAt || 0
  };
};

/**
 * 保存 User 的专有主页资料
 */
export const saveUserSnapshotProfile = async (chatId, { name, handle, avatar, bio, banner, tags, showcaseImages }) => {
  if (!chatId) return;
  const numericChatId = Number(chatId);
  const profileKey = `user_${numericChatId}`;

  await db.snapshotProfiles.put({
    profileKey,
    chatId: numericChatId,
    targetType: 'user',
    targetId: null,
    name: (name || '').trim() || '我',
    handle: (handle || '').trim(),
    avatar: avatar || '',
    bio: (bio || '').trim(),
    banner: banner || '',
    tags: normalizeTags(tags),
    showcaseImages: normalizeShowcaseImages(showcaseImages),
    updatedAt: Date.now()
  });
};

/**
 * 获取某个 Chat 对应的 Character 在 Snapshots 中的专有主页资料
 */
export const getCharSnapshotProfile = async (chatId, characterId) => {
  if (!chatId || !characterId) return null;

  const numericChatId = Number(chatId);
  const numericCharId = Number(characterId);
  const profileKey = `char_${numericChatId}_${numericCharId}`;
  const customProfile = await db.snapshotProfiles.get(profileKey);
  const char = await db.characters.get(numericCharId);

  return {
    profileKey,
    chatId: numericChatId,
    characterId: numericCharId,
    targetType: 'character',
    name: customProfile?.name || char?.name || '未知伴侣',
    handle: customProfile?.handle || '',
    avatar: customProfile?.avatar || char?.avatar || '',
    bio: customProfile?.bio || char?.bio || '生活里的吉光片羽。',
    banner: customProfile?.banner || '',
    tags: normalizeTags(customProfile?.tags),
    showcaseImages: normalizeShowcaseImages(customProfile?.showcaseImages),
    updatedAt: customProfile?.updatedAt || 0
  };
};

/**
 * 保存 Character 的专有主页资料
 */
export const saveCharSnapshotProfile = async (chatId, characterId, { name, handle, avatar, bio, banner, tags, showcaseImages }) => {
  if (!chatId || !characterId) return;
  const numericChatId = Number(chatId);
  const numericCharId = Number(characterId);
  const profileKey = `char_${numericChatId}_${numericCharId}`;

  await db.snapshotProfiles.put({
    profileKey,
    chatId: numericChatId,
    targetType: 'character',
    targetId: numericCharId,
    name: (name || '').trim() || '伴侣',
    handle: (handle || '').trim(),
    avatar: avatar || '',
    bio: (bio || '').trim(),
    banner: banner || '',
    tags: normalizeTags(tags),
    showcaseImages: normalizeShowcaseImages(showcaseImages),
    updatedAt: Date.now()
  });
};

export default {
  getUserSnapshotProfile,
  saveUserSnapshotProfile,
  getCharSnapshotProfile,
  saveCharSnapshotProfile
};