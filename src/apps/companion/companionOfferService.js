/*
 * 角色主动提议"要不要一起养小伙伴"。
 *
 * 写法照抄 away（`getAwayOfferNote` + `applyAwayDirective`）和
 * 地点小册子（`applyPlaceNoteDirective`）的隐藏标签模式：
 * 提示词里说明用法和规则 → 回复解析时把标签取出并从正文去掉
 * （一律去掉，不管这次有没有生效）→ 代码再校验一次能不能生效。
 *
 * 只在 aiService.js 的 triggerAiResponse 里接入（用户点"回应"、
 * 或离线结束后自动回复走的那条主路径），不影响陪伴模式等其他路径。
 */

import db from '../../db';

const OFFER_PROBABILITY = 0.18;
const OFFER_COOLDOWN_HOURS = 72; // 提过一次之后，至少 3 天才会再提

const COMPANION_OFFER_TAG_PATTERN = /\s*\[COMPANION_OFFER:\s*([^\]]*)\]\s*/i;

const hoursSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  return (now - then) / 3600000;
};

export const COMPANION_OFFER_PROMPT_NOTE = `
【可选行为：提议一起养一只"小伙伴"】
你和用户目前还没有一起养"小伙伴"——一只由你们两个人共同照顾的小动物。
如果这次聊天的气氛、话题合适，你可以自然地在回复里提议养一只，语气要符合你的性格，
真诚一点，不要显得刻意或像在完成任务。

如果你决定提议，请在回复正文的最后单独一行加上（用户不会看到这行原始文字，
系统会把它转换成一张邀请卡片展示给用户）：
[COMPANION_OFFER: 用你自己的语气写一句邀请用户一起养小伙伴的话]

如果这次不合适，就不要写这个标签，正常回复即可。`;

/*
 * 决定这一次要不要把"提议养小伙伴"的选项交给角色。
 * 只要交出了这个选项（不管角色最后用不用），就记一次时间，
 * 避免短时间内被反复提议。
 */
export const getCompanionOfferNote = async ({ chatId, chat }) => {
  if (!chatId || !chat) return '';

  try {
    const existing = await db.companions.where('chatId').equals(chatId).first();
    if (existing) return '';
  } catch (error) {
    console.error('[CompanionOffer] 查询是否已养小伙伴失败:', error);
    return '';
  }

  if (hoursSince(chat.companionOfferedAt) < OFFER_COOLDOWN_HOURS) return '';
  if (Math.random() >= OFFER_PROBABILITY) return '';

  try {
    await db.chats.update(chatId, { companionOfferedAt: Date.now() });
  } catch (error) {
    console.error('[CompanionOffer] 记录邀请时间失败:', error);
  }

  return COMPANION_OFFER_PROMPT_NOTE;
};

/*
 * 从角色回复里取出 [COMPANION_OFFER: ...] 标签，一律从正文去掉；
 * 只有这次确实把选项交给了角色、且这个聊天窗此刻仍然没有小伙伴时，
 * 才会返回一张邀请卡片消息的数据（由调用方负责写入 db.messages）。
 */
export const applyCompanionOfferDirective = async ({ chatId, content, offered }) => {
  const original = String(content || '');
  const match = COMPANION_OFFER_TAG_PATTERN.exec(original);
  const strippedContent = original.replace(COMPANION_OFFER_TAG_PATTERN, '').trim();

  if (!match || !offered) {
    return { content: strippedContent, offerMessage: null };
  }

  try {
    const existing = await db.companions.where('chatId').equals(chatId).first();
    if (existing) {
      return { content: strippedContent, offerMessage: null };
    }
  } catch (error) {
    console.error('[CompanionOffer] 二次校验失败，放弃这次邀请:', error);
    return { content: strippedContent, offerMessage: null };
  }

  const offerText = match[1].trim().slice(0, 60) || '要不要一起养一只小伙伴呀？';

  return {
    content: strippedContent,
    offerMessage: { type: 'companion_offer', content: offerText },
  };
};