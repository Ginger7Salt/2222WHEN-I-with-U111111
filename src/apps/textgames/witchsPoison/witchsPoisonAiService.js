// src/apps/textgames/witchsPoison/witchsPoisonAiService.js
//
// "女巫的毒药"真实规则（2026-10 改版，替换掉第一版"一方藏一方猜"的
// 理解错误）：用户和角色各自偷偷选一个杯子藏毒，然后轮流点杯子——每次
// 点的是"自己还没点过的杯子"，赌它不是对方藏毒的那一杯；谁先点中对方
// 藏的那一杯，谁就中毒、算输。两边各自的"已经点过的杯子"是分开计数的
// （同一个杯子编号，你和TA可以分别点，不互相占用），所以每一方最多
// 点9次就一定会撞上对方的毒（9个杯子里总有一个是对方藏的）。
//
// 角色这边完全不需要AI参与"自己藏哪一杯"——纯 Math.random，没有任何
// 可利用的信息，没必要为了一个随机数走一次AI调用（见 requestCharacterSecretCup）。
// 角色每一次"点杯子"的回合才用AI，让选的编号带一点人设直觉的理由，
// 失败就安静退回随机选择，不影响回合本身正常进行。

import {
  getGenerationContext,
  requestAiText,
} from '../../messages/interactions/interactionAiService';

export const CUP_COUNT = 9;

const randomCupNumber = () => Math.floor(Math.random() * CUP_COUNT) + 1;

// 角色藏毒：纯随机，不走AI，调用方直接用这个结果作为角色这一局的秘密。
export const pickCharacterSecretCup = () => randomCupNumber();

// 角色这一轮该点哪个杯子——只能从"角色自己还没点过的杯子"里选一个，
// 没有任何关于用户藏在哪一杯的信息，纯粹是带了人设语气的直觉赌注。
// availableCups 是角色自己还没点过的杯子编号数组（调用方算好传进来）。
export const requestCharacterCupPick = async ({
  chatId,
  character,
  availableCups,
  stakeNote,
}) => {
  const fallbackPick = () =>
    availableCups[Math.floor(Math.random() * availableCups.length)];

  if (!availableCups || availableCups.length === 0) {
    return { cupNumber: null, reason: '' };
  }

  try {
    const context = await getGenerationContext(chatId);
    if (!context) return { cupNumber: fallbackPick(), reason: '' };

    const { apiConfig } = context;
    const stakeLine = stakeNote ? `这把的赌注是："${stakeNote}"，中毒了是要认账的。` : '';

    const systemPrompt = `你正在扮演角色：${character?.name || 'TA'}。

角色设定：
${character?.bio || '无'}

你正在和用户玩"女巫的毒药"：你和用户各自偷偷藏了一杯毒药，轮流点还没点过的杯子，赌它不是对方藏毒的那一杯——谁先点中对方藏的那一杯，谁就中毒。你完全不知道用户把毒藏在哪一杯，只能凭直觉赌一把。${stakeLine}

你现在还没点过的杯子编号是：${availableCups.join('、')}。

请从这些编号里选一个作为你这一轮要点的杯子，并用一句话说说你选它的理由（可以是性格化的直觉、玩笑或小迷信，不需要有逻辑依据）。

严格按下面格式输出，不要有其他内容：
编号：<数字>
理由：<一句话，不超过30个汉字>`;

    const content = await requestAiText({ apiConfig, systemPrompt });
    const numMatch = content.match(/编号[：:]\s*(\d+)/);
    const reasonMatch = content.match(/理由[：:]\s*(.+)/);

    const parsedNumber = numMatch ? Number(numMatch[1]) : null;
    const cupNumber = availableCups.includes(parsedNumber) ? parsedNumber : fallbackPick();

    return {
      cupNumber,
      reason: reasonMatch ? reasonMatch[1].trim() : '',
    };
  } catch (error) {
    console.warn('[WitchsPoisonAiService] 角色选杯子失败，退回随机选择。', error);
    return { cupNumber: fallbackPick(), reason: '' };
  }
};

// 回合结束后，角色对结果说一句即时反应——失败就安静地返回空字符串，
// 调用方据此不显示这一行，不影响回合结果本身。poisonedSide 是"谁中毒了"
// ('user' | 'character')。
export const requestRoundReaction = async ({
  chatId,
  character,
  poisonedSide,
  stakeNote,
}) => {
  try {
    const context = await getGenerationContext(chatId);
    if (!context) return '';

    const { apiConfig } = context;
    const outcomeText = poisonedSide === 'user' ? '用户中毒了' : '你中毒了';
    const stakeLine = stakeNote ? `这把的赌注是："${stakeNote}"。` : '';

    const systemPrompt = `你正在扮演角色：${character?.name || 'TA'}。

角色设定：
${character?.bio || '无'}

你和用户刚玩完一局"女巫的毒药"，结果是${outcomeText}。${stakeLine}

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