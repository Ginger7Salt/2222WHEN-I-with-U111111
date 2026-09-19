// src/apps/hub/appGridOrderStore.js
//
// 首页应用区的自定义顺序，存在 db.settings 这张已有的 key/value 表
// 里，不需要新建表、也不需要升级 Dexie 的 schema 版本。
//
// 存的只是一份 id 顺序（字符串数组），不存卡片内容本身——appGridItems.jsx
// 里各个卡片的定义还是唯一真源。这样即使以后新增/下线某个应用，也只是
// 「合并」时自动处理，不会因为顺序表跟卡片定义脱节而出问题：
//   - 顺序表里存在、卡片定义里也还在的 id：按顺序表的顺序排。
//   - 卡片定义里新增的 id（顺序表里还没有）：按它在 appGridItems.jsx
//     里原本的顺序，追加在最后。
//   - 顺序表里的 id 在卡片定义里已经找不到了（比如某个应用下线了）：
//     直接忽略，不会留下野指针。

import db from '../../db';

export const APP_GRID_ORDER_SETTINGS_KEY = 'homeAppGridOrder';

export const loadAppGridOrder = async () => {
  try {
    const saved = await db.settings.get(APP_GRID_ORDER_SETTINGS_KEY);
    if (saved && Array.isArray(saved.value)) {
      return saved.value;
    }
  } catch (error) {
    console.error('读取首页应用排序失败：', error);
  }

  return [];
};

export const saveAppGridOrder = async (orderedIds) => {
  try {
    await db.settings.put({
      key: APP_GRID_ORDER_SETTINGS_KEY,
      value: orderedIds,
    });
  } catch (error) {
    console.error('保存首页应用排序失败：', error);
  }
};

// 把「保存过的顺序」应用到「当前这一版的卡片定义」上，规则见上方注释。
export const applySavedOrder = (items, savedOrderIds) => {
  if (!savedOrderIds || savedOrderIds.length === 0) {
    return items;
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const ordered = [];

  savedOrderIds.forEach((id) => {
    const item = itemsById.get(id);
    if (item) {
      ordered.push(item);
      itemsById.delete(id);
    }
  });

  // 剩下没被顺序表提到的（新加的应用），按原本定义顺序追加在最后
  items.forEach((item) => {
    if (itemsById.has(item.id)) {
      ordered.push(item);
    }
  });

  return ordered;
};

export default {
  APP_GRID_ORDER_SETTINGS_KEY,
  loadAppGridOrder,
  saveAppGridOrder,
  applySavedOrder,
};