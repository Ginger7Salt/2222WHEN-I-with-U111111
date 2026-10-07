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
import { BUBBLE_SHAPES } from './components/bubbleShapes';
import { BUBBLE_ANIMATIONS } from './components/bubbleAnimations';

const BUBBLE_STYLE_TAG_PATTERN = /\s*\[BUBBLE_STYLE:\s*([^\]]*)\]\s*/i;

const presetNames = BUBBLE_STYLE_PRESETS.map((preset) => preset.name).join('、');
const decorationNames = BUBBLE_DECORATION_LIST
  .map((decoration) => decoration.name)
  .join('、');

// 想换形状 / 进场动画 / 自己写 CSS：只在回复末尾写一个不带内容的
// [BUBBLE_WANT]，系统马上再单独调用一次（bubbleStyleSession.js），完整的
// 名单和写 CSS 的规则只在那一次里给，不放进每次都带的主聊天提示词。
const BUBBLE_WANT_TAG_PATTERN = /\s*\[BUBBLE_WANT\]\s*/i;
const BUBBLE_WANT_TAG_PATTERN_ALL = /\s*\[BUBBLE_WANT\]\s*/gi;

// 常驻说明：只列配色和装饰的名字，形状 / 进场动画 / 自己写 CSS 合并成最后
// 一句"想不想换"，不再带名单。
export const BUBBLE_STYLE_PROMPT_NOTE = `
【可选行为：切换聊天气泡风格】
你可以随时自主决定换这个聊天窗的气泡配色和装饰，不用征求用户同意，也不用担心换得太频繁；挑当下最贴切的，不合适就不换。
配色（照抄名字，不要自己编）：${presetNames}
装饰（照抄名字，不想加就写"无装饰"）：${decorationNames}
要换就在回复正文最后单独一行写（用户看不到这行，系统会直接生效）：
[BUBBLE_STYLE: 配色名 | 装饰名]
装饰可以省略。不想换就不要写这个标签。
如果你想换气泡的形状、进场动画，或者想自己写一段气泡 CSS，就在回复最后单独一行写 [BUBBLE_WANT]，系统会马上再单独问你具体想怎么换。`;

// 保持原来的函数名和调用方式（aiService.js 里已经在用），不再按概率带名单。
export const buildBubbleStylePromptNote = () => BUBBLE_STYLE_PROMPT_NOTE;

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
const findShapeByName = (rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return null;

  return (
    BUBBLE_SHAPES.find((shape) => shape.name === name) ||
    BUBBLE_SHAPES.find((shape) => (
      name.includes(shape.name) || shape.name.includes(name)
    )) ||
    null
  );
};

const findAnimationByName = (rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return null;

  return (
    BUBBLE_ANIMATIONS.find((animation) => animation.name === name) ||
    BUBBLE_ANIMATIONS.find((animation) => (
      name.includes(animation.name) || animation.name.includes(name)
    )) ||
    null
  );
};

export const applyBubbleStyleDirective = async ({ chatId, content }) => {
  const rawContent = String(content || '');
  // [BUBBLE_WANT] 一律从正文去掉；是否真的补一次调用由调用方（aiService.js）
  // 根据 wantsChange 决定。
  const wantsChange = BUBBLE_WANT_TAG_PATTERN.test(rawContent);
  const original = rawContent.replace(BUBBLE_WANT_TAG_PATTERN_ALL, '');
  const match = BUBBLE_STYLE_TAG_PATTERN.exec(original);
  const strippedContent = original.replace(BUBBLE_STYLE_TAG_PATTERN, '').trim();

  const nothingApplied = {
    content: strippedContent,
    wantsChange,
    appliedPresetName: null,
    appliedDecorationName: null,
    appliedShapeName: null,
    appliedAnimationName: null,
  };

  if (!match) {
    return nothingApplied;
  }

  // 四个位置：配色 | 装饰 | 形状 | 进场动画，每个位置都可以留空（空的
  // 位置查不到名字，等于保持原样不动）。
  const [
    rawPresetPart,
    rawDecorationPart,
    rawShapePart,
    rawAnimationPart,
  ] = match[1].split('|');

  const preset = findPresetByName(rawPresetPart);
  const decoration = rawDecorationPart != null
    ? findDecorationByName(rawDecorationPart)
    : null;
  const shape = rawShapePart != null ? findShapeByName(rawShapePart) : null;
  const animation = rawAnimationPart != null
    ? findAnimationByName(rawAnimationPart)
    : null;

  if (!preset && !decoration && !shape && !animation) {
    return nothingApplied;
  }

  const updates = {};
  if (preset) {
    updates.customCss = preset.code;
    // 换了新的配色预设，之前角色自己写的那一层样式就撤掉，免得盖在新配色上面。
    updates.bubbleCharCss = '';
    updates.bubbleCharCssName = '';
  }
  if (decoration) updates.bubbleDecoration = decoration.id;
  if (shape) updates.bubbleShape = shape.id;
  if (animation) updates.bubbleAnimation = animation.id;

  try {
    await db.chats.update(chatId, updates);
  } catch (error) {
    console.error('[BubbleStyle] 保存气泡风格失败:', error);
    return nothingApplied;
  }

  return {
    content: strippedContent,
    wantsChange,
    appliedPresetName: preset?.name || null,
    appliedDecorationName: decoration?.name || null,
    appliedShapeName: shape?.name || null,
    appliedAnimationName: animation?.name || null,
  };
};