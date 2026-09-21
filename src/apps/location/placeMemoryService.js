// src/apps/location/placeMemoryService.js
//
// 地点小册子里的"这里发生过的事"：每个已命名地点下的一条条短句小记录。
// 用户可以自己写、编辑、删除；角色可以在回复末尾用隐藏标签
// [PLACE_NOTE: 一句话] 悄悄留一句（不发聊天卡片，不多花一次 AI 请求）。
//
// 数据在 db.placeMemories：{ id, chatId, placeId, author: 'user' | 'char', text, createdAt, updatedAt }
//
// 角色写入的"闸门"都在代码里，提示词只是告诉角色可以这么做：
// 只有用户此刻在一个已命名的地点、定位不太旧、并且距离角色上一次留言已经隔了一阵，
// 才会真的写入；同一句话不会重复写；每个地点最多留着最近的 30 条角色记录。

import db from '../../db';
import { getLocationFixAgeMs } from './placeService';

export const PLACE_MEMORY_USER_MAX_CHARS = 120;
export const PLACE_MEMORY_CHAR_MAX_CHARS = 40;

// 定位比这个更旧，就认为用户可能已经离开了，不再让角色往这个地点写东西。
export const PLACE_NOTE_MAX_FIX_AGE_MS = 60 * 60 * 1000;

// 角色两次留言之间至少隔多久（每个聊天窗单独算）。
export const PLACE_NOTE_COOLDOWN_MS = 30 * 60 * 1000;

// 满足条件的回复里，把"可以留言"这个选项告诉角色的概率。
export const PLACE_NOTE_OFFER_PROBABILITY = 0.3;

// 每个地点最多保留多少条角色写的记录（超出的删最旧的）。
export const PLACE_NOTE_CHAR_KEEP_PER_PLACE = 30;

// 放进提示词的最多几条。
export const PLACE_MEMORY_PROMPT_LIMIT = 3;

const PLACE_NOTE_TAG_PATTERN = /\[\s*PLACE_NOTE\s*(?:[:：]\s*([^\]]*))?\]/gi;

const nowIso = () => new Date().toISOString();

// 去掉 emoji（全站不用 emoji）、多余空白，并限制长度。
const cleanText = (raw, maxChars) => (
  Array.from(
    String(raw ?? '')
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, maxChars)
    .join('')
);

// 判断"是不是同一句话"时忽略空白和标点。
const normalizeForCompare = (text) => (
  String(text || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
);

/** 某个地点下的全部小记录，最新的在前面。 */
export const listPlaceMemories = async (placeId) => {
  const list = await db.placeMemories
    .where('placeId')
    .equals(placeId)
    .toArray();

  return list.sort((a, b) => (
    String(b.createdAt).localeCompare(String(a.createdAt)) || (b.id - a.id)
  ));
};

/** 用户手动添加一条。返回新记录，文字为空返回 null。 */
export const addUserPlaceMemory = async ({ chatId, placeId, text }) => {
  const cleaned = cleanText(text, PLACE_MEMORY_USER_MAX_CHARS);

  if (!cleaned) return null;

  const timestamp = nowIso();
  const id = await db.placeMemories.add({
    chatId,
    placeId,
    author: 'user',
    text: cleaned,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return db.placeMemories.get(id);
};

/** 编辑一条（用户可以改任何一条，包括角色写的）。文字为空则不改。 */
export const updatePlaceMemory = async (id, text) => {
  const existing = await db.placeMemories.get(id);

  if (!existing) return null;

  const cleaned = cleanText(text, PLACE_MEMORY_USER_MAX_CHARS);

  if (!cleaned) return existing;

  await db.placeMemories.update(id, { text: cleaned, updatedAt: nowIso() });

  return db.placeMemories.get(id);
};

export const deletePlaceMemory = async (id) => {
  await db.placeMemories.delete(id);
};

/**
 * 从回复里取出 [PLACE_NOTE: 一句话] 标签。标签一律从正文里去掉（不管这次有没有生效），
 * 避免标签文字漏给用户。返回 { content, note }，note 是清理过的文字或空字符串。
 */
export const extractPlaceNoteDirective = (rawText) => {
  let note = '';
  let seen = false;

  const content = String(rawText || '')
    .replace(PLACE_NOTE_TAG_PATTERN, (fullMatch, payload = '') => {
      if (!seen) {
        seen = true;
        note = cleanText(payload, PLACE_MEMORY_CHAR_MAX_CHARS);
      }

      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { content, note };
};

// 角色最近一次留言的时间（毫秒），没有则为 0。
const getLastCharNoteTime = async (chatId) => {
  const list = await db.placeMemories
    .where('chatId')
    .equals(chatId)
    .filter((memory) => memory.author === 'char')
    .toArray();

  return list.reduce((latest, memory) => {
    const time = new Date(memory.createdAt).getTime();
    return Number.isFinite(time) && time > latest ? time : latest;
  }, 0);
};

/**
 * 现在能不能让角色往"当前所在地点"留一句？条件：
 * 地点功能开着、用户此刻在一个已命名的地点、定位不太旧、距离角色上一次留言已经隔了一阵。
 */
export const checkPlaceNoteEligibility = async ({ chatId, settings, place, now = Date.now() }) => {
  if (!settings?.enabled) return false;
  if (!place?.id || !place.isNamed) return false;
  if (getLocationFixAgeMs(settings, now) > PLACE_NOTE_MAX_FIX_AGE_MS) return false;

  const lastCharNoteAt = await getLastCharNoteTime(chatId);

  return !lastCharNoteAt || (now - lastCharNoteAt) >= PLACE_NOTE_COOLDOWN_MS;
};

const buildPlaceNoteOfferText = (placeName) => [
  '【可选行为：在小册子里留一句小记录】',
  `你和用户有一本共同的"地点小册子"，用户此刻就在「${placeName}」。如果这次聊天里，在这个地方发生了一件真正值得记住的小事（比如用户说了一句有趣的话、做了什么、有什么心情），你可以悄悄给这个地方留一句记录，用户之后会在小册子里看到。`,
  '做法：在这次回复的最后另起一行，写 [PLACE_NOTE: 一句话]。例如：[PLACE_NOTE: 今天在这里说想养一只猫]',
  '规则：',
  '1. 这是很少使用的行为。大多数时候不要用，拿不准就不用。',
  '2. 只记录这次聊天里真实发生的事，或者用户亲口说的话，不要编造，也不要只是重复地点名字或位置本身。',
  '3. 一句话，不超过 30 个字，不要 emoji，不要引号。',
  '4. 一次回复最多一条，也不要在正文里提到你写了记录。',
  '5. 这行标签不会作为聊天内容显示给用户。',
].join('\n');

/**
 * 这一次回复要不要把"可以留言"的选项交给角色。
 * 不满足条件、或者这次没被选中，就返回空字符串——提示词里一个字都不多。
 */
export const getPlaceNoteOffer = async ({
  chatId,
  settings,
  place,
  now = Date.now(),
  random = Math.random,
}) => {
  if (random() >= PLACE_NOTE_OFFER_PROBABILITY) return '';

  const eligible = await checkPlaceNoteEligibility({ chatId, settings, place, now });

  return eligible ? buildPlaceNoteOfferText(place.name) : '';
};

/**
 * 处理角色回复里的 [PLACE_NOTE: ...] 标签：标签一律从正文里去掉；
 * 只有此刻确实满足留言条件、文字有效、不是重复的一句时，才会写进小册子。
 * 返回去掉标签之后的正文。
 */
export const applyPlaceNoteDirective = async ({ chatId, content, now = Date.now() }) => {
  const { content: visibleContent, note } = extractPlaceNoteDirective(content);

  if (!note) return visibleContent;

  try {
    const settings = await db.locationSettings.get(chatId);
    const place = settings?.currentPlaceId
      ? await db.places.get(settings.currentPlaceId)
      : null;

    const eligible = await checkPlaceNoteEligibility({ chatId, settings, place, now });

    if (!eligible) return visibleContent;

    const existing = await db.placeMemories
      .where('placeId')
      .equals(place.id)
      .toArray();

    const compare = normalizeForCompare(note);

    if (existing.some((memory) => normalizeForCompare(memory.text) === compare)) {
      return visibleContent;
    }

    const timestamp = new Date(now).toISOString();

    await db.placeMemories.add({
      chatId,
      placeId: place.id,
      author: 'char',
      text: note,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 每个地点只留最近的 N 条角色记录。
    const charNotes = existing
      .filter((memory) => memory.author === 'char')
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const overflow = charNotes.length + 1 - PLACE_NOTE_CHAR_KEEP_PER_PLACE;

    if (overflow > 0) {
      await db.placeMemories.bulkDelete(
        charNotes.slice(0, overflow).map((memory) => memory.id),
      );
    }
  } catch (error) {
    console.warn('[Location] 记录地点小记录失败：', error);
  }

  return visibleContent;
};

const describeAge = (createdAt, now) => {
  const time = new Date(createdAt).getTime();

  if (!Number.isFinite(time)) return '';

  const days = Math.floor((now - time) / (24 * 60 * 60 * 1000));

  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;

  const date = new Date(time);

  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

/**
 * 放进提示词的"这个地方的小记录"：最近的几条，不会很长。没有记录返回空字符串。
 */
export const getPlaceMemoryPromptLines = async (placeId, now = Date.now()) => {
  const memories = (await listPlaceMemories(placeId)).slice(0, PLACE_MEMORY_PROMPT_LIMIT);

  if (memories.length === 0) return '';

  const lines = memories.map((memory) => {
    const who = memory.author === 'char' ? '你写的' : '用户写的';
    const age = describeAge(memory.createdAt, now);

    return `  · ${age ? `${age}，` : ''}${who}：${memory.text}`;
  });

  return `- 你们在这里留下过的小记录（只在自然贴切时才提起，不要逐条复述，也不要每次都提）：\n${lines.join('\n')}\n`;
};

export default {
  listPlaceMemories,
  addUserPlaceMemory,
  updatePlaceMemory,
  deletePlaceMemory,
  extractPlaceNoteDirective,
  checkPlaceNoteEligibility,
  getPlaceNoteOffer,
  applyPlaceNoteDirective,
  getPlaceMemoryPromptLines,
};