// src/apps/textgames/witchsPoison/witchsPoisonService.js
//
// "女巫的毒药"的数据层：薄薄一层包在 textGameSharedService 上面，只
// 负责拼这个游戏自己的 contextNote/noticeText 文案。
//
// result 字段统一是"猜的那一方"的结果：'win' 猜中了毒药在哪一杯，
// 'loss' 没猜中——witchSide 记录这一把是谁藏毒（'character'藏毒时猜的
// 是用户，'user'藏毒时猜的是角色），两边轮流当女巫（见
// WitchsPoisonGame.jsx 里"再来一局"自动翻面的逻辑），不是固定谁赢谁输
// 的对抗游戏。

import {
  listCharactersForPicker,
  getChatIdForCharacter,
  getMatchStats,
  recordTextGameMatch,
} from '../textGameSharedService';

export const GAME_ID_WITCHS_POISON = 'witchs-poison';

export { listCharactersForPicker, getChatIdForCharacter, getMatchStats };

export const recordWitchsPoisonRound = async ({
  characterId,
  witchSide,
  result,
  poisonedCup,
  guessedCup,
  stakeNote,
}) => {
  const guesserLabel = witchSide === 'character' ? '用户' : 'TA';
  const resultText = result === 'win' ? `${guesserLabel}猜中了` : `${guesserLabel}没猜中`;
  const stakeLine = stakeNote ? `这把的赌注是"${stakeNote}"。` : '';

  const contextNote = `这把"女巫的毒药"是${
    witchSide === 'character' ? '你藏毒、用户猜' : '用户藏毒、你猜'
  }，毒药在${poisonedCup}号杯，猜的是${guessedCup}号杯，${resultText}。${stakeLine}`;

  const noticeText = `这把是${
    witchSide === 'character' ? '你藏毒、TA猜' : 'TA藏毒、你猜'
  }，${resultText}`;

  return recordTextGameMatch({
    gameId: GAME_ID_WITCHS_POISON,
    gameTitle: '女巫的毒药',
    characterId,
    result,
    contextNote,
    noticeText,
    extra: { witchSide, poisonedCup, guessedCup, stakeNote: stakeNote || null },
  });
};