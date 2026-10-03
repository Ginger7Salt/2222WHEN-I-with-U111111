// 情绪急救盒：首次生成这个角色的 5 类 x 3 条纸条池子。
//
// 复用 aiService.js 导出的 generateResponse（跟 Pebbling / 长RP 同一个
// 一次性调用入口），不是在线回复管线，也不是线下模式的 JSON-envelope
// 写法——这是独立功能自己的一次性调用，按架构约定走这条路径。
//
// 已知限制：generateResponse 内部只读主 API 配置，不会在主 API 失败时
// 自动切换到备用 API（这是全项目现有的一个小缺口，diyAreaService 那边
// 已经记录过，不是这个文件新引入的）。失败时整段直接走兜底文案，
// 不会抛出未处理的异常。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import {
  EMOTION_KIT_CATEGORIES,
  EMOTION_KIT_CATEGORY_IDS,
  EMOTION_KIT_FALLBACK_NOTES,
  EMOTION_KIT_NOTES_PER_CATEGORY,
} from './emotionKitTypes';

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

const buildFallbackPools = (nowIso) => {
  const pools = {};

  EMOTION_KIT_CATEGORY_IDS.forEach((categoryId) => {
    pools[categoryId] = EMOTION_KIT_FALLBACK_NOTES[categoryId].map((text) => ({
      text,
      createdAt: nowIso,
    }));
  });

  return pools;
};

const buildSystemPrompt = (character) => {
  const categoryLines = EMOTION_KIT_CATEGORY_IDS
    .map((id) => `- ${id}（${EMOTION_KIT_CATEGORIES[id].label}）`)
    .join('\n');

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

用户现在心情不好，不一定想打字说话，于是打开了属于你的"情绪急救盒"——
一个可以直接抽一张纸条获得安慰的地方，不需要用户先开口。请你用第一人称，
以这个角色的语气和说话习惯，为以下 5 个类别各写 ${EMOTION_KIT_NOTES_PER_CATEGORY} 条纸条：

${categoryLines}

每一条要求：
- 20 到 60 个汉字之间；
- 语气要符合上面的人设，但核心目的始终是安抚、陪伴，不要说教或指责；
- 不使用 Emoji；
- 同一类别内的几条之间语气/角度要有变化，不要互相重复。

严格要求：
- 只输出合法 JSON 对象，形如
  {"calm": ["...", "...", "..."], "task": [...], "letter": [...], "affirm": [...], "memory": [...]}；
- 五个 key 都必须是上面给出的英文类别名，且每个 key 下恰好 ${EMOTION_KIT_NOTES_PER_CATEGORY} 条；
- 不要输出 Markdown、代码块围栏、编号或任何多余说明，只输出这一个 JSON 对象本身。`;
};

const parsePoolsFromRawText = (rawText) => {
  const cleaned = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 返回内容不是对象');
  }

  const nowIso = new Date().toISOString();
  const pools = {};

  EMOTION_KIT_CATEGORY_IDS.forEach((categoryId) => {
    const rawList = Array.isArray(parsed[categoryId]) ? parsed[categoryId] : [];

    const cleanedList = rawList
      .map((line) => removeEmoji(line).slice(0, 80))
      .filter(Boolean)
      .slice(0, EMOTION_KIT_NOTES_PER_CATEGORY)
      .map((text) => ({ text, createdAt: nowIso }));

    pools[categoryId] = cleanedList.length >= EMOTION_KIT_NOTES_PER_CATEGORY
      ? cleanedList
      : EMOTION_KIT_FALLBACK_NOTES[categoryId].map((text) => ({
        text,
        createdAt: nowIso,
      }));
  });

  return pools;
};

// 生成（或重新生成）一个角色的全部情绪急救盒池子，并直接缓存进
// character.emotionKit 字段（不是 Dexie 索引字段，不需要升级数据库版本）。
export const generateEmotionKitPools = async (character) => {
  const nowIso = new Date().toISOString();

  if (!character) {
    return { pools: buildFallbackPools(nowIso), generatedAt: nowIso };
  }

  try {
    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      const fallback = { pools: buildFallbackPools(nowIso), generatedAt: nowIso };

      if (character.id) {
        await db.characters.update(character.id, { emotionKit: fallback });
      }

      return fallback;
    }

    const rawText = await generateResponse([
      { role: 'system', content: buildSystemPrompt(character) },
    ], { temperature: 0.9 });

    const pools = parsePoolsFromRawText(rawText);
    const result = { pools, generatedAt: nowIso };

    if (character.id) {
      await db.characters.update(character.id, { emotionKit: result });
    }

    return result;
  } catch (error) {
    console.warn(
      '[EmotionKitAiService] 情绪急救盒生成失败，先用通用文案顶上。',
      error
    );

    const fallback = { pools: buildFallbackPools(nowIso), generatedAt: nowIso };

    if (character?.id) {
      await db.characters.update(character.id, { emotionKit: fallback });
    }

    return fallback;
  }
};