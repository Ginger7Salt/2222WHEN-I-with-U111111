// 反方向：把本项目的记忆导出成 Operit 能导入的 operit_memory_archive
// 格式，好让本项目的记忆流回 Operit 里。跟 obsidianMarkdownExporter.js
// 是同一个思路（导入的镜像文件，放在同一个 operitImport/ 文件夹里）。
//
// 本项目记忆记录里没有 Operit 需要的 source/tags/folderPath 这几个字段，
// 三条回填规则都是跟用户确认过的：
// - source：按 confidence 判断 —— “用户写入”的记忆算 user_created，
//   其余（AI 整理/推断/导入）都算 ai_created。
// - folderPath：如果这条记忆本来就是从 Operit 导入进来的（带着
//   operitFolderPath），原样还原；否则用它所属消息框的标题当文件夹名，
//   这样 Operit 那边至少能按消息框把记忆分开看。
// - tags：同样优先用已有的 operitTags（原样还原）；否则用记忆类型的
//   中文标签顶一个标签（MEMORY_TYPE_OPTIONS 里的 label），
//   至少能看出这条记忆原本是什么类型。
//
// id 字段：如果这条记忆本来就是从 Operit 导入的（operitKey 形如
// "operit::<原始id>"），导出时把原始 id 还原回去，而不是本项目自己的
// memoryId —— 这样"从 Operit 导入、又导出回 Operit"的记忆不会在 Operit
// 那边变成一条新记录。本项目原生产生的记忆没有这个历史，直接用
// memoryId 本身当 id（本来就是全局唯一的稳定字符串）。

import db from '../../../db';
import { getChatMemory } from '../memoryService';
import { MEMORY_CONFIDENCES, MEMORY_TYPE_OPTIONS } from '../memoryConstants';
import { OPERIT_ARCHIVE_TYPE } from './operitImportService';

const TYPE_LABEL_BY_ID = new Map(
  MEMORY_TYPE_OPTIONS.map((option) => [option.id, option.label])
);

const OPERIT_KEY_PREFIX = 'operit::';

const extractOperitId = (memory) => (
  typeof memory.operitKey === 'string'
    && memory.operitKey.startsWith(OPERIT_KEY_PREFIX)
    ? memory.operitKey.slice(OPERIT_KEY_PREFIX.length)
    : memory.memoryId
);

const toEpochMs = (isoValue) => {
  const time = new Date(isoValue || 0).getTime();

  return Number.isFinite(time) ? time : Date.now();
};

const buildOperitMemoryRecord = (memory, chatTitle) => {
  const tags = Array.isArray(memory.operitTags) && memory.operitTags.length > 0
    ? memory.operitTags
    : [TYPE_LABEL_BY_ID.get(memory.type) || memory.type || '未分类'];

  const folderPath = memory.operitFolderPath || chatTitle || 'default';

  const source = memory.confidence === MEMORY_CONFIDENCES.USER_WRITTEN
    ? 'user_created'
    : 'ai_created';

  return {
    id: extractOperitId(memory),
    title: memory.title || memory.content.slice(0, 40) || '(无标题)',
    content: memory.content || '',
    source,
    tags,
    folderPath,
    createdAt: toEpochMs(memory.createdAt),
    updatedAt: toEpochMs(memory.updatedAt)
  };
};

const getAllChatIdsWithMemories = async () => {
  const memories = await db.memories.toArray();

  return [...new Set(memories.map((memory) => memory.chatId))];
};

// scope: { type: 'chat', chatId } | { type: 'all' } —— 和
// memoryImportExport.js 的原生导出、obsidianMarkdownExporter.js 的
// Markdown 导出用的是同一套 scope 约定。
export const buildOperitArchive = async (scope = {}) => {
  const chatIds = scope.type === 'chat'
    && scope.chatId !== undefined
    && scope.chatId !== null
    && scope.chatId !== ''
    ? [scope.chatId]
    : await getAllChatIdsWithMemories();

  const records = [];

  for (const chatId of chatIds) {
    const chat = await db.chats.get(chatId);
    const chatTitle = chat?.title || `消息框 ${chatId}`;
    const memories = await getChatMemory(chatId);

    for (const memory of memories) {
      records.push(buildOperitMemoryRecord(memory, chatTitle));
    }
  }

  return {
    archiveType: OPERIT_ARCHIVE_TYPE,
    formatVersion: 1,
    exportedAt: Date.now(),
    memories: records
  };
};

const triggerBlobDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

// 跟 Obsidian Markdown 导出不同，Operit 的归档天然就是"一份文件装下所有
// 记忆"，不需要按消息框拆成多个文件再打包 zip —— 不管 scope 是单个消息框
// 还是全部消息框，都只产出一个 .json。
export const downloadOperitArchive = async (scope = {}) => {
  const archive = await buildOperitArchive(scope);

  const blob = new Blob(
    [JSON.stringify(archive, null, 2)],
    { type: 'application/json;charset=utf-8' }
  );

  triggerBlobDownload(
    blob,
    `when-i-with-u-operit-${new Date().toISOString().slice(0, 10)}.json`
  );

  return { memoryCount: archive.memories.length };
};