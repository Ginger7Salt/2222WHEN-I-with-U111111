// src/apps/textgames/texas/texasChipsService.js
//
// 德州扑克用的"全局虚拟筹码池"：一个存在 db.settings 里的单一数字
// （key: textGamesChips，默认 1000），不是按角色/按游戏分的表——这是
// 整个文字游戏大厅里第一个需要"持久化输赢"的游戏，所以单独起了这个
// key，按项目硬规则7的惯例（能用 settings 的一行 key/value 就不另开
// 表），不需要升 db 版本。
//
// 买入/结算的时机（跟 useTexasMatch.js 配合）：坐下选好买入金额的那一
// 刻就从余额里扣掉（钱"上桌"了），会话正常结束（摊牌拿满/主动离场）时
// 把最终的桌上筹码数加回余额；中途直接退出不结算，按项目惯例（UNO也是
// 这样："中途退出就是放弃"）买入的这笔钱就当输掉了，不另外找补——这样
// 不用在对局没走完的时候做任何"存一半进度"的事。

import db from '../../../db';

export const CHIPS_SETTING_KEY = 'textGamesChips';
export const DEFAULT_CHIPS = 1000;

// 余额过低玩不成一桌的时候，大厅给的"台面保底"：不是惩罚机制的一部分，
// 只是避免真的归零之后再也打不开这个游戏。
export const MIN_PLAYABLE_CHIPS = 20;
export const COMP_TOPUP_TO = 200;

export const getChipBalance = async () => {
  const row = await db.settings.get(CHIPS_SETTING_KEY);
  const value = row?.value;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : DEFAULT_CHIPS;
};

export const setChipBalance = async (value) => {
  const clamped = Math.max(0, Math.round(value || 0));
  await db.settings.put({ key: CHIPS_SETTING_KEY, value: clamped });
  return clamped;
};

export const adjustChipBalance = async (delta) => {
  const current = await getChipBalance();
  return setChipBalance(current + delta);
};

// 余额低于保底线时直接补到 COMP_TOPUP_TO，返回最终余额（可能是没动过
// 的原值，也可能是补过之后的新值）。坐下买入之前调用一次。
export const ensureMinimumChips = async () => {
  const current = await getChipBalance();
  if (current >= MIN_PLAYABLE_CHIPS) return current;
  return setChipBalance(COMP_TOPUP_TO);
};