// src/apps/rp/rpWorldBookService.js
//
// 长RP子应用切片E：世界书系统。
//
// 跟你确认过的两点：
// 1. 条目颗粒度对标SillyTavern——每条世界书都有自己的关键词，靠关键词
//    命中才注入，不是像 db.worldBooks（线上聊天用的那张表）那样整本无
//    条件塞进提示词。
// 2. 一本书的所有条目内嵌存成 rpWorldBooks 记录上的 entries 数组字段
//    （照抄 rpPresets.prompts 那套写法），不单独建 rpWorldBookEntries
//    表——数据量不大的时候，少一张表、少一次join，编辑器写起来也更简单，
//    entries数组本来就没有跨表查询/索引的需求。
//
// 世界书是一个跟角色/会话都不绑定的共享库（照抄现有 db.worldBooks 库的
// 定位）——一本书可以被挂到任意数量的长RP会话上（session.
// attachedWorldBookIds 是数组），一个会话也可以同时挂多本书。

import db from '../../db';

/**
 * 按更新时间倒序，取所有世界书列表。
 */
export const getAllRpWorldBooks = async () => {
  try {
    return await db.rpWorldBooks.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    console.error('[rpWorldBookService] 获取世界书列表失败:', err);
    return [];
  }
};

export const getRpWorldBookById = async (worldBookId) => {
  if (worldBookId === null || worldBookId === undefined) return null;
  try {
    return await db.rpWorldBooks.get(Number(worldBookId));
  } catch (err) {
    console.error('[rpWorldBookService] 获取世界书详情失败:', err);
    return null;
  }
};

/**
 * 新建一本世界书。不传 entries 的话给一条示例条目起步（跟预设"给合理
 * 默认骨架而不是空数组"是同一个考虑——一片空白不知道从哪下手）。
 */
export const createRpWorldBook = async ({ name, entries } = {}) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return null;

  const finalEntries = Array.isArray(entries) && entries.length > 0
    ? entries
    : [{
      id: `wbe-${Date.now()}`,
      keywords: [],
      content: '',
      enabled: true,
    }];

  try {
    const now = Date.now();
    return await db.rpWorldBooks.add({
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      entries: finalEntries,
    });
  } catch (err) {
    console.error('[rpWorldBookService] 创建世界书失败:', err);
    return null;
  }
};

/**
 * 整体覆盖式更新（name/entries 任意子集）——编辑器每次保存传完整的
 * entries 数组，不做增量patch，跟预设编辑器是同一个思路。
 */
export const updateRpWorldBook = async (worldBookId, patch) => {
  if (worldBookId === null || worldBookId === undefined) return;
  try {
    await db.rpWorldBooks.update(Number(worldBookId), {
      ...patch,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[rpWorldBookService] 更新世界书失败:', err);
  }
};

/**
 * 删除一本世界书。正在挂着这本书的会话不会被连带处理——它们的
 * attachedWorldBookIds 里会留一个指向已删除书的id，扫描函数会自己跳过
 * 找不到的书（静默退回，不报错），这跟预设删除后会话静默退回是同一个
 * 简化。
 */
export const deleteRpWorldBook = async (worldBookId) => {
  if (worldBookId === null || worldBookId === undefined) return;
  try {
    await db.rpWorldBooks.delete(Number(worldBookId));
  } catch (err) {
    console.error('[rpWorldBookService] 删除世界书失败:', err);
  }
};

/**
 * 扫描 + 命中 + 拼装成一段可以直接塞进system prompt的文本。
 *
 * - scanText：从最近几条消息拼出来的一段文本，调用方（rpAiService）负责
 *   截取"最近几条"这个窗口，这个函数只管在给定文本里找关键词。
 * - 关键词匹配：纯文本包含、大小写不敏感（跟你确认过不需要正则关键词）。
 * - 多本书的条目汇总在一起按 maxEntries 总数上限截取，不是每本书各自
 *   限额——书之间没有优先级之分，先到先得（按书的顺序、书内条目的顺序）。
 * - 被禁用的条目（entry.enabled === false）直接跳过。
 */
export const scanRpWorldBooks = async (attachedWorldBookIds, scanText, { maxEntries = 5 } = {}) => {
  if (!Array.isArray(attachedWorldBookIds) || attachedWorldBookIds.length === 0) return '';
  const text = String(scanText || '').toLowerCase();
  if (!text) return '';

  try {
    const books = await db.rpWorldBooks
      .where('id')
      .anyOf(attachedWorldBookIds.map(Number))
      .toArray();

    const matched = [];

    for (const book of books) {
      for (const entry of (book.entries || [])) {
        if (matched.length >= maxEntries) break;
        if (entry.enabled === false) continue;
        if (!entry.content) continue;

        const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];
        const hit = keywords.some((kw) => kw && text.includes(String(kw).toLowerCase()));
        if (hit) matched.push(entry);
      }
      if (matched.length >= maxEntries) break;
    }

    if (matched.length === 0) return '';

    return `【相关背景设定】\n${matched.map((e) => `- ${e.content}`).join('\n')}`;
  } catch (err) {
    console.error('[rpWorldBookService] 扫描世界书失败:', err);
    return '';
  }
};

export default {
  getAllRpWorldBooks,
  getRpWorldBookById,
  createRpWorldBook,
  updateRpWorldBook,
  deleteRpWorldBook,
  scanRpWorldBooks,
};