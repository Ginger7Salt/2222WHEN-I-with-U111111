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
// 各自独立 roll 一次 70% 概率——判定资格是"各自独立"的，更接近真实生活圈的感觉。
//
// 【2026-09 发烫/卡顿修复说明，见下方 MAX_POSTS_PER_ROUND】
// 但"判定资格独立"不等于"执行也要一起挤在同一轮"——用户反馈只要命中，
// 所有消息框的char/npc会在同一轮里一起触发发帖，引发手机发烫卡顿。
// 现在加了一个跨越本轮【所有chat】的全局预算：一轮巡检最多实际执行
// MAX_POSTS_PER_ROUND 次发帖（char+npc+news合计），预算内正常按上面的
// 冷却+概率判定，一旦预算耗尽，本轮巡检直接提前结束（还没轮到的chat/npc
// 冷却不会被消耗，只是错开到下一轮15分钟后重新判定），把原本堆积在
// 一轮里的AI请求量摊薄到多轮。
import db from '../../../db';
import {
  generateCharacterPost, generateNpcPost, generateNewsPost, NEWS_ACCOUNT, getApiConfig
} from './snapshotAiService';
import { getNpcsByChatId, ensureAutoNpcPool, ensureNpcPersona, isNpcAutoPostEnabled } from './snapshotNpcService';
import { autoGenerateNpcComments } from './snapshotAutoCommentService';
import { triggerSystemNotification } from '../../../services/aiService';
import { pickDailyLifeTopic, describeDailyLifeTopicAsHint } from '../../../services/dailyLifeTopicPicker';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CHAR_POST_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const NPC_POST_COOLDOWN_MS = 4 * 60 * 60 * 1000;
// 2026-09 频率调整：60% -> 70%，冷却时间不变，用户反馈NPC发帖还是太少。
const NPC_TRIGGER_PROBABILITY = 0.7;
const NEWS_POST_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const NEWS_TRIGGER_PROBABILITY = 0.5;

// 2026-09 发烫/卡顿修复：这个调度器一轮要遍历数据库里【所有】聊天窗，
// 之前每个chat下符合条件的char/npc都会在同一轮里连续触发，chat一多、
// NPC一多，一轮巡检堆起来可能是几十次连续AI请求。这里给"整轮巡检、
// 跨所有chat"设一个总预算——用完就提前结束本轮（不是提前结束某个chat，
// 是直接不再处理后面的chat），下一轮（15分钟后）再继续。budget是一个
// 跨函数共享的可变对象（{remaining}），因为要在processChat内部的
// 多个小函数之间实时扣减、实时判断是否还有余量。
const MAX_POSTS_PER_ROUND = 3;

let schedulerTimer = null;
let isRunningCheck = false;

const getNotificationPreview = (content = '') => {
  const normalized = String(content).replace(/\s+/g, ' ').trim();
  return normalized.length <= 52 ? normalized : `${normalized.slice(0, 52)}…`;
};

// 角色主动发一条生活动态（该聊天窗对应角色开启了主动消息、且距上次角色发帖超过 4 小时）
const tryPostForCharacter = async (chat, character, now, budget) => {
  if (!character || character.isAutoMessageActive === false) return null;
  if (budget.remaining <= 0) return null;

  try {
    const lastCharPost = await db.snapshots
      .where('chatId')
      .equals(chat.id)
      .and((s) => s.characterId === character.id && s.authorType === 'character')
      .last();

    if (lastCharPost && now - lastCharPost.timestamp <= CHAR_POST_COOLDOWN_MS) {
      return null;
    }

    const topicHint = describeDailyLifeTopicAsHint(await pickDailyLifeTopic(chat.id));
    const postData = await generateCharacterPost(character.id, chat.id, topicHint);

    const record = {
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
    };
    const snapshotId = await db.snapshots.add(record);
    const fullRecord = { id: snapshotId, ...record };
    budget.remaining -= 1;

    void triggerSystemNotification(
      `${character.name} 发布了一条新动态`,
      getNotificationPreview(postData.content),
      character.avatar
    );

    // 只有后台调度器自动发的角色动态才自动配NPC评论——这里正是这种场景。
    await autoGenerateNpcComments(chat.id, fullRecord, { type: 'character', id: character.id });

    return fullRecord;
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

const postNpcSnapshot = async (chat, character, npc, now, budget) => {
  try {
    const npcWithPersona = await ensureNpcPersona(npc, character);
    const postData = await generateNpcPost(
      npcWithPersona,
      chat.id,
      character?.name || '朋友',
      chat.userName || '常客'
    );

    const record = {
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
    };
    const snapshotId = await db.snapshots.add(record);
    const fullRecord = { id: snapshotId, ...record };
    budget.remaining -= 1;

    void triggerSystemNotification(
      `${npc.name} 发布了一条新动态`,
      getNotificationPreview(postData.content),
      ''
    );

    // NPC自己发的帖子也一起配自动评论（跟用户确认过的范围）。
    await autoGenerateNpcComments(chat.id, fullRecord, { type: 'npc', id: npc.id });

    return fullRecord;
  } catch (error) {
    console.error(
      `[SnapshotGlobalScheduler] 聊天窗 ${chat.id} NPC(${npc.name}) 动态生成失败：`,
      error
    );
    return null;
  }
};

// NPC 偶发生活动态：该聊天窗下每一个已过冷却（4 小时）的 NPC，各自独立
// 70% 概率判定是否发帖，但受本轮全局预算限制——预算用完就停止，
// 跳过的NPC冷却没被消耗，下一轮还会正常参与判定。
const tryPostForNpc = async (chat, character, now, budget, npcAutoPostEnabled) => {
  if (!npcAutoPostEnabled) return [];
  if (budget.remaining <= 0) return [];
  const npcs = await getNpcsByChatId(chat.id);
  if (npcs.length === 0) return [];

  const posted = [];

  for (const npc of npcs) {
    if (budget.remaining <= 0) break;

    const offCooldown = await isNpcOffCooldown(chat, npc, now);
    if (!offCooldown) continue;

    if (Math.random() >= NPC_TRIGGER_PROBABILITY) continue;

    const record = await postNpcSnapshot(chat, character, npc, now, budget);
    if (record) posted.push(record);
  }

  return posted;
};

// 本地生活速报（虚构媒体账号）：跟角色/NPC各自独立判定，每个chat自己的
// 冷却（6小时）+ 50%概率，不占用角色/NPC的发帖机会。
const isNewsOffCooldown = async (chat, now) => {
  const lastNewsPost = await db.snapshots
    .where('chatId')
    .equals(chat.id)
    .and((s) => s.authorType === 'news')
    .last();

  return !lastNewsPost || now - lastNewsPost.timestamp > NEWS_POST_COOLDOWN_MS;
};

const tryPostForNews = async (chat, now, budget) => {
  if (budget.remaining <= 0) return null;

  const offCooldown = await isNewsOffCooldown(chat, now);
  if (!offCooldown) return null;
  if (Math.random() >= NEWS_TRIGGER_PROBABILITY) return null;

  try {
    const postData = await generateNewsPost(chat.id);
    const record = {
      chatId: chat.id,
      authorType: 'news',
      characterId: null,
      npcId: null,
      authorName: NEWS_ACCOUNT.name,
      authorAvatar: NEWS_ACCOUNT.avatar,
      mediaUrl: '',
      imagePrompt: postData.imagePrompt,
      content: postData.content,
      location: postData.location,
      likes: 0,
      isLiked: false,
      timestamp: now,
      createdAt: now
    };
    const snapshotId = await db.snapshots.add(record);
    budget.remaining -= 1;

    void triggerSystemNotification(
      `${NEWS_ACCOUNT.name} 发布了一条新资讯`,
      getNotificationPreview(postData.content),
      ''
    );

    return { id: snapshotId, ...record };
  } catch (error) {
    console.error(`[SnapshotGlobalScheduler] 聊天窗 ${chat.id} 新闻速报生成失败：`, error);
    return null;
  }
};

const processChat = async (chat, now, budget, npcAutoPostEnabled) => {
  const character = chat.characterId
    ? await db.characters.get(chat.characterId)
    : null;

  // 这个chat要是从来没有NPC（用户没手动加，也没自动补过），先补一次
  // （只补这一次，见 snapshotNpcService.ensureAutoNpcPool 的注释）。
  await ensureAutoNpcPool(chat.id, character, chat);

  // 角色 / NPC / 本地资讯速报 各自独立判定，互不占用彼此的发帖机会，
  // 但共同消耗同一份跨chat的全局预算（budget）。
  const charPost = await tryPostForCharacter(chat, character, now, budget);
  const npcPosts = await tryPostForNpc(chat, character, now, budget, npcAutoPostEnabled);
  const newsPost = await tryPostForNews(chat, now, budget);

  return [charPost, ...npcPosts, newsPost].filter(Boolean);
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
    const budget = { remaining: MAX_POSTS_PER_ROUND };
    const npcAutoPostEnabled = await isNpcAutoPostEnabled();

    for (const chat of allChats) {
      if (budget.remaining <= 0) break;
      const results = await processChat(chat, now, budget, npcAutoPostEnabled);
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