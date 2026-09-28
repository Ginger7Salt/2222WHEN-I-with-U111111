/*
 * 角色主动决定"换回一张历史头像"，对应待办 3 后半段。
 *
 * 跟气泡风格不同：气泡配色只是聊天气氛的小装饰，用户明确说了不用限制；
 * 头像是角色的"脸"，换一次视觉冲击比换气泡颜色大得多，所以这里参照
 * companionOfferService.js 那一套（概率 + 冷却），而不是无限制。
 * 概率/冷却数值先按经验给一版保守的，觉得太少/太多可以随时改
 * OFFER_PROBABILITY / OFFER_COOLDOWN_HOURS 这两个常量。
 *
 * 写法仍然是隐藏标签模式：只在"这次抽中、真的把选项交给角色"时才把
 * 提示词说明带上 → 回复解析时把标签一律从正文去掉 → 再校验一次这个
 * 聊天窗对应的角色是不是真的有历史头像可换、且这次确实拿到过这个选项，
 * 都满足才真正切换。
 *
 * 只在 aiService.js 的 triggerAiResponse 里接入，不影响陪伴模式等其他路径。
 */

import db from '../../db';
import { getAvatarHistory, switchToRandomHistoricalAvatar } from './avatarHistoryService';

const OFFER_PROBABILITY = 0.15;
const OFFER_COOLDOWN_HOURS = 48; // 换过一次之后，至少 2 天才会再换

const AVATAR_HISTORY_TAG_PATTERN = /\s*\[AVATAR_HISTORY_SWITCH\]\s*/i;

const hoursSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  return (now - then) / 3600000;
};

export const AVATAR_HISTORY_PROMPT_NOTE = `
【可选行为：换回一张以前用过的头像】
你有一些以前用过、后来被换掉的头像存在"历史相册"里。如果这次聊天的气氛
合适，你可以自主决定随机换回其中一张（具体换成哪张由系统随机挑选，你不
需要也无法指定是哪一张）。

如果你决定换，请在回复正文的最后单独一行加上（用户不会看到这行原始
文字）：
[AVATAR_HISTORY_SWITCH]

如果这次不合适，就不要写这个标签，正常回复即可。`;

/*
 * 决定这一次要不要把"换回历史头像"的选项交给角色。
 * 角色没有任何历史头像可换时，直接不给选项（不占提示词篇幅）。
 * 跟小伙伴邀请一样：只要交出了这个选项（不管角色最后用不用），
 * 就记一次时间，避免短时间内被反复提议。
 */
export const getAvatarHistorySwitchNote = async ({ characterId, character }) => {
  if (!characterId || !character) return '';

  try {
    const history = await getAvatarHistory(characterId);
    if (history.length === 0) return '';
  } catch (error) {
    console.error('[AvatarHistorySwitch] 查询历史头像失败:', error);
    return '';
  }

  if (hoursSince(character.avatarSwitchOfferedAt) < OFFER_COOLDOWN_HOURS) return '';
  if (Math.random() >= OFFER_PROBABILITY) return '';

  try {
    await db.characters.update(characterId, { avatarSwitchOfferedAt: Date.now() });
  } catch (error) {
    console.error('[AvatarHistorySwitch] 记录提议时间失败:', error);
  }

  return AVATAR_HISTORY_PROMPT_NOTE;
};

/*
 * 从角色回复里取出 [AVATAR_HISTORY_SWITCH] 标签，一律从正文去掉；
 * 只有这次确实把选项交给了角色、且角色此刻仍然有历史头像可换时，
 * 才会真的执行切换（随机挑一张，具体逻辑见 avatarHistoryService.js）。
 */
export const applyAvatarHistorySwitchDirective = async ({ characterId, content, offered }) => {
  const original = String(content || '');
  const matched = AVATAR_HISTORY_TAG_PATTERN.test(original);
  const strippedContent = original.replace(AVATAR_HISTORY_TAG_PATTERN, '').trim();

  if (!matched || !offered) {
    return { content: strippedContent, switchedAvatar: null };
  }

  const newAvatar = await switchToRandomHistoricalAvatar(characterId);

  return { content: strippedContent, switchedAvatar: newAvatar };
};