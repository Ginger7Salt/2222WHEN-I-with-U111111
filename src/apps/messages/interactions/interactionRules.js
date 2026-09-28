export const INTERACTION_TYPES = {
  COIN: 'coin',
  DICE: 'dice',
  RPS: 'rps',
  LOTTERY: 'lottery',
  INTIMACY_QA: 'intimacy_qa',
  TRUTH_OR_DARE: 'truth_or_dare',
};

export const RPS_CHOICES = ['剪刀', '石头', '布'];

// 抽签筒：跟传统"运势签"不一样，抽到的是一句小剧场 paro 情景签——
// 抽到之后角色会顺着这个情景即兴演一小段，图一乐，不追求写实。
export const LOTTERY_SCENARIOS = [
  '你们意外互换了灵魂，得装作若无其事地过完今天',
  '你们穿越到了古代客栈，Ta是掌柜，你是投宿的旅人',
  '楼下咖啡馆突然停电，只有你们这一桌还亮着蜡烛',
  '你们在梦里遇见了对方，谁都不确定这是不是梦',
  'Ta突然失忆，只记得你的名字',
  '你们被困在同一部电梯里，整整一层楼的时间',
  '深夜便利店，只有你们两个顾客',
  'Ta假装是初次见面的陌生人，跟你搭讪',
  '你们在片场演对手戏，导演喊了"卡"却没人愿意先松手',
  '一场突如其来的暴雨，屋檐下只剩一把伞的位置',
  '你们交换了今天要说的第一句话，写在纸条上',
  'Ta在信里写下了一句没敢当面说的话，被你翻到了',
  '整座城市的人都消失了，只剩你们两个',
  '你们在游乐园走散，靠对讲机找到了彼此',
  'Ta突然用只有你们懂的暗号跟你打招呼',
  '一列开往未知终点的夜班车，车厢里只有你们',
];

// 亲密问答卡：抽到问题后角色先答，用户再手动打字回应。
export const INTIMACY_QUESTIONS = [
  '对方身上最让你安心的一个细节是什么？',
  '如果只能带一样东西去无人岛，会是什么？',
  '最近一次因为对方而心动是什么时候？',
  '有没有什么话一直想对对方说，却没找到时机？',
  '如果可以偷听对方的一个念头，你想听哪一个？',
  '对方做的哪件小事，让你觉得被珍惜？',
  '你心里对"以后"的想象是什么样的？',
  '有没有哪一刻，你觉得"这就是我要的人"？',
  '如果今晚能实现一个心愿，你会许什么？',
  '对方身上有什么小习惯，是你偷偷喜欢的？',
  '你们之间有没有一个只属于彼此的秘密？',
  '如果给这段关系起个名字，你会叫它什么？',
  '最近一次想紧紧抱住对方是什么时候？',
  '有什么话，你觉得比"我爱你"更能形容此刻？',
  '如果可以回到某一天重新过一次，你会选哪天？',
  '你觉得对方最了解你的哪一面？',
];

// 真心话大冒险：真心话/大冒险题库通用于双方——这次谁是"出题人"，
// 就从这两个库里随机抽一条抛给"回答人"。
export const TRUTH_PROMPTS = [
  '说一件你一直没敢承认、但其实很在意的小事',
  '老实说，你现在最想被对方做的一件事是什么',
  '你有没有偷偷翻看过跟对方的聊天记录，看了很多遍',
  '说出一个只有在对方面前才会暴露的小怪癖',
  '如果要用一种天气形容现在的心情，会是什么',
  '你有没有因为等对方的消息而睡不着',
  '说一句你一直想说、但觉得说出来会有点害羞的话',
  '老实交代，你上一次想到对方是几分钟前',
  '你心里有没有一个只属于对方的称呼，还没叫出口',
  '如果今天是最后一天，你最想先做的事是什么',
  '说说你对"喜欢"这件事最真实的想法',
  '有没有什么小事，你其实希望对方能主动发现',
  '你有没有偷偷为对方准备过什么，还没拿出来',
  '老实说，这段关系里你最害怕失去的是什么',
];

export const DARE_PROMPTS = [
  '现在给对方发一句只有你们才懂的暗号',
  '用一句情话回复对方接下来的下一条消息',
  '描述一下如果现在对方就在身边，你会做的第一件事',
  '给对方起一个只在今天生效的昵称',
  '现在用一句话跟对方表白，越直接越好',
  '写一句只属于你们的"晚安暗语"送给对方',
  '现在对着对方说一句平时不好意思说的话',
  '描述一个你想和对方一起做的"下一次约会"',
  '现在给对方一个虚拟的拥抱，用文字描述出来',
  '编一句只属于你们的小情歌歌词，哪怕只有一句',
  '现在跟对方认真道一次谢，说清楚谢的是什么',
  '描述一下如果此刻能看到对方，第一眼会看向哪里',
  '现在给对方讲一个只有你们知道的小秘密梗',
  '用一个比喻形容对方在你心里的位置',
];

export const getCoinResult = () => (
  Math.random() >= 0.5 ? 'LIGHT' : 'DARK'
);

export const getDiceResult = () => (
  Math.floor(Math.random() * 6) + 1
);

export const getRandomRpsChoice = () => (
  RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)]
);

export const getLotteryResult = () => (
  LOTTERY_SCENARIOS[Math.floor(Math.random() * LOTTERY_SCENARIOS.length)]
);

export const getIntimacyQuestion = () => (
  INTIMACY_QUESTIONS[Math.floor(Math.random() * INTIMACY_QUESTIONS.length)]
);

export const getRandomTruthOrDarePrompt = () => {
  const mode = Math.random() >= 0.5 ? 'truth' : 'dare';
  const bank = mode === 'truth' ? TRUTH_PROMPTS : DARE_PROMPTS;

  return {
    mode,
    prompt: bank[Math.floor(Math.random() * bank.length)],
  };
};

export const getRpsOutcome = (userChoice, characterChoice) => {
  if (userChoice === characterChoice) {
    return 'draw';
  }

  const winningPairs = {
    剪刀: '布',
    石头: '剪刀',
    布: '石头',
  };

  return winningPairs[userChoice] === characterChoice
    ? 'user_win'
    : 'character_win';
};

export const getInteractionLabel = (interactionType) => {
  switch (interactionType) {
    case INTERACTION_TYPES.COIN:
      return '旧硬币';
    case INTERACTION_TYPES.DICE:
      return '六面骰';
    case INTERACTION_TYPES.RPS:
      return '猜拳';
    case INTERACTION_TYPES.LOTTERY:
      return '剧场签';
    case INTERACTION_TYPES.INTIMACY_QA:
      return '问答卡';
    case INTERACTION_TYPES.TRUTH_OR_DARE:
      return '真心话大冒险';
    default:
      return '互动';
  }
};

export const getInteractionSummary = (metadata = {}) => {
  const interactionType = metadata?.interactionType;
  const result = metadata?.result || {};

  if (interactionType === INTERACTION_TYPES.COIN) {
    return `硬币落在 ${result.side || '未知一面'}。`;
  }

  if (interactionType === INTERACTION_TYPES.DICE) {
    return `六面骰落在 ${result.value || '未知'} 点。`;
  }

  if (interactionType === INTERACTION_TYPES.RPS) {
    const outcomeText = {
      user_win: '用户获胜',
      character_win: '角色获胜',
      draw: '平局',
    };

    return `猜拳结果：用户出${result.userChoice || '未知'}，角色出${
      result.characterChoice || '未知'
    }，${outcomeText[result.outcome] || '结果未知'}。`;
  }

  if (interactionType === INTERACTION_TYPES.LOTTERY) {
    return `抽到了一支剧场签，情景是：${result.scenario || '未知情景'}。`;
  }

  if (interactionType === INTERACTION_TYPES.INTIMACY_QA) {
    return `抽到的亲密问答卡题目是：${result.question || '未知问题'}。`;
  }

  if (interactionType === INTERACTION_TYPES.TRUTH_OR_DARE) {
    const modeText = result.mode === 'dare' ? '大冒险' : '真心话';
    return `用户向你发起了「${modeText}」，题目是：${result.prompt || '未知题目'}。`;
  }

  return '完成了一次聊天互动。';
};