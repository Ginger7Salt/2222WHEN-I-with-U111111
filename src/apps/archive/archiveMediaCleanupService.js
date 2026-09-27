// src/apps/archive/archiveMediaCleanupService.js
//
// 存档室的媒体清理 + 打包下载，2026-09 新增，独立文件（不改 archiveService.js）。
//
// 范围（已跟用户确认）：
// - 只针对 archivedMessages 表（存档室里的记录），不碰活跃聊天 messages 表。
// - 清理只清"语音本体"（metadata.audioBlob）和"图片本体"（metadata.blob），
//   不删整条消息、不动文字内容——真实语音的转写文字、图片消息的提示文字
//   都原样保留，用户之后翻记录还能看到"当时说了什么/发生过什么"，只是
//   听不到原声、看不到原图了。
// - 下载和清理是两个完全独立的功能，不强制绑定——下载不会触发清理，
//   清理前也不会强制走一遍下载。
// - realVoice 类型的消息在生成时会把 audioBlob 同时写进 message.metadata
//   和 message.versions[0].metadata 两个地方（历史遗留写法），清理时两处
//   都要清掉，不然只清 metadata 表面上看起来清了，实际上 versions 里那份
//   还占着地方。

import db from '../../db';

const MEDIA_MESSAGE_TYPES = ['realVoice', 'photo'];

const getMessageMediaBlob = (message) => (
  message?.metadata?.audioBlob || message?.metadata?.blob || null
);

const messageHasAnyMedia = (message) => {
  if (getMessageMediaBlob(message) instanceof Blob) return true;

  if (Array.isArray(message?.versions)) {
    return message.versions.some((version) => (
      version?.metadata?.audioBlob instanceof Blob
      || version?.metadata?.blob instanceof Blob
    ));
  }

  return false;
};

const stripMediaFromMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return metadata;

  const { blob, audioBlob, ...rest } = metadata;

  return rest;
};

const stripMediaFromVersions = (versions) => {
  if (!Array.isArray(versions)) return versions;

  return versions.map((version) => ({
    ...version,
    metadata: stripMediaFromMetadata(version?.metadata),
  }));
};

const getArchivedMediaMessages = async (chatId) => (
  db.archivedMessages
    .where('chatId')
    .equals(chatId)
    .filter((message) => MEDIA_MESSAGE_TYPES.includes(message.type))
    .toArray()
);

/**
 * 清空某个聊天在存档室里的全部语音/图片本体，保留文字记录。
 * 不可撤销——调用方在真正执行前应该自己弹一次确认。
 */
export const clearArchivedMediaForChat = async (chatId) => {
  const mediaMessages = await getArchivedMediaMessages(chatId);
  const targets = mediaMessages.filter(messageHasAnyMedia);

  if (targets.length === 0) {
    return { clearedCount: 0, scannedCount: mediaMessages.length };
  }

  await db.transaction('rw', db.archivedMessages, async () => {
    for (const message of targets) {
      // eslint-disable-next-line no-await-in-loop
      await db.archivedMessages.update(message.id, {
        metadata: {
          ...stripMediaFromMetadata(message.metadata),
          mediaCleared: true,
          mediaClearedAt: new Date().toISOString(),
        },
        versions: stripMediaFromVersions(message.versions),
      });
    }
  });

  return { clearedCount: targets.length, scannedCount: mediaMessages.length };
};

const extensionForMimeType = (mimeType, fallbackType) => {
  if (mimeType === 'audio/wav') return 'wav';
  if (typeof mimeType === 'string' && mimeType.startsWith('audio/')) return 'mp3';
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
    return mimeType.split('/')[1] || 'jpg';
  }

  return fallbackType === 'photo' ? 'jpg' : 'mp3';
};

const downloadBlob = (blob, filename) => {
  try {
    if (!(blob instanceof Blob) || blob.size === 0) {
      return false;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

    return true;
  } catch (error) {
    console.error('[ArchiveMediaCleanup] 下载媒体文件失败：', error);
    return false;
  }
};

/**
 * 把某个聊天存档室里现存的语音/图片本体逐个下载到本地。
 * 跟通话回看的批量下载用同一套节奏（sequential + 350ms 间隔），
 * 避免浏览器把一次性触发的一堆下载当成弹窗骚扰拦掉一部分。
 */
export const downloadArchivedMediaForChat = async (
  chatId,
  characterName,
  { onProgress } = {},
) => {
  const mediaMessages = await getArchivedMediaMessages(chatId);

  const items = mediaMessages
    .map((message) => ({
      blob: getMessageMediaBlob(message),
      mimeType: message?.metadata?.mimeType,
      timestamp: message.timestamp,
      type: message.type,
    }))
    .filter((item) => item.blob instanceof Blob && item.blob.size > 0);

  let successCount = 0;
  let failCount = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const stamp = item.timestamp
      ? new Date(item.timestamp).getTime()
      : Date.now();
    const extension = extensionForMimeType(item.mimeType, item.type);
    const filename = `${characterName || 'archive'}-${item.type}-${stamp}.${extension}`;

    const ok = downloadBlob(item.blob, filename);

    if (ok) {
      successCount += 1;
    } else {
      failCount += 1;
    }

    onProgress?.({ current: index + 1, total: items.length });

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      window.setTimeout(resolve, 350);
    });
  }

  return {
    successCount,
    failCount,
    totalCount: items.length,
  };
};

export default {
  clearArchivedMediaForChat,
  downloadArchivedMediaForChat,
};