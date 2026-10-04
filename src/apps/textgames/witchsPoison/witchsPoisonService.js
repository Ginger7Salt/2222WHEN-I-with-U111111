// src/apps/textgames/witchsPoison/witchsPoisonService.js
//
// "女巫的毒药"的数据层：薄薄一层包在 textGameSharedService 上面，只
// 负责拼这个游戏自己的 contextNote/noticeText 文案。
//
// result 字段统一是"用户视角"的结果：'win' 是角色中毒了（用户赢），
// 'loss' 是用户中毒了（用户输）——真实规则见 WitchsPoisonGame.jsx 顶部
// 注释：双方各自藏一杯毒，轮流点还没点过的杯子，谁先点中对方藏的那一
// 杯谁就中毒，不是"一方藏一方猜"的旧版本。

import {
  listCharactersForPicker,
  getChatIdForCharacter,
  getMatchStats,
  recordTextGameMatch,
} from '../textGameSharedService';

export const GAME_ID_WITCHS_POISON = 'witchs-poison';

export { listCharactersForPicker, getChatIdForCharacter, getMatchStats };

// 把对局过程中双方互相放的话（暗示/烟雾弹/反应）压缩成一句过程摘要，
// 塞进 contextNote 里一起回传——这样角色下次聊天不只知道"谁中毒了"，
// 还能记得这把互相试探时说过什么，contextNote 本身就是"结果+过程摘要"。
// 每条话截断到合理长度，总条数也设个上限，避免一把点满9轮、每轮都写
// 一长串话时把 contextNote 撑得过长。
const MAX_BANTER_LINES = 6;
const MAX_BANTER_LINE_LENGTH = 40;

const summarizeBanter = (turnLog) => {
  if (!Array.isArray(turnLog) || turnLog.length === 0) return '';

  const lines = turnLog
    .filter((item) => item?.message)
    .slice(-MAX_BANTER_LINES)
    .map((item) => {
      const speaker = item.side === 'user' ? '用户' : '你';
      const text = item.message.trim().slice(0, MAX_BANTER_LINE_LENGTH);
      return `${speaker}说"${text}"`;
    });

  return lines.length > 0 ? `期间互相放了几句话：${lines.join('；')}。` : '';
};

export const recordWitchsPoisonRound = async ({
  characterId,
  poisonedSide, // 'user' | 'character'
  userSecretCup,
  characterSecretCup,
  hitCup,
  turnsTaken,
  stakeNote,
  turnLog,
}) => {
  const result = poisonedSide === 'character' ? 'win' : 'loss';
  const resultText = poisonedSide === 'character' ? 'TA中毒了' : '用户中毒了';
  const stakeLine = stakeNote ? `这把的赌注是"${stakeNote}"。` : '';
  const banterLine = summarizeBanter(turnLog);

  const contextNote = `这把"女巫的毒药"里，你藏的毒在${characterSecretCup}号杯，用户藏的毒在${userSecretCup}号杯，一共点了${turnsTaken}轮，最后在${hitCup}号杯${resultText}。${stakeLine}${banterLine}`;

  const noticeText = `玩了一局女巫的毒药，${resultText}`;

  return recordTextGameMatch({
    gameId: GAME_ID_WITCHS_POISON,
    gameTitle: '女巫的毒药',
    characterId,
    result,
    contextNote,
    noticeText,
    extra: {
      poisonedSide,
      userSecretCup,
      characterSecretCup,
      hitCup,
      turnsTaken,
      stakeNote: stakeNote || null,
    },
  });
};