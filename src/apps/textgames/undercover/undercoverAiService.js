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
// 走"原始内容兜底"这条路时，模型可能也没遵守25字限制——截断一下避免
// 在 UI 上挤成一大段，跟 UndercoverGame.jsx 里 SPEECH_MAX_LEN 留一点余量
// （这里稍微宽松一点，没必要跟用户输入框的硬限制一模一样）。
const SPEECH_HARD_CAP = 40;

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

// 下面这几个诊断用的 console.warn（2026-10 排查"AI 总是退回兜底"问题时
// 加的）：原来请求失败/格式解析不出来/词语泄露这三种情况全部静默退回
// 兜底，玩的时候完全看不出卡在哪一步。现在每一步失败都会在控制台打印
// 一行 [UndercoverAiService] 开头的日志，帮忙对照下面哪一种：
// 1. "没有配置 apiConfig" —— db.settings 里没有 baseUrl/apiKey，这个
//    游戏本身没走错路，是接口配置没读到（但其他游戏正常就不太像这个）；
// 2. "接口返回非 200" —— 带上了状态码，网络/接口本身的问题；
// 3. "解析不出发言格式，原始内容：..." —— 接口确实返回了内容，但不是
//    "发言：xxx"这个格式，模型没有照着格式输出（最常见的一种，很多
//    模型不会严格遵守这种"冒号后一句话"的格式要求）；
// 4. "发言里包含了词本身，已替换成兜底" —— 格式对了，但内容里带了那个
//    词，被兜底逻辑拦掉了（这种情况其实是在保护游戏，不是 bug）。
const getApiConfig = async () => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    console.warn('[UndercoverAiService] 没有配置 apiConfig（缺 baseUrl 或 apiKey），退回兜底。');
    return null;
  }
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
        // 2026-10 排查发现：只发一条 role:'system' 消息，在某些
        // 网关/代理（比如把 messages 转译成 Gemini 的 contents 字段
        // 那种）下会被判定成"contents is not specified"直接 400——
        // 这类网关认定"只有 system、没有任何 user 消息"不是合法请求。
        // 改成标准的 system+user 两条，把人设/规则放 system，把"现在
        // 要做什么"单独放一条 user，兼容性更好，其他聊天接口对这种
        // 写法也完全没问题。
        messages: [
          { role: 'system', content: '你是一个游戏里的角色扮演助手，严格按用户给出的要求生成内容。' },
          { role: 'user', content: systemPrompt },
        ],
        temperature: 0.9,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      console.warn(
        `[UndercoverAiService] 接口返回非 200（状态码 ${response.status}），退回兜底。`,
        bodyText.slice(0, 300)
      );
      return '';
    }

    const data = await response.json();
    return removeEmoji(data?.choices?.[0]?.message?.content || '');
  } catch (error) {
    console.warn('[UndercoverAiService] 请求失败（网络错误/超时/JSON解析失败）。', error);
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

// 模型不一定会乖乖带着"发言："这个标签回答——很多模型对"随口说一句话"
// 这种偏口语化的要求，会直接说那句话，不套格式（跟"选一个编号"这种天然
// 适合结构化输出的要求不一样）。所以解析失败时不直接认输：退一步把
// 原始内容本身洗一遍（去掉首尾引号/多余空白/换行）当成发言内容，只有
// 洗完还是空的才真正交给兜底库。
const cleanRawReply = (content) =>
  String(content || '')
    .trim()
    .replace(/^["'"'「『]+|["'"'」』]+$/g, '')
    .split('\n')[0]
    .trim();

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
    if (!content) return fallback(); // requestText 已经打印过具体原因了

    const match = content.match(/发言[：:]\s*(.+)/);
    let text = match ? match[1].trim() : '';

    if (!text) {
      // 没按格式回答，退一步直接用模型说的那句话本身，不急着判定失败。
      text = cleanRawReply(content);
      if (text) {
        console.warn('[UndercoverAiService] 没有按"发言：xxx"格式回答，改用原始内容本身。原始内容：', content);
      }
    }

    if (!text) {
      console.warn('[UndercoverAiService] 解析不出任何可用发言内容，原始内容：', content);
      return fallback();
    }
    if (text.length > SPEECH_HARD_CAP) {
      text = `${text.slice(0, SPEECH_HARD_CAP)}……`;
    }
    if (containsWord(text, seat.word)) {
      console.warn('[UndercoverAiService] 发言里包含了词本身，已替换成兜底。', text);
      return fallback();
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
    if (!content) return { target: fallbackPick(), reason: '' }; // requestText 已经打印过原因

    const nameMatch = content.match(/投票[：:]\s*(\S+)/);
    const reasonMatch = content.match(/理由[：:]\s*(.+)/);
    const pickedName = nameMatch?.[1]?.trim();
    let matched = candidates.find((c) => c.label === pickedName);

    if (!matched) {
      // 没按"投票：名字"格式回答——退一步看原始内容里有没有直接提到
      // 某个候选人的名字（模型可能只是说了"我觉得是XX"这种自然语句）。
      matched = candidates.find((c) => content.includes(c.label));
      if (matched) {
        console.warn('[UndercoverAiService] 没有按"投票：名字"格式回答，从原始内容里认出了候选人名字。', content);
      }
    }

    if (!matched) {
      console.warn(
        `[UndercoverAiService] 投票解析不出候选名字（候选是：${candidateNames}），随机选择。原始内容：`,
        content
      );
    }

    return {
      target: matched || fallbackPick(),
      reason: reasonMatch ? reasonMatch[1].trim() : '',
    };
  } catch (error) {
    console.warn('[UndercoverAiService] 投票生成失败，随机选择。', error);
    return { target: fallbackPick(), reason: '' };
  }
};