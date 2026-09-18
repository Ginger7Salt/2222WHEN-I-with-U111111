// src/apps/snapshots/services/snapshotGlobalScheduler.js
//
// 【新建文件说明】
// 让 char / npc 的动态发布不再依赖 SnapshotsApp 页面是否打开。
// 参考项目里已有的 offlineSessionScheduler.js / travelPostcardScheduler.js 的写法：
// 独立文件、独立 setInterval，在 App.jsx 里和 startAutoMessageScheduler() 一起启动。
//
// 和旧的 snapshotSchedulerService.js（只盯当前打开的一个 chatId）不同，
// 这里每次巡检会遍历数据库里【所有】聊天窗，逐个按角色 4 小时冷却 /
// NPC 8 小时 30% 概率的规则判断是否该发一条新动态。
//
// 发帖判定规则与旧的 snapshotSchedulerService.js 保持完全一致，没有新增/更改业务逻辑，
// 只是把作用范围从"当前打开的一个 chatId"扩大到"所有 chatId"。
//
// 说明：这里沿用角色的 isAutoMessageActive 字段作为唯一开关（和旧版 snapshotSchedulerService.js
// 一致），不接入 SettingsPage 里"全局主动消息"总开关，也不接入免打扰时段——这是你在这次澄清里选择的行为。
import db from '../../../db';
import { generateCharacterPost, generateNpcPost, getApiConfig } from './snapshotAiService';
import { getNpcsByChatId } from './snapshotNpcService';
import { triggerSystemNotification } from '../../../services/aiService';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CHAR_POST_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const NPC_POST_COOLDOWN_MS = 8 * 60 * 60 * 1000;
const NPC_TRIGGER_PROBABILITY = 0.3;

let schedulerTimer = null;
let isRunningCheck = false;

const getNotificationPreview = (content = '') => {
  const normalized = String(content).replace(/\s+/g, ' ').trim();
  return normalized.length <= 52 ? normalized : `${normalized.slice(0, 52)}…`;
};

// 角色主动发一条生活动态（该聊天窗对应角色开启了主动消息、且距上次角色发帖超过 4 小时）
const tryPostForCharacter = async (chat, character, now) => {
  if (!character || character.isAutoMessageActive === false) return null;

  try {
    const lastCharPost = await db.snapshots
      .where('chatId')
      .equals(chat.id)
      .and((s) => s.characterId === character.id && s.authorType === 'character')
      .last();

    if (lastCharPost && now - lastCharPost.timestamp <= CHAR_POST_COOLDOWN_MS) {
      return null;
    }

    const postData = await generateCharacterPost(character.id, chat.id);

    const snapshotId = await db.snapshots.add({
      chatId: chat.id,
      authorType: 'character',
      characterId: character.id,
      authorName: character.name,
      authorAvatar: character.avatar || '',
      mediaUrl: '',
      imagePrompt: postData.imagePrompt,
      content: postData.content,
      location: postData.location,
      likes: 1,
      isLiked: false,
      timestamp: now,
      createdAt: now
    });

    void triggerSystemNotification(
      `${character.name} 发布了一条新动态`,
      getNotificationPreview(postData.content),
      character.avatar
    );

    return snapshotId;
  } catch (error) {
    console.error(
      `[SnapshotGlobalScheduler] 聊天窗 ${chat.id} 角色动态生成失败：`,
      error
    );
    return null;
  }
};

// NPC 偶发生活动态（该聊天窗下存在 NPC、30% 概率命中、且距上次 NPC 发帖超过 8 小时）
const tryPostForNpc = async (chat, character, now) => {
  try {
    const npcs = await getNpcsByChatId(chat.id);
    if (npcs.length === 0) return null;
    if (Math.random() >= NPC_TRIGGER_PROBABILITY) return null;

    const lastNpcPost = await db.snapshots
      .where('chatId')
      .equals(chat.id)
      .and((s) => s.authorType === 'npc')
      .last();

    if (lastNpcPost && now - lastNpcPost.timestamp <= NPC_POST_COOLDOWN_MS) {
      return null;
    }

    const pickedNpc = npcs[Math.floor(Math.random() * npcs.length)];

    const postData = await generateNpcPost(
      pickedNpc,
      chat.id,
      character?.name || '朋友',
      chat.userName || '常客'
    );

    const snapshotId = await db.snapshots.add({
      chatId: chat.id,
      authorType: 'npc',
      npcId: pickedNpc.id,
      authorName: pickedNpc.name,
      authorAvatar: '',
      mediaUrl: '',
      imagePrompt: postData.imagePrompt,
      content: postData.content,
      location: postData.location,
      likes: 0,
      isLiked: false,
      timestamp: now,
      createdAt: now
    });

    void triggerSystemNotification(
      `${pickedNpc.name} 发布了一条新动态`,
      getNotificationPreview(postData.content),
      ''
    );

    return snapshotId;
  } catch (error) {
    console.error(
      `[SnapshotGlobalScheduler] 聊天窗 ${chat.id} NPC 动态生成失败：`,
      error
    );
    return null;
  }
};

const processChat = async (chat, now) => {
  const character = chat.characterId
    ? await db.characters.get(chat.characterId)
    : null;

  // 角色和 NPC 各自独立判定，互不占用彼此的发帖机会。
  const charPostId = await tryPostForCharacter(chat, character, now);
  const npcPostId = await tryPostForNpc(chat, character, now);

  return [charPostId, npcPostId].filter(Boolean);
};

export const checkAndTriggerGlobalSnapshotPosts = async () => {
  if (isRunningCheck) return [];
  isRunningCheck = true;

  try {
    // 未配置 API 时不必逐个聊天窗尝试（避免刷一整页重复报错日志）。
    await getApiConfig();
  } catch (error) {
    console.log('[SnapshotGlobalScheduler] 跳过本轮：API 未配置。');
    isRunningCheck = false;
    return [];
  }

  try {
    const allChats = await db.chats.toArray();
    const now = Date.now();
    const posted = [];

    for (const chat of allChats) {
      const results = await processChat(chat, now);
      posted.push(...results);
    }

    return posted;
  } catch (error) {
    console.error('[SnapshotGlobalScheduler] 全局巡检失败：', error);
    return [];
  } finally {
    isRunningCheck = false;
  }
};

export const startSnapshotGlobalScheduler = () => {
  if (schedulerTimer) return;

  void checkAndTriggerGlobalSnapshotPosts();

  schedulerTimer = setInterval(() => {
    void checkAndTriggerGlobalSnapshotPosts();
  }, CHECK_INTERVAL_MS);
};

export const stopSnapshotGlobalScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};