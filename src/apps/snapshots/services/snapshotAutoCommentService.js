// src/apps/snapshots/services/snapshotAutoCommentService.js
//
// 【新建文件说明】
// 只给"后台调度器自动发的"角色/NPC动态配 1~3 条NPC评论，让生活圈显得更
// 热闹有人气。手动点"让大家发点什么"、用户自己发的帖子、
// CreateSnapshotModal 里手动发的帖子都不会触发这个——这是跟用户确认过的
// 范围（不是所有发帖场景都自动配评论）。
//
// 独立成一个文件是为了避开循环引用：snapshotNpcService.js 需要引用
// snapshotAiService.js 的 extractOrInventNpcs（自动补NPC那部分），如果反过来
// 又让 snapshotAiService.js 引用 snapshotNpcService.js 的 getNpcsByChatId，
// 会形成 A -> B -> A 的循环 import。这个新文件两边都要用，放第三个文件里
// 最干净，snapshotGlobalScheduler.js / snapshotSchedulerService.js 直接调用
// 这里的 autoGenerateNpcComments 即可。
//
import db from '../../../db';
import { getNpcsByChatId, ensureNpcPersona } from './snapshotNpcService';
import { generateSnapshotComment } from './snapshotAiService';

/**
 * 从数组中不重复随机抽取 n 个元素（跟 snapshotRandomPostService.js 里
 * 那个是同一个实现，量太小不值得单独抽公共文件）。
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
 * 给一条刚由后台调度器发出的角色/NPC动态配 1~3 条NPC评论。
 * snapshot: 完整的动态记录（至少要有 id + 生成评论要用到的
 *   authorName/imagePrompt/content/location/authorType/characterId/npcId）。
 * posterEntity: { type: 'character'|'npc', id } —— 这条动态的作者，
 *   评论人选池要排除TA自己（NPC不会在自己发的帖子底下自己评论自己）。
 */
export const autoGenerateNpcComments = async (chatId, snapshot, posterEntity) => {
  if (!chatId || !snapshot) return;

  try {
    const numericChatId = Number(chatId);
    const npcs = await getNpcsByChatId(numericChatId);
    const candidates = npcs.filter(
      (npc) => !(posterEntity?.type === 'npc' && Number(npc.id) === Number(posterEntity.id))
    );
    if (candidates.length === 0) return;

    // 拿角色人设，供 ensureNpcPersona 在还没固化人设的NPC身上生成一次
    // 独立于char的说话风格（见 snapshotNpcService.ensureNpcPersona 的注释，
    // 这是修"NPC评论容易被char夺舍/OOC"问题的一部分）。
    const chat = await db.chats.get(numericChatId);
    const character = chat?.characterId ? await db.characters.get(chat.characterId) : null;

    // 1~3条，池子不够就有多少发多少
    const targetCount = Math.min(candidates.length, 1 + Math.floor(Math.random() * 3));
    const chosenOnes = sampleWithoutReplacement(candidates, targetCount);

    for (const npc of chosenOnes) {
      try {
        const npcWithPersona = await ensureNpcPersona(npc, character);
        const commentText = await generateSnapshotComment(
          snapshot,
          { type: 'npc', id: npcWithPersona.id, name: npcWithPersona.name, roleTag: npcWithPersona.roleTag, personaSummary: npcWithPersona.personaSummary },
          numericChatId
        );

        if (commentText) {
          await db.snapshotComments.add({
            snapshotId: snapshot.id,
            chatId: numericChatId,
            senderType: 'npc',
            characterId: null,
            npcId: npc.id,
            senderName: npc.name,
            roleTag: npc.roleTag || '街区邻里',
            senderAvatar: '',
            content: commentText,
            createdAt: Date.now()
          });
        }
      } catch (err) {
        console.error(`[snapshotAutoCommentService] NPC(${npc.name}) 自动评论失败:`, err);
        // 单条评论失败不阻断其他NPC的评论
      }
    }
  } catch (err) {
    console.error('[snapshotAutoCommentService] 自动配评论失败:', err);
  }
};

export default {
  autoGenerateNpcComments
};