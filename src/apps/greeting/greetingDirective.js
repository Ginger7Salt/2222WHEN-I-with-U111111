// src/apps/greeting/greetingDirective.js
//
// 角色"主动送贺卡"，写法沿用 bubbleStyleDirective.js / bubbleStyleSession.js 的
// 两段式，省 token：
//   1. 聊天提示词里只常驻一小段说明（本文件的 NOTE），并且只在没有处于冷却期时才带；
//   2. 角色想送，就在回复末尾单独一行写 [CARD_WANT] 或 [CARD_WANT: 场合]，
//      本文件把标签一律从正文摘掉（不管有没有生效），告诉调用方"想送"；
//   3. 调用方（aiService.js）在回复写入之后，动态 import greetingSession.js 另外
//      调用一次模型，完整的写卡规则只在那一次里给。
// 没有定时器：什么时候送完全由聊天里角色自己的回复触发。
//
// 本文件只依赖 db 和常量，不 import aiService（避免循环依赖）。

import db from '../../db';
import { GREETING_SOURCE, OCCASIONS, PROACTIVE_COOLDOWN_MS } from './greetingConstants';

const CARD_WANT_PATTERN = /\s*\[CARD_WANT(?::\s*([^\]]*))?\]\s*/i;
const CARD_WANT_PATTERN_ALL = /\s*\[CARD_WANT(?::\s*[^\]]*)?\]\s*/gi;

const occasionNames = OCCASIONS.map((item) => item.label).join('、');

export const GREETING_PROMPT_NOTE = `
【可选行为：送一张贺卡】
如果你此刻特别想亲手给用户做一张贺卡（比如想哄TA、想道谢、想道歉、想纪念什么），可以自己决定送，不用征求同意；没有这个念头就不要写，不要为了送而送。
想送就在回复正文最后单独一行写（用户看不到这行）：
[CARD_WANT: 场合]
场合可选（照抄）：${occasionNames}。不确定场合就只写 [CARD_WANT]。
用户直接要你做贺卡时也用这个办法回应。
重要：这次回复里不要写贺卡的内容，也不要描述卡片长什么样，只像平时聊天一样接话再加标签；真正做卡是系统另外单独问你的那一次。`;

// 是否允许这个角色现在主动送一张：同一个角色上一张主动送的卡超过冷却时间，
// 并且没有一张主动送的卡还在制作中。
export const canSendProactiveCard = async (characterId, now = Date.now()) => {
  if (characterId == null) return false;

  const rows = await db.greetingCards
    .where('characterId')
    .equals(characterId)
    .toArray();

  return !rows.some(
    (card) =>
      card.source === GREETING_SOURCE.PROACTIVE &&
      now - (card.createdAt || 0) < PROACTIVE_COOLDOWN_MS,
  );
};

// 聊天提示词用：冷却期内返回空字符串，不带这段说明。
export const buildGreetingPromptNote = async ({ characterId }) => {
  try {
    return (await canSendProactiveCard(characterId)) ? GREETING_PROMPT_NOTE : '';
  } catch (error) {
    console.warn('[GreetingDirective] 读取冷却状态失败，本次不带说明：', error);
    return '';
  }
};

const matchOccasionId = (rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return 'any';

  const hit =
    OCCASIONS.find((item) => item.label === name || item.id === name) ||
    OCCASIONS.find((item) => name.includes(item.label) || item.label.includes(name));

  return hit ? hit.id : 'any';
};

// 摘标签。返回去掉标签后的正文，以及角色是否想送、挑的场合。
export const applyGreetingDirective = ({ content }) => {
  const rawContent = String(content || '');
  const match = CARD_WANT_PATTERN.exec(rawContent);

  return {
    content: rawContent.replace(CARD_WANT_PATTERN_ALL, ''),
    wantsCard: Boolean(match),
    occasion: match ? matchOccasionId(match[1]) : 'any',
  };
};
