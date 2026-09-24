/*
 * 情绪相关的信号词表与标签，独立成文件，避免继续膨胀 memorySignals.js。
 *
 * 用途 1：EMOTION_SIGNAL_PATTERNS 会被 memorySignals.js 并入信号规则，
 *   用来判断"这批消息里有没有值得尽快整理的情绪线索"。
 *   - priority 4：强烈或明确指向关系的情绪，会让记忆整理提前触发。
 *   - priority 3：较温和的情绪线索，只会被记录为信号，不会单独触发整理，
 *     避免每一句"有点累"都消耗一次 AI 调用。
 *
 * 用途 2：EMOTION_VALENCES / EMOTION_VALENCE_LABELS 是情绪记忆的
 *   "正负向"字段（emotionValence）的取值和展示文案，
 *   memoryAiService.js 用它校验 AI 输出，MemoryCard.jsx 用它展示。
 */

export const EMOTION_VALENCES = [
  'positive',
  'negative',
  'mixed',
  'neutral'
];

export const EMOTION_VALENCE_LABELS = {
  positive: '偏正向',
  negative: '偏负向',
  mixed: '悲喜交加',
  neutral: '中性'
};

export const EMOTION_SIGNAL_PATTERNS = [
  // 强烈的情绪状态
  {
    type: 'emotion',
    priority: 4,
    pattern: /我(真的|已经|快|好像)?(崩溃|受不了|撑不下去|绝望|心碎|喘不过气|想哭|哭了).{0,100}/
  },
  {
    type: 'emotion',
    priority: 4,
    pattern: /我(真的)?(好|很|特别|太|超级|非常)(焦虑|委屈|失望|孤独|寂寞|愧疚|后悔|生气|愤怒|害怕|不安|难受|心累|烦|想你|想念|感动|幸福|期待|兴奋|激动|安心|心动|紧张|慌).{0,100}/
  },
  {
    type: 'emotion',
    priority: 4,
    pattern: /(太开心了|好幸福|超级开心|开心死了|激动死了|高兴坏了).{0,100}/
  },

  // 直接对角色表达的思念与不安
  {
    type: 'emotion',
    priority: 4,
    pattern: /(好想你|我想你了|特别想你|一直想着你).{0,100}/
  },
  {
    type: 'emotion',
    priority: 4,
    pattern: /你(根本|完全)?(不懂我|不理解我|不在乎我|不关心我|不爱我|不喜欢我了).{0,100}/
  },
  {
    type: 'emotion',
    priority: 4,
    pattern: /(是不是|会不会)(不喜欢我了|不要我了|讨厌我了|在生我的气|嫌我烦).{0,100}/
  },

  // 关系里的冲突与转折
  {
    type: 'relationship',
    priority: 4,
    pattern: /(吵架|冷战|不想理你|不想说话|别管我).{0,100}/
  },
  {
    type: 'relationship',
    priority: 3,
    pattern: /(对不起|我错了|是我不好|别生气了|我们和好|和好吧|原谅我).{0,100}/
  },
  {
    type: 'relationship',
    priority: 3,
    pattern: /(谢谢你|多亏了你|有你在真好|被你治愈|你让我好多了).{0,100}/
  },

  // 较温和的情绪线索，只记录，不单独触发整理
  {
    type: 'emotion',
    priority: 3,
    pattern: /(有点|有些|稍微|感觉)(累|疲惫|难过|难受|害怕|生气|焦虑|紧张|委屈|失落|烦躁|无聊|孤单|低落|不安|担心|开心|高兴|期待|放松|安心).{0,100}/
  }
];