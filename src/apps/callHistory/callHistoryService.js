// src/apps/callHistory/callHistoryService.js
//
// 全局"通话记录"管理界面的数据层，2026-09 新增。
//
// 背景（对应待办 2）：call 类型消息此前会被 archiveService.js 一视同仁
// 地自动/手动归档，搬进 db.archivedMessages 之后，CallReviewModal
// （保留/下载/删除语音）和归档查看器互相不认识对方——call 消息的语音
// 存在 message.metadata.turns[].audio.audioBlob，跟归档查看器/
// archiveMediaCleanupService.js 认的 metadata.audioBlob 是两套完全
// 不同的字段形状，导致语音数据还在但没有任何界面能管理。
//
// 现在的方案：
// 1. archiveService.js 已经把 call 类型消息排除出所有归档候选集，
//    它会永远留在 db.messages 里，不再被搬进 archivedMessages。
// 2. src/db/index.js 的 v65 迁移把历史上已经被误归档的 call 记录
//    搬回了 db.messages。
// 3. 这里提供一个全局入口：跨所有聊天窗汇总 db.messages 里的 call
//    类型消息，可以查看、单条/批量删除、把语音打包下载成一个 zip。
//    单条通话内的详情/单独下载仍然复用现成的 CallReviewModal。

import db from '../../db';

const isFiniteId = (id) => Number.isFinite(Number(id));

const formatCallDuration = (metadata = {}) => {
  const { connectedAt, endedAt } = metadata;

  if (!connectedAt || !endedAt) {
    return null;
  }

  const totalSeconds = Math.max(
    0,
    Math.round((new Date(endedAt) - new Date(connectedAt)) / 1000)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getAudioTurns = (metadata = {}) => (
  Array.isArray(metadata.turns)
    ? metadata.turns.filter((turn) => (
        turn?.audio?.audioBlob instanceof Blob && turn.audio.audioBlob.size > 0
      ))
    : []
);

/*
 * "未接通"筛选标签用：对方拒绝/暂时无法接听，或者通话已结束但算不出
 * 时长（没有真正连上过），都算未接通。响铃中/进行中不算——那是活跃
 * 状态，不该被这个历史筛选标签吞掉。
 */
export const isMissedCall = (item) => (
  Boolean(item?.declined) || (item?.status === 'ended' && !item?.duration)
);

/*
 * 跨所有聊天窗汇总通话记录，按结束时间（没有就用消息时间戳）倒序。
 * type 在 messages 表上是索引字段，这里直接走索引查，不用整表扫描。
 */
export const getAllCallMessages = async () => {
  const [callMessages, chats, characters] = await Promise.all([
    db.messages.where('type').equals('call').toArray(),
    db.chats.toArray(),
    db.characters.toArray()
  ]);

  const chatMap = new Map(chats.map((chat) => [chat.id, chat]));
  const characterMap = new Map(
    characters.map((character) => [character.id, character])
  );

  const rows = callMessages.map((message) => {
    const chat = chatMap.get(message.chatId) || null;
    const character = characterMap.get(message.characterId)
      || (chat?.characterId ? characterMap.get(chat.characterId) : null)
      || null;

    const metadata = message.metadata || {};
    const audioTurns = getAudioTurns(metadata);

    return {
      message,
      messageId: message.id,
      chatId: message.chatId,
      characterName: character?.name || chat?.title || '未命名',
      characterAvatar: character?.avatar || '',
      chatTitle: chat?.title || character?.name || '未命名聊天',
      userName: chat?.userName || character?.userName || '你',
      status: metadata.status,
      direction: metadata.direction,
      declined: !!metadata.declined,
      unavailable: !!metadata.unavailable,
      mode: metadata.mode,
      connectedAt: metadata.connectedAt || null,
      endedAt: metadata.endedAt || null,
      timestamp: message.timestamp,
      duration: formatCallDuration(metadata),
      audioCount: audioTurns.length,
      hasAudio: audioTurns.length > 0
    };
  });

  return rows.sort((a, b) => {
    const aTime = new Date(a.endedAt || a.timestamp || 0).getTime() || 0;
    const bTime = new Date(b.endedAt || b.timestamp || 0).getTime() || 0;

    return bTime - aTime;
  });
};

/*
 * 彻底删除一批通话记录（不可恢复）——调用方应该在真正执行前
 * 自己弹一次 ConfirmModal 二次确认。
 */
export const deleteCallMessages = async (messageIds) => {
  const numericIds = (messageIds || [])
    .map((id) => Number(id))
    .filter(Number.isFinite);

  if (numericIds.length === 0) {
    return 0;
  }

  await db.messages.where('id').anyOf(numericIds).delete();

  return numericIds.length;
};

/*
 * 把选中的通话记录里，所有保留下来的语音片段打包成一个 zip 下载。
 * JSZip 是已有依赖（obsidianMarkdownExporter.js 已经在用同一个动态
 * import 的惯例），这里不重复加依赖。
 *
 * items 需要至少带 messageId / characterName / timestamp 字段——
 * 直接传 getAllCallMessages() 返回的行对象（按调用方自己的勾选状态
 * 过滤后传入）即可；音频本体现场从 db 重新读一遍最新数据，不依赖
 * 列表里缓存的旧快照。
 */
export const downloadCallMessagesAudioZip = async (items) => {
  const targets = (items || []).filter((item) => isFiniteId(item?.messageId));

  if (targets.length === 0) {
    return { fileCount: 0, messageCount: 0 };
  }

  const numericIds = targets.map((item) => Number(item.messageId));

  const freshMessages = await db.messages
    .where('id')
    .anyOf(numericIds)
    .toArray();

  const messageMap = new Map(
    freshMessages.map((message) => [message.id, message])
  );

  // JSZip 是一个已有依赖（package.json 里已经有 "jszip": "^3.10.1"），
  // 动态 import 避免把它打进首屏包体积。
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  const usedNames = new Set();
  let fileCount = 0;
  let messageCount = 0;

  for (const item of targets) {
    const message = messageMap.get(Number(item.messageId));

    if (!message) {
      continue;
    }

    const metadata = message.metadata || {};
    const audioTurns = getAudioTurns(metadata);

    if (audioTurns.length === 0) {
      continue;
    }

    messageCount += 1;

    const stamp = message.timestamp ? new Date(message.timestamp) : new Date();
    const dateLabel = Number.isNaN(stamp.getTime())
      ? 'unknown-time'
      : stamp.toISOString().slice(0, 16).replace(/[:T]/g, '-');

    const safeName = (item.characterName || '通话').replace(/[\\/:*?"<>|]/g, '_');

    audioTurns.forEach((turn, index) => {
      const mimeType = turn.audio?.mimeType;
      const extension = mimeType === 'audio/wav' ? 'wav' : 'mp3';

      let fileName = `${safeName}-${dateLabel}-${index + 1}.${extension}`;
      let suffix = 2;

      while (usedNames.has(fileName)) {
        fileName = `${safeName}-${dateLabel}-${index + 1} (${suffix}).${extension}`;
        suffix += 1;
      }

      usedNames.add(fileName);
      zip.file(fileName, turn.audio.audioBlob);
      fileCount += 1;
    });
  }

  if (fileCount === 0) {
    return { fileCount: 0, messageCount: 0 };
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const objectUrl = URL.createObjectURL(zipBlob);
  const zipStamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `通话语音-${zipStamp}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

  return { fileCount, messageCount };
};

export default {
  getAllCallMessages,
  deleteCallMessages,
  downloadCallMessagesAudioZip,
  isMissedCall
};