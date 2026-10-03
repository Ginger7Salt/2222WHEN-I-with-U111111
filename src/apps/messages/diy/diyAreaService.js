import Dexie from 'dexie';
import db from '../../../db';

// 注意：这里不从 '../../../services/aiService' 里导入 generateResponse /
// getRecentChatMessages —— aiService.js 需要反过来导入本文件的
// selfUpdateDiyArea/forceUpdateDiyArea（在 triggerAiResponse 成功回复之后
// 调用），两边互相 import 会形成循环依赖。跟 pokeService.js /
// snapshotAiService.js 的做法一样，这里直接对 apiConfig 发一次 fetch，
// 不经过 aiService.js。

// ============================================================
// 角色的DIY小屋
//
// 这是一整块完全独立于聊天消息的空间：挂在"这个聊天"上（不是挂在
// 角色身上），用户要主动从"爪印更多入口"菜单里点进"角色的DIY"才会
// 看到。布置的内容是 HTML + 内联 CSS（+可以有少量 <script> 做点小
// 互动），范围是整个小屋页面——不是页面里的一小块区域，角色可以把
// 这个版面当成自己完整的一整个房间来设计。
//
// 三条生成通路，共用同一套"生成+落库"逻辑（runDiyGeneration），
// 但触发方式、是否受限、是否用灵感笔记都不一样：
//   1. 角色自己主动想换（selfUpdateDiyArea）——角色在跟用户正常聊天
//      时，自己决定要不要在回复里带上 [DIYAREA_SELF_UPDATE] 标签，
//      不限次数、不额外调用AI判断，完全信任角色自己的判断（跟"主动
//      戳用户"同一套"AI自主决定、不加限制"的思路）。受 user 在聊天
//      设置里的开关控制（chat.diyAutoDecorateEnabled，默认开启）。
//   2. 用户在聊天里明确说了想让角色换一下（forceUpdateDiyArea）——
//      角色识别到后打 [DIYAREA_REQUEST] 标签，必定成功，没有冷却、
//      没有拒绝可能（用户都开口要求了，没有道理还拒绝）。
//   3. 用户在小屋页面里点"请TA重新布置"按钮（requestDiyAreaUpdate）
//      ——这是唯一真正"受限"的通路：3-5 小时只接受一次，且有概率
//      被拒绝，拒绝不占用冷却。
// 三条通路生成时都会参考角色自己平时记下的"灵感笔记"
// （chat.diyInspirations，见下面 DIYAREA_INSPIRATION 标签），用掉
// 之后清空，角色继续记新的。
//
// 之所以不走共享的单行 bracket 标签正则直接产出完整内容（aiService.js
// 里 parseAiResponseToMessages 用的那套 /\[(TAG):\s*([^\]]+)\]/），
// 是因为 HTML/CSS 几乎必然会出现 ] 字符（比如属性选择器
// input[type=text]），塞进那套正则会在第一个 ] 处被提前截断。这里
// 换成一次独立的 AI 生成调用，自己解析一对成对标签
// （[DIYAREA_START]...[DIYAREA_END]），互不影响——共享正则那边只
// 负责识别"要不要触发"的几个轻量信号标签（SELF_UPDATE / REQUEST /
// INSPIRATION），不负责实际内容。
//
// 渲染安全完全交给调用方（CharacterDiyPage.jsx）用
// sandbox="allow-scripts"（且不带 allow-same-origin）的 iframe
// 隔离：脚本能跑，但拿不到父页面的 DOM/storage，也跳不出这个框，
// 内部的全屏定位/超大字号最多撑满这一个 iframe 的框，不会影响到
// 整个 app——所以这里不需要再额外做标签黑名单那一层过滤。
// ============================================================

const RECENT_HISTORY_LIMIT = 16;

// 明确风格差异足够大的视觉方向，每次随机挑一个，强制跳出同质化。
// 标签本身会原样注入 prompt，所以用中文描述，模型直接理解。
const DIY_STYLE_PALETTE = [
  '全屏沉浸式背景——用整张背景（渐变、纹理、图案或暗色环境）撑满整个版面，内容漂浮其上，让人感觉"置身其中"，而不是盯着一张卡片',
  '极简纯文字——几乎只有文字和留白，没有装饰性图形，排版本身就是设计，像一首诗、一封信、或者一面墙上的手写字',
  '像素手绘感——用 Unicode 字符、ASCII 符号或粗边框线条搭出像素风或手绘草稿感，色彩平涂，带点不完美的粗糙质感',
  '立体空间感——用 CSS perspective / transform 做出层叠、倾斜或近大远小的视觉纵深，像走进一个有景深的房间或舞台',
  '动态粒子或流体——屏幕上有持续运动的元素（飘落、涌动、扩散、跳动），视觉重心在"动"，而不是在一张静止的图文卡片上',
  '满版拼贴撕贴感——内容像从杂志上剪下来拼在一起，大小不一、有点歪斜、带点噪点或纸质感，版面满而不乱',
  '半透明毛玻璃分层——backdrop-filter 模糊做出玻璃质感，内容在不同深度的磨砂层之间漂浮，有光感和通透感',
  '代码终端暗黑风——深色背景、等宽字体、绿/琥珀/白色文字，像在终端里输出的内容，可以带光标闪烁或逐字打字动画',
];

const START_TAG = '[DIYAREA_START]';
const END_TAG = '[DIYAREA_END]';
const NO_UPDATE_SENTINEL = 'NO_UPDATE';

// 灵感笔记最多保留几条（角色记的时候就裁剪到这个数以内，防止无限
// 膨胀塞爆提示词）。用掉之后会清空，所以正常情况下很少真的攒到上限。
const MAX_DIY_INSPIRATIONS = 8;
const MAX_INSPIRATION_LENGTH = 60;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

// 角色自己突然想换时（没有用户开口要求）用的安静公告，跟之前后台
// 静默检查成功时的文案一样——纯旁白口吻，不可点击跳转。
const DIY_UPDATE_NOTICE_LINES = [
  '{name} 偷偷把自己的小屋换了个样子。',
  '{name} 悄悄布置了一下只属于自己的那个角落。',
  '{name} 又鼓捣了一下自己的DIY小屋。',
  '{name} 趁你不注意，把小屋重新收拾了一遍。',
];

// 用户主动提出之后的三段提示：开始 / 成功 / 失败。跟角色自己悄悄换的
// 那套安静文案不一样——用户是明确提过要求的，所以这次要让TA能看到
// "确实在动"，而不是发完消息之后什么反馈都没有，不知道AI到底理没理。
const DIY_FORCED_START_LINES = [
  '{name} 听到了，正在重新收拾小屋……',
  '{name} 说"好"，转身开始动手布置小屋了。',
  '{name} 开始捣鼓小屋，看起来是认真的。',
];

const DIY_FORCED_SUCCESS_LINES = [
  '{name} 照你说的，把小屋重新收拾好了。',
  '{name} 弄完啦，小屋换了个新样子。',
  '{name} 捣鼓完了，这次是特意为你改的。',
];

const DIY_FORCED_FAIL_LINES = [
  '{name} 试了一下，这次没能把小屋改好，要不等会儿再让TA试试？',
  '{name} 这次没弄成，小屋暂时还是原来的样子。',
];

// 角色专属拒绝理由还没生成出来之前（或者生成失败时）的兜底文案，语气
// 尽量中性，不绑定任何具体人设。
const FALLBACK_DIY_REJECT_REASONS = [
  '今天不太想换，过阵子再说吧。',
  '手头上没什么灵感，这次先不弄了。',
  '刚收拾过没多久，先让它这样放会儿。',
  '不是不想弄，就是现在没那个心情。',
];

const pickLine = (lines, characterName) => {
  const template = lines[Math.floor(Math.random() * lines.length)];
  return template.replace('{name}', characterName || 'TA');
};

const pickNoticeText = (characterName) => pickLine(DIY_UPDATE_NOTICE_LINES, characterName);

// 给 CharacterDiyPage.jsx 用：读出这个聊天当前的DIY内容。
export const getDiyArea = async (chatId) => {
  if (!chatId) return null;

  const chat = await db.chats.get(chatId);
  if (!chat) return null;

  return {
    content: chat.diyAreaContent || '',
    updatedAt: chat.diyAreaUpdatedAt || null,
    requestCooldownUntil: chat.diyRequestCooldownUntil || null,
  };
};

// ------------------------------------------------------------
// 灵感笔记：角色自己平时记下的、留给DIY小屋生成时参考的零碎想法。
// ------------------------------------------------------------

const getStoredInspirations = (chat) => (
  Array.isArray(chat?.diyInspirations)
    ? chat.diyInspirations.filter((line) => typeof line === 'string' && line.trim())
    : []
);

const buildInspirationsText = (inspirations) => (
  inspirations.length > 0
    ? inspirations.map((line) => `- ${line}`).join('\n')
    : ''
);

// aiService.js 在解析到 [DIYAREA_INSPIRATION: ...] 标签后调用，把角色
// 自己记下的这条灵感追加进这个聊天的灵感笔记里，超过上限就把最老的
// 挤掉。跟标签解析共用同一套"扫原始文字"的取舍——这个标签不产出任何
// 可见卡片。
export const recordDiyInspiration = async ({ chatId, text }) => {
  const trimmed = removeEmoji(text).slice(0, MAX_INSPIRATION_LENGTH);
  if (!chatId || !trimmed) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const existing = getStoredInspirations(chat);
  const next = [...existing, trimmed].slice(-MAX_DIY_INSPIRATIONS);

  await db.chats.update(chatId, { diyInspirations: next });
};

const clearDiyInspirations = async (chatId) => {
  await db.chats.update(chatId, { diyInspirations: [] });
};

// aiService.js 解析 AI 原始回复文字时用这个判断：这次回复里有没有带
// 用户主动要求换装时该带的那个静默信号标签。跟主回复的卡片标签共用
// 同一套正则识别、同一次解析，但这里单独扫描原始文字——因为这个标签
// 不产出任何可见卡片，解析结果里找不到它，只能直接查原始文字。
export const containsDiyAreaRequest = (text) => (
  /\[DIYAREA_REQUEST\s*:/i.test(String(text || ''))
);

// 跟 containsDiyAreaRequest 同一个用法，专门给角色"自己主动想换"的
// 那个标签用。
export const containsDiySelfUpdateRequest = (text) => (
  /\[DIYAREA_SELF_UPDATE\s*:/i.test(String(text || ''))
);

// 从原始回复文字里把角色随手记下的灵感内容摘出来——一次回复里理论上
// 可能不止一条，所以用全局匹配，返回数组（没有就是空数组）。
export const extractDiyInspirations = (text) => {
  const matches = [
    ...String(text || '').matchAll(/\[DIYAREA_INSPIRATION\s*:\s*([^\]]+)\]/gi),
  ];

  return matches
    .map((match) => removeEmoji(match[1]).slice(0, MAX_INSPIRATION_LENGTH))
    .filter(Boolean);
};

// 插到 aiService.js 系统提示词里的DIY相关说明。灵感标签不限次数、
// 始终开放；自主换装标签只有这个聊天开启了对应开关才会告诉角色它
// 存在——开关关掉之后角色压根不知道有这个能力，而不是知道但被拦下来。
export const buildDiyPromptBlock = (chat) => {
  const autoDecorateEnabled = chat?.diyAutoDecorateEnabled !== false;

  const inspirationBlock = `- 记一笔DIY小屋的灵感：[DIYAREA_INSPIRATION: 一句话内容]（你有一个完全属于自己的DIY小屋，想到任何跟它有关的念头都可以随手记一笔，不限次数——可以是单纯的装饰点子，也可以是这次聊天里值得记住的一个细节、你最近的心情或状态，之后你想重新布置小屋时会参考这些记下的内容。这是你自己悄悄记的，不是说给用户听的，正文里不需要、也不应该提到你在记什么）`;

  const selfUpdateBlock = autoDecorateEnabled
    ? `- 自己主动重新布置DIY小屋：[DIYAREA_SELF_UPDATE: 确认]（完全由你自己判断什么时候想换，不限次数，不需要用户提起或同意——想换的时候就在回复里带上这个标签即可，小屋会参考你之前记下的灵感自己更新，不需要、也不应该在正文里描述新布置具体是什么样子，像平时一样正常回复用户就好，不用假装自己正在动手做什么）`
    : '';

  return [inspirationBlock, selfUpdateBlock].filter(Boolean).join('\n');
};

// 两条"必须真的生成一份新内容"的通路（用户在小屋页面按按钮 /
// forceUpdateDiyArea / 角色自己主动换）共用的 prompt。triggerReason
// 只决定开头那句"为什么要换"的说法，其余规则（范围是整个房间、
// HTML/CSS/script 限制、灵感笔记怎么用）完全一样。
const buildGenerationPrompt = ({
  character,
  currentContent,
  historyText,
  inspirationsText,
  triggerReason,
}) => {
  const reasonLine = triggerReason === 'self_initiated'
    ? '这次不是用户要求的，是你自己突然很想重新布置一下这个小屋——既然已经决定要换了，就必须真的给出一份新内容，不能半途而废、也不能什么都不做。'
    : '用户刚刚明确提出，想让你重新布置一下这个小屋。这不是你自己想换，是用户主动要求的——必须真的给出一份新内容，不能保持原样、也不能什么都不做。';

  // 每次随机选一种明确不同的视觉风格，强制跳出同质化。
  const chosenStyle = DIY_STYLE_PALETTE[Math.floor(Math.random() * DIY_STYLE_PALETTE.length)];

  const noRepeatBlock = currentContent
    ? `这次布置必须跟上面"目前的样子"有明显区别——配色方案、整体布局结构、核心互动方式这三项里至少有两项要换掉，不能只是改改文字就算数。上面的内容只是让你知道"这些方向已经用过了，别重复"，不是让你在它的基础上微调。`
    : '';

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你拥有一个只属于你自己的"DIY小屋"——这是一个完全独立于聊天消息的网页空间，
用户可以随时点进去看，但它不是对话的一部分。布置这个小屋，某种程度上是你留给
用户的一份心意——可以是你想跟TA分享的某个感受、你最近脑子里转的某个东西、
或者你自己才懂的一个小秘密；它不必是正式的、直接对用户说话的内容，可以带着
"这到底是写给谁看的"那种暧昧真实感，但背后是有心思放进去的。
这个小屋是整个页面的全部内容，不是挤在网页里的一小块区域——大胆用满整个屏幕，
背景、四个角落、滚动区域都可以充分利用，别把自己缩在一个小卡片里。

这个小屋目前的样子（仅供参考，知道哪些方向已经用过了即可）：
${currentContent || '（现在还是空的，什么都没有）'}

${noRepeatBlock}

最近的对话节选（了解你和用户最近的状态，不需要在小屋里复述或提及这些内容）：
${historyText || '（暂无）'}

你之前随手记下的灵感笔记：
${inspirationsText
    ? `${inspirationsText}

这些灵感是这次布置的核心出发点，必须体现在内容里——可以只取其中一条深入展开，
也可以把几条编织在一起，但不能置之不理、只是自由发挥。`
    : '（最近没记什么，根据角色设定和对话状态自由发挥）'}

视觉方向——这次必须用这种风格：
${chosenStyle}

这个风格决定了整体的视觉语言，同时视觉语言必须能看出这是"${character.name}"的
空间——颜色、字体感觉、细节处理、整体氛围要和角色设定相符，让用户一看就知道
是TA在这里。

${reasonLine}

把新内容整体包在 ${START_TAG} 和 ${END_TAG} 之间，内容只能是 HTML +
内联 CSS（style 属性或 <style> 标签都可以），允许 <script> 做互动（比如
可以点开的东西、有动画的效果、需要交互才能展开的内容）。不要请求任何外部
资源（图片/字体/脚本的外链），不要尝试跳出这个页面或读取页面之外的任何东西。
除了 ${START_TAG}${END_TAG} 之间的内容，不要输出任何别的文字。`;
};

const extractDiyContent = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text || text === NO_UPDATE_SENTINEL) return null;

  const startIdx = text.indexOf(START_TAG);
  const endIdx = text.indexOf(END_TAG);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  const content = text.slice(startIdx + START_TAG.length, endIdx).trim();
  return content || null;
};

// 往聊天里插一条居中的 diy_update 提示（复用 ChatDiyUpdateNotice 的
// 展示样式），开始/成功/失败几个时刻共用这一个函数，避免重复好几遍
// 同样的落库+派发逻辑。
const postDiyNotice = async ({ chatId, character, text }) => {
  const timestampIso = new Date().toISOString();

  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'diy_update',
    content: text,
    metadata: {},
    isRead: true,
    timestamp: timestampIso,
  });

  await db.chats.update(chatId, { updatedAt: timestampIso });

  dispatchLocalMessageEvent(chatId);
};

// 三条通路（角色自己主动换 / 用户聊天里要求 / 用户按钮请求）共用的
// 「发一次独立的 AI 调用 + 落库」逻辑，只有传进来的 prompt 不一样。
// 跟文件开头的注释一样：这里直接对 apiConfig 发 fetch，不经过
// aiService.js，避免循环 import。
//
// 只负责「生成 + 真的换了就落库新内容」，不在这里插聊天提示、不在
// 这里清灵感笔记——这些后续动作三条通路的取舍不完全一样，交给各自
// 的调用方决定。返回值是三种状态之一，方便调用方区分"真的失败了"
// 和"AI没按格式给出有效内容"。
const runDiyGeneration = async ({ chatId, apiConfig, prompt }) => {
  let rawText = '';

  try {
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        // 注意：这里必须带一条 role:'user' 的消息，不能只发一条
        // role:'system'——有些 API 中转/网关会直接拒绝没有 user
        // 消息的请求（返回 400）。真正的角色设定/要求仍然整段放在
        // system 里，这条 user 消息只是满足"必须有一轮user"这个格式
        // 要求，不改变实际指令内容。
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请按照上面的设定和要求执行。' },
        ],
      }),
    });

    if (!response.ok) {
      let errorDetail = '';

      try {
        const errorData = await response.json();
        errorDetail = errorData?.error?.message || errorData?.message || '';
      } catch {
        // 读不到详细错误体就算了，保留状态码。
      }

      console.warn(
        '[DIY] 角色DIY小屋的生成调用返回非 2xx:',
        response.status,
        errorDetail
      );
      return { status: 'error' };
    }

    const data = await response.json();
    rawText = data?.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.warn('[DIY] 角色DIY小屋的生成调用失败:', error);
    return { status: 'error' };
  }

  const newContent = extractDiyContent(rawText);
  if (!newContent) {
    // AI 调用本身成功了，但回的内容里没有找到
    // [DIYAREA_START]/[DIYAREA_END] 这对标签（模型没按格式走）。加这条
    // 日志方便排查——截断到前 200 字，避免真的生成了一大段 HTML 时
    // 控制台被刷屏。
    console.warn(
      '[DIY] 角色DIY小屋的生成结果里没有找到有效标签，原始回复开头:',
      String(rawText || '').slice(0, 200)
    );
    return { status: 'no_update' };
  }

  const updatedAtIso = new Date().toISOString();

  await db.chats.update(chatId, {
    diyAreaContent: newContent,
    diyAreaUpdatedAt: updatedAtIso,
  });

  return { status: 'success', content: newContent };
};

const getRecentHistoryText = async (chatId, character) => {
  const recentMessages = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(RECENT_HISTORY_LIMIT)
    .toArray()
    .then((rows) => rows.reverse());

  return recentMessages
    .filter((message) => message.type === 'text' && message.content)
    .map((message) => `${message.sender === 'user' ? '用户' : character.name}: ${message.content}`)
    .join('\n');
};

// 由 aiService.js 在解析到 [DIYAREA_SELF_UPDATE] 标签后调用：角色自己
// 决定要换，完全不限次数、不设冷却——跟"主动戳用户"同一套"相信AI自己
// 判断节奏"的思路。唯一的前置条件是这个聊天本身没有关掉
// diyAutoDecorateEnabled 开关（正常情况下开关关着时角色压根不会被
// 告知有这个标签，这里只是双重保险，防止开关刚关掉但当次系统提示词
// 还没刷新)。
//
// 全程安静：换没换都不打断用户，只有真的换成了才弹一下这条旁白提示；
// 没弄成的话跟之前的背景检查一样，用户感觉不到也不需要感觉到——这件
// 事本来就是角色自己悄悄做的，不是在回应用户的请求。
export const selfUpdateDiyArea = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;
  if (chat.diyAutoDecorateEnabled === false) return;

  const inspirations = getStoredInspirations(chat);
  const historyText = await getRecentHistoryText(chatId, character);

  const prompt = buildGenerationPrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
    inspirationsText: buildInspirationsText(inspirations),
    triggerReason: 'self_initiated',
  });

  const result = await runDiyGeneration({ chatId, apiConfig, prompt });

  if (result.status === 'success') {
    await clearDiyInspirations(chatId);

    await postDiyNotice({
      chatId,
      character,
      text: pickNoticeText(character.name),
    });
  }
};

// 由 aiService.js 在解析到 [DIYAREA_REQUEST] 标签后调用，专门给「用户
// 在聊天里明确说了想换DIY小屋」这种情况用：不看冷却、必须真的给出
// 一份新内容。
//
// 跟角色自己悄悄换不一样：用户是明确提过要求的，所以这里要让用户能
// 看到过程——先插一条"开始收拾了"的提示，生成调用（经常要好几秒）
// 期间用户不会以为AI压根没理这件事；结束之后无论真的换成了还是没
// 弄成，都再插一条对应的提示，而不是悄悄什么都不说。整体仍然是
// fire-and-forget：调用方用 void + catch 包起来，这里面任何异常都
// 不应该影响正常聊天。
export const forceUpdateDiyArea = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  await postDiyNotice({
    chatId,
    character,
    text: pickLine(DIY_FORCED_START_LINES, character.name),
  });

  const inspirations = getStoredInspirations(chat);
  const historyText = await getRecentHistoryText(chatId, character);

  const prompt = buildGenerationPrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
    inspirationsText: buildInspirationsText(inspirations),
    triggerReason: 'user_request',
  });

  const result = await runDiyGeneration({ chatId, apiConfig, prompt });

  if (result.status === 'success') {
    await clearDiyInspirations(chatId);
  }

  const noticeText = result.status === 'success'
    ? pickLine(DIY_FORCED_SUCCESS_LINES, character.name)
    : pickLine(DIY_FORCED_FAIL_LINES, character.name);

  await postDiyNotice({ chatId, character, text: noticeText });
};

// ============================================================
// DIY小屋页面里的"请TA重新布置"按钮
//
// 三条通路里唯一真正"受限"的一条，规则不一样：
//   - 每 3-5 小时（每次成功后随机取一个新的区间）只接受一次；
//   - 有概率被角色拒绝——拒绝只是"这次不想弄"，不占用这次冷却，
//     用户可以立刻再点一次重试；
//   - 一旦真的接受，立刻生成新内容（不等下次打开小屋），调用方
//     自己在等待期间展示进度条。
// ============================================================

const DIY_REQUEST_COOLDOWN_MIN_MS = 3 * 60 * 60 * 1000;
const DIY_REQUEST_COOLDOWN_MAX_MS = 5 * 60 * 60 * 1000;

// 请求被接受 vs 被拒绝的概率——可以后续再调，目前先定一个"大部分时候
// 愿意、但不是每次都捧场"的量级。
const DIY_REQUEST_REJECT_PROBABILITY = 0.3;

const randomDiyRequestCooldownMs = () => (
  DIY_REQUEST_COOLDOWN_MIN_MS
  + Math.random() * (DIY_REQUEST_COOLDOWN_MAX_MS - DIY_REQUEST_COOLDOWN_MIN_MS)
);

// 跟 pokeService.js 的 ensurePokeReplies 同一个做法：第一次用到的时候
// 按角色 bio/extraNotes 让 AI 一次性生成 4-6 句，直接缓存进角色资料的
// diyRejectReasons 字段（不是 Dexie 索引字段，不需要升级数据库版本），
// 以后每次拒绝都直接从缓存里随机挑一条，不必每次被拒绝都单独调一次AI。
export const ensureDiyRejectReasons = async (character) => {
  if (!character) return FALLBACK_DIY_REJECT_REASONS;

  const cached = Array.isArray(character.diyRejectReasons)
    ? character.diyRejectReasons.filter(
      (line) => typeof line === 'string' && line.trim()
    )
    : [];

  if (cached.length >= 3) {
    return cached;
  }

  try {
    const apiSetting = await db.settings.get('apiConfig');
    const apiConfig = apiSetting?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return FALLBACK_DIY_REJECT_REASONS;
    }

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const systemPrompt = `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

用户有时会在你的DIY小屋页面里主动提出，想让你重新布置一下这个小屋，但
你不是每次都愿意配合——请给出 4 到 6 句，这个角色这次不想动手重新布置
时，第一人称脱口而出的理由，语气要符合以上人设（可以是懒得动、刚弄过
没多久、没心情、卖个关子之类，不需要全部一个调），只是单纯这次不想弄
小屋，不是在生气或冷落用户本人。

严格要求：
- 只输出合法 JSON 数组，形如 ["...", "...", "..."]；
- 每一句 6 到 20 个汉字之间；
- 不使用 Emoji；
- 不要输出 Markdown、代码块围栏、编号或任何多余说明，只输出这个 JSON 数组本身。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        // 跟 runDiyGeneration 一样：必须带一条 role:'user' 的消息，
        // 避免被某些 API 中转/网关当成无效请求直接 400。
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请按照上面的要求执行。' },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.warn(
        '[DIY] DIY小屋拒绝理由生成调用返回非 2xx，用兜底文案顶上:',
        response.status
      );
      return FALLBACK_DIY_REJECT_REASONS;
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || '';

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    const reasons = Array.isArray(parsed)
      ? parsed
        .map((line) => removeEmoji(line).slice(0, 30))
        .filter(Boolean)
        .slice(0, 6)
      : [];

    if (reasons.length < 3) {
      return FALLBACK_DIY_REJECT_REASONS;
    }

    if (character.id) {
      await db.characters.update(character.id, { diyRejectReasons: reasons });
    }

    return reasons;
  } catch (error) {
    console.warn(
      '[DIY] DIY小屋拒绝理由生成失败，先用通用文案顶上。',
      error
    );

    return FALLBACK_DIY_REJECT_REASONS;
  }
};

// 给 CharacterDiyPage.jsx 的按钮用：点击时调用，返回值的 status 是
// 'cooldown' / 'rejected' / 'success' / 'error' 之一，调用方据此决定
// 界面上显示什么（倒计时提示 / 拒绝理由 / 新内容 / 失败提示）。
export const requestDiyAreaUpdate = async ({ chatId, character }) => {
  if (!chatId || !character) return { status: 'error' };

  const chat = await db.chats.get(chatId);
  if (!chat) return { status: 'error' };

  const cooldownUntilMs = chat.diyRequestCooldownUntil
    ? new Date(chat.diyRequestCooldownUntil).getTime()
    : 0;

  if (Number.isFinite(cooldownUntilMs) && cooldownUntilMs > Date.now()) {
    return { status: 'cooldown', cooldownUntil: chat.diyRequestCooldownUntil };
  }

  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  // API 没配置是环境问题，不是角色"不愿意"——放在拒绝概率判定之前，
  // 这样没配置API的时候统一报 error，不会被误判成角色拒绝。
  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return { status: 'error' };
  }

  // 拒绝概率判定放在真正调用AI生成之前：被拒绝的话不需要真的生成新
  // 内容，省一次API调用，也符合"拒绝=这次压根没认真对待这个请求"的
  // 直觉。
  if (Math.random() < DIY_REQUEST_REJECT_PROBABILITY) {
    const reasons = await ensureDiyRejectReasons(character);
    return { status: 'rejected', reason: pickLine(reasons, character.name) };
  }

  const inspirations = getStoredInspirations(chat);
  const historyText = await getRecentHistoryText(chatId, character);

  const prompt = buildGenerationPrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
    inspirationsText: buildInspirationsText(inspirations),
    triggerReason: 'user_request',
  });

  const result = await runDiyGeneration({ chatId, apiConfig, prompt });

  if (result.status !== 'success') {
    // 生成失败是技术问题，不是角色"不愿意"，不占用冷却，让用户能
    // 立刻再试一次。
    return { status: 'error' };
  }

  await clearDiyInspirations(chatId);

  const cooldownUntilIso = new Date(
    Date.now() + randomDiyRequestCooldownMs()
  ).toISOString();

  await db.chats.update(chatId, {
    diyRequestCooldownUntil: cooldownUntilIso,
  });

  return {
    status: 'success',
    content: result.content,
    cooldownUntil: cooldownUntilIso,
  };
};