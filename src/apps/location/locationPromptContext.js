// src/apps/location/locationPromptContext.js
//
// 生成拼接进 system prompt 的"位置感知"文本块，写法仿照
// almanacPromptBuilder / innerWorldPromptContext 的模式：
// 任何失败都安全降级为空字符串，绝不能因为定位数据阻断正常聊天。

import db from '../../db';
import {
  getLocationSettings,
  getCurrentStayDurationMs,
  getLocationFixAgeMs,
} from './placeService';
import {
    getPlaceMemoryPromptLines,
  getPlaceNoteOffer,
} from './placeMemoryService';
import { getChatPatternPromptLine } from './placePatternService';

// 定位比这个更旧，就提醒角色"用户可能已经离开了"，不要断言 ta 还在这里。
const STALE_FIX_MS = 60 * 60 * 1000;
const formatAge = (ms) => {
  const totalMinutes = Math.max(1, Math.round(ms / (60 * 1000)));

  if (totalMinutes < 60) return `${totalMinutes}分钟`;

  const hours = Math.floor(totalMinutes / 60);

  return `${hours}小时`;
};

export const getLocationPromptContext = async (chatId) => {
  try {
    const settings = await getLocationSettings(chatId);

    if (!settings.enabled) return '';

    const currentPlace = settings.currentPlaceId
      ? await db.places.get(settings.currentPlaceId)
      : null;

    if (!currentPlace) return '';

    const stayMs = getCurrentStayDurationMs(settings);
    const stayHours = Math.floor(stayMs / (60 * 60 * 1000));
    const stayMinutes = Math.floor(
      (stayMs % (60 * 60 * 1000)) / (60 * 1000),
    );

    let stayText = '';

    if (stayHours > 0) {
      stayText = `${stayHours}小时${
        stayMinutes > 0 ? `${stayMinutes}分钟` : ''
      }`;
    } else if (stayMinutes > 0) {
      stayText = `${stayMinutes}分钟`;
    }

    const fixAgeMs = getLocationFixAgeMs(settings);
    const isStale = fixAgeMs > STALE_FIX_MS;

    let block = '\n【用户当前位置感知——真实定位信息，仅在自然贴切时使用，不要每次都提】：\n';

    if (currentPlace.isNamed) {
      block += `- 用户此刻所在地点：${currentPlace.name}（第 ${
        currentPlace.visitCount || 1
      } 次到访${
        stayText ? `，这次已经待了约${stayText}` : ''
      }）。\n`;

      if (currentPlace.note) {
               block += `- 你对这个地方的印象/备注：${currentPlace.note}\n`;
      }

      block += getChatPatternPromptLine(currentPlace);
      block += await getPlaceMemoryPromptLines(currentPlace.id);

      block += '- 如果你想主动跟用户提起ta现在的位置、或分享一张位置卡片，使用格式：[LOCATION: 地点名称 | 一句附加感想(可选)]。\n';
      block += '- 不要每次都提位置，只在自然、贴合当下语境时才用；也不要让用户感觉被持续监控。\n';
    } else {
      block += '- 用户出现在一个你还不认识的新地方。你可以自然地表现出好奇，问一句"这是哪里呀？"，但不要生硬追问，也不必每次都问。\n';
    }

    if (isStale && Number.isFinite(fixAgeMs)) {
      block += `- 注意：这是大约${formatAge(fixAgeMs)}前的定位，用户现在可能已经离开了，不要断言ta还在这里。\n`;
    }

    // 角色可以悄悄往这个地方留一句小记录：只在满足条件、并且这一次被选中时才加，
    // 其余时候一个字都不多。
    if (currentPlace.isNamed) {
      const offer = await getPlaceNoteOffer({
        chatId,
        settings,
        place: currentPlace,
      });

      if (offer) {
        block += `\n${offer}\n`;
      }
    }

    return block;
  } catch (error) {
    console.warn('[Location] Prompt context skipped safely:', error);
    return '';
  }
};

export default {
  getLocationPromptContext,
};