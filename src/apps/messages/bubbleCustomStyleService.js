// src/apps/messages/bubbleCustomStyleService.js
//
// 角色自己写的气泡 CSS 的"试用 / 保存 / 还原"。
//
// 数据放在哪：
//   - chats.bubbleCharCss / chats.bubbleCharCssName：这个聊天窗当前正在试用
//     的角色样式（已经过 bubbleCssSanitizer 清洗、不带作用域前缀）。是跟
//     用户自己的 customCss 分开的一层，渲染时叠在上面，不会覆盖用户自己的
//     配色。都是不建索引的新增字段，不需要升级数据库版本。
//   - db.settings 里 key 为 'bubbleCustomStyles' 的一条：用户点了"保存"的
//     样式库（全局，所有聊天窗共用），每项 { id, name, css, createdAt }。
//     设置页（BubbleCustomizer.jsx）里点一下就能当配色预设用。
//   - 聊天里那张卡片本身是 type 'bubble_css_card' 的消息，metadata 里记着
//     { css, name, status: 'trial' | 'saved' | 'reverted' }。

import db from '../../db';

export const BUBBLE_CUSTOM_STYLES_KEY = 'bubbleCustomStyles';
export const MAX_SAVED_BUBBLE_STYLES = 30;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', { detail: { chatId } }),
  );
};

export const getSavedBubbleStyles = async () => {
  try {
    const record = await db.settings.get(BUBBLE_CUSTOM_STYLES_KEY);
    const list = Array.isArray(record?.value) ? record.value : [];
    return list.filter((item) => item && item.id && item.css);
  } catch (error) {
    console.warn('[BubbleCustomStyle] 读取样式库失败:', error);
    return [];
  }
};

const writeSavedBubbleStyles = async (list) => {
  await db.settings.put({ key: BUBBLE_CUSTOM_STYLES_KEY, value: list });
};

export const saveBubbleStyleToLibrary = async ({ name, css }) => {
  const cleanName = String(name || '').trim().slice(0, 12) || '角色的气泡样式';
  const existing = await getSavedBubbleStyles();

  // 完全相同的样式只留一份，不重复堆。
  const duplicated = existing.find((item) => item.css === css);
  if (duplicated) return duplicated;

  const entry = {
    id: `bcs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    css,
    createdAt: new Date().toISOString(),
  };

  const next = [entry, ...existing].slice(0, MAX_SAVED_BUBBLE_STYLES);
  await writeSavedBubbleStyles(next);
  return entry;
};

export const deleteSavedBubbleStyle = async (styleId) => {
  const existing = await getSavedBubbleStyles();
  await writeSavedBubbleStyles(existing.filter((item) => item.id !== styleId));
};

export const setCharBubbleCss = async (chatId, { css, name }) => {
  await db.chats.update(chatId, {
    bubbleCharCss: css,
    bubbleCharCssName: String(name || '').trim().slice(0, 12),
  });
};

export const clearCharBubbleCss = async (chatId) => {
  await db.chats.update(chatId, { bubbleCharCss: '', bubbleCharCssName: '' });
  dispatchLocalMessageEvent(chatId);
};

const patchCardMetadata = async (messageId, patch) => {
  const message = await db.messages.get(messageId);
  if (!message) return;

  const nextMetadata = { ...(message.metadata || {}), ...patch };
  const nextVersions = Array.isArray(message.versions)
    ? message.versions.map((version, index) => (
      index === (message.currentVersionIndex || 0)
        ? { ...version, metadata: { ...(version.metadata || {}), ...patch } }
        : version
    ))
    : message.versions;

  await db.messages.update(messageId, {
    metadata: nextMetadata,
    versions: nextVersions,
  });
};

// 卡片上的"保存"：存进样式库，样式继续留在聊天窗里生效。
export const saveBubbleCssCard = async (message) => {
  const css = message?.metadata?.css;
  if (!css) return null;

  const entry = await saveBubbleStyleToLibrary({
    name: message.metadata.name,
    css,
  });

  await patchCardMetadata(message.id, { status: 'saved' });
  dispatchLocalMessageEvent(message.chatId);
  return entry;
};

// 卡片上的"还原"：撤掉这个聊天窗里的角色样式。
export const revertBubbleCssCard = async (message) => {
  if (!message?.chatId) return;

  const chat = await db.chats.get(message.chatId);

  // 只有这个聊天窗当前生效的还是这张卡片的样式时才清掉，避免旧卡片
  // 误把后来换上的新样式撤掉。
  if (chat?.bubbleCharCss && chat.bubbleCharCss === message.metadata?.css) {
    await db.chats.update(message.chatId, { bubbleCharCss: '', bubbleCharCssName: '' });
  }

  await patchCardMetadata(message.id, { status: 'reverted' });
  dispatchLocalMessageEvent(message.chatId);
};