// src/apps/messages/interactions/drawGuess/drawGuessRules.js
//
// 你画我猜的纯规则函数：状态常量、猜测判定、写进消息 content 的文案。
// 不访问数据库，也不发网络请求，方便 service / AI service / 卡片组件共用。

export const DRAW_GUESS_STATUS = {
  GUESSING: 'guessing',
  RESOLVED: 'resolved',
  FAILED: 'failed',
};

// 判定时统一去掉空白和常见标点、转小写，避免"猫！"和"猫"被当成不同答案。
const normalizeForMatch = (text = '') => String(text)
  .toLowerCase()
  .replace(/[\s　.,!?;:'"()\[\]{}<>~、，。！？；：“”‘’（）【】《》…—\-]/g, '');

/*
 * 判断角色猜得对不对。采用宽松的包含判定：
 * 猜的答案和题目互相包含就算对（"生日蛋糕"对"蛋糕"、"鸟"对"小鸟"）。
 * 角色没给出明确答案（guess 为空）时，退一步看它说的整句话里有没有出现题目。
 * 同义说法（比如"单车"对"自行车"）判不出来，所以卡片上留了手动改判的入口。
 */
export const isGuessCorrect = (word, guess, line = '') => {
  const target = normalizeForMatch(word);
  if (!target) return false;

  const normalizedGuess = normalizeForMatch(guess);

  if (normalizedGuess) {
    return (
      normalizedGuess.includes(target) || target.includes(normalizedGuess)
    );
  }

  return normalizeForMatch(line).includes(target);
};

/*
 * 消息 content 会被聊天上下文和记忆系统当作普通文本读到。
 * 关键：在角色猜出来之前，content 里绝不能出现题目，否则这段时间里
 * 任何一次别的 AI 调用读到历史，都会把答案泄露给角色。题目只在
 * 已经有结果之后才写进 content。
 */
export const buildDrawGuessContent = (metadata = {}) => {
  const result = metadata?.result || {};

  if (metadata?.status !== DRAW_GUESS_STATUS.RESOLVED) {
    return '用户画了一幅画，正在等你看画来猜。';
  }

  const guessText = result.guess || '没有说出确切的答案';
  const verdictText = result.isCorrect ? '你猜对了' : '你没有猜对';

  return `用户和你玩了一局「你画我猜」：用户画的是「${result.word || '未知'}」，你猜的是「${guessText}」，${verdictText}。`;
};
