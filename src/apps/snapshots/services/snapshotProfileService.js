// src/apps/snapshots/services/snapshotProfileService.js
//
// 【整体替换说明】（文件不大，直接整体替换比局部 diff 更清晰）
// 唯一改动：删除 getUserSnapshotProfile 里对 globalPersona/globalAvatar 的
// fallback 读取。因为现在每个消息框都是独立世界线，不再需要"全局 User 人设"
// 这层兜底；fallback 链变为: per-chat 自定义资料 -> chat 自身信息 -> 硬编码默认值。
// saveUserSnapshotProfile / getCharSnapshotProfile / saveCharSnapshotProfile 不变。
//
import db from '../../../db';

/**
 * 获取某个 Chat 对应的 User 在 Snapshots 中的专有主页资料
 */
export const getUserSnapshotProfile = async (chatId) => {
  if (!chatId) return null;

  const numericChatId = Number(chatId);
  const profileKey = `user_${numericChatId}`;
  const customProfile = await db.snapshotProfiles.get(profileKey);

  // 获取该 Chat 的基础设定作为 Fallback（不再回退到全局 User 人设）
  const chat = await db.chats.get(numericChatId);

  const defaultName = chat?.userName || '我';
  const defaultAvatar = chat?.userAvatar || '';
  const defaultBio = chat?.userPersona || '在日常的缝隙里，收纳温暖的光影。';

  return {
    profileKey,
    chatId: numericChatId,
    targetType: 'user',
    name: customProfile?.name || defaultName,
    avatar: customProfile?.avatar || defaultAvatar,
    bio: customProfile?.bio || defaultBio,
    banner: customProfile?.banner || '',
    updatedAt: customProfile?.updatedAt || 0
  };
};

/**
 * 保存 User 的专有主页资料
 */
export const saveUserSnapshotProfile = async (chatId, { name, avatar, bio, banner }) => {
  if (!chatId) return;
  const numericChatId = Number(chatId);
  const profileKey = `user_${numericChatId}`;

  await db.snapshotProfiles.put({
    profileKey,
    chatId: numericChatId,
    targetType: 'user',
    targetId: null,
    name: (name || '').trim() || '我',
    avatar: avatar || '',
    bio: (bio || '').trim(),
    banner: banner || '',
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
    avatar: customProfile?.avatar || char?.avatar || '',
    bio: customProfile?.bio || char?.bio || '生活里的吉光片羽。',
    banner: customProfile?.banner || '',
    updatedAt: customProfile?.updatedAt || 0
  };
};

/**
 * 保存 Character 的专有主页资料
 */
export const saveCharSnapshotProfile = async (chatId, characterId, { name, avatar, bio, banner }) => {
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
    avatar: avatar || '',
    bio: (bio || '').trim(),
    banner: banner || '',
    updatedAt: Date.now()
  });
};

export default {
  getUserSnapshotProfile,
  saveUserSnapshotProfile,
  getCharSnapshotProfile,
  saveCharSnapshotProfile
};
