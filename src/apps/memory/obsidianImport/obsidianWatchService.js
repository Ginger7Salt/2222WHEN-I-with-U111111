// Obsidian folder watch - entry point 2 from the confirmed OB import
// design: the user grants persistent read access to one Obsidian folder
// via the File System Access API, binds the whole folder to one chat (per
// the confirmed "整个文件夹绑一个消息框" scope for this round), and this
// project checks it for new/changed .md files once whenever the memory
// page opens (no background polling timer, per the confirmed choice).
//
// Chrome/Edge only - the API doesn't exist elsewhere. Everything here
// feature-detects and the UI (ObsidianWatchModal.jsx) falls back to
// pointing people at the manual-upload entry point when unsupported.
//
// This module never decides what gets written into memory - it only scans
// for changed files and hands them to the same parseObsidianFileEntries/
// importObsidianEntries pair the manual-upload entry point uses, so the
// review screen, the dedup key and the actual memory writes are identical
// between both entry points.

import db from '../../../db';

const IGNORED_DIR_NAMES = new Set([
  '.obsidian',
  '.trash',
  '.git',
  'node_modules'
]);

export const isObsidianWatchSupported = () => (
  typeof window !== 'undefined'
  && typeof window.showDirectoryPicker === 'function'
);

// Recursively walks a directory handle collecting every .md file as
// { relativePath, file }. Skips Obsidian's own housekeeping folders and a
// couple of common folders that sometimes end up inside a vault by
// accident - a vault is assumed to be nested (Obsidian users routinely
// organize notes into subfolders), so this always recurses rather than
// only reading the top level.
const collectMarkdownFiles = async (dirHandle, pathPrefix = '') => {
  const results = [];

  for await (const [name, handle] of dirHandle.entries()) {
    const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;

    if (handle.kind === 'directory') {
      if (IGNORED_DIR_NAMES.has(name)) continue;

      const nested = await collectMarkdownFiles(handle, relativePath);
      results.push(...nested);
      continue;
    }

    if (/\.md$/i.test(name)) {
      const file = await handle.getFile();
      results.push({ relativePath, file });
    }
  }

  return results;
};

export const getObsidianWatchFolders = async () => (
  db.obsidianWatchFolders.toArray()
);

// Opens the browser's folder picker and stores the resulting handle bound
// to one chat. Must be called from a user gesture (a click handler) - the
// browser refuses showDirectoryPicker() otherwise.
export const connectObsidianWatchFolder = async ({ chatId }) => {
  if (!isObsidianWatchSupported()) {
    throw new Error(
      '当前浏览器不支持文件夹授权，请使用 Chrome 或 Edge，或改用上面的手动上传。'
    );
  }

  if (chatId === null || chatId === undefined || chatId === '') {
    throw new Error('请先选择这个文件夹要绑定到哪个消息框。');
  }

  const directoryHandle = await window.showDirectoryPicker();
  const now = new Date().toISOString();

  const id = await db.obsidianWatchFolders.add({
    chatId,
    folderName: directoryHandle.name,
    directoryHandle,
    fileState: {},
    createdAt: now,
    lastCheckedAt: null
  });

  return db.obsidianWatchFolders.get(id);
};

export const removeObsidianWatchFolder = async (id) => {
  await db.obsidianWatchFolders.delete(id);
};

// 'granted' | 'prompt' | 'denied' | 'unsupported'. Safe to call without a
// user gesture - only requestPermission() below needs one.
export const getWatchFolderPermissionState = async (watchFolder) => {
  if (!watchFolder?.directoryHandle?.queryPermission) {
    return 'unsupported';
  }

  try {
    return await watchFolder.directoryHandle.queryPermission({
      mode: 'read'
    });
  } catch {
    return 'unsupported';
  }
};

// Must be called from a user gesture (a click handler) - the browser
// refuses requestPermission() otherwise, so this can't be run
// automatically from a background/mount-time check.
export const requestWatchFolderPermission = async (watchFolder) => {
  if (!watchFolder?.directoryHandle?.requestPermission) {
    throw new Error('这个文件夹的授权已经失效，请删除后重新连接。');
  }

  return watchFolder.directoryHandle.requestPermission({ mode: 'read' });
};

// Scans one watched folder for .md files that are new or whose lastModified
// changed since the last time this folder's changes were actually
// imported. Does NOT touch fileState itself and does NOT write anything to
// memory - call commitWatchFolderScan() only after the user has reviewed
// and imported the result, so a cancelled review doesn't advance the
// watermark and silently skip those files next time.
export const scanObsidianWatchFolder = async (watchFolder) => {
  const permission = await getWatchFolderPermissionState(watchFolder);

  if (permission !== 'granted') {
    return { permission, changedFiles: [] };
  }

  const allFiles = await collectMarkdownFiles(watchFolder.directoryHandle);
  const knownState = watchFolder.fileState || {};

  const changedFiles = allFiles.filter(({ relativePath, file }) => (
    knownState[relativePath]?.mtime !== file.lastModified
  ));

  await db.obsidianWatchFolders.update(watchFolder.id, {
    lastCheckedAt: new Date().toISOString()
  });

  return { permission, changedFiles };
};

// Scans every watched folder that currently has granted permission, and
// returns only the ones with at least one changed file - this is what runs
// once when the memory page opens. Folders needing re-authorization are
// silently skipped here (queryPermission never prompts); the watch-folder
// management screen is where the user re-grants access. One folder whose
// handle has gone stale (e.g. the folder was moved or deleted on disk)
// throwing never blocks checking the rest.
export const scanAllObsidianWatchFolders = async () => {
  const watchFolders = await getObsidianWatchFolders();
  const results = [];

  for (const watchFolder of watchFolders) {
    try {
      const { permission, changedFiles } = await scanObsidianWatchFolder(
        watchFolder
      );

      if (permission === 'granted' && changedFiles.length > 0) {
        results.push({ watchFolder, changedFiles });
      }
    } catch {
      // 跳过这一个文件夹，不影响检查其余已连接的文件夹。
    }
  }

  return results;
};

// Called once the user has reviewed and imported (or explicitly chosen to
// skip) a batch of changed files, to move the "have I looked at this
// version" watermark forward so the same unchanged content isn't flagged
// again next time. This runs regardless of which individual entries the
// user selected inside that batch - skipping a heading on purpose is a
// content decision, not a "come back and ask me again" request; only a
// future edit (a new mtime) re-surfaces that file for review.
export const commitWatchFolderScan = async (watchFolderId, changedFiles) => {
  const watchFolder = await db.obsidianWatchFolders.get(watchFolderId);

  if (!watchFolder) return;

  const now = new Date().toISOString();
  const nextFileState = { ...(watchFolder.fileState || {}) };

  for (const { relativePath, file } of changedFiles || []) {
    nextFileState[relativePath] = {
      mtime: file.lastModified,
      lastImportedAt: now
    };
  }

  await db.obsidianWatchFolders.update(watchFolderId, {
    fileState: nextFileState
  });
};