// src/apps/shared-world/sharedWorldService.js
//
// 「共享世界」的数据层：一组全局的设定/规则小册子，
// 可以选择对所有角色生效，或只对指定的几位角色生效。
// 同一个世界观下的角色不必在每个角色里重复填写。
//
// 表：db.sharedWorldEntries
//   id, title, content, isEnabled(1/0), scopeMode('all'|'selected'),
//   characterIds(数组), sortOrder, createdAt, updatedAt

import db from '../../db';

export const SCOPE_ALL = 'all';
export const SCOPE_SELECTED = 'selected';

// 启用中的内容总字数超过这个值时，页面上给出"占用较多"的提示
export const SHARED_WORLD_LENGTH_WARNING = 3000;

const sortEntries = (entries) => (
  [...entries].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.id ?? 0) - (b.id ?? 0);
  })
);

export const listSharedWorldEntries = async () => {
  const entries = await db.sharedWorldEntries.toArray();
  return sortEntries(entries);
};

const normalizeCharacterIds = (ids) => (
  Array.isArray(ids) ? ids.map((id) => Number(id)).filter(Number.isFinite) : []
);

export const createSharedWorldEntry = async ({
  title,
  content,
  isEnabled = 1,
  scopeMode = SCOPE_ALL,
  characterIds = [],
}) => {
  const existing = await db.sharedWorldEntries.toArray();
  const maxOrder = existing.reduce(
    (max, entry) => Math.max(max, entry.sortOrder ?? 0),
    0,
  );
  const now = new Date().toISOString();

  return db.sharedWorldEntries.add({
    title: String(title || '').trim() || '未命名小册子',
    content: String(content || ''),
    isEnabled: isEnabled ? 1 : 0,
    scopeMode: scopeMode === SCOPE_SELECTED ? SCOPE_SELECTED : SCOPE_ALL,
    characterIds: normalizeCharacterIds(characterIds),
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateSharedWorldEntry = async (id, changes) => {
  const next = { ...changes, updatedAt: new Date().toISOString() };

  if ('title' in next) {
    next.title = String(next.title || '').trim() || '未命名小册子';
  }
  if ('isEnabled' in next) {
    next.isEnabled = next.isEnabled ? 1 : 0;
  }
  if ('scopeMode' in next) {
    next.scopeMode = next.scopeMode === SCOPE_SELECTED
      ? SCOPE_SELECTED
      : SCOPE_ALL;
  }
  if ('characterIds' in next) {
    next.characterIds = normalizeCharacterIds(next.characterIds);
  }

  await db.sharedWorldEntries.update(id, next);
};

export const deleteSharedWorldEntry = async (id) => {
  await db.sharedWorldEntries.delete(id);
};

// direction: -1 上移，1 下移。与相邻一本交换 sortOrder。
export const moveSharedWorldEntry = async (id, direction) => {
  const entries = await listSharedWorldEntries();
  const index = entries.findIndex((entry) => entry.id === id);
  const targetIndex = index + direction;

  if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) return;

  // 先统一重排成 1..n，避免历史数据里 sortOrder 相同导致交换无效
  const reordered = [...entries];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[index],
  ];

  await db.transaction('rw', db.sharedWorldEntries, async () => {
    for (let i = 0; i < reordered.length; i += 1) {
      await db.sharedWorldEntries.update(reordered[i].id, { sortOrder: i + 1 });
    }
  });
};

const isEntryActiveForCharacter = (entry, characterId) => {
  if (!entry.isEnabled) return false;
  if (!String(entry.content || '').trim()) return false;
  if (entry.scopeMode !== SCOPE_SELECTED) return true;

  return normalizeCharacterIds(entry.characterIds).includes(Number(characterId));
};

/*
 * 生成要拼进提示词的一段文字；没有任何生效内容时返回空字符串。
 * 返回值以两个换行开头，可以直接拼在核心总提示词后面。
 * 出任何错都返回空字符串，不能影响正常聊天。
 */
export const getSharedWorldPromptBlock = async (characterId) => {
  try {
    const entries = sortEntries(await db.sharedWorldEntries.toArray());
    const active = entries.filter((entry) => (
      isEntryActiveForCharacter(entry, characterId)
    ));

    if (active.length === 0) return '';

    const body = active
      .map((entry) => `《${entry.title}》\n${String(entry.content).trim()}`)
      .join('\n\n');

    return `\n\n【共享世界设定】：\n以下是你所在的世界里、各位角色共同适用的设定与规则，与核心总提示词并行生效，不覆盖也不取代它。\n\n${body}`;
  } catch (error) {
    console.warn('[SharedWorld] 读取共享世界设定失败：', error);
    return '';
  }
};