// src/apps/textgames/undercover/undercoverWordBank.js
//
// "谁是卧底"内置词库：平民词/卧底词是一对意思相近但不完全相同的词，
// 卧底描述自己的词时容易无意中说出跟平民不一样的细节，这就是破绽所在。
// 纯数据文件，不碰 DB/React，方便以后要扩充词库时直接加数组项。
//
// AI 生成词对是可选项（见 undercoverAiWordService.js），这里只是内置
// 兜底词库，任何时候都能直接用，不依赖网络请求。

export const UNDERCOVER_WORD_PAIRS = [
  { civilian: '苹果', undercover: '梨' },
  { civilian: '牙刷', undercover: '梳子' },
  { civilian: '咖啡', undercover: '茶' },
  { civilian: '沙发', undercover: '躺椅' },
  { civilian: '手机', undercover: '平板' },
  { civilian: '篮球', undercover: '排球' },
  { civilian: '老师', undercover: '家教' },
  { civilian: '雨伞', undercover: '雨衣' },
  { civilian: '火锅', undercover: '烧烤' },
  { civilian: '地铁', undercover: '公交车' },
  { civilian: '钢琴', undercover: '电子琴' },
  { civilian: '蛋糕', undercover: '面包' },
  { civilian: '眼镜', undercover: '隐形眼镜' },
  { civilian: '自行车', undercover: '电动车' },
  { civilian: '书包', undercover: '手提包' },
  { civilian: '电影院', undercover: '剧院' },
  { civilian: '围巾', undercover: '领带' },
  { civilian: '沙滩', undercover: '草坪' },
  { civilian: '闹钟', undercover: '手表' },
  { civilian: '拖鞋', undercover: '凉鞋' },
  { civilian: '面条', undercover: '米粉' },
  { civilian: '公园', undercover: '广场' },
  { civilian: '钥匙', undercover: '门禁卡' },
  { civilian: '雪糕', undercover: '冰棍' },
  { civilian: '行李箱', undercover: '背包' },
  { civilian: '医生', undercover: '护士' },
  { civilian: '台灯', undercover: '手电筒' },
  { civilian: '汉堡', undercover: '三明治' },
  { civilian: '羽毛球', undercover: '网球' },
  { civilian: '口罩', undercover: '围巾' },
];

// 随机取一对，且不是最近用过的那几对（避免连续两局撞同一个词对）。
// recentPairs：最近用过的词对数组（跟 UNDERCOVER_WORD_PAIRS 的项引用
// 无关，按 civilian 字段比较即可），不传就是普通随机。
export const pickRandomWordPair = (recentPairs = []) => {
  const recentCivilians = new Set((recentPairs || []).map((p) => p?.civilian));
  const pool = UNDERCOVER_WORD_PAIRS.filter((p) => !recentCivilians.has(p.civilian));
  const list = pool.length > 0 ? pool : UNDERCOVER_WORD_PAIRS;
  return list[Math.floor(Math.random() * list.length)];
};