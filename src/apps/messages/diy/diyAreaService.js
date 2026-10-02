import Dexie from 'dexie';
import db from '../../../db';

// 注意：这里不从 '../../../services/aiService' 里导入 generateResponse /
// getRecentChatMessages —— aiService.js 需要反过来导入本文件的
// maybeUpdateDiyArea（在 triggerAiResponse 成功回复之后调用），两边互相
// import 会形成循环依赖。跟 pokeService.js / snapshotAiService.js 的
// 做法一样，这里直接对 apiConfig 发一次 fetch，不经过 aiService.js。

// ============================================================
// 角色的DIY小屋
//
// 这是一块完全独立于聊天消息的小天地：挂在"这个聊天"上（不是挂在
// 角色身上），角色隔一段时间会自己判断要不要重新布置一下，布置的
// 内容是 HTML + 内联 CSS（+可以有少量 <script> 做点小互动，比如
// 一份可以点开的礼物、一张带点小动画的贺卡），跟聊天回复完全无关，
// 用户要主动从"爪印更多入口"菜单里点进"角色的DIY"才会看到。
//
// 之所以不走共享的单行 bracket 标签正则（aiService.js 里
// parseAiResponseToMessages 用的那套 /\[(TAG):\s*([^\]]+)\]/），
// 是因为 HTML/CSS 几乎必然会出现 ] 字符（比如属性选择器
// input[type=text]），塞进那套正则会在第一个 ] 处被提前截断。
// 这里换成一次独立的 AI 生成调用，自己解析一对成对标签
// （[DIYAREA_START]...[DIYAREA_END]），互不影响。
//
// 渲染安全完全交给调用方（CharacterDiyPage.jsx）用
// sandbox="allow-scripts"（且不带 allow-same-origin）的 iframe
// 隔离：脚本能跑，但拿不到父页面的 DOM/storage，也跳不出这个框，
// 内部的全屏定位/超大字号最多撑满这一个 iframe 的框，不会影响到
// 整个 app——所以这里不需要再额外做标签黑名单那一层过滤。
// ============================================================

// 3-5 小时区间内的一个居中默认值；检查本身（不管最后有没有真的换）
// 都会把冷却重置一次，避免冷却没到之前每条回复都触发一次 AI 调用。
const DIY_AREA_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const RECENT_HISTORY_LIMIT = 16;

const START_TAG = '[DIYAREA_START]';
const END_TAG = '[DIYAREA_END]';
const NO_UPDATE_SENTINEL = 'NO_UPDATE';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

// 换完之后弹的小卡片，纯旁白口吻的文字公告，不可点击跳转。
const DIY_UPDATE_NOTICE_LINES = [
  '{name} 偷偷把自己的小屋换了个样子。',
  '{name} 悄悄布置了一下只属于自己的那个角落。',
  '{name} 又鼓捣了一下自己的DIY小屋。',
  '{name} 趁你不注意，把小屋重新收拾了一遍。',
];

// 用户主动提出之后的三段提示：开始 / 成功 / 失败。跟后台自己悄悄换的
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

const buildJudgePrompt = ({ character, currentContent, historyText }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你拥有一个只属于你自己的"DIY小屋"——这是一个完全独立于聊天消息的小网页
角落，用户可以随时点进去看，但它不是对话的一部分，你不是在"回复"用户，
只是在布置自己的一小块地方（有点像在收拾自己房间，或者在个人主页上随手
写点什么），所以可以带着"这到底是写给谁看的"那种暧昧真实感，不必是正式
的、直接对用户说话的内容。

这个小屋目前的样子：
${currentContent || '（现在还是空的，什么都没有）'}

最近的对话节选（仅供你参考自己最近的心情/状态，不需要在小屋里复述或提及
这些对话内容）：
${historyText || '（暂无）'}

请你自己判断：这次要不要重新布置一下这个小屋？不是每次都要换，大部分时候
可以保持原样、什么都不做——只有当你真的想改的时候才改。

严格按以下两种方式之一输出，不要有任何其他文字、解释或开场白：

1. 如果这次不想改，只输出：${NO_UPDATE_SENTINEL}

2. 如果想改，把新内容整体包在 ${START_TAG} 和 ${END_TAG} 之间，内容只能是
   HTML + 内联 CSS（style 属性或 <style> 标签都可以），允许少量 <script>
   做简单互动（比如一份可以点开的礼物、一张带点小动画的贺卡）。不要请求
   任何外部资源（图片/字体/脚本的外链），不要尝试跳出这个页面或读取页面
   之外的任何东西，不要用超大字号或铺满整个视口的定位——内容应该安安静静
   待在这个小屋自己的版面里。除了 ${START_TAG}${END_TAG} 之间的内容，不要
   输出任何别的文字。`;

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
// 展示样式），开始/成功/失败三个时刻共用这一个函数，避免重复三遍同样
// 的落库+派发逻辑。
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

// 两条路径（常规冷却判断 / 用户主动点名要换）共用的「拿最近历史 + 发一次
// 独立的 AI 调用 + 落库」逻辑，只有传进来的 prompt 不一样。跟文件开头的
// 注释一样：这里直接对 apiConfig 发 fetch，不经过 aiService.js，避免
// 循环 import。
//
// 只负责「生成 + 真的换了就落库新内容」，不在这里插聊天提示——开始/
// 成功/失败具体要不要让用户看到、看到什么文案，后台静默检查和用户
// 主动要求这两条路径的取舍完全不同，交给各自的调用方（maybeUpdateDiyArea
// / forceUpdateDiyArea）决定。返回值是三种状态之一，方便调用方区分
// "真的失败了"和"AI判断这次不想换"。
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
        messages: [{ role: 'system', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn('[DIY] 角色DIY小屋的生成调用返回非 2xx:', response.status);
      return { status: 'error' };
    }

    const data = await response.json();
    rawText = data?.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.warn('[DIY] 角色DIY小屋的判断/生成调用失败，跳过本次检查:', error);
    return { status: 'error' };
  }

  const newContent = extractDiyContent(rawText);
  if (!newContent) {
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

// 跟在一次正常的「用户发消息 -> 角色回复」成功之后调用（只挂在这一条
// 主路径上，重新生成/角色主动发起的消息不触发，跟 aiService.js 里
// checkAbsenceEmotionSignal 的取舍是同一个道理，避免同一件事被反复
// 判断）。整个函数是 fire-and-forget：调用方用 void + catch 包起来，
// 这里面任何失败都只是「这次小屋没换成」，不应该影响正常聊天。
export const maybeUpdateDiyArea = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const lastCheckAtMs = chat.diyAreaLastCheckAt
    ? new Date(chat.diyAreaLastCheckAt).getTime()
    : 0;

  if (
    Number.isFinite(lastCheckAtMs)
    && lastCheckAtMs > 0
    && Date.now() - lastCheckAtMs < DIY_AREA_COOLDOWN_MS
  ) {
    return;
  }

  // 不管这次最终有没有真的换，先把检查时间点占上——这样冷却窗口内
  // 哪怕角色选择"这次不换"，也不会每条回复都重新触发一次 AI 调用。
  await db.chats.update(chatId, {
    diyAreaLastCheckAt: new Date().toISOString(),
  });

  const historyText = await getRecentHistoryText(chatId, character);

  const prompt = buildJudgePrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
  });

  const result = await runDiyGeneration({ chatId, apiConfig, prompt });

  // 背景检查全程安静：换没换都不打断用户，只有真的换了才弹一下这条
  // 旁白提示；"这次不想改"或者调用失败，用户感觉不到也不需要感觉到。
  if (result.status === 'success') {
    await postDiyNotice({
      chatId,
      character,
      text: pickNoticeText(character.name),
    });
  }
};

// aiService.js 解析 AI 原始回复文字时用这个判断：这次回复里有没有带
// 用户主动要求换装时该带的那个静默信号标签。跟主回复的卡片标签共用
// 同一套正则识别、同一次解析，但这里单独扫描原始文字——因为这个标签
// 不产出任何可见卡片，解析结果里找不到它，只能直接查原始文字。
export const containsDiyAreaRequest = (text) => (
  /\[DIYAREA_REQUEST\s*:/i.test(String(text || ''))
);

const buildForcedJudgePrompt = ({ character, currentContent, historyText }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你拥有一个只属于你自己的"DIY小屋"——这是一个完全独立于聊天消息的小网页
角落，用户可以随时点进去看，但它不是对话的一部分，你不是在"回复"用户，
只是在布置自己的一小块地方（有点像在收拾自己房间，或者在个人主页上随手
写点什么），所以可以带着"这到底是写给谁看的"那种暧昧真实感，不必是正式
的、直接对用户说话的内容。

这个小屋目前的样子：
${currentContent || '（现在还是空的，什么都没有）'}

最近的对话节选（仅供你参考自己最近的心情/状态和用户刚才提的要求，不需要
在小屋里复述或提及这些对话内容）：
${historyText || '（暂无）'}

用户刚刚在聊天里明确提出，想让你重新布置一下这个小屋。这次不是你自己
判断要不要换——必须真的给出一份新内容，不能保持原样、也不能什么都不做。

把新内容整体包在 ${START_TAG} 和 ${END_TAG} 之间，内容只能是 HTML +
内联 CSS（style 属性或 <style> 标签都可以），允许少量 <script> 做简单
互动（比如一份可以点开的礼物、一张带点小动画的贺卡，每次不要是一样的内容，充分利用html、css和JavaScript制作出能给user的惊喜，也可以是展露你内心的小屋，可以放和你相关的内容，你的状态栏等等）。不要请求任何外部
资源（图片/字体/脚本的外链），不要尝试跳出这个页面或读取页面之外的任何
东西，不要用超大字号或铺满整个视口的定位——内容应该安安静静待在这个小
屋自己的版面里。除了 ${START_TAG}${END_TAG} 之间的内容，不要输出任何
别的文字。`;


// 由 aiService.js 在解析到 [DIYAREA_REQUEST] 标签后调用，专门给「用户
// 在聊天里明确说了想换DIY小物」这种情况用：不看冷却、不走"这次不想改"
// 的 NO_UPDATE 分支，必须真的给出一份新内容。跟 maybeUpdateDiyArea
// 共用同一个 diyAreaLastCheckAt 时间戳字段——用户刚主动换完之后，背景
// 的常规判断也会重新进入冷却窗口，不会紧接着又触发一次。
//
// 跟后台静默检查不一样：用户是明确提过要求的，所以这里要让用户能看到
// 过程——先插一条"开始收拾了"的提示，生成调用（经常要好几秒）期间
// 用户不会以为AI压根没理这件事；结束之后无论真的换成了还是没弄成，
// 都再插一条对应的提示，而不是像背景检查那样失败了就悄悄什么都不说。
// 整体仍然是 fire-and-forget：调用方用 void + catch 包起来，这里面
// 任何异常都不应该影响正常聊天。
export const forceUpdateDiyArea = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  await db.chats.update(chatId, {
    diyAreaLastCheckAt: new Date().toISOString(),
  });

  await postDiyNotice({
    chatId,
    character,
    text: pickLine(DIY_FORCED_START_LINES, character.name),
  });

  const historyText = await getRecentHistoryText(chatId, character);

  const prompt = buildForcedJudgePrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
  });

  const result = await runDiyGeneration({ chatId, apiConfig, prompt });

  const noticeText = result.status === 'success'
    ? pickLine(DIY_FORCED_SUCCESS_LINES, character.name)
    : pickLine(DIY_FORCED_FAIL_LINES, character.name);

  await postDiyNotice({ chatId, character, text: noticeText });
};

// ============================================================
// DIY小屋页面里的"请TA重新布置"按钮
//
// 跟上面 forceUpdateDiyArea（聊天里自然语言提出 -> AI自己打
// [DIYAREA_REQUEST] 标签 -> 必定成功，没有冷却）是完全独立的第二条
// 请求通路，专门给DIY小屋页面自己的按钮用，规则不一样：
//   - 每 3-5 小时（每次成功后随机取一个新的区间）只接受一次；
//   - 有概率被角色拒绝——拒绝只是"这次不想弄"，不占用这次冷却，
//     用户可以立刻再点一次重试；
//   - 一旦真的接受，立刻生成新内容（不等下次打开小屋），调用方
//     自己在等待期间展示进度条。
// 两条通路各用各的字段（这条通路用 diyRequestCooldownUntil，后台
// 常规检查用 diyAreaLastCheckAt），互不干扰、互不共用冷却——但本
// 通路一旦成功，也会顺手把 diyAreaLastCheckAt 一起重置，避免刚
// 手动换完新样子，后台常规检查紧接着又判断一次。
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

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

// 角色专属拒绝理由还没生成出来之前（或者生成失败时）的兜底文案，语气
// 尽量中性，不绑定任何具体人设。
const FALLBACK_DIY_REJECT_REASONS = [
  '今天不太想换，过阵子再说吧。',
  '手头上没什么灵感，这次先不弄了。',
  '刚收拾过没多久，先让它这样放会儿。',
  '不是不想弄，就是现在没那个心情。',
];

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
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
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

  const historyText = await getRecentHistoryText(chatId, character);

  const prompt = buildForcedJudgePrompt({
    character,
    currentContent: chat.diyAreaContent,
    historyText,
  });

  const result = await runDiyGeneration({ chatId, apiConfig, prompt });

  if (result.status !== 'success') {
    // 生成失败是技术问题，不是角色"不愿意"，不占用冷却，让用户能
    // 立刻再试一次。
    return { status: 'error' };
  }

  const cooldownUntilIso = new Date(
    Date.now() + randomDiyRequestCooldownMs()
  ).toISOString();

  await db.chats.update(chatId, {
    diyRequestCooldownUntil: cooldownUntilIso,
    // 顺手让后台常规检查（maybeUpdateDiyArea）也重新进入它自己的冷却，
    // 避免刚手动换完新样子，常规检查紧接着又判断一次。
    diyAreaLastCheckAt: new Date().toISOString(),
  });

  return {
    status: 'success',
    content: result.content,
    cooldownUntil: cooldownUntilIso,
  };
};