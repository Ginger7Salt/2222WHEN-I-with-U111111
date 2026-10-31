// src/apps/messages/interactions/drawGuess/drawGuessWords.js
//
// 你画我猜的预设题库。全部是通用名词，不含任何作品里的角色或品牌，
// 保证普通人几笔就能画出个大概。按类别分组：类别会一并告诉角色，
// 相当于真人玩时常见的"提示一下是什么类型"，让猜测不至于完全无从下手。

export const DRAW_WORD_CATEGORIES = [
  {
    id: 'animal',
    label: '动物',
    words: [
      '猫', '狗', '兔子', '小鸟', '鱼', '乌龟',
      '大象', '企鹅', '蝴蝶', '青蛙', '蜗牛', '熊猫',
    ],
  },
  {
    id: 'food',
    label: '食物',
    words: [
      '苹果', '西瓜', '蛋糕', '冰淇淋', '饺子', '面条',
      '汉堡', '奶茶', '香蕉', '草莓', '披萨', '面包',
    ],
  },
  {
    id: 'object',
    label: '日常物品',
    words: [
      '雨伞', '眼镜', '钥匙', '台灯', '自行车', '杯子',
      '剪刀', '帽子', '吉他', '闹钟', '书包', '耳机',
    ],
  },
  {
    id: 'nature',
    label: '自然与天气',
    words: [
      '太阳', '月亮', '云朵', '彩虹', '雪人', '星星',
      '大树', '花', '山', '海浪', '闪电', '雨滴',
    ],
  },
  {
    id: 'scene',
    label: '场景与动作',
    words: [
      '睡觉', '吃饭', '跑步', '打伞', '看星星', '过马路',
      '放风筝', '拥抱', '牵手', '刷牙', '游泳', '钓鱼',
    ],
  },
];

/*
 * 随机抽一道题。excludeWord 用于"换一个"：保证换出来的不是上一道。
 * 先随机选类别，再从该类别里随机选词，这样每个类别被抽到的概率相同，
 * 不会因为某个类别词多就总是抽到它。
 */
export const getRandomDrawWord = (excludeWord = '') => {
  const categories = DRAW_WORD_CATEGORIES.filter(
    (category) => category.words.some((word) => word !== excludeWord)
  );

  const category = categories[Math.floor(Math.random() * categories.length)];
  const candidates = category.words.filter((word) => word !== excludeWord);
  const word = candidates[Math.floor(Math.random() * candidates.length)];

  return {
    word,
    categoryId: category.id,
    categoryLabel: category.label,
  };
};
