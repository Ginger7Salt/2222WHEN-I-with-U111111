// src/apps/snapshots/services/snapshotSchedulerService.js
//
// 【整体替换说明】
// 相对旧版的改动：NPC 来源从全局 `db.snapshotSettings.get('npcs')`
// 改为按 chatId 专属的 `getNpcsByChatId(chatId)`；
// generateNpcPost 调用同步适配新签名 (npc, chatId, charName, userName)。
//
// 【2026-09 频率调整说明】
// 旧版：NPC 冷却 8 小时 + 全局只随机抽 1 个 NPC + 30% 概率命中一次。
// 新版：NPC 冷却缩到 4 小时（与 char 对齐），冷却按【每个 NPC 各自】的最后一次
// 发帖时间计算（不再是"该 chat 下任意 NPC 最后一次发帖"），且每个已过冷却的
// NPC 各自独立 roll 一次 60% 概率——同一轮巡检可以有多个 NPC 同时发新动态。
// 和 snapshotGlobalScheduler.js 保持同一套规则，两处重复实现属于本项目里
// 已有的"调度器各自独立成文件"惯例，不合并。
//
import db from '../../../db';
import { generateCharacterPost, generateNpcPost } from './snapshotAiService';
import { getNpcsByChatId } from './snapshotNpcService';

class SnapshotScheduler {
  constructor() {
    this.timer = null;
    this.activeChatId = null;
    this.listeners = new Set();
    this.isRunningCheck = false;
  }

  start(chatId) {
    const nextChatId = chatId ? Number(chatId) : null;
    if (this.activeChatId === nextChatId && this.timer) {
      return; // 已经在跑当前 Chat，不重复启动
    }

    this.activeChatId = nextChatId;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.activeChatId) return;

    // 每 2 分钟巡检一次发帖条件
    this.timer = setInterval(() => {
      this.checkAndTrigger();
    }, 2 * 60 * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.activeChatId = null;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (e) {
        console.error('[SnapshotScheduler] 订阅回调异常:', e);
      }
    });
  }

  async checkAndTrigger() {
    if (!this.activeChatId || this.isRunningCheck) return;
    this.isRunningCheck = true;

    try {
      const chat = await db.chats.get(this.activeChatId);
      if (!chat) return;

      const char = chat.characterId ? await db.characters.get(chat.characterId) : null;
      const now = Date.now();

      // 1. 检查 Char 是否该主动发生活动态 (角色开启了主动消息，冷却 4 小时)
      if (char && char.isAutoMessageActive) {
        const lastCharPost = await db.snapshots
          .where('chatId')
          .equals(this.activeChatId)
          .and(s => s.characterId === char.id && s.authorType === 'character')
          .last();

        if (!lastCharPost || now - lastCharPost.timestamp > 4 * 60 * 60 * 1000) {
          const postData = await generateCharacterPost(char.id, this.activeChatId);
          await db.snapshots.add({
            chatId: this.activeChatId,
            authorType: 'character',
            characterId: char.id,
            authorName: char.name,
            authorAvatar: char.avatar || '',
            mediaUrl: '',
            imagePrompt: postData.imagePrompt,
            content: postData.content,
            location: postData.location,
            likes: 1,
            isLiked: false,
            timestamp: now,
            createdAt: now
          });
          this.notify();
          return; // 本次轮询已发，结束本次检查
        }
      }

      // 2. 检查 NPC 是否偶发生活动态
      // 冷却 4 小时，每个已过冷却的 NPC 各自独立 60% 概率触发，
      // 同一轮巡检可以有多个 NPC 同时发帖。
      const npcs = await getNpcsByChatId(this.activeChatId);
      let hasNpcPosted = false;

      for (const npc of npcs) {
        const lastNpcPost = await db.snapshots
          .where('chatId')
          .equals(this.activeChatId)
          .and(s => s.authorType === 'npc' && s.npcId === npc.id)
          .last();

        const offCooldown = !lastNpcPost || now - lastNpcPost.timestamp > 4 * 60 * 60 * 1000;
        if (!offCooldown) continue;

        if (Math.random() >= 0.6) continue;

        try {
          const postData = await generateNpcPost(
            npc,
            this.activeChatId,
            char?.name || '朋友',
            chat.userName || '常客'
          );

          await db.snapshots.add({
            chatId: this.activeChatId,
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
          hasNpcPosted = true;
        } catch (err) {
          console.error(`[SnapshotScheduler] NPC(${npc.name}) 动态生成失败:`, err);
        }
      }

      if (hasNpcPosted) {
        this.notify();
      }
    } catch (err) {
      console.error('[SnapshotScheduler] 调度检查异常:', err);
    } finally {
      this.isRunningCheck = false;
    }
  }
}

export const snapshotScheduler = new SnapshotScheduler();