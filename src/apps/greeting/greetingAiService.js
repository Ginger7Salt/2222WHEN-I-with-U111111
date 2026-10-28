// src/apps/greeting/greetingAiService.js
//
// 让角色"亲手做一张贺卡"：构造提示词、调用一次 generateResponse、把返回内容
// 解析并校验成可以直接存库和渲染的结构。
//
// 这是一个独立的一次性生成调用，不走在线聊天的 triggerAiResponse / 方括号标签
// 解析流程（见项目约定：一次性生成放在自己的 service 文件里）。返回格式用
// 简单的 <tag>…</tag> 分段，而不是 JSON——自由创作模式要返回一大段 HTML，
// 塞进 JSON 字符串里转义很容易出错，分段解析更稳。
//
// 所有来自模型的内容都当作不可信数据：文字会去 emoji、限长；颜色只接受
// 十六进制并检查对比度；枚举值不在白名单里就回退默认；HTML 交给
// greetingSandbox.sanitizeFreeHtml 清洗，并且最终只会在沙箱 iframe 里运行。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import {
  COVER_MOTIFS,
  DEFAULT_PALETTE,
  FONT_KEYS,
  GREETING_MODE,
  LIMITS,
  PALETTE_KEYS,
  SCENES,
  getOccasion,
} from './greetingConstants';
import { sanitizeFreeHtml } from './greetingSandbox';

/* ------------------------------ 校验小工具 ------------------------------ */

const EMOJI_RE = /[\p{Extended_Pictographic}️‍]/gu;

const cleanText = (value, maxChars) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(EMOJI_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);

const pickEnum = (value, allowed, fallback) => {
  const key = String(value || '').trim().toLowerCase();
  return allowed.includes(key) ? key : fallback;
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHex = (value) => {
  const text = String(value || '').trim();
  if (!HEX_RE.test(text)) return null;
  if (text.length === 4) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
  }
  return text.toLowerCase();
};

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrastRatio = (hexA, hexB) => {
  const la = luminance(hexA);
  const lb = luminance(hexB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

// 文字色和底色对比度不够时，换成黑或白里对比更高的那个，保证正文一定读得出来。
const ensureReadable = (textHex, bgHex, minRatio) => {
  if (contrastRatio(textHex, bgHex) >= minRatio) return textHex;
  return contrastRatio('#111111', bgHex) >= contrastRatio('#ffffff', bgHex)
    ? '#111111'
    : '#ffffff';
};

const parseJsonObject = (text) => {
  const raw = String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// 把角色给的 style 对象整理成一定安全、一定可读的调色板 + 场景 + 字体。
export const normalizeInsideStyle = (rawStyle) => {
  const style = rawStyle && typeof rawStyle === 'object' ? rawStyle : {};

  const palette = {};
  PALETTE_KEYS.forEach((key) => {
    palette[key] = normalizeHex(style[key]) || DEFAULT_PALETTE[key];
  });

  palette.ink = ensureReadable(palette.ink, palette.paper, 4.5);
  palette.mute = ensureReadable(palette.mute, palette.paper, 3);
  palette.sceneInk = ensureReadable(palette.sceneInk, palette.sceneBg, 3);

  return {
    palette,
    scene: pickEnum(style.scene, SCENES, 'glow'),
    font: pickEnum(style.font, FONT_KEYS, 'serif'),
  };
};

/* ------------------------------- 解析回复 ------------------------------- */

const grabTag = (text, tag) => {
  const match = String(text || '').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
};

// 解析模型回复。返回 null 表示"这份回复不能用"（调用方可以重试）。
// requestedMode 是用户选的模式；如果选了自由创作但 HTML 无效/缺失，会降级成
// 积木库模式（只要文字内容完整），而不是直接判失败。
export const parseGreetingReply = (raw, requestedMode = GREETING_MODE.BLOCKS) => {
  const text = String(raw || '');

  const title = cleanText(grabTag(text, 'title'), LIMITS.title);
  const to = cleanText(grabTag(text, 'to'), LIMITS.to) || '给你';
  const sign = cleanText(grabTag(text, 'sign'), LIMITS.sign);

  const body = grabTag(text, 'body')
    .split(/\n+/)
    .map((line) => cleanText(line, LIMITS.bodyLineChars))
    .filter(Boolean)
    .slice(0, LIMITS.bodyLines);

  if (!title || !body.length || !sign) return null;

  const motif = pickEnum(grabTag(text, 'motif'), COVER_MOTIFS, 'mist');
  const { palette, scene, font } = normalizeInsideStyle(parseJsonObject(grabTag(text, 'style')));

  let mode = GREETING_MODE.BLOCKS;
  let html = '';
  if (requestedMode === GREETING_MODE.FREE) {
    html = sanitizeFreeHtml(grabTag(text, 'free_html'));
    if (html) mode = GREETING_MODE.FREE;
  }

  const inside = { to, body, sign, palette, scene, font };
  if (mode === GREETING_MODE.FREE) inside.html = html;

  return { mode, cover: { title, motif }, inside };
};

/* ------------------------------ 构造提示词 ------------------------------ */

const stringify = (value) => {
  if (value === null || value === undefined || value === '') return '未设置';
  if (typeof value === 'string') return value.trim() || '未设置';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getCharacterContext = (character) =>
  `【你的角色设定】
- 姓名：${stringify(character?.name)}
- 称呼 / Handle：${stringify(character?.handle)}
- 角色简介 / Bio：${stringify(character?.bio)}
- 补充设定 / Extra Notes：${stringify(character?.extraNotes)}
- 状态列表 / Status List：${stringify(character?.statusList)}
- 你对用户的了解（用户人设）：${stringify(character?.userPersona)}`;

const getEnabledWorldBooksText = async () => {
  try {
    const books = await db.worldBooks.where('isEnabled').equals(1).toArray();
    if (!books.length) return '';
    return `【已启用的世界书设定】
${books.map((book, index) => `- ${book.title || `世界书 ${index + 1}`}：${book.content || ''}`).join('\n')}`;
  } catch (error) {
    console.warn('读取世界书失败（贺卡生成会继续，只是少一段背景）：', error);
    return '';
  }
};

const OUTPUT_COMMON = `<card>
<title>封面标题</title>
<motif>mist</motif>
<to>称呼</to>
<body>
第一行
第二行
</body>
<sign>署名</sign>`;

const BLOCKS_SPEC = `【内页：积木库模式】
内页完全由你定义，不跟随用户 app 的主题。颜色、场景、字体都由你决定，让它贴合你想表达的气氛。
<style> 里放一个 JSON 对象，字段如下：
- paper：正文页底色；ink：正文文字色；mute：次要文字色
- sceneBg：上半页底色；sceneInk：上半页线条色
- glowA、glowB：上半页两团弥散光的颜色
- scene：可选 ripple / horizon / orbit / waves / glow / none
- font：可选 serif / sans / mono / kai
所有颜色必须是 #rrggbb 十六进制；ink 与 paper 要有足够对比度，保证正文清晰可读。

【输出格式（严格遵守，不要输出格式以外的任何文字）】
${OUTPUT_COMMON}
<style>{"paper":"#faf6ee","ink":"#2b2622","mute":"#8a8175","sceneBg":"#e9e2d3","sceneInk":"#2b2622","glowA":"#d8cdb6","glowB":"#efe7d6","scene":"ripple","font":"serif"}</style>
</card>`;

const FREE_SPEC = `【内页：自由创作模式】
内页是一整张竖向的画布，宽高比约 1 : 2.2，上半是第一页，下半是第二页，高度 50% 处是折痕。
你要写这张画布的 HTML，完全自由，不必跟随用户 app 的主题，可以用任何颜色、排版、动画。
硬性规则：
- 只写 <body> 里面的内容（可以包含 <style> 和 <script>），不要写 <html> <head> <body> 标签。
- 画布宽度是 100vw，高度是 100vh。尺寸请用 vw / vh / % 单位，不要写死像素。
- 页面在用户翻开贺卡的那一刻才加载，动画从加载时开始播放。
- 不能联网，不能引用任何外部文件、字体或图片；可以用内联 SVG、CSS、canvas、data: URI。不能用 <form>。
- <to> <body> <sign> 里的文字必须真正排进页面里，正文字号大约 4vw 到 5vw，确保清晰可读；重要文字不要压在折痕上。
- 页面不做任何互动也要完整好看；想加点击小互动可以，但不是必须。
- HTML 总长度不超过 40KB。
- <style> 可选：给一个 JSON，字段同积木库模式，只用于万一页面无法显示时的降级配色。

【输出格式（严格遵守，不要输出格式以外的任何文字）】
${OUTPUT_COMMON}
<free_html>
（这里放内页画布的 HTML）
</free_html>
</card>`;

export const buildGreetingSystemPrompt = async ({
  character,
  occasion = 'any',
  userNote = '',
  mode = GREETING_MODE.BLOCKS,
  context = null,
}) => {
  const occasionInfo = getOccasion(occasion);
  const worldBooksText = await getEnabledWorldBooksText();
  const note = cleanText(userNote, 120);
  const contextText = context
    ? `
【这次的来由】
这不是用户要求的，是你刚才和用户聊天时自己想送一张贺卡。
最近的聊天：
${String(context.history || '').slice(0, 1200) || '（暂无）'}
你刚才说的那句话：${cleanText(context.trigger, 200) || '（无）'}
卡片内容要和这段聊天有呼应，但不要照搬原话，也不要提"聊天记录"。
`
    : '';

  return `你现在正扮演「${character?.name || '未命名角色'}」。

${getCharacterContext(character)}

${worldBooksText}

【任务】
你要亲手为用户做一张贺卡。
场合：${occasionInfo.label}。${occasionInfo.hint}。
${note ? `用户留了一句话：「${note}」。` : '用户没有留话，由你自己决定写什么。'}
${contextText}
【写作要求】
- 用你自己的口吻写，具体、克制，像一个真实的人会写的话。不要客服式安慰，不要鸡汤，不要堆砌形容词。
- 正文 2 到 6 行，每行一句完整的话，每行不超过 28 个汉字。
- 不得使用 Emoji，不得使用 Markdown。
- 署名写你自己的名字。

【封面】
封面是简约系，颜色会自动跟随用户的主题，所以你只能选款式、写标题：
- motif 可选：mist（雾面）、ink（墨，深色）、blank（留白，一个细圆环）、line（细线）
- 标题不超过 12 个字，要像一张卡的名字，不要写成一整句话。

${mode === GREETING_MODE.FREE ? FREE_SPEC : BLOCKS_SPEC}`;
};

/* ------------------------------- 对外入口 ------------------------------- */

// 生成一张贺卡的内容。失败会抛出 Error，message 可以直接展示给用户。
export const generateGreetingContent = async ({
  character,
  occasion = 'any',
  userNote = '',
  mode = GREETING_MODE.BLOCKS,
  context = null,
}) => {
  const systemPrompt = await buildGreetingSystemPrompt({ character, occasion, userNote, mode, context });
  const userPrompt = '请现在就做这张贺卡，严格按指定格式输出。';

  // 最多尝试两次：第一次格式不对时再要一次。网络/配置类错误由 generateResponse 直接抛出。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    const parsed = parseGreetingReply(raw, mode);
    if (parsed) return parsed;
  }

  throw new Error('这次没有做成一张完整的贺卡，可以再试一次。');
};
