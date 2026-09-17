// src/apps/snapshots/services/snapshotCleanupService.js
//
// 【新建文件说明】
// 按 chatId 隔离的自动清理逻辑：
// 1. 过期规则：超过 7 天（无豁免，无论是否被点赞/评论）直接删除
// 2. 数量规则：清理完过期数据后，若剩余仍 > 30 条，按时间从旧到新继续删至 30 条
// 3. 两条规则独立生效，互不依赖先后顺序，最终结果一致
// 4. 删除动态时级联删除其所有评论
// 5. 用 snapshotSettings 里的 `lastCleanup_${chatId}` 做 24 小时节流，避免频繁全表扫描
//
import db from '../../../db';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SNAPSHOTS_PER_CHAT = 30;
const CLEANUP_THROTTLE_MS = 24 * 60 * 60 * 1000;

/**
 * 删除一批 snapshot 及其关联的评论。
 */
const deleteSnapshotsWithComments = async (snapshotIds) => {
  if (!snapshotIds || snapshotIds.length === 0) return;

  await db.transaction('rw', db.snapshots, db.snapshotComments, async () => {
    for (const id of snapshotIds) {
      await db.snapshotComments.where('snapshotId').equals(id).delete();
    }
    await db.snapshots.bulkDelete(snapshotIds);
  });
};

/**
 * 对指定 chatId 执行一次清理检查（内部不做节流判断，节流由 runSnapshotCleanup 控制）。
 * 返回本次实际删除的 snapshot 数量。
 */
const doCleanup = async (chatId) => {
  const numericChatId = Number(chatId);
  const now = Date.now();

  const all = await db.snapshots
    .where('chatId')
    .equals(numericChatId)
    .toArray();

  if (all.length === 0) return 0;

  const toDeleteIds = new Set();

  // ---- 规则 1：过期删除（无豁免） ----
  for (const snap of all) {
    const ts = snap.timestamp || snap.createdAt || 0;
    if (now - ts > SEVEN_DAYS_MS) {
      toDeleteIds.add(snap.id);
    }
  }

  // ---- 规则 2：数量上限（基于过期规则处理后的剩余集合） ----
  const remaining = all
    .filter((snap) => !toDeleteIds.has(snap.id))
    .sort((a, b) => (a.timestamp || a.createdAt || 0) - (b.timestamp || b.createdAt || 0));

  if (remaining.length > MAX_SNAPSHOTS_PER_CHAT) {
    const overflowCount = remaining.length - MAX_SNAPSHOTS_PER_CHAT;
    for (let i = 0; i < overflowCount; i += 1) {
      toDeleteIds.add(remaining[i].id);
    }
  }

  const idsArray = Array.from(toDeleteIds);
  if (idsArray.length > 0) {
    await deleteSnapshotsWithComments(idsArray);
  }

  return idsArray.length;
};

/**
 * 对外入口：按 chatId 触发一次清理检查，内部做 24 小时节流。
 * 建议在进入/切换到某个 chatId 时调用。
 */
export const runSnapshotCleanup = async (chatId) => {
  if (!chatId) return { skipped: true, reason: 'no_chat_id' };

  try {
    const numericChatId = Number(chatId);
    const throttleKey = `lastCleanup_${numericChatId}`;
    const lastRecord = await db.snapshotSettings.get(throttleKey);
    const lastRunAt = lastRecord?.value || 0;
    const now = Date.now();

    if (now - lastRunAt < CLEANUP_THROTTLE_MS) {
      return { skipped: true, reason: 'throttled' };
    }

    const deletedCount = await doCleanup(numericChatId);

    await db.snapshotSettings.put({ key: throttleKey, value: now });

    return { skipped: false, deletedCount };
  } catch (err) {
    console.error('[snapshotCleanupService] 清理执行失败:', err);
    return { skipped: true, reason: 'error', error: err };
  }
};

export default {
  runSnapshotCleanup
};