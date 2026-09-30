// src/apps/rp/rpThinkingFold.js
//
// 思维链折叠：把AI回复正文里被"折叠标签"包住的部分（比如
// <thinking>...</thinking>）切出来，单独渲染成一个可展开/收起的折叠框，
// 不是写死只认 <thinking>——跟用户确认过，具体要折叠哪些标签由用户自己在
// 会话设置面板（RpRoomSettingsModal）里填，因为不同预设/角色卡习惯用的
// 标签名不一样（<thinking>、<think>、甚至自定义的中文标签都可能出现）。
//
// 存储层完全不动：message.content 在数据库里永远是AI原样输出的全文本，
// 标签也留在里面——这里只是渲染这一层的切分，编辑消息时 draft 依然是带
// 标签的原文，不会因为折叠功能把标签"吃掉"。
//
// session.foldTagNames 是一个字符串数组（默认 ['thinking']），会话设置面板
// 里用户以逗号分隔的形式编辑，这里再拆分/清洗成数组。用户把这个字段清空
// 就等于关掉折叠功能，整段文本按原来的方式渲染。

export const DEFAULT_FOLD_TAG_NAMES = ['thinking'];
export const DEFAULT_THINKING_LABEL_TEXT = '点击查看思考过程';

/**
 * 把逗号/顿号/空格分隔的用户输入解析成标签名数组，去空白、去重、转小写
 * （标签匹配不区分大小写）。
 */
export const parseFoldTagNamesInput = (input) => {
  return String(input || '')
    .split(/[,，、\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i);
};

const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 把 content 按 foldTagNames 里的标签切分成一个有序数组：
 *   [{ type: 'text', content }, { type: 'thinking', tag, content }, ...]
 * 标签外的原文原样保留顺序，不做任何改写；tagNames 为空数组时直接整段
 * 当作一个 text 段返回（相当于关闭折叠）。
 */
export const splitContentByFoldTags = (content, tagNames) => {
  const text = String(content || '');
  const tags = Array.isArray(tagNames) ? tagNames.filter(Boolean) : [];

  if (tags.length === 0 || !text) {
    return [{ type: 'text', content: text }];
  }

  const pattern = new RegExp(`<(${tags.map(escapeRegex).join('|')})>([\\s\\S]*?)<\\/\\1>`, 'gi');

  const segments = [];
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'thinking', tag: match[1], content: match[2].trim() });
    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
};