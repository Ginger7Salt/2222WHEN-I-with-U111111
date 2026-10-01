// src/apps/messages/work/workAssistantService.js
//
// Work 聊天窗的"助理身份"数据层。
//
// 跟 real/rp 不同：work 不是"选一个已有角色"，而是全局唯一的一份身份
// （名字/头像/人设/user偏好全局共享），可以同时开很多个 work 聊天窗，
// 它们都指向同一条 characters 记录，只是各自的 chats 记录（标题/背景/
// 气泡颜色/字号等）互相独立——这部分视觉字段本来就是 chats 表自己的，
// 不需要这里管。
//
// 实现上刻意不新建表：复用现有 db.characters，只是：
// 1. 全局只允许存在一条 isWorkAssistant === true 的记录（懒加载，第一次
//    创建 work 聊天窗时才建，不占用没用过这个功能的人的数据）；
// 2. 角色库（CharacterLibrary.jsx）按 isWorkAssistant 过滤掉它，因为它
//    不是一个可以拿去发起 RP/现实陪伴的"角色"。

import db from '../../../db';

const DEFAULT_WORK_ASSISTANT_NAME = '助理';

/**
 * 取出全局唯一的 work 助理身份记录，不存在就创建一条默认的。
 * 两处调用方共用：
 * 1. NewChatModal.jsx 新建 work 聊天窗时，跳过选角色步骤直接拿这条。
 * 2. 助理设置面板读取/编辑时。
 */
export const getOrCreateWorkAssistantCharacter = async () => {
  const existing = await db.characters
    .filter((character) => character.isWorkAssistant === true)
    .first();

  if (existing) {
    return existing;
  }

  const nowIso = new Date().toISOString();

  const newCharacterId = await db.characters.add({
    name: DEFAULT_WORK_ASSISTANT_NAME,
    avatar: '',
    bio: '',
    extraNotes: '',
    userPersona: '',
    userAvatar: '',
    isWorkAssistant: true,
    createdAt: nowIso,
  });

  return db.characters.get(newCharacterId);
};

/**
 * 助理设置面板保存用：只允许改这几个字段，避免不小心把角色记录上
 * 其他跟 work 无关的字段（isAutoMessageActive 等）弄脏。
 */
export const updateWorkAssistantIdentity = async (characterId, patch = {}) => {
  if (!characterId) return;

  const allowedFields = ['name', 'avatar', 'bio', 'extraNotes', 'userPersona'];

  const payload = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      payload[field] = patch[field];
    }
  }

  if (Object.keys(payload).length === 0) return;

  await db.characters.update(characterId, payload);
};

export default {
  getOrCreateWorkAssistantCharacter,
  updateWorkAssistantIdentity,
};