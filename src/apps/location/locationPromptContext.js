// src/apps/location/locationPromptContext.js
//
// 生成拼接进 system prompt 的"位置感知"文本块，写法仿照
// almanacPromptBuilder / innerWorldPromptContext 的模式：
// 任何失败都安全降级为空字符串，绝不能因为定位数据阻断正常聊天。

import db from '../../db';
import { getLocationSettings } from './placeService';

export const getLocationPromptContext = async (chatId) => {
  try {
    const settings = await getLocationSettings(chatId);

    if (!settings.enabled) return '';

    const currentPlace = settings.currentPlaceId
      ? await db.places.get(settings.currentPlaceId)
      : null;

    if (!currentPlace) return '';

    let block = '\n【用户当前位置感知——真实定位信息，仅在自然贴切时使用，不要每次都提】：\n';

    if (currentPlace.isNamed) {
      block += `- 用户此刻所在地点：${currentPlace.name}（已到访 ${currentPlace.visitCount || 1} 次）。\n`;
      block += '- 如果你想主动跟用户提起ta现在的位置、或分享一张位置卡片，使用格式：[LOCATION: 地点名称 | 一句附加感想(可选)]。\n';
      block += '- 不要每次都提位置，只在自然、贴合当下语境时才用；也不要让用户感觉被持续监控。\n';
    } else {
      block += '- 用户出现在一个你还不认识的新地方。你可以自然地表现出好奇，问一句"这是哪里呀？"或类似的话，但不要生硬追问，也不必每次都问。\n';
    }

    return block;
  } catch (error) {
    console.warn('[Location] Prompt context skipped safely:', error);
    return '';
  }
};

export default { getLocationPromptContext };