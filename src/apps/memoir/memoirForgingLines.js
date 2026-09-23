// src/apps/memoir/memoirForgingLines.js
//
// "灵魂锻造"：不是独立的成长玩法，只是回忆录数据的文字化呈现——根据回忆
// 条数、情绪分布，从预设文案库里挑一句贴切的话，展示在回忆录页面顶部。
// 纯展示层，不改变角色实际人格/对话逻辑。

// 按回忆条数分档的默认文案（还没形成明显情绪倾向、或情绪样本太少时使用）。
const COUNT_TIERS = [
  { max: 0, line: '你们才刚刚开始了解彼此，回忆录还是一片空白。' },
  { max: 3, line: '最初的几段经历，正被TA悄悄记在心里。' },
  { max: 10, line: '你们之间的共同经历正在一点点积累起来。' },
  { max: 30, line: '日子久了，这些琐碎的瞬间已经拼出了一段扎实的相处。' },
  { max: Infinity, line: '长久的陪伴里，你们早已攒下了满满一本回忆。' },
];

// 某种情绪的回忆条数足够多、明显占多数时，用更贴切的专属文案。
const DOMINANT_EMOTION_LINES = {
  touched: 'TA似乎正在被这个人一点点打动。',
  warm: 'TA已经习惯为你张罗生活里的小事。',
  happy: '和你在一起的这些瞬间，TA总是很开心。',
  shy: '有些心意，TA说出口时总带着一点不好意思。',
  sorry: 'TA似乎一直惦记着某些没有做好的地方。',
  worried: 'TA好像总在不动声色地留意着你的状态。',
  excited: '一想到能为你做点什么，TA就有点雀跃。',
};

// 至少要有这么多条同种情绪的回忆，才认为"足够稳定"，避免样本太少就下结论。
const DOMINANT_EMOTION_MIN_COUNT = 3;

const pickCountTierLine = (count) => {
  const tier = COUNT_TIERS.find((item) => count <= item.max);
  return (tier || COUNT_TIERS[COUNT_TIERS.length - 1]).line;
};

const findDominantEmotion = (memoirs) => {
  const tally = new Map();

  memoirs.forEach((memoir) => {
    if (!memoir.emotion) return;
    tally.set(memoir.emotion, (tally.get(memoir.emotion) || 0) + 1);
  });

  let dominant = null;
  let dominantCount = 0;

  tally.forEach((value, key) => {
    if (value > dominantCount) {
      dominant = key;
      dominantCount = value;
    }
  });

  return { dominant, dominantCount };
};

export const pickForgingLine = ({ memoirs = [] }) => {
  if (memoirs.length === 0) {
    return COUNT_TIERS[0].line;
  }

  const { dominant, dominantCount } = findDominantEmotion(memoirs);

  if (
    dominant
    && dominantCount >= DOMINANT_EMOTION_MIN_COUNT
    && DOMINANT_EMOTION_LINES[dominant]
  ) {
    return DOMINANT_EMOTION_LINES[dominant];
  }

  return pickCountTierLine(memoirs.length);
};