/**
 * badgeService.js
 *
 * 「连续天数收藏卡片」首次解锁要不要弹庆祝动画的状态读写。
 *
 * 不新建 Dexie 表——直接在 companion 记录上加一个数组字段
 * seenBadgeMilestones，跟 companionService.js 里 firedMilestoneEventIds /
 * unlockedRareFoodIds 的做法完全一致：Dexie 不要求在 db.version() 里
 * 预先声明非索引字段，给 companion 对象加一个新字段不需要新建表、
 * 也不需要迁移脚本。
 *
 * seenBadgeMilestones 只记"庆祝动画弹过没有"，不是"解锁了没有"——
 * 解不解锁完全由当前连续天数实时比较（streakCount >= 门槛天数）算出来，
 * 不存在这个字段里，避免两处状态不同步。
 */

import { db } from '../../../db/index';

export async function getSeenBadgeMilestones(companionId) {
  if (!companionId) return [];
  const companion = await db.companions.get(companionId);
  return companion?.seenBadgeMilestones || [];
}

/**
 * 把一批天数门槛标记为"庆祝动画已经弹过"，去重后写回。
 * @param {number} companionId
 * @param {number[]} days 这次要标记为"已看过"的门槛天数列表
 */
export async function markBadgeMilestonesSeen(companionId, days) {
  if (!companionId || !days || days.length === 0) return;

  const companion = await db.companions.get(companionId);
  if (!companion) return;

  const next = new Set(companion.seenBadgeMilestones || []);
  days.forEach((d) => next.add(d));

  await db.companions.update(companionId, {
    seenBadgeMilestones: Array.from(next).sort((a, b) => a - b),
    updatedAt: Date.now(),
  });
}