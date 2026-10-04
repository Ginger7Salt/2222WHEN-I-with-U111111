// src/apps/textgames/twentyQuestions/twentyQuestionsService.js
//
// "20个问题"的数据层：薄薄一层包在 textGameSharedService 上面，只负责
// 拼这个游戏自己的 contextNote/noticeText 文案。
//
// result 字段统一是"负责猜的那一方"的结果：'win' 在20问以内猜中了，
// 'loss' 用完20问还没猜中——direction==='character_sets' 时猜的是
// 用户，direction==='user_sets' 时猜的是角色，所以同一个 result 在两种
// 方向下，"赢的人"其实是不同的一方，文案里要分方向讲清楚，不能笼统地
// 套用户视角的"赢/输"。
//
// 过程摘要（2026-10 新增，补齐跟女巫的毒药同一套做法——之前这里只把
// 最终结果和秘密词写回 contextNote，完全没有一问一答的过程，角色下次
// 聊天只会知道"赢了/输了"，不会记得具体问过什么、怎么答的）：
// summarizeHistory 把 history（[{question, answer}]）压缩成一句过程
// 摘要一起写进 contextNote，每条问答截断到合理长度、总条数也设上限，
// 避免20问全部摊开把 contextNote 撑得过长。

import {
  listCharactersForPicker,
  getChatIdForCharacter,
  getMatchStats,
  recordTextGameMatch,
} from '../textGameSharedService';

export const GAME_ID_TWENTY_QUESTIONS = 'twenty-questions';
export const QUESTION_LIMIT = 20;

export const DIRECTIONS = {
  CHARACTER_SETS: 'character_sets', // 角色出题，用户猜（默认）
  USER_SETS: 'user_sets', // 用户出题，角色猜
};

export { listCharactersForPicker, getChatIdForCharacter, getMatchStats };

const MAX_HISTORY_LINES = 8;
const MAX_HISTORY_SEGMENT_LENGTH = 24;

const summarizeHistory = (history) => {
  if (!Array.isArray(history) || history.length === 0) return '';

  const lines = history
    .slice(-MAX_HISTORY_LINES)
    .map((item) => {
      const question = String(item?.question || '').trim().slice(0, MAX_HISTORY_SEGMENT_LENGTH);
      const answer = String(item?.answer || '').trim().slice(0, MAX_HISTORY_SEGMENT_LENGTH);
      return `${question}→${answer}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? `过程摘要：${lines.join('；')}。` : '';
};

export const recordTwentyQuestionsMatch = async ({
  characterId,
  direction,
  result,
  secretWord,
  questionsUsed,
  history,
}) => {
  const guesserLabel = direction === DIRECTIONS.USER_SETS ? 'TA' : '用户';
  const resultText =
    result === 'win' ? `${guesserLabel}猜中了` : `${guesserLabel}没能在20问内猜中`;
  const historyLine = summarizeHistory(history);

  const contextNote = `这局"20个问题"是${
    direction === DIRECTIONS.USER_SETS ? '用户出题、你来猜' : '你出题、用户来猜'
  }的方向，秘密是"${secretWord || '未知'}"，用了${questionsUsed}问，结果是${resultText}。${historyLine}`;

  const noticeText = `这局是"${
    direction === DIRECTIONS.USER_SETS ? 'TA来问，你来想' : '你来问，TA来想'
  }"，${resultText}`;

  return recordTextGameMatch({
    gameId: GAME_ID_TWENTY_QUESTIONS,
    gameTitle: '20个问题',
    characterId,
    result,
    contextNote,
    noticeText,
    extra: { direction, secretWord, questionsUsed },
  });
};