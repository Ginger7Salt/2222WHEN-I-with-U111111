// src/apps/messages/backgroundSwitchDirective.js
//
// 背景图自主切换：跟 bubbleStyleDirective 同一套"自主时机"约定——角色
// 任何一次回复都可以自己决定换背景，不设概率/冷却限制，只要这个聊天窗
// 配置了背景图库（每张图带一句注释）即可。AI 在回复正文最后追加
// [SWITCH_BACKGROUND: 注释原文] 来触发，用户看不到这行原始文字，系统会
// 把它解析掉并把对应背景图设为当前背景（chat.bgImage）。

import db from '../../db';

const BACKGROUND_SWITCH_TAG_PATTERN = /\s*\[SWITCH_BACKGROUND:\s*([^\]]*)\]\s*/i;

const normalize = (text) => String(text || '').trim().toLowerCase();

const findBackgroundByCaption = (backgrounds, rawCaption) => {
  const target = normalize(rawCaption);
  if (!target) return null;

  const exact = backgrounds.find((item) => normalize(item.caption) === target);
  if (exact) return exact;

  return (
    backgrounds.find((item) => {
      const caption = normalize(item.caption);
      return caption && (caption.includes(target) || target.includes(caption));
    }) || null
  );
};

// 组装喂给 AI 的提示词片段：列出当前聊天窗配置的所有背景图注释。
// 没有配置图库（或图库里没有任何带注释的图）时返回空字符串——这样
// AI 不会被告知一个它根本用不上的"可选行为"。
export const buildBackgroundSwitchPromptNote = (backgrounds) => {
  const list = Array.isArray(backgrounds)
    ? backgrounds.filter((item) => item?.image && String(item?.caption || '').trim())
    : [];

  if (list.length === 0) return '';

  const captionLines = list.map((item) => `- ${item.caption.trim()}`).join('\n');

  return `
【可选行为：切换聊天背景图】
这个聊天窗配置了几张可选的背景图，每张都配了一句注释，帮你判断什么场合
适合换上它。你可以随时自主决定要不要换背景——不需要征求用户同意，也不
用担心用得太频繁，不设概率/冷却限制，单纯看当下这段对话的氛围/场景跟
哪张图的注释最贴切；都不贴切的话，就不用换。

当前可选的背景图注释：
${captionLines}

如果你决定换背景，请在回复正文的最后单独一行加上（用户不会看到这行原始
文字，系统会直接把背景图换掉；注释要跟上面列出的某一条完全一致或非常接
近，否则系统会匹配不到）：
[SWITCH_BACKGROUND: 对应的注释原文]
`;
};

// 解析并应用背景切换指令：无论是否匹配成功，都会把标签从正文中剥离。
export const applyBackgroundSwitchDirective = async ({ chatId, content, backgrounds }) => {
  const original = String(content || '');
  const match = BACKGROUND_SWITCH_TAG_PATTERN.exec(original);
  const strippedContent = original.replace(BACKGROUND_SWITCH_TAG_PATTERN, '').trim();

  if (!match) {
    return { content: strippedContent, appliedCaption: null };
  }

  const list = Array.isArray(backgrounds) ? backgrounds : [];
  const target = findBackgroundByCaption(list, match[1]);

  if (!target) {
    return { content: strippedContent, appliedCaption: null };
  }

  try {
    await db.chats.update(chatId, { bgImage: target.image });
  } catch (error) {
    console.error('[backgroundSwitchDirective] 更新背景图失败：', error);
    return { content: strippedContent, appliedCaption: null };
  }

  return { content: strippedContent, appliedCaption: target.caption };
};