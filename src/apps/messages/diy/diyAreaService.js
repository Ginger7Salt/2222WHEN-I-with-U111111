import Dexie from 'dexie';
import db from '../../../db';

// 注意：这里不从 '../../../services/aiService' 里导入 generateResponse /
// getRecentChatMessages —— aiService.js 需要反过来导入本文件的
// maybeUpdateDiyArea（在 triggerAiResponse 成功回复之后调用），两边互相
// import 会形成循环依赖。跟 pokeService.js / snapshotAiService.js 的
// 做法一样，这里直接对 apiConfig 发一次 fetch，不经过 aiService.js。

// ============================================================
// 角色的DIY小屋
//
// 这是一块完全独立于聊天消息的小天地：挂在"这个聊天"上（不是挂在
// 角色身上），角色隔一段时间会自己判断要不要重新布置一下，布置的
// 内容是 HTML + 内联 CSS（+可以有少量 <script> 做点小互动，比如
// 一份可以点开的礼物、一张带点小动画的贺卡），跟聊天回复完全无关，
// 用户要主动从"爪印更多入口"菜单里点进"角色的DIY"才会看到。
//
// 之所以不走共享的单行 bracket 标签正则（aiService.js 里
// parseAiResponseToMessages 用的那套 /\[(TAG):\s*([^\]]+)\]/），
// 是因为 HTML/CSS 几乎必然会出现 ] 字符（比如属性选择器
// input[type=text]），塞进那套正则会在第一个 ] 处被提前截断。
// 这里换成一次独立的 AI 生成调用，自己解析一对成对标签
// （[DIYAREA_START]...[DIYAREA_END]），互不影响。
//
// 渲染安全完全交给调用方（CharacterDiyPage.jsx）用
// sandbox="allow-scripts"（且不带 allow-same-origin）的 iframe
// 隔离：脚本能跑，但拿不到父页面的 DOM/storage，也跳不出这个框，
// 内部的全屏定位/超大字号最多撑满这一个 iframe 的框，不会影响到
// 整个 app——所以这里不需要再额外做标签黑名单那一层过滤。
// ============================================================

// 3-5 小时区间内的一个居中默认值；检查本身（不管最后有没有真的换）
// 都会把冷却重置一次，避免冷却没到之前每条回复都触发一次 AI 调用。
const DIY_AREA_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const RECENT_HISTORY_LIMIT = 16;

const START_TAG = '[DIYAREA_START]';
const END_TAG = '[DIYAREA_END]';
const NO_UPDATE_SENTINEL = 'NO_UPDATE';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

// 换完之后弹的小卡片，纯旁白口吻的文字公告，不可点击跳转。
const DIY_UPDATE_NOTICE_LINES = [
  '{name} 偷偷把自己的小屋换了个样子。',
  '{name} 悄悄布置了一下只属于自己的那个角落。',
  '{name} 又鼓捣了一下自己的DIY小屋。',
  '{name} 趁你不注意，把小屋重新收拾了一遍。',
];

const pickNoticeText = (characterName) => {
  const template = DIY_UPDATE_NOTICE_LINES[
    Math.floor(Math.random() * DIY_UPDATE_NOTICE_LINES.length)
  ];
  return template.replace('{name}', characterName || 'TA');
};

// 给 CharacterDiyPage.jsx 用：读出这个聊天当前的DIY内容。
export const getDiyArea = async (chatId) => {
  if (!chatId) return null;

  const chat = await db.chats.get(chatId);
  if (!chat) return null;

  return {
    content: chat.diyAreaContent || '',
    updatedAt: chat.diyAreaUpdatedAt || null,
  };
};

const buildJudgePrompt = ({ character, currentContent, historyText }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你拥有一个只属于你自己的"DIY小屋"——这是一个完全独立于聊天消息的小网页
角落，用户可以随时点进去看，但它不是对话的一部分，你不是在"回复"用户，
只是在布置自己的一小块地方（有点像在收拾自己房间，或者在个人主页上随手
写点什么），所以可以带着"这到底是写给谁看的"那种暧昧真实感，不必是正式
的、直接对用户说话的内容。

这个小屋目前的样子：
${currentContent || '（现在还是空的，什么都没有）'}

最近的对话节选（仅供你参考自己最近的心情/状态，不需要在小屋里复述或提及
这些对话内容）：
${historyText || '（暂无）'}

请你自己判断：这次要不要重新布置一下这个小屋？不是每次都要换，大部分时候
可以保持原样、什么都不做——只有当你真的想改的时候才改。

严格按以下两种方式之一输出，不要有任何其他文字、解释或开场白：

1. 如果这次不想改，只输出：${NO_UPDATE_SENTINEL}

2. 如果想改，把新内容整体包在 ${START_TAG} 和 ${END_TAG} 之间，内容只能是
   HTML + 内联 CSS（style 属性或 <style> 标签都可以），允许少量 <script>
   做简单互动（比如一份可以点开的礼物、一张带点小动画的贺卡）。不要请求
   任何外部资源（图片/字体/脚本的外链），不要尝试跳出这个页面或读取页面
   之外的任何东西，不要用超大字号或铺满整个视口的定位——内容应该安安静静
   待在这个小屋自己的版面里。除了 ${START_TAG}${END_TAG} 之间的内容，不要
   输出任何别的文字。`;

const extractDiyContent = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text || text === NO_UPDATE_SENTINEL) return null;

  const startIdx = text.indexOf(START_TAG);
  const endIdx = text.indexOf(END_TAG);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  const content = text.slice(startIdx + START_TAG.length, endIdx).trim();
  return content || null;
};

// 跟在一次正常的「用户发消息 -> 角色回复」成功之后调用（只挂在这一条
// 主路径上，重新生成/角色主动发起的消息不触发，跟 aiService.js 里
// checkAbsenceEmotionSignal 的取舍是同一个道理，避免同一件事被反复
// 判断）。整个函数是 fire-and-forget：调用方用 void + catch 包起来，
// 这里面任何失败都只是「这次小屋没换成」，不应该影响正常聊天。
export const maybeUpdateDiyArea = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const lastCheckAtMs = chat.diyAreaLastCheckAt
    ? new Date(chat.diyAreaLastCheckAt).getTime()
    : 0;

  if (
    Number.isFinite(lastCheckAtMs)
    && lastCheckAtMs > 0
    && Date.now() - lastCheckAtMs < DIY_AREA_COOLDOWN_MS
  ) {
    return;
  }

  // 不管这次最终有没有真的换，先把检查时间点占上——这样冷却窗口内
  // 哪怕角色选择"这次不换"，也不会每条回复都重新触发一次 AI 调用。
  await db.chats.update(chatId, {
    diyAreaLastCheckAt: new Date().toISOString(),
  });

  const recentMessages = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(RECENT_HISTORY_LIMIT)
    .toArray()
    .then((rows) => rows.reverse());

  const historyText = recentMessages
    .filter((message) => message.type === 'text' && message.content)
    .map((message) => `${message.sender === 'user' ? '用户' : character.name}: ${message.content}`)
    .join('\n');

  const prompt = buildJudgePrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
  });

  let rawText = '';
  try {
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    rawText = data?.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.warn('[DIY] 角色DIY小屋的判断/生成调用失败，跳过本次检查:', error);
    return;
  }

  const newContent = extractDiyContent(rawText);
  if (!newContent) return;

  const updatedAtIso = new Date().toISOString();

  await db.chats.update(chatId, {
    diyAreaContent: newContent,
    diyAreaUpdatedAt: updatedAtIso,
  });

  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'diy_update',
    content: pickNoticeText(character.name),
    metadata: {},
    isRead: true,
    timestamp: updatedAtIso,
  });

  await db.chats.update(chatId, { updatedAt: updatedAtIso });

  dispatchLocalMessageEvent(chatId);
};