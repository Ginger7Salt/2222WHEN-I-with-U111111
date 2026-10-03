// 情绪急救盒：数据读写/抽取逻辑。绑定角色，数据存在
// character.emotionKit = { pools: { calm: [...], task: [...], ... }, generatedAt }
// 这个附加字段上（characters 表索引不变，不需要升级数据库版本）。

import db from '../../db';
import { generateEmotionKitPools } from './emotionKitAiService';
import { EMOTION_KIT_CATEGORY_IDS } from './emotionKitTypes';

const hasUsablePools = (emotionKit) => {
  if (!emotionKit?.pools) return false;

  return EMOTION_KIT_CATEGORY_IDS.every((categoryId) => {
    const list = emotionKit.pools[categoryId];
    return Array.isArray(list) && list.length > 0;
  });
};

// 第一次进入这个角色的急救盒：如果池子已经生成过，直接用缓存；
// 否则触发一次 AI 生成（全部 5 类一次性生成，之后只抽取不再自动重生成）。
export const ensureEmotionKitGenerated = async (character) => {
  if (!character) return null;

  if (hasUsablePools(character.emotionKit)) {
    return character.emotionKit;
  }

  return generateEmotionKitPools(character);
};

// 手动"重新生成全部"：无视现有池子，强制重新生成一次。
export const regenerateEmotionKit = async (character) => {
  if (!character) return null;

  return generateEmotionKitPools(character);
};

// 抽取一张：类别随机，再从该类别池子里随机一条。
export const drawFromEmotionKit = (emotionKit) => {
  if (!hasUsablePools(emotionKit)) return null;

  const availableCategoryIds = EMOTION_KIT_CATEGORY_IDS.filter(
    (categoryId) => (emotionKit.pools[categoryId] || []).length > 0
  );

  if (availableCategoryIds.length === 0) return null;

  const categoryId = availableCategoryIds[
    Math.floor(Math.random() * availableCategoryIds.length)
  ];

  const list = emotionKit.pools[categoryId];
  const note = list[Math.floor(Math.random() * list.length)];

  return { categoryId, note };
};

export const getPoolTotal = (emotionKit) => {
  if (!emotionKit?.pools) return 0;

  return EMOTION_KIT_CATEGORY_IDS.reduce(
    (sum, categoryId) => sum + (emotionKit.pools[categoryId]?.length || 0),
    0
  );
};

export const listCharactersWithAvatar = async () => {
  const characters = await db.characters.toArray();
  return characters.filter((character) => character?.id);
};