// src/apps/textgames/undercover/undercoverService.js
//
// "谁是卧底"的数据层。Slice A 这一批只需要："取最近几局用过的词对"
// （开局前避免连续撞同一对词）——真正的"写一局结算记录 + 回写每位
// 参赛真实角色的聊天"留到 Slice C 再加，跟 unoService.js 的
// recordUnoMatch 同样的落库/回写方式（每位参赛真实角色各自的聊天都
// 写一份，设计已确认，不是只写绑定的那一个）。
//
// 复用 textGameMatches 表（gameId='undercover'），不需要升 db 版本——
// UNO 当初也是这样接进同一张表的（见 db/index.js v76 的注释）。

import db from '../../../db';
import { listCharactersForPicker } from '../textGameSharedService';

export { listCharactersForPicker };

export const GAME_ID_UNDERCOVER = 'undercover';
export const GAME_TITLE_UNDERCOVER = '谁是卧底';

const RECENT_PAIRS_LOOKBACK = 5;

const loadUndercoverRows = () =>
  db.textGameMatches.where('gameId').equals(GAME_ID_UNDERCOVER).toArray();

// 最近几局用过的词对，按时间倒序，最多取 RECENT_PAIRS_LOOKBACK 个——
// 给 pickRandomWordPair/generateAiWordPair 用来避免连续撞同一对词。
// 这张表现在还没有 undercover 的任何行（Slice C 才会开始写），所以
// 目前总是返回空数组，属于正常情况。
export const getRecentWordPairs = async () => {
  const rows = await loadUndercoverRows();
  return rows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(0, RECENT_PAIRS_LOOKBACK)
    .map((row) => row.wordPair)
    .filter(Boolean);
};