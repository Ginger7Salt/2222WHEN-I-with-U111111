// src/apps/shell/shellService.js
import db from '../../db';
import { fetchAiCompletionWithTools } from '../../services/aiService';
import { rollShellDraw, DAILY_QUOTA } from './shellTypes';
import { buildShellDrawPrompt } from './shellPromptBuilder';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// 今天这个角色已经打捞了几次——直接现查 shellCatches，不额外维护一张
// 配额表：跟贝壳册（全局一本）共用同一份数据源，不会有"配额表"和
// "实际打捞记录"互相不同步的问题。
export async function getTodayCatchCount(characterId) {
  if (!characterId) return 0;

  const since = startOfToday();
  const numericId = Number(characterId);

  const rows = await db.shellCatches
    .where('characterId')
    .equals(numericId)
    .filter((row) => row.createdAt >= since)
    .toArray();

  return rows.length;
}

export async function getRemainingQuota(characterId) {
  const used = await getTodayCatchCount(characterId);
  return Math.max(0, DAILY_QUOTA - used);
}

const parseDrawResponse = (rawText) => {
  const cleaned = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title || '未命名的潮汐',
      when: parsed.when || '',
      content: parsed.content || cleaned,
    };
  } catch {
    return {
      title: '未命名的潮汐',
      when: '',
      content: cleaned || '潮水卷走了这段文字，什么也没留下。',
    };
  }
};

// 打捞一次：抽身份/形式（含稀有度）→ 拼 prompt → 走带主备切换的 AI
// 请求 → 解析结果、落库。配额检查放在这里（而不是只在 UI 层判断），
// 避免任何调用方绕过 UI 直接调用时越过每日上限。
export async function salvageShell({ characterId, chatId = null }) {
  const character = await db.characters.get(Number(characterId));

  if (!character) {
    throw new Error('找不到对应的角色');
  }

  const remaining = await getRemainingQuota(character.id);

  if (remaining <= 0) {
    throw new Error('今日的潮水已经退去，明天再来打捞吧');
  }

  const draw = rollShellDraw();
  const prompt = buildShellDrawPrompt({
    character,
    identity: draw.identity,
    form: draw.form,
  });

  // 加一个本地超时兜底：aiService 的主备切换本身没有超时控制，网络卡住时
  // fetch 可能永远不 resolve。这里单独给潮汐贝壳加超时（不改动共享的
  // aiService.js），超时后明确抛错，而不是让 UI 卡在"打捞中"却什么都
  // 不告诉用户。
  const SALVAGE_TIMEOUT_MS = 45000;

  const result = await Promise.race([
    fetchAiCompletionWithTools({
      systemPrompt: prompt,
      messages: [{ role: 'user', content: '打捞。' }],
      chatId: chatId || null,
      characterId: character.id,
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('打捞超时了，潮水好像卡住了，请检查网络或 API 设置后再试'));
      }, SALVAGE_TIMEOUT_MS);
    }),
  ]);

  if (result?.error) {
    throw new Error(result.message || '打捞失败，潮水好像有点乱');
  }

  const { title, when, content } = parseDrawResponse(result.content);

  const now = Date.now();
  const payload = {
    characterId: character.id,
    chatId: chatId || null,
    identity: draw.identity,
    form: draw.form,
    tier: draw.tier,
    title,
    when,
    content,
    createdAt: now,
  };

  const id = await db.shellCatches.add(payload);

  return { id, ...payload, character };
}

// 贝壳册：全局一本，不分角色，最新的在最前面。
export async function getShellCollection() {
  const rows = await db.shellCatches.orderBy('createdAt').reverse().toArray();

  if (rows.length === 0) return [];

  const characterIds = [...new Set(rows.map((row) => row.characterId))];
  const characters = await db.characters.bulkGet(characterIds);
  const characterMap = new Map(
    characterIds.map((id, index) => [id, characters[index]])
  );

  return rows.map((row) => ({
    ...row,
    character: characterMap.get(row.characterId) || null,
  }));
}

export async function deleteShellCatch(id) {
  await db.shellCatches.delete(id);
}