import db from '../../db';
import { generateResponse } from '../aiService';
import { ensureAccessRecord, savePassword } from './innerWorldAccessService';

function buildPasswordPrompt({ character }) {
  const characterName = character?.name || 'TA';

  return `你是「${characterName}」。请为你的"内心主页"设置一个今天专属的密码。

密码要求：
- 3-8个字，可以是词语、短语、你们之间的梗、一个只有你们懂的暗号
- 符合你的人设语气

只输出密码本身，不要输出任何其他文字、引号或标点。`;
}

function buildEntryPrompt({ character, recentMessages, previousEntry }) {
  const characterName = character?.name || 'TA';

  const transcript = recentMessages
    .map((m) => {
      const speaker = m.sender === 'user' ? (m.userName || '用户') : characterName;
      return `${speaker}: ${m.content}`;
    })
    .join('\n');

  const previousDimensions = previousEntry?.dimensions
    ? JSON.stringify(previousEntry.dimensions)
    : '（还没有历史记录，这是第一次）';

  return `你是「${characterName}」。现在用户翻开了你的"内心主页"——这是只有TA能看到的、你最真实的内心记录。请基于你的人设和你们最近的对话，写下此刻的内心状态。

你上一次的性格维度是：${previousDimensions}

只输出 JSON，不要输出任何其他文字或代码块标记，格式：
{
  "weather": "你所在的天气，比如'小雨'",
  "temperature": "温度，比如'18℃'",
  "mood": "此刻的心情，一两个词",
  "moodScore": 0到100之间的数字，表示心情的正负程度,
  "musings": "一段碎碎念，40字以内",
  "innerMonologue": "一段对用户的内心独白，不会说出口的那种，60字以内",
  "dimensions": {
    "自定义维度名1": 0到100的数字,
    "自定义维度名2": 0到100的数字
  },
  "dimensionNotes": {
    "维度名1": "这个维度为什么是这个水平，一句话解释"
  },
  "todos": ["接下来想和用户一起做的第一件事", "第二件事"]
}

维度请自己决定3-5个、最贴合你人设特质的名称，不要用"开朗度"这类泛泛的词，除非真的符合你。

对话内容：
${transcript}`;
}

function safeParseJsonObject(rawText) {
  if (!rawText) return null;

  const cleaned = rawText
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('[innerWorldService] 解析内心内容失败:', error, rawText);
    return null;
  }
}

export async function ensureTodayPassword(chatId, characterId, character) {
  const record = await ensureAccessRecord(chatId, characterId);
  if (record.password) return record.password;

  let rawText = '';
  try {
    rawText = await generateResponse([
      { role: 'user', content: buildPasswordPrompt({ character }) },
    ]);
  } catch (error) {
    console.error('[innerWorldService] 生成密码失败:', error);
    return null;
  }

  const password = rawText.trim().replace(/^["'“”]|["'“”]$/g, '').slice(0, 20);
  if (!password) return null;

  await savePassword(chatId, password);
  return password;
}

export async function generateTodayEntryIfNeeded(chatId, characterId, character) {
  const today = new Date().toISOString().slice(0, 10);

  const existing = await db.innerWorldEntries
    .where('[chatId+date]')
    .equals([chatId, today])
    .first();

  if (existing) return existing;

  const allMessages = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
  const recentMessages = allMessages.slice(-60);

  const priorEntries = await db.innerWorldEntries.where('chatId').equals(chatId).sortBy('date');
  const previousEntry = priorEntries[priorEntries.length - 1] || null;

  let rawText = '';
  try {
    rawText = await generateResponse([
      { role: 'user', content: buildEntryPrompt({ character, recentMessages, previousEntry }) },
    ]);
  } catch (error) {
    console.error('[innerWorldService] 生成内心内容失败:', error);
    return null;
  }

  const parsed = safeParseJsonObject(rawText);
  if (!parsed) return null;

  const entry = {
    chatId,
    characterId,
    date: today,
    weather: parsed.weather || '',
    temperature: parsed.temperature || '',
    mood: parsed.mood || '',
    moodScore: Number(parsed.moodScore) || 50,
    musings: String(parsed.musings || '').slice(0, 100),
    innerMonologue: String(parsed.innerMonologue || '').slice(0, 150),
    dimensions: parsed.dimensions || {},
    dimensionNotes: parsed.dimensionNotes || {},
    todos: Array.isArray(parsed.todos) ? parsed.todos.slice(0, 2) : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const id = await db.innerWorldEntries.add(entry);
  entry.id = id;

  return entry;
}

export async function updateInnerWorldEntry(entryId, patch) {
  await db.innerWorldEntries.update(entryId, {
    ...patch,
    updatedAt: Date.now(),
  });
}