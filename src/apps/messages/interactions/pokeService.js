import db from '../../../db';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

// 角色专属戳一戳反应文案还没生成出来之前（或者生成失败时）的兜底文案，
// 语气尽量中性，不绑定任何具体人设。
const FALLBACK_POKE_REPLIES = [
  '干嘛戳我～',
  '嗯？在叫我吗。',
  '别戳啦，怪痒的。',
  '有事直说，戳我做什么。',
  '戳一下就想我理你？',
];

// 每个角色专属的 3-5 条戳一戳反应文案：第一次被戳时，按这个角色的
// bio/extraNotes 让 AI 生成一次，结果直接缓存进角色资料的 pokeReplies
// 字段（不是 Dexie 索引字段，不需要升级数据库版本）。以后戳这个角色
// 都直接从缓存里随机挑一条，不必每次都调用 AI，也不给用户提供编辑入口。
export const ensurePokeReplies = async (character) => {
  if (!character) return FALLBACK_POKE_REPLIES;

  const cached = Array.isArray(character.pokeReplies)
    ? character.pokeReplies.filter(
      (line) => typeof line === 'string' && line.trim()
    )
    : [];

  if (cached.length >= 3) {
    return cached;
  }

  try {
    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return FALLBACK_POKE_REPLIES;
    }

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const systemPrompt = `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

用户会不定期"戳一戳"你（类似隔空捅一下肩膀，一种很轻的撒娇/调侃式互动，
不是正式对话）。请给出 3 到 5 句这个角色被戳一下时，第一人称脱口而出的
即时反应，必须符合以上人设的语气和说话习惯，彼此之间语气可以有变化
（比如有的傲娇、有的开心、有的假装生气）。

严格要求：
- 只输出合法 JSON 数组，形如 ["...", "...", "..."]；
- 每一句 4 到 16 个汉字之间；
- 不使用 Emoji；
- 不要输出 Markdown、代码块围栏、编号或任何多余说明，只输出这个 JSON 数组本身。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      return FALLBACK_POKE_REPLIES;
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || '';

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    const phrases = Array.isArray(parsed)
      ? parsed
        .map((line) => removeEmoji(line).slice(0, 20))
        .filter(Boolean)
        .slice(0, 5)
      : [];

    if (phrases.length < 3) {
      return FALLBACK_POKE_REPLIES;
    }

    if (character.id) {
      await db.characters.update(character.id, { pokeReplies: phrases });
    }

    return phrases;
  } catch (error) {
    console.warn(
      '[PokeService] 戳一戳反应文案生成失败，先用通用文案顶上。',
      error
    );

    return FALLBACK_POKE_REPLIES;
  }
};

export const pickPokeReply = (phrases) => {
  const list = Array.isArray(phrases) && phrases.length > 0
    ? phrases
    : FALLBACK_POKE_REPLIES;

  return list[Math.floor(Math.random() * list.length)];
};

// 创建一条戳一戳记录。direction 是谁戳了谁：
// 'user_to_char' = 用户戳角色，'char_to_user' = 角色主动戳用户。
// intensity 决定播放的效果强弱：'light' = 双击头像的轻量效果，
// 'full' = 表情区手势触发的全屏效果。
export const createPokeMessage = async ({
  chatId,
  characterId,
  direction,
  intensity = 'light',
  reactionText = '',
  actorLabel = '',
  targetLabel = '',
}) => {
  if (!chatId || !characterId || !direction) {
    return null;
  }

  const timestamp = new Date().toISOString();

  // content 留一句人能看懂的摘要：既是找不到渲染组件时的兜底文案，
  // 也顺带让这次戳一戳能被现有的记忆管线正常收录——不用为它专门
  // 再写一遍记忆相关的逻辑。
  const content = actorLabel && targetLabel
    ? `${actorLabel} 戳了戳 ${targetLabel}${
      reactionText ? `，对方回应：${reactionText}` : ''
    }`
    : '戳了戳对方';

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: direction === 'char_to_user' ? 'character' : 'user',
    type: 'poke',
    content,
    metadata: {
      direction,
      intensity,
      reactionText,
    },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
  });

  dispatchLocalMessageEvent(chatId);

  return messageId;
};