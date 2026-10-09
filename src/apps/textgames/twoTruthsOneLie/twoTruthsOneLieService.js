// src/apps/textgames/twoTruthsOneLie/twoTruthsOneLieService.js
//
// "两个真话，一个假话"的数据层：薄薄一层包在 textGameSharedService 上面，
// 只负责算最终胜负、拼这个游戏自己的 contextNote/noticeText 文案。
//
// 一局固定两轮：
// - 第一轮：角色说三句关于自己的话（两真一假），用户猜哪句是假的；
// - 第二轮：用户写三句关于自己的话（两真一假），角色猜哪句是假的。
// 每一轮"猜对"算那一方得 1 分。result 统一按用户视角记：
// 'win'  = 用户猜对、角色没猜对（用户 1:0 领先）
// 'loss' = 用户没猜对、角色猜对
// 'draw' = 双方都猜对，或者双方都没猜对
//
// 不新建表、不升数据库版本：额外字段通过 recordTextGameMatch 的 extra
// 参数铺平存进 textGameMatches 这一行。

import {
  listCharactersForPicker,
  getChatIdForCharacter,
  getMatchStats,
  recordTextGameMatch,
} from '../textGameSharedService';

export const GAME_ID_TWO_TRUTHS = 'two-truths-one-lie';

export { listCharactersForPicker, getChatIdForCharacter, getMatchStats };

export const computeTwoTruthsResult = (userCorrect, charCorrect) => {
  if (userCorrect && !charCorrect) return 'win';
  if (!userCorrect && charCorrect) return 'loss';
  return 'draw';
};

const NOTICE_TEXT = {
  win: '你识破了TA的假话，TA却没看穿你的',
  loss: 'TA看穿了你的假话，你却没能识破TA的',
  bothCorrect: '你们都识破了对方的假话，打成平局',
  bothWrong: '你们都被对方骗过去了，打成平局',
};

const MAX_STATEMENT_NOTE_LENGTH = 40;

const clip = (text) =>
  String(text || '').trim().slice(0, MAX_STATEMENT_NOTE_LENGTH);

// charStatements: [{ text, isLie }]（已经是用户看到的顺序）
// userStatements: string[]（用户写的三句，顺序就是用户写的顺序）
const describeStatements = (texts) =>
  texts.map((text, index) => `${index + 1}.${clip(text)}`).join('；');

export const recordTwoTruthsMatch = async ({
  characterId,
  charStatements,
  userPickIndex,
  userStatements,
  userLieIndex,
  charGuessIndex,
  userCorrect,
  charCorrect,
}) => {
  const result = computeTwoTruthsResult(userCorrect, charCorrect);

  const charLieText = charStatements.find((item) => item.isLie)?.text || '';
  const userPickedText = charStatements[userPickIndex]?.text || '';
  const userLieText = userStatements[userLieIndex] || '';
  const charGuessedText = userStatements[charGuessIndex] || '';

  const contextNote =
    `这局"两个真话，一个假话"分两轮。` +
    `第一轮你说了三句关于自己的话：${describeStatements(
      charStatements.map((item) => item.text)
    )}，其中假的是"${clip(charLieText)}"（这句是你编的，另外两句是真的、算数）；` +
    `用户猜的是"${clip(userPickedText)}"，${userCorrect ? '猜对了' : '没猜对'}。` +
    `第二轮用户说了三句关于他自己的话：${describeStatements(
      userStatements
    )}，其中假的是"${clip(userLieText)}"（这句是用户编的、另外两句是真的）；` +
    `你猜的是"${clip(charGuessedText)}"，${charCorrect ? '你猜对了' : '你没猜对'}。` +
    `最终比分：用户猜对${userCorrect ? 1 : 0}轮，你猜对${charCorrect ? 1 : 0}轮。`;

  let noticeText;
  if (result === 'win') noticeText = NOTICE_TEXT.win;
  else if (result === 'loss') noticeText = NOTICE_TEXT.loss;
  else noticeText = userCorrect ? NOTICE_TEXT.bothCorrect : NOTICE_TEXT.bothWrong;

  return recordTextGameMatch({
    gameId: GAME_ID_TWO_TRUTHS,
    gameTitle: '两个真话，一个假话',
    characterId,
    result,
    contextNote,
    noticeText,
    extra: { userCorrect, charCorrect },
  });
};