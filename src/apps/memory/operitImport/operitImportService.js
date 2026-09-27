// Operit 记忆归档导入 - 一次性文件导入，不做文件夹监听/自动同步。
//
// Operit 是另一个 AI 助手 App，它自己的记忆导出格式（operit_memory_archive）
// 是一份扁平的记忆列表，不绑定到本项目的任何消息框，也没有本项目的
// type/importance/confidence 这些字段。整体做法照抄 obsidianImportService.js
// 的骨架：parseOperitArchiveFile() 只负责读文件+校验+分组，
// importOperitEntries() 才真正调用本项目现成的 memoryService.js 的
// createMemory/updateMemory 写入，和普通新增记忆走同一套逻辑与副作用
// （记忆修订记录等），没有另起一条写入路径。
//
// 去重/重复导入：Operit 的每条记忆自带稳定的 id 字段，直接用
// `operit::<id>` 作为去重 key（存成 operitKey 这个新增字段，写法与
// obsidianImportService.js 的 obsidianKey 完全一致：db 表不需要迁移，
// 只是给命中的记录 modify 一个新字段）。同一份归档文件重复导入、
// 或者 Operit 那边更新后重新导出再导入，都会更新已有记忆而不是重复新增。

import db from '../../../db';
import { createMemory, updateMemory } from '../memoryService';
import {
  MEMORY_CONFIDENCES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES
} from '../memoryConstants';

export const OPERIT_ARCHIVE_TYPE = 'operit_memory_archive';

const cleanText = (value) => String(value || '').trim();

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeTags = (tags) => (
  asArray(tags)
    .map((tag) => cleanText(tag))
    .filter(Boolean)
);

const buildFallbackTitle = (content) => {
  const firstLine = cleanText(content).split(/\r?\n/)[0] || '';

  return firstLine.slice(0, 40) || '(无标题)';
};

// 把 Operit 原始的一条记忆对象整理成本模块内部统一使用的 entry 形状。
// 只在这里做字段容错（缺 id、缺 title、tags 不是数组等），后面的分组/
// 勾选/导入逻辑都只认这个整理过的形状，不用再关心原始 JSON 长什么样。
const normalizeEntry = (rawMemory, indexInArchive) => {
  const content = cleanText(rawMemory?.content);
  const operitId = cleanText(rawMemory?.id);

  if (!content) {
    return {
      error: '这条记忆没有正文内容，已跳过。',
      operitId,
      title: cleanText(rawMemory?.title) || `第 ${indexInArchive + 1} 条`
    };
  }

  return {
    error: null,

    // 没有 operitId 时退化用序号占位，仅用于本次会话内的勾选/展示，
    // 不能拿它去重（见 importOperitEntries 里的说明），所以单独标一下。
    clientEntryId: operitId
      ? `operit_${operitId}`
      : `operit_noid_${indexInArchive}`,
    operitId,
    hasStableId: Boolean(operitId),

    title: cleanText(rawMemory?.title) || buildFallbackTitle(content),
    content,
    tags: normalizeTags(rawMemory?.tags),
    folderPath: cleanText(rawMemory?.folderPath) || 'default',

    // 原样保留，不映射成本项目的 confidence/sourceKind ——
    // 这次导入统一按外部导入处理，这个字段只是给用户在列表里参考。
    operitSource: cleanText(rawMemory?.source),

    createdAtMs: Number.isFinite(rawMemory?.createdAt)
      ? rawMemory.createdAt
      : null,
    updatedAtMs: Number.isFinite(rawMemory?.updatedAt)
      ? rawMemory.updatedAt
      : null
  };
};

const groupEntriesByFolder = (entries) => {
  const byFolder = new Map();

  for (const entry of entries) {
    const key = entry.folderPath || 'default';

    if (!byFolder.has(key)) {
      byFolder.set(key, []);
    }

    byFolder.get(key).push(entry);
  }

  return Array.from(byFolder.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folderPath, folderEntries]) => ({
      folderPath,
      entries: folderEntries
    }));
};

const readFileText = (file) => (
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(
        reader.error || new Error('读取文件失败。')
      );

      reader.readAsText(file);
    })
);

// 只接受第一个文件 —— Operit 一次导出就是一份完整归档，不像 Obsidian
// 笔记那样天然是多文件的，所以这里不做多选。
export const parseOperitArchiveFile = async (fileList) => {
  const file = fileList?.[0];

  if (!file) {
    throw new Error('请选择一个 Operit 记忆归档文件（.json）。');
  }

  const text = await readFileText(file);

  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('这个文件不是有效的 JSON。');
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.archiveType !== OPERIT_ARCHIVE_TYPE
  ) {
    throw new Error('这不是 Operit 的记忆归档文件（archiveType 不匹配）。');
  }

  const rawMemories = asArray(payload.memories);
  const normalizedEntries = rawMemories.map(normalizeEntry);

  const validEntries = normalizedEntries.filter((entry) => !entry.error);
  const invalidEntries = normalizedEntries.filter((entry) => entry.error);

  const folders = groupEntriesByFolder(validEntries);

  return {
    payload,
    folders,
    summary: {
      fileName: file.name,
      archiveFormatVersion: payload.formatVersion ?? null,
      exportedAt: Number.isFinite(payload.exportedAt)
        ? new Date(payload.exportedAt).toISOString()
        : '',
      folderCount: folders.length,
      totalEntryCount: validEntries.length,
      invalidEntryCount: invalidEntries.length
    }
  };
};

const buildOperitKey = (entry) => `operit::${entry.operitId}`;

export const importOperitEntries = async ({
  chatId,
  folders,
  selectedEntryIds,
  defaultType,
  defaultImportance,
  defaultStatus
}) => {
  if (chatId === null || chatId === undefined || chatId === '') {
    throw new Error('请选择要导入到的消息框。');
  }

  const selectedIdSet = new Set(selectedEntryIds || []);

  const jobs = asArray(folders)
    .flatMap((folder) => folder.entries)
    .filter((entry) => selectedIdSet.has(entry.clientEntryId));

  if (jobs.length === 0) {
    throw new Error('请至少选择一条要导入的记忆。');
  }

  const existingMemories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  const existingByKey = new Map(
    existingMemories
      .filter((memory) => memory.operitKey)
      .map((memory) => [memory.operitKey, memory])
  );

  let insertedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const entry of jobs) {
    // 没有 operitId 的条目没法可靠去重（重复导入同一份文件会变成
    // 反复新增），每次都当作新记忆写入，并在错误列表之外单独提示。
    const operitKey = entry.hasStableId ? buildOperitKey(entry) : null;
    const existing = operitKey ? existingByKey.get(operitKey) : null;

    try {
      if (existing) {
        await updateMemory(existing.memoryId, {
          title: entry.title,
          content: entry.content,
          type: defaultType,
          importance: defaultImportance
        }, {
          note: `重新从 Operit 记忆归档导入并更新（原标题：《${entry.title}》）`
        });

        await db.memories
          .where('memoryId')
          .equals(existing.memoryId)
          .modify({
            operitTags: entry.tags,
            operitFolderPath: entry.folderPath
          });

        updatedCount += 1;
        continue;
      }

      const created = await createMemory({
        chatId,
        title: entry.title,
        content: entry.content,
        type: defaultType,
        importance: defaultImportance,
        status: defaultStatus,
        confidence: MEMORY_CONFIDENCES.CONFIRMED,
        sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
        sourceKind: MEMORY_SOURCE_KINDS.OPERIT_IMPORT,
        note: `从 Operit 记忆归档导入（原标题：《${entry.title}》）`
      });

      await db.memories
        .where('memoryId')
        .equals(created.memoryId)
        .modify({
          operitKey,
          operitTags: entry.tags,
          operitFolderPath: entry.folderPath
        });

      if (operitKey) {
        existingByKey.set(operitKey, { memoryId: created.memoryId });
      }

      insertedCount += 1;
    } catch (error) {
      failedCount += 1;
      errors.push({
        title: entry.title,
        message: error?.message || '导入这一条时出错。'
      });
    }
  }

  return {
    insertedCount,
    updatedCount,
    failedCount,
    errors
  };
};