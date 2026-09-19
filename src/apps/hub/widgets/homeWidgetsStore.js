// src/apps/hub/widgets/homeWidgetsStore.js
//
// 首页小组件实例的增删改查。存在新表 db.homeWidgets 里——这是一个
// 全新的概念（用户自己在首页加的小组件实例列表），不是给某张已有表
// 追加字段就能表达的，所以按项目里 pebblings/snapshots 那样新增
// 表的先例，单独开一张表。
//
// 每条记录：{ id, type, config, createdAt }
//   - type：对应 widgetRegistry.js 里的某个类型
//   - config：该类型自己的配置（比如纪念日倒数需要 { importantDateId }，
//     定时消息倒计时不需要配置，config 就是 {}）

import db from '../../../db';

export const listHomeWidgets = async () => {
  try {
    return await db.homeWidgets.orderBy('createdAt').toArray();
  } catch (error) {
    console.error('读取首页小组件失败：', error);
    return [];
  }
};

export const addHomeWidget = async ({ type, config = {} }) => {
  if (!type) return null;

  const id = await db.homeWidgets.add({
    type,
    config,
    createdAt: new Date().toISOString(),
  });

  return db.homeWidgets.get(id);
};

export const removeHomeWidget = async (id) => {
  try {
    await db.homeWidgets.delete(id);
  } catch (error) {
    console.error('删除首页小组件失败：', error);
  }
};

export const updateHomeWidgetConfig = async (id, config) => {
  try {
    await db.homeWidgets.update(id, { config });
  } catch (error) {
    console.error('更新首页小组件配置失败：', error);
  }
};

export default {
  listHomeWidgets,
  addHomeWidget,
  removeHomeWidget,
  updateHomeWidgetConfig,
};