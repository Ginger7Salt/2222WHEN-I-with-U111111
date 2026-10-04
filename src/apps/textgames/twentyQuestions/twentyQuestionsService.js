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

export const recordTwentyQuestionsMatch = async ({
  characterId,
  direction,
  result,
  secretWord,
  questionsUsed,
}) => {
  const guesserLabel = direction === DIRECTIONS.USER_SETS ? 'TA' : '用户';
  const resultText =
    result === 'win' ? `${guesserLabel}猜中了` : `${guesserLabel}没能在20问内猜中`;

  const contextNote = `这局"20个问题"是${
    direction === DIRECTIONS.USER_SETS ? '用户出题、你来猜' : '你出题、用户来猜'
  }的方向，秘密是"${secretWord || '未知'}"，用了${questionsUsed}问，结果是${resultText}。`;

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