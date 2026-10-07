// src/apps/messages/bubbleStyleSession.js
//
// 角色在正常回复里写了 [BUBBLE_WANT]（"我想换气泡"）之后，立刻补的那一次
// 单独调用。完整的提示词（形状名单 + 进场动画名单 + 怎么自己写 CSS 的规则）
// 只在这里出现，平时的主聊天提示词里只有一句"想换就写 [BUBBLE_WANT]"。
//
// 写法跟 pokeService.js / challengeService.js 一样：直接 fetch 到
// db.settings 里的 apiConfig，不经过 aiService.js（aiService.js 要 import
// 这个文件，反过来 import 会循环依赖）。失败一律静默，只留一条 console.warn，
// 不影响已经写入的正常回复。
//
// 结果怎么落地：
//   - 形状 / 进场动画：直接写进 chats.bubbleShape / chats.bubbleAnimation，
//     跟之前角色自己切换形状一样，立刻生效；
//   - 角色自己写的 CSS：清洗后先"试用"（写进 chats.bubbleCharCss），同时在
//     聊天里追加一张 bubble_css_card 卡片，让用户选保存还是还原。

import Dexie from 'dexie';
import db from '../../db';
import { BUBBLE_SHAPES } from './components/bubbleShapes';
import { BUBBLE_ANIMATIONS } from './components/bubbleAnimations';
import { sanitizeBubbleCss, MAX_BUBBLE_CSS_LENGTH } from './bubbleCssSanitizer';
import { setCharBubbleCss } from './bubbleCustomStyleService';

const HISTORY_LIMIT = 8;
const HISTORY_LINE_MAX = 120;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', { detail: { chatId } }),
  );
};

const findByName = (list, rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return null;

  return (
    list.find((item) => item.name === name)
    || list.find((item) => name.includes(item.name) || item.name.includes(name))
    || null
  );
};

const getRecentHistoryText = async (chatId, character) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(HISTORY_LIMIT)
    .toArray();

  return rows
    .reverse()
    .filter((row) => row.type === 'text' && row.content)
    .map((row) => {
      const who = row.sender === 'user' ? '用户' : (character?.name || '你');
      return `${who}：${String(row.content).replace(/\s+/g, ' ').slice(0, HISTORY_LINE_MAX)}`;
    })
    .join('\n');
};

// 还有一张没处理（既没保存也没还原）的试用卡片时，不再开新的一轮，
// 避免用户还没表态角色就一直在换。
const hasPendingTrialCard = async (chatId) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(60)
    .toArray();

  return rows.some((row) => row.type === 'bubble_css_card' && row.metadata?.status === 'trial');
};

const buildSessionPrompt = ({ character, chat, historyText, triggerReply }) => {
  const shapeNames = BUBBLE_SHAPES.map((shape) => shape.name).join('、');
  const animationNames = BUBBLE_ANIMATIONS.map((animation) => animation.name).join('、');
  const currentShape = BUBBLE_SHAPES.find((shape) => shape.id === chat?.bubbleShape)?.name || '跟随配色';
  const currentAnimation = BUBBLE_ANIMATIONS.find((animation) => animation.id === chat?.bubbleAnimation)?.name || '无动画';
  const hasCharCss = Boolean(chat?.bubbleCharCss);

  return `你正在扮演角色：${character?.name || '角色'}。

角色设定：
${String(character?.bio || '无').slice(0, 800)}

补充设定：
${String(character?.extraNotes || '无').slice(0, 400)}

你刚才在和用户聊天时，表示想给这个聊天窗的气泡换点新花样。现在请你决定具体怎么换，要符合你的性格和当下的聊天气氛。

最近的聊天：
${historyText || '（暂无）'}

你刚才说的这句话：${String(triggerReply || '').slice(0, 200)}

当前状态：形状「${currentShape}」，进场动画「${currentAnimation}」，${hasCharCss ? '已经有一套你写的自定义样式在试用' : '没有自定义样式'}。

你可以做下面三件事里的任意几件（至少做一件），不做的就整行不写：

1. 换形状（照抄名字）：${shapeNames}
   [SHAPE: 形状名]
2. 换进场动画（照抄名字）：${animationNames}
   [ANIMATION: 动画名]
3. 自己写一段气泡 CSS，用来改颜色、边框、阴影、圆角、字体、装饰小图案等。格式：
   [NAME: 给这套样式起个名字，8 个字以内]
   [SAY: 用你自己的语气对用户说一句话介绍它，30 个字以内]
   [CSS]
   这里写 CSS
   [/CSS]

写 CSS 的规则（不符合的内容会被系统直接丢掉）：
- 选择器只能是 .user-bubble（用户的气泡）和 .ai-bubble（你的气泡），可以加 :hover、::before、::after，不能写别的选择器，不能写 .user-bubble 和 .ai-bubble 以外的任何东西（不能写 body、不能写标签名、不能写别的 class）。
- 常用属性都可以用：background、color、border、border-radius、box-shadow、padding、font-*、letter-spacing、transform、transition、animation、filter、clip-path、content（只能是纯文字字符串）等。
- 可以写最多 4 个 @keyframes 动画，然后在 animation 里引用。
- 不能用 url()、@import、图片链接，也不能写 position:fixed。
- 颜色可以用 var(--accent-color)、var(--text-main)、var(--control-soft-bg)、var(--divider) 这些主题变量，让深浅色主题下都看得清。
- 文字必须保持看得清，不要让文字和背景颜色接近；不要用 Emoji。
- 总长度不超过 ${MAX_BUBBLE_CSS_LENGTH} 个字符，保持简洁。

严格按照上面的标签格式输出，不要有任何多余的话、不要加代码块围栏（\`\`\`）、不要用中文全角的【】或（）代替英文半角的 [ ]。下面是一个完整的输出例子，照着这个格式写，内容按你自己的想法换掉：
[NAME: 暖阳絮语]
[SAY: 想给我们的对话加一点暖色，你看喜欢吗]
[CSS]
.user-bubble { background: var(--accent-color); color: var(--accent-foreground); border-radius: 1.2rem 1.2rem 0.2rem 1.2rem; }
.ai-bubble { background: #fff3e0; color: #5c3a1e; border: 1px solid rgba(255, 183, 94, 0.4); border-radius: 1.2rem 1.2rem 1.2rem 0.2rem; }
[/CSS]`;
};

const callModel = async (systemPrompt) => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请按照上面的要求执行。' },
      ],
      temperature: 0.9,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
};

const readTag = (text, tagName) => {
  const match = new RegExp(`\\[${tagName}:\\s*([^\\]]*)\\]`, 'i').exec(text);
  return match ? match[1].trim() : '';
};

// 优先认 [CSS]...[/CSS]；角色没按格式写时还有两层兜底：一是常见的
// ```css ... ``` 代码块围栏，二是直接从第一个 .user-bubble / .ai-bubble
// 选择器开始、扫到花括号配对结束为止，尽量把角色写的内容抢救出来——
// 抢救出来的内容仍然要过 sanitizeBubbleCss 这一关，格式不对还是会被丢掉，
// 这里只是不让"没完全按标签格式"变成"什么都没发生"。
const readCssBlock = (text) => {
  const tagged = /\[CSS\]([\s\S]*?)\[\/CSS\]/i.exec(text);
  if (tagged) {
    return tagged[1]
      .replace(/^\s*```(?:css)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();
  }

  const fenced = /```(?:css)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced && /\.(user|ai)-bubble/.test(fenced[1])) {
    return fenced[1].trim();
  }

  const startMatch = /\.(user|ai)-bubble/i.exec(text);
  if (!startMatch) return '';

  // 从第一个气泡选择器开始，切到文本里最后一个"}"为止，尽量把角色写的
  // 所有规则（包括后面的 .ai-bubble、@keyframes）都包进来；不要求这段
  // 本身大括号严格配对——不配对的话 sanitizeBubbleCss 会直接判定整段
  // 作废，是安全的兜底，不会把半截内容当真。
  const lastBraceIndex = text.lastIndexOf('}');
  if (lastBraceIndex < startMatch.index) return '';

  return text.slice(startMatch.index, lastBraceIndex + 1).trim();
};

const insertBubbleCssCard = async ({ chatId, character, css, name, say }) => {
  const nowIso = new Date().toISOString();
  const metadata = { css, name, say, status: 'trial' };
  const content = say || `换了一套新的气泡样式「${name}」`;

  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'bubble_css_card',
    content,
    metadata,
    versions: [{ type: 'bubble_css_card', content, metadata, timestamp: nowIso }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: nowIso,
  });
};

export const runBubbleStyleSession = async ({ chatId, character, triggerReply }) => {
  try {
    if (!chatId || !character) return { applied: false };
    if (await hasPendingTrialCard(chatId)) return { applied: false, reason: 'pending-trial' };

    const chat = await db.chats.get(chatId);
    if (!chat) return { applied: false };

    const historyText = await getRecentHistoryText(chatId, character);
    const prompt = buildSessionPrompt({ character, chat, historyText, triggerReply });
    const rawText = await callModel(prompt);
    if (!rawText) return { applied: false };

    const shape = findByName(BUBBLE_SHAPES, readTag(rawText, 'SHAPE'));
    const animation = findByName(BUBBLE_ANIMATIONS, readTag(rawText, 'ANIMATION'));

    const updates = {};
    if (shape) updates.bubbleShape = shape.id;
    if (animation) updates.bubbleAnimation = animation.id;
    if (Object.keys(updates).length > 0) {
      await db.chats.update(chatId, updates);
    }

    let cssApplied = false;
    const rawCss = readCssBlock(rawText);

    if (rawCss) {
      const result = sanitizeBubbleCss(rawCss);

      if (result.ok) {
        const name = readTag(rawText, 'NAME').slice(0, 12) || '角色的气泡样式';
        const say = readTag(rawText, 'SAY').slice(0, 60);

        await setCharBubbleCss(chatId, { css: result.css, name });
        await insertBubbleCssCard({ chatId, character, css: result.css, name, say });
        cssApplied = true;
      } else {
        console.warn('[BubbleStyleSession] 角色写的 CSS 没有可用内容，已丢弃：', result.reason);
      }
    }

    if (Object.keys(updates).length > 0 || cssApplied) {
      dispatchLocalMessageEvent(chatId);
    }

    return { applied: Object.keys(updates).length > 0 || cssApplied };
  } catch (error) {
    console.warn('[BubbleStyleSession] 换气泡这一轮失败，已跳过：', error);
    return { applied: false };
  }
};