// src/apps/snapshots/services/snapshotGlobalScheduler.js
//
// 【新建文件说明】
// 让 char / npc 的动态发布不再依赖 SnapshotsApp 页面是否打开。
// 参考项目里已有的 offlineSessionScheduler.js / travelPostcardScheduler.js 的写法：
// 独立文件、独立 setInterval，在 App.jsx 里和 startAutoMessageScheduler() 一起启动。
//
// 和旧的 snapshotSchedulerService.js（只盯当前打开的一个 chatId）不同，
// 这里每次巡检会遍历数据库里【所有】聊天窗，逐个按角色 4 小时冷却 /
// NPC 4 小时冷却 + 每个 NPC 独立 60% 概率的规则判断是否该发一条新动态。
//
// 说明：这里沿用角色的 isAutoMessageActive 字段作为唯一开关（和旧版 snapshotSchedulerService.js
// 一致），不接入 SettingsPage 里"全局主动消息"总开关，也不接入免打扰时段——这是你在这次澄清里选择的行为。
//
// 【2026-09 频率调整说明】
// 旧版：NPC 冷却 8 小时 + 全局只随机抽 1 个 NPC + 30% 概率命中一次。
// 新版：NPC 冷却缩到 4 小时（与 char 对齐），冷却改为按【每个 NPC 各自】计算
// （而不是"该 chat 下任意 NPC 最后一次发帖"这种全局冷却），且每个已过冷却的 NPC
// 各自独立 roll 一次 60% 概率——同一轮巡检里，运气好可以有多个 NPC 同时发新动态，
// 更接近真实生活圈的感觉。
import db from '../../../db';
import { generateCharacterPost, generateNpcPost, getApiConfig } from './snapshotAiService';
import { getNpcsByChatId } from './snapshotNpcService';
import { triggerSystemNotification } from '../../../services/aiService';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CHAR_POST_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const NPC_POST_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const NPC_TRIGGER_PROBABILITY = 0.6;

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

// 单个 NPC 距其上一次发帖是否已经过了冷却时间（注意：是这个 NPC 自己的最后一次
// 发帖时间，不是"该 chat 下任意 NPC"的最后一次发帖时间——这样才能让多个 NPC
// 互不占用彼此的冷却名额）。
const isNpcOffCooldown = async (chat, npc, now) => {
  const lastNpcPost = await db.snapshots
    .where('chatId')
    .equals(chat.id)
    .and((s) => s.authorType === 'npc' && s.npcId === npc.id)
    .last();

  return !lastNpcPost || now - lastNpcPost.timestamp > NPC_POST_COOLDOWN_MS;
};

const postNpcSnapshot = async (chat, character, npc, now) => {
  try {
    const postData = await generateNpcPost(
      npc,
      chat.id,
      character?.name || '朋友',
      chat.userName || '常客'
    );

    const snapshotId = await db.snapshots.add({
      chatId: chat.id,
      authorType: 'npc',
      npcId: npc.id,
      authorName: npc.name,
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
      `${npc.name} 发布了一条新动态`,
      getNotificationPreview(postData.content),
      ''
    );

    return snapshotId;
  } catch (error) {
    console.error(
      `[SnapshotGlobalScheduler] 聊天窗 ${chat.id} NPC(${npc.name}) 动态生成失败：`,
      error
    );
    return null;
  }
};

// NPC 偶发生活动态：该聊天窗下每一个已过冷却（4 小时）的 NPC，各自独立
// 60% 概率判定是否发帖——同一轮巡检里可以有多个 NPC 同时发。
const tryPostForNpc = async (chat, character, now) => {
  const npcs = await getNpcsByChatId(chat.id);
  if (npcs.length === 0) return [];

  const postedIds = [];

  for (const npc of npcs) {
    const offCooldown = await isNpcOffCooldown(chat, npc, now);
    if (!offCooldown) continue;

    if (Math.random() >= NPC_TRIGGER_PROBABILITY) continue;

    const snapshotId = await postNpcSnapshot(chat, character, npc, now);
    if (snapshotId) postedIds.push(snapshotId);
  }

  return postedIds;
};

const processChat = async (chat, now) => {
  const character = chat.characterId
    ? await db.characters.get(chat.characterId)
    : null;

  // 角色和 NPC 各自独立判定，互不占用彼此的发帖机会。
  const charPostId = await tryPostForCharacter(chat, character, now);
  const npcPostIds = await tryPostForNpc(chat, character, now);

  return [charPostId, ...npcPostIds].filter(Boolean);
};

export const checkAndTriggerGlobalSnapshotPosts = async (providedChats = null) => {
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
    // globalChatScheduler.js 会传入已经查好的 chats 数组；单独调用时
    // 不传，还是自己查一次，行为不变。
    const allChats = providedChats || (await db.chats.toArray());
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