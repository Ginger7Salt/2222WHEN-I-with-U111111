// src/apps/snapshots/services/snapshotRandomPostService.js
//
// 【新建文件说明】
// "让大家发点什么" 按钮的核心逻辑：
// 1. 候选池 = 该 chat 绑定的角色（若有）+ 该 chat 的所有 NPC，平铺成一个列表，
//    不强制包含角色。
// 2. 随机决定本次生成 2 条或 3 条（各 50% 概率）。
// 3. 从候选池中不重复随机抽样对应数量（池子不足则全部使用）。
// 4. 对每个被抽中的人调用对应的生成函数（角色用 generateCharacterPost，
//    NPC 用 generateNpcPost），两者都会带上剧情上下文。
// 5. 依次写入 db.snapshots，返回新增列表供 UI 刷新。
//
// 无冷却限制：按产品决定，用户点一次就跑一次，不做频率节流。
//
import db from '../../../db';
import { getNpcsByChatId } from './snapshotNpcService';
import { generateCharacterPost, generateNpcPost } from './snapshotAiService';

/**
 * 从数组中不重复随机抽取 n 个元素。
 */
const sampleWithoutReplacement = (arr, n) => {
  if (n >= arr.length) return [...arr];
  const pool = [...arr];
  const result = [];
  for (let i = 0; i < n; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
};

/**
 * 触发"让大家发点什么"：随机 2~3 位候选人各自生成一条动态并写入数据库。
 * 返回值: { posted: Array<插入的snapshot记录>, skipped: boolean, reason?: string }
 */
export const triggerRandomDailyPosts = async (chatId) => {
  if (!chatId) return { posted: [], skipped: true, reason: 'no_chat_id' };

  try {
    const numericChatId = Number(chatId);
    const chat = await db.chats.get(numericChatId);
    if (!chat) return { posted: [], skipped: true, reason: 'chat_not_found' };

    // 候选池：角色（若有） + 该 chat 的所有 NPC
    const pool = [];
    if (chat.characterId) {
      const char = await db.characters.get(Number(chat.characterId));
      if (char) {
        pool.push({ type: 'character', id: char.id, name: char.name, avatar: char.avatar || '' });
      }
    }

    const npcs = await getNpcsByChatId(numericChatId);
    npcs.forEach((npc) => {
      pool.push({ type: 'npc', id: npc.id, name: npc.name, roleTag: npc.roleTag, avatar: npc.avatar || '' });
    });

    if (pool.length === 0) {
      return { posted: [], skipped: true, reason: 'empty_pool' };
    }

    // 随机 2 或 3 条（50/50）
    const targetCount = Math.random() < 0.5 ? 2 : 3;
    const chosenOnes = sampleWithoutReplacement(pool, targetCount);

    const posted = [];
    const now = Date.now();

    for (const chosen of chosenOnes) {
      try {
        let postData;
        if (chosen.type === 'character') {
          postData = await generateCharacterPost(chosen.id, numericChatId);
        } else {
          postData = await generateNpcPost(
            chosen,
            numericChatId,
            chat.characterId ? (pool.find((p) => p.type === 'character')?.name || '') : '',
            chat.userName || 'User'
          );
        }

        const record = {
          chatId: numericChatId,
          authorType: chosen.type,
          characterId: chosen.type === 'character' ? chosen.id : null,
          npcId: chosen.type === 'npc' ? chosen.id : null,
          authorName: chosen.name,
          authorAvatar: chosen.avatar || '',
          mediaUrl: '',
          imagePrompt: postData.imagePrompt,
          content: postData.content,
          location: postData.location,
          likes: 0,
          isLiked: false,
          timestamp: now,
          createdAt: now
        };

        const newId = await db.snapshots.add(record);
        posted.push({ id: newId, ...record });
      } catch (err) {
        console.error(`[snapshotRandomPostService] ${chosen.name} 生成动态失败:`, err);
        // 单个失败不阻断其他候选人的生成
      }
    }

    return { posted, skipped: false };
  } catch (err) {
    console.error('[snapshotRandomPostService] 随机批量发帖失败:', err);
    return { posted: [], skipped: true, reason: 'error', error: err };
  }
};

export default {
  triggerRandomDailyPosts
};