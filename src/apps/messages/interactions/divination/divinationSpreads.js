// src/apps/messages/interactions/divination/divinationSpreads.js
//
// 四种抽牌方式的定义（纯数据 + 一个纯函数抽牌）。
// 三个三张牌阵只有位置标签不同，渲染与抽牌逻辑共用一套：
// 每个牌阵就是一个 positions 数组，数组长度就是要抽的牌数。

export const SPREAD_IDS = {
  SINGLE: 'single',
  PAST_PRESENT_FUTURE: 'past_present_future',
  RELATIONSHIP: 'relationship',
  DECISION: 'decision',
};

export const DIVINATION_SPREADS = {
  [SPREAD_IDS.SINGLE]: {
    id: SPREAD_IDS.SINGLE,
    label: '无牌阵',
    description: '抽一张牌，直接回答问题',
    positions: [{ key: 'answer', label: '牌面' }],
  },
  [SPREAD_IDS.PAST_PRESENT_FUTURE]: {
    id: SPREAD_IDS.PAST_PRESENT_FUTURE,
    label: '过去 / 现在 / 未来',
    description: '三张牌，看事情的来龙去脉',
    positions: [
      { key: 'past', label: '过去' },
      { key: 'present', label: '现在' },
      { key: 'future', label: '未来' },
    ],
  },
  [SPREAD_IDS.RELATIONSHIP]: {
    id: SPREAD_IDS.RELATIONSHIP,
    label: '双人关系阵',
    description: '你的心意 / 对方的心意 / 关系走向',
    positions: [
      { key: 'self', label: '你的心意' },
      { key: 'other', label: '对方的心意' },
      { key: 'trend', label: '关系走向' },
    ],
  },
  [SPREAD_IDS.DECISION]: {
    id: SPREAD_IDS.DECISION,
    label: '抉择阵',
    description: '选项A / 选项B / 内心指引',
    positions: [
      { key: 'optionA', label: '选项A' },
      { key: 'optionB', label: '选项B' },
      { key: 'guidance', label: '内心指引' },
    ],
  },
};

export const SPREAD_OPTIONS = Object.values(DIVINATION_SPREADS);

export const getSpread = (spreadId) => (
  DIVINATION_SPREADS[spreadId] || DIVINATION_SPREADS[SPREAD_IDS.SINGLE]
);

// Fisher-Yates 洗牌（拷贝一份，不改动原数组）。
const shuffle = (list) => {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

/*
 * 抽牌：从给定牌组里无放回地抽出牌阵所需张数，逐个对应到牌阵位置。
 * supportsReversed 为 true 时，每张牌各自独立地 50% 概率逆位。
 * 返回的每一项都带有位置信息，可以直接存进消息 metadata：
 * { cardId, name, positionKey, positionLabel, reversed }
 */
export const drawCardsForSpread = ({ cards, spreadId, supportsReversed }) => {
  const spread = getSpread(spreadId);
  const deck = Array.isArray(cards) ? cards : [];

  if (deck.length < spread.positions.length) return [];

  const drawn = shuffle(deck).slice(0, spread.positions.length);

  return drawn.map((card, index) => ({
    cardId: card.id,
    name: card.name,
    positionKey: spread.positions[index].key,
    positionLabel: spread.positions[index].label,
    reversed: supportsReversed ? Math.random() >= 0.5 : false,
  }));
};