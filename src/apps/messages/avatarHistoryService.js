// src/apps/messages/avatarHistoryService.js
//
// 角色头像历史相册的数据层（对应待办 3 后半段，v66 新增
// db.characterAvatarHistory 表）。范围只覆盖角色头像
// （characters.avatar），不管聊天背景/该角色的用户人设头像——
// 这个范围是跟用户确认过的。
//
// 两条使用路径共用这里的基础函数：
// 1. 手动路径：CharacterEditor.jsx 里的"历史相册"入口——用户选一张
//    旧图预览后，要点"保存"才真正生效（草稿态），具体的"点保存时才
//    记录旧图/消费历史条目"逻辑写在 CharacterEditor.jsx 里，这里只
//    提供 recordAvatarHistory / deleteAvatarHistoryEntry / getAvatarHistory
//    这几个原子操作。
// 2. AI 自主路径：avatarHistoryDirective.js 里一步到位的
//    switchToRandomHistoricalAvatar，没有"草稿态"，AI 一旦决定换就
//    直接落库生效。

import db from '../../db';

// 每个角色最多保留这么多张历史头像，超出的按时间顺序淘汰最旧的——
// 头像是大段 base64，攒太多容易把 IndexedDB 占用堆起来。
const MAX_HISTORY_PER_CHARACTER = 24;

/*
 * 把一张"即将被替换掉"的旧头像记进历史相册。
 * 调用方负责判断"这张图是不是真的要被替换掉的旧图"（比如
 * CharacterEditor.jsx 只在真的换了新头像且旧头像非空时才调用）。
 */
export const recordAvatarHistory = async (characterId, avatarDataUrl) => {
  if (!characterId || !avatarDataUrl) return;

  try {
    await db.characterAvatarHistory.add({
      characterId,
      avatar: avatarDataUrl,
      createdAt: Date.now(),
    });

    const all = await db.characterAvatarHistory
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');

    if (all.length > MAX_HISTORY_PER_CHARACTER) {
      const overflow = all.slice(0, all.length - MAX_HISTORY_PER_CHARACTER);
      await db.characterAvatarHistory.bulkDelete(overflow.map((item) => item.id));
    }
  } catch (error) {
    console.error('[AvatarHistory] 记录历史头像失败:', error);
  }
};

/*
 * 取某个角色的历史头像列表，按时间倒序（最近换掉的排最前面）。
 */
export const getAvatarHistory = async (characterId) => {
  if (!characterId) return [];

  try {
    const list = await db.characterAvatarHistory
      .where('characterId')
      .equals(characterId)
      .toArray();

    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error) {
    console.error('[AvatarHistory] 读取历史头像失败:', error);
    return [];
  }
};

/*
 * 彻底删除一条历史头像记录（不可恢复）。
 */
export const deleteAvatarHistoryEntry = async (historyId) => {
  if (!Number.isFinite(Number(historyId))) return;

  try {
    await db.characterAvatarHistory.delete(Number(historyId));
  } catch (error) {
    console.error('[AvatarHistory] 删除历史头像失败:', error);
  }
};

/*
 * AI 自主换头像专用：从这个角色的历史相册里随机挑一张换成当前头像，
 * 一步到位（没有草稿态）：
 * 1. 把当前头像存进历史相册（这样"现在这张"以后也能被翻回来）；
 * 2. 把选中的历史条目从相册里移除（它现在是"在用"的头像，不再是历史）；
 * 3. 更新 characters.avatar。
 *
 * 相册为空、或角色不存在时返回 null（调用方据此决定不生效）。
 */
export const switchToRandomHistoricalAvatar = async (characterId) => {
  if (!characterId) return null;

  try {
    const character = await db.characters.get(characterId);
    if (!character) return null;

    const history = await getAvatarHistory(characterId);
    if (history.length === 0) return null;

    const picked = history[Math.floor(Math.random() * history.length)];
    if (!picked?.avatar) return null;

    const previousAvatar = character.avatar || '';

    await db.characters.update(characterId, { avatar: picked.avatar });
    await db.characterAvatarHistory.delete(picked.id);

    if (previousAvatar) {
      await recordAvatarHistory(characterId, previousAvatar);
    }

    return picked.avatar;
  } catch (error) {
    console.error('[AvatarHistory] AI 自主切换历史头像失败:', error);
    return null;
  }
};

export default {
  recordAvatarHistory,
  getAvatarHistory,
  deleteAvatarHistoryEntry,
  switchToRandomHistoricalAvatar,
};