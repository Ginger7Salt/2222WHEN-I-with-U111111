// src/apps/messages/bubbleStyleDirective.js
//
// 角色"自主决定"切换气泡风格（配色预设 + 装饰），对应待办 3。
//
// 写法沿用 companionOfferService.js / awayState.js 那一套隐藏标签模式：
// 提示词里说明用法 → 回复解析时把标签一律从正文去掉（不管这次有没有
// 生效）→ 代码再校验标签里写的名字是不是真的存在，存在才落库生效。
//
// 跟"提议养小伙伴"不同的是：用户明确要求这个不需要概率/冷却限制
// （"跟戳一戳同一套，不加限制"）——角色任何一次回复都可以自己决定换，
// 想换就换，不用像小伙伴邀请那样攒时间、掷骰子。所以这里没有
// `getXxxOfferNote` 那种"只在被抽中的这一次才把选项交出去"的逻辑，
// 提示词说明只受 `ignoreAway` 一个开关控制（跟离线/小伙伴选项的用法
// 保持一致：角色刚上线的那次自动回复不额外塞新花样）。
//
// 配色预设名单读 bubbleStylePresets.js（跟 BubbleCustomizer.jsx 设置页
// 用的是同一份数据），装饰名单读 bubbleDecorations.jsx（同理）。

import db from '../../db';
import { BUBBLE_STYLE_PRESETS } from './components/bubbleStylePresets';
import { BUBBLE_DECORATION_LIST } from './components/bubbleDecorations';

const BUBBLE_STYLE_TAG_PATTERN = /\s*\[BUBBLE_STYLE:\s*([^\]]*)\]\s*/i;

const presetNames = BUBBLE_STYLE_PRESETS.map((preset) => preset.name).join('、');
const decorationNames = BUBBLE_DECORATION_LIST
  .map((decoration) => decoration.name)
  .join('、');

export const BUBBLE_STYLE_PROMPT_NOTE = `
【可选行为：切换聊天气泡风格】
你可以随时自主决定给这个聊天窗换一套气泡的配色和装饰，不需要征求用户同意，
也不用担心用得太频繁——挑一个你觉得当下气氛/心情最贴切的风格即可，不合适
就不用换。

可选配色预设（从下面名字里选一个，照抄名字，不要自己编）：
${presetNames}

可选装饰（从下面名字里选一个；不想加装饰就写"无装饰"）：
${decorationNames}

如果你决定换风格，请在回复正文的最后单独一行加上（用户不会看到这行原始
文字，系统会直接把气泡样式换掉）：
[BUBBLE_STYLE: 配色预设名字 | 装饰名字]

装饰名字可以省略（只写配色，装饰保持不变），格式为：
[BUBBLE_STYLE: 配色预设名字]

如果这次不想换，就不要写这个标签，正常回复即可。`;

const findPresetByName = (rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return null;

  return (
    BUBBLE_STYLE_PRESETS.find((preset) => preset.name === name) ||
    BUBBLE_STYLE_PRESETS.find((preset) => (
      name.includes(preset.name) || preset.name.includes(name)
    )) ||
    null
  );
};

const findDecorationByName = (rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return null;

  return (
    BUBBLE_DECORATION_LIST.find((decoration) => decoration.name === name) ||
    BUBBLE_DECORATION_LIST.find((decoration) => (
      name.includes(decoration.name) || decoration.name.includes(name)
    )) ||
    null
  );
};

/*
 * 从角色回复里取出 [BUBBLE_STYLE: ...] 标签，一律从正文去掉；
 * 标签里写的配色/装饰名字只要能匹配上已知名单，就直接落库生效
 * （db.chats.update）。已经打开的聊天窗会通过角色新消息触发的
 * `new-local-message-inserted` 事件自动重新读取 chat 数据并刷新样式，
 * 不需要额外再加一个专门的刷新事件。
 */
export const applyBubbleStyleDirective = async ({ chatId, content }) => {
  const original = String(content || '');
  const match = BUBBLE_STYLE_TAG_PATTERN.exec(original);
  const strippedContent = original.replace(BUBBLE_STYLE_TAG_PATTERN, '').trim();

  if (!match) {
    return { content: strippedContent, appliedPresetName: null, appliedDecorationName: null };
  }

  const [rawPresetPart, rawDecorationPart] = match[1].split('|');

  const preset = findPresetByName(rawPresetPart);
  const decoration = rawDecorationPart != null
    ? findDecorationByName(rawDecorationPart)
    : null;

  if (!preset && !decoration) {
    return { content: strippedContent, appliedPresetName: null, appliedDecorationName: null };
  }

  const updates = {};
  if (preset) updates.customCss = preset.code;
  if (decoration) updates.bubbleDecoration = decoration.id;

  try {
    await db.chats.update(chatId, updates);
  } catch (error) {
    console.error('[BubbleStyle] 保存气泡风格失败:', error);
    return { content: strippedContent, appliedPresetName: null, appliedDecorationName: null };
  }

  return {
    content: strippedContent,
    appliedPresetName: preset?.name || null,
    appliedDecorationName: decoration?.name || null,
  };
};