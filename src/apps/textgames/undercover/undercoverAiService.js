// src/apps/textgames/undercover/undercoverAiService.js
//
// "谁是卧底"每一位 AI/NPC 座位的发言和投票——跟 witchsPoisonAiService.js
// 一样直接 fetch 接口配置，不走 interactionAiService.js 的
// getGenerationContext（那个函数认定"一个 chatId 对应一个角色"，这里
// 一局要给 4 个不同座位分别调用，且 NPC 根本没有 chatId），失败就安静
// 退回兜底发言/随机投票，不中断对局本身。
//
// 发言规则（设计确认）：限字数，且严格不能直接说出自己的词本身——提示词
// 里要求，另外在解析结果后再用 containsWord 兜底检查一次，双重保险。
// 投票理由会展示给用户看（设计确认），所以这里的投票提示词也要求 AI
// 给一句理由。

import db from '../../../db';

const REQUEST_TIMEOUT_MS = 12000;

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

const getApiConfig = async () => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;
  return apiConfig;
};

const requestText = async (systemPrompt) => {
  const apiConfig = await getApiConfig();
  if (!apiConfig) return '';

  let timer = null;
  try {
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.9,
      }),
    });
    if (!response.ok) return '';

    const data = await response.json();
    return removeEmoji(data?.choices?.[0]?.message?.content || '');
  } catch (error) {
    console.warn('[UndercoverAiService] 请求失败。', error);
    return '';
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const FALLBACK_SPEECHES = [
  '这个东西我平时也会用到，挺常见的。',
  '说起来有点难形容，但生活里经常碰到。',
  '它给我的感觉还挺日常的，不算特别。',
  '我对这个印象还可以，说不上太深的感受。',
];

const containsWord = (text, word) => !!text && !!word && text.includes(word);

// seat：当前要发言的座位（带 name/bio/word）。speechHistory：
// toPerspectiveSpeechLog 转换好的、这个座位视角下的 [{ label, text }]。
export const requestUndercoverSpeech = async ({ seat, speechHistory }) => {
  const fallback = () => FALLBACK_SPEECHES[Math.floor(Math.random() * FALLBACK_SPEECHES.length)];

  const historyLines = (speechHistory || [])
    .map((entry) => `${entry.label}：${entry.text}`)
    .join('\n');

  const systemPrompt = `你正在扮演：${seat.name}。

人设：
${seat.bio || '无'}

你在玩"谁是卧底"：你拿到的词是"${seat.word}"，这是你自己的秘密。请用一句话
描述这个词给你的感觉、用途或联想，目的是让同阵营的人认出你、同时不轻易
被对方看穿。

${historyLines ? `本轮目前已经有人发言：\n${historyLines}\n` : '你是本轮第一个发言的人。'}

严格要求：
- 只输出一句话，不超过25个汉字；
- 绝对不能直接说出"${seat.word}"这个词本身，也不能说出几乎等价的说法；
- 不使用 Emoji；
- 不要输出标题、引号、解释、前言；
- 不要提及AI、系统、游戏、卧底、平民、身份等词。

严格按下面格式输出，不要有其他内容：
发言：<一句话>`;

  try {
    const content = await requestText(systemPrompt);
    const match = content.match(/发言[：:]\s*(.+)/);
    let text = match ? match[1].trim() : '';
    if (!text || containsWord(text, seat.word)) {
      text = fallback();
    }
    return text;
  } catch (error) {
    console.warn('[UndercoverAiService] 发言生成失败，使用兜底发言。', error);
    return fallback();
  }
};

// candidates：getVoteCandidates 算好的、排除自己之后的候选名单
// [{ seatIndex, label }]。speechHistory：这个座位视角下的发言记录。
export const requestUndercoverVote = async ({ seat, candidates, speechHistory }) => {
  const fallbackPick = () => candidates[Math.floor(Math.random() * candidates.length)];
  if (!candidates || candidates.length === 0) return { target: null, reason: '' };

  const historyLines = (speechHistory || [])
    .map((entry) => `${entry.label}：${entry.text}`)
    .join('\n');
  const candidateNames = candidates.map((c) => c.label).join('、');

  const systemPrompt = `你正在扮演：${seat.name}。

人设：
${seat.bio || '无'}

你在玩"谁是卧底"，你拿到的词是"${seat.word}"。这一轮所有人的发言：
${historyLines || '（这一轮没有人发言）'}

请根据发言内容，投票选出你认为最可能是卧底的一位（不能投给自己），只能
从这些人里选：${candidateNames}。

严格按下面格式输出，不要有其他内容：
投票：<名字>
理由：<一句话，不超过20个汉字>`;

  try {
    const content = await requestText(systemPrompt);
    const nameMatch = content.match(/投票[：:]\s*(\S+)/);
    const reasonMatch = content.match(/理由[：:]\s*(.+)/);
    const pickedName = nameMatch?.[1]?.trim();
    const target = candidates.find((c) => c.label === pickedName) || fallbackPick();
    return {
      target,
      reason: reasonMatch ? reasonMatch[1].trim() : '',
    };
  } catch (error) {
    console.warn('[UndercoverAiService] 投票生成失败，随机选择。', error);
    return { target: fallbackPick(), reason: '' };
  }
};