// src/apps/textgames/witchsPoison/witchsPoisonAiService.js
//
// "女巫的毒药"跟20个问题不一样，大部分时候根本不需要AI：角色当"藏毒方"
// 时纯粹是 Math.random 选一个杯子，不存在可利用的信息，没必要为了一个
// 纯随机数走一次AI调用。只有两处用到AI，而且都是"锦上添花"——接口没
// 配置好/请求失败时都安静地退回合理的默认值，不影响回合本身正常进行：
// - 角色当"猜测方"时，让猜的那个杯子编号带一点人设语气的"直觉理由"，
//   而不是单纯一个冷冰冰的随机数；
// - 回合结束后角色对结果说一句即时反应，只在游戏界面里展示，不写进
//   聊天记录（跟井字棋一样，真正写进聊天的只有回合结束后的战绩消息）。

import {
  getGenerationContext,
  requestAiText,
} from '../../messages/interactions/interactionAiService';

export const CUP_COUNT = 9;

const randomCupNumber = () => Math.floor(Math.random() * CUP_COUNT) + 1;

// 角色当猜测方时：用户已经偷偷选好了被下毒的那个杯子，角色完全不知道
// 答案，只能凭"人设直觉"选一个赌一把——数字本身就是带了性格的随机数，
// 解析不出来就退回纯随机。
export const requestCharacterCupGuess = async ({ chatId, character, stakeNote }) => {
  try {
    const context = await getGenerationContext(chatId);
    if (!context) return { cupNumber: randomCupNumber(), reason: '' };

    const { apiConfig } = context;
    const stakeLine = stakeNote ? `这把的赌注是："${stakeNote}"，猜错了是要认账的。` : '';

    const systemPrompt = `你正在扮演角色：${character?.name || 'TA'}。

角色设定：
${character?.bio || '无'}

你正在和用户玩"女巫的毒药"：桌上摆着编号1到${CUP_COUNT}的杯子，用户已经偷偷在心里选好了哪一杯有毒，你完全不知道答案，只能凭直觉赌一把。${stakeLine}

请选一个1到${CUP_COUNT}之间的数字作为你猜的杯子编号，并用一句话说说你选这个数字的理由（可以是性格化的直觉、玩笑或小迷信，不需要有逻辑依据）。

严格按下面格式输出，不要有其他内容：
编号：<数字>
理由：<一句话，不超过30个汉字>`;

    const content = await requestAiText({ apiConfig, systemPrompt });
    const numMatch = content.match(/编号[：:]\s*(\d+)/);
    const reasonMatch = content.match(/理由[：:]\s*(.+)/);

    const parsedNumber = numMatch ? Number(numMatch[1]) : null;
    const cupNumber =
      parsedNumber && parsedNumber >= 1 && parsedNumber <= CUP_COUNT
        ? parsedNumber
        : randomCupNumber();

    return {
      cupNumber,
      reason: reasonMatch ? reasonMatch[1].trim() : '',
    };
  } catch (error) {
    console.warn('[WitchsPoisonAiService] 角色猜杯子失败，退回随机选择。', error);
    return { cupNumber: randomCupNumber(), reason: '' };
  }
};

// 回合结束后，角色对结果说一句即时反应——失败就安静地返回空字符串，
// 调用方据此不显示这一行，不影响回合结果本身。
export const requestRoundReaction = async ({
  chatId,
  character,
  witchSide,
  guesserWon,
  stakeNote,
}) => {
  try {
    const context = await getGenerationContext(chatId);
    if (!context) return '';

    const { apiConfig } = context;
    const whoGuessed = witchSide === 'character' ? '用户' : '你';
    const outcomeText = guesserWon ? `${whoGuessed}猜中了` : `${whoGuessed}没猜中`;
    const stakeLine = stakeNote ? `这把的赌注是："${stakeNote}"。` : '';

    const systemPrompt = `你正在扮演角色：${character?.name || 'TA'}。

角色设定：
${character?.bio || '无'}

你和用户刚玩完一局"女巫的毒药"，这把是${
      witchSide === 'character' ? '你藏毒、用户猜' : '用户藏毒、你猜'
    }，结果是${outcomeText}。${stakeLine}

请以角色第一人称，对这个结果说一句自然的即时反应。

严格要求：
- 只输出一句话，不超过35个汉字；
- 不使用 Emoji；
- 不要输出引号、解释、前言；
- 不要提及AI、系统、游戏组件或技术实现。`;

    return (await requestAiText({ apiConfig, systemPrompt })) || '';
  } catch (error) {
    console.warn('[WitchsPoisonAiService] 回合反应未能生成。', error);
    return '';
  }
};