// src/services/userSavedInfoService.js
//
// 用户常用信息（收货地址、联系方式、口味偏好等）的读写。
// 数据存在全局表 db.userSavedInfo 里，所有聊天窗共用。
// 仓库里默认是空的，不会写入任何个人内容。

import db from '../db';

export const SAVED_INFO_LIMITS = {
  maxEntries: 30,
  maxTitleLength: 30,
  maxContentLength: 500,
};

const normalizeInput = (input = {}) => ({
  title: String(input.title ?? '')
    .trim()
    .slice(0, SAVED_INFO_LIMITS.maxTitleLength),
  content: String(input.content ?? '')
    .trim()
    .slice(0, SAVED_INFO_LIMITS.maxContentLength),
});

export const listSavedInfo = async () => {
  return db.userSavedInfo.orderBy('createdAt').toArray();
};

export const addSavedInfo = async (input) => {
  const { title, content } = normalizeInput(input);

  if (!title || !content) {
    throw new Error('标题和内容都需要填写。');
  }

  const count = await db.userSavedInfo.count();

  if (count >= SAVED_INFO_LIMITS.maxEntries) {
    throw new Error(`最多保存 ${SAVED_INFO_LIMITS.maxEntries} 条常用信息。`);
  }

  const now = Date.now();

  return db.userSavedInfo.add({
    title,
    content,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateSavedInfo = async (id, input) => {
  const { title, content } = normalizeInput(input);

  if (!title || !content) {
    throw new Error('标题和内容都需要填写。');
  }

  await db.userSavedInfo.update(id, {
    title,
    content,
    updatedAt: Date.now(),
  });
};

export const deleteSavedInfo = async (id) => {
  await db.userSavedInfo.delete(id);
};

export default {
  listSavedInfo,
  addSavedInfo,
  updateSavedInfo,
  deleteSavedInfo,
};