// Obsidian markdown export - the reverse direction of
// obsidianMarkdownParser.js/obsidianImportService.js. One chat's formal
// memories become one .md file: the chat's title is the file's own H1,
// and each memory becomes a "## <title>" heading with a
// "> 类型：... · 重要度：n" marker line right under it, written by
// buildMemoryMetadataLine() and read back on re-import by
// parseObsidianNote() - so exporting and re-importing this project's own
// files round-trips type/importance instead of losing it.
//
// Only formal (confirmed) memories are exported, not pending candidates or
// the revision history - those are this app's own internal bookkeeping,
// not something an Obsidian note should carry.

import db from '../../../db';
import { getChatMemory } from '../memoryService';
import { buildMemoryMetadataLine } from './obsidianMarkdownParser';

const sanitizeFileName = (value) => (
  String(value || '未命名消息框')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 80) || '未命名消息框'
);

const buildMemorySection = (memory) => {
  const heading = memory.title?.trim() || memory.content.slice(0, 24).trim() || '未命名记忆';
  const metadataLine = buildMemoryMetadataLine({
    type: memory.type,
    importance: memory.importance
  });

  return `## ${heading}\n\n${metadataLine}\n\n${memory.content || ''}`.trim();
};

// Builds one chat's memories into a single markdown string. Memories are
// written in the same newest-first order the memory list itself shows.
export const buildChatMarkdownExport = async (chatId) => {
  const chat = await db.chats.get(chatId);
  const title = chat?.title || `消息框 ${chatId}`;
  // 已经按 updatedAt 新到旧排好序，这里直接沿用，不需要重新排一次。
  const memories = await getChatMemory(chatId);
  const sections = memories.map(buildMemorySection).join('\n\n');

  return {
    chatId,
    chatTitle: title,
    fileName: `${sanitizeFileName(title)}.md`,
    memoryCount: memories.length,
    content: memories.length > 0
      ? `# ${title}\n\n${sections}\n`
      : `# ${title}\n\n（这个消息框还没有正式记忆。）\n`
  };
};

const getAllChatIdsWithMemories = async () => {
  const memories = await db.memories.toArray();

  return [...new Set(memories.map((memory) => memory.chatId))];
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

// scope: { type: 'chat', chatId } | { type: 'all' }. A single chat
// downloads directly as one .md file; "all" bundles every chat that has at
// least one formal memory into a .zip, one .md per chat, since a browser
// can't hand back more than one file from a single download action.
export const downloadObsidianMarkdownExport = async (scope = {}) => {
  if (scope.type === 'chat') {
    const result = await buildChatMarkdownExport(scope.chatId);

    triggerBlobDownload(
      new Blob([result.content], { type: 'text/markdown;charset=utf-8' }),
      result.fileName
    );

    return { fileCount: 1, memoryCount: result.memoryCount };
  }

  const chatIds = await getAllChatIdsWithMemories();

  if (chatIds.length === 0) {
    throw new Error('还没有任何消息框有正式记忆，没有可导出的内容。');
  }

  // JSZip 是一个新增依赖，需要先在 package.json 里加上
  // "jszip": "^3.10.1" 并跑一次 npm install，这个文件才能正常工作。
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  const usedFileNames = new Set();
  let totalMemoryCount = 0;

  for (const chatId of chatIds) {
    const result = await buildChatMarkdownExport(chatId);

    // 两个消息框标题清理后可能撞名，加序号避免互相覆盖。
    let fileName = result.fileName;
    let suffix = 2;

    while (usedFileNames.has(fileName)) {
      fileName = result.fileName.replace(/\.md$/, ` (${suffix}).md`);
      suffix += 1;
    }

    usedFileNames.add(fileName);
    totalMemoryCount += result.memoryCount;

    zip.file(fileName, result.content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  triggerBlobDownload(
    zipBlob,
    `when-i-with-u-obsidian-${new Date().toISOString().slice(0, 10)}.zip`
  );

  return { fileCount: chatIds.length, memoryCount: totalMemoryCount };
};