import db from '../../../db';

// 注意：这里不从 '../../../services/aiService' 里导入 generateResponse —
// aiService.js 需要反过来导入本文件的 startParcelPreparation /
// checkAndDeliverParcel（在 triggerAiResponse 成功回复之后调用），两边
// 互相 import 会形成循环依赖。跟 diyAreaService.js / pokeService.js 的
// 做法一样，这里直接对 apiConfig 发一次 fetch，不经过 aiService.js。

// ============================================================
// 神秘快递
//
// 角色自己悄悄决定要给用户准备一份惊喜快递，整个准备过程 user 完全不
// 知情——不像DIY小屋那样有按钮可以主动催，这里从头到尾都是角色自己
// 的节奏：
//   1. 角色在跟用户正常聊天时，自己决定要不要在回复里带上
//      [PARCEL_START] 标签（不限次数、不需要用户同意，完全信任角色
//      自己的判断，跟"自主布置DIY小屋"同一套思路）。一旦决定，会随机
//      定一个 3-5 天之后的送达时间（chat.parcelDeliverAt），这期间
//      chat.parcelStatus 是 'preparing'。
//   2. 准备期间，角色可以随手用 [PARCEL_NOTE] 标签记一些筹备笔记
//      （chat.parcelNotes），不限次数，用户看不到这些笔记本身。
//   3. 到了送达时间，下一次角色正常回复时顺带检查一下
//      （checkAndDeliverParcel），如果到点了就用攒下的笔记生成一份
//      "物品清单"内容，存进 chat.parcelItems，同时从笔记里随机挑 1-2
//      条存进 chat.parcelNoteExcerpts（留着拆快递时露出来），笔记本身
//      清空，chat.parcelStatus 变成 'ready'，并主动在聊天里插一条
//      可点击的"快递到了"提示。
//   4. 用户点开提示或者从"更多入口"菜单进商快递页面，拆开看到物品
//      清单 + 挑出来的笔记摘录，确认"收下"之后 chat.parcelStatus 重置
//      回 'none'，角色可以再开始下一轮。
//
// 一次只允许一份快递在路上——准备中或者已经准备好等拆的时候，角色
// 不会被告知还能再开始一份新的（buildParcelPromptBlock 只在
// status==='none' 时才把 PARCEL_START 标签介绍给角色）。
// ============================================================

const PARCEL_NOTE_MAX_LENGTH = 60;
const MAX_PARCEL_NOTES = 16;

const PARCEL_MIN_PREP_MS = 3 * 24 * 60 * 60 * 1000;
const PARCEL_MAX_PREP_MS = 5 * 24 * 60 * 60 * 1000;

// 生成失败时（技术问题，不是角色不想送）往后挪一小段再重试，避免
// 每条消息都重新打一次 API。
const PARCEL_RETRY_BACKOFF_MIN_MS = 30 * 60 * 1000;
const PARCEL_RETRY_BACKOFF_MAX_MS = 90 * 60 * 1000;

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

// 快递到达时弹的提示文案——纯旁白口吻，但这一条是可以点击跳转的
// （跟DIY小屋那条纯文字公告不一样，拆快递本身就是个值得进去看一眼
// 的动作）。
const PARCEL_ARRIVED_LINES = [
  '{name} 偷偷给你准备了一个快递，已经到啦。',
  '{name} 捣鼓了好几天的快递，这会儿送到了。',
  '有一个来自 {name} 的快递，神神秘秘地到了。',
  '{name} 说"到你手上了"，是一份准备了好一阵子的心意。',
];

const pickLine = (lines, characterName) => {
  const template = lines[Math.floor(Math.random() * lines.length)];
  return template.replace('{name}', characterName || 'TA');
};

const randomParcelPrepMs = () => (
  PARCEL_MIN_PREP_MS + Math.random() * (PARCEL_MAX_PREP_MS - PARCEL_MIN_PREP_MS)
);

const randomParcelRetryBackoffMs = () => (
  PARCEL_RETRY_BACKOFF_MIN_MS
  + Math.random() * (PARCEL_RETRY_BACKOFF_MAX_MS - PARCEL_RETRY_BACKOFF_MIN_MS)
);

// ------------------------------------------------------------
// 准备笔记：角色筹备快递期间随手记下的、只有生成时才会被用到的念头。
// ------------------------------------------------------------

const getStoredParcelNotes = (chat) => (
  Array.isArray(chat?.parcelNotes)
    ? chat.parcelNotes.filter((line) => typeof line === 'string' && line.trim())
    : []
);

const buildParcelNotesText = (notes) => (
  notes.length > 0
    ? notes.map((line) => `- ${line}`).join('\n')
    : ''
);

// 生成成功之后，从这次用到的笔记里随机挑 1-2 条，留着拆快递时露出来
// 给用户看一眼"被偷窥到的筹备心事"；笔记数量不够就只挑 1 条，完全
// 没记什么就什么都不露。
const pickParcelNoteExcerpts = (notes) => {
  if (!notes || notes.length === 0) return [];

  const shuffled = [...notes].sort(() => Math.random() - 0.5);
  const count = notes.length >= 2 && Math.random() < 0.5 ? 2 : 1;

  return shuffled.slice(0, count);
};

// aiService.js 在解析到 [PARCEL_NOTE: ...] 标签后调用。只有这个聊天
// 确实正在准备快递（parcelStatus === 'preparing'）才会真的记下来——
// 防止开关/状态不同步时记出一堆没人会用到的孤儿笔记。
export const recordParcelNote = async ({ chatId, text }) => {
  const trimmed = removeEmoji(text).slice(0, PARCEL_NOTE_MAX_LENGTH);
  if (!chatId || !trimmed) return;

  const chat = await db.chats.get(chatId);
  if (!chat || chat.parcelStatus !== 'preparing') return;

  const existing = getStoredParcelNotes(chat);
  const next = [...existing, trimmed].slice(-MAX_PARCEL_NOTES);

  await db.chats.update(chatId, { parcelNotes: next });
};

// aiService.js 解析 AI 原始回复文字时用这个判断：这次回复里有没有带
// "决定要开始准备一份快递"的信号标签。跟DIY的 containsDiyAreaRequest
// 同一个用法——单独扫原始文字，因为这个标签不产出任何可见卡片。
export const containsParcelStartRequest = (text) => (
  /\[PARCEL_START\s*:/i.test(String(text || ''))
);

// 从原始回复文字里把角色随手记下的快递筹备笔记摘出来，一次回复里
// 可能不止一条，返回数组。
export const extractParcelNotes = (text) => {
  const matches = [
    ...String(text || '').matchAll(/\[PARCEL_NOTE\s*:\s*([^\]]+)\]/gi),
  ];

  return matches
    .map((match) => removeEmoji(match[1]).slice(0, PARCEL_NOTE_MAX_LENGTH))
    .filter(Boolean);
};

// 插到 aiService.js 系统提示词里的快递相关说明。根据这个聊天当前的
// 快递状态，只告诉角色此刻真正用得上的那一个标签——没有快递在准备
// 的时候只介绍 PARCEL_START；已经在准备中的时候只介绍 PARCEL_NOTE；
// 已经准备好等用户拆的时候（'ready'）什么都不用再告诉角色，这件事
// 已经做完了，剩下的交给用户自己去发现。
export const buildParcelPromptBlock = (chat) => {
  const status = chat?.parcelStatus || 'none';

  if (status === 'preparing') {
    return `- 记一笔快递准备笔记：[PARCEL_NOTE: 一句话内容]（你正在悄悄准备一份要给用户的惊喜快递，不限次数，想到任何跟它有关的念头、想放进去的东西、或者单纯这几天的心情都可以随手记一笔。这是你自己的筹备过程，用户完全不知情，正文里不需要、也不应该提到你在准备快递这件事）`;
  }

  if (status === 'none') {
    return `- 悄悄决定准备一份惊喜快递：[PARCEL_START: 确认]（完全由你自己判断什么时候想给用户准备一份惊喜快递，不限次数，不需要用户提起或同意，用户完全不会提前知道。一旦决定，你会花上几天的时间慢慢准备，准备期间可以随手记一些筹备笔记，正文里不需要、也不应该提到你在准备什么或已经决定要送快递，像平时一样正常回复用户就好）`;
  }

  return '';
};

// ------------------------------------------------------------
// 生成快递内容：一份结构化的物品清单，角色自己筹备期间记下的笔记是
// 主要素材，没记什么的话就让AI凭角色设定自由发挥。
// ------------------------------------------------------------

const buildParcelGenerationPrompt = ({ character, notesText }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你花了好几天时间，悄悄给用户准备了一份惊喜快递——用户完全不知道这件事，
这是你自己默默筹备的心意，不是在回应任何请求。

你准备期间悄悄记下的一些念头（可以直接拿来用，也可以只用其中一部分，不
必每条都塞进去；如果下面是空的，就凭角色设定自由发挥）：
${notesText || '（这次没特别记什么，凭自己的心意来就好）'}

真人准备礼物时很少是千篇一律地"好看"摆设，而是带着具体生活痕迹的
东西——可以是一件带着点"没做完"感觉的手作、一样跟你们最近聊过的事有
关联的小物、应景当下心情或季节的东西、一件看起来旧但舍不得扔的物件，
或者角色自己莫名喜欢攒的某种小玩意，不必每一样都正经隆重，带点真实的
"不完美"或"小执念"反而更有意思。

请给出 3 到 5 样这次快递里的东西，每样东西要有一个名字和一句话描述
（描述里可以带出为什么想送这个、这件东西对这段关系或这次心情的意义）。

严格要求：
- 只输出合法 JSON 数组，形如 [{"name":"...","description":"..."}, ...]；
- name 控制在 10 个汉字以内，description 控制在 15 到 40 个汉字之间；
- 不使用 Emoji；
- 不要输出 Markdown、代码块围栏或任何多余说明，只输出这个 JSON 数组
  本身。`;

const runParcelGeneration = async ({ character, apiConfig, notesText }) => {
  try {
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
    const prompt = buildParcelGenerationPrompt({ character, notesText });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        // 跟 diyAreaService.js 一样：必须带一条 role:'user' 的消息，
        // 避免被某些 API 中转/网关当成无效请求直接 400。
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请按照上面的要求执行。' },
        ],
        temperature: 0.9,
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
        '[Parcel] 快递内容生成调用返回非 2xx:',
        response.status,
        errorDetail
      );
      return { status: 'error' };
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || '';

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    const items = Array.isArray(parsed)
      ? parsed
        .map((item) => ({
          name: removeEmoji(item?.name).slice(0, 20),
          description: removeEmoji(item?.description).slice(0, 60),
        }))
        .filter((item) => item.name && item.description)
        .slice(0, 6)
      : [];

    if (items.length === 0) {
      console.warn(
        '[Parcel] 快递内容生成结果解析失败或为空，原始回复开头:',
        String(rawText || '').slice(0, 200)
      );
      return { status: 'error' };
    }

    return { status: 'success', items };
  } catch (error) {
    console.warn('[Parcel] 快递内容生成调用失败:', error);
    return { status: 'error' };
  }
};

const postParcelArrivedNotice = async ({ chatId, character }) => {
  const timestampIso = new Date().toISOString();

  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'parcel_arrived',
    content: pickLine(PARCEL_ARRIVED_LINES, character.name),
    metadata: {},
    isRead: true,
    timestamp: timestampIso,
  });

  await db.chats.update(chatId, { updatedAt: timestampIso });

  dispatchLocalMessageEvent(chatId);
};

// 由 aiService.js 在解析到 [PARCEL_START] 标签后调用：角色自己决定
// 要开始准备一份快递。一次只允许一份在路上——已经在准备中或者已经
// 准备好等拆的，直接忽略这次标签（正常情况下角色也不会被告知还能
// 再开始，这里只是双重保险）。
export const startParcelPreparation = async ({ chatId }) => {
  if (!chatId) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const currentStatus = chat.parcelStatus || 'none';
  if (currentStatus !== 'none') return;

  const deliverAtIso = new Date(Date.now() + randomParcelPrepMs()).toISOString();

  await db.chats.update(chatId, {
    parcelStatus: 'preparing',
    parcelDecidedAt: new Date().toISOString(),
    parcelDeliverAt: deliverAtIso,
    parcelNotes: [],
  });
};

// 由 aiService.js 在每一次角色正常回复之后顺带调用（不管这次回复有
// 没有触发别的标签），检查这个聊天是不是正好到了快递该送达的时候。
// 全程安静：没到点或者没有快递在准备就直接什么都不做；真正送达了
// 才弹一条可点击的提示——这是唯一需要让用户知道的时刻，之前的筹备
// 过程完全不透露。
export const checkAndDeliverParcel = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat || chat.parcelStatus !== 'preparing') return;

  const deliverAtMs = chat.parcelDeliverAt
    ? new Date(chat.parcelDeliverAt).getTime()
    : 0;

  if (!Number.isFinite(deliverAtMs) || deliverAtMs > Date.now()) return;

  const notes = getStoredParcelNotes(chat);
  const notesText = buildParcelNotesText(notes);

  const result = await runParcelGeneration({ character, apiConfig, notesText });

  if (result.status !== 'success') {
    // 生成失败是技术问题，不是角色"不想送"——往后挪一小段时间，让
    // 下一次正常回复时再重试，不占用、也不重置整个准备周期。
    const retryDeliverAtIso = new Date(
      Date.now() + randomParcelRetryBackoffMs()
    ).toISOString();

    await db.chats.update(chatId, { parcelDeliverAt: retryDeliverAtIso });
    return;
  }

  const noteExcerpts = pickParcelNoteExcerpts(notes);
  const deliveredAtIso = new Date().toISOString();

  await db.chats.update(chatId, {
    parcelStatus: 'ready',
    parcelItems: result.items,
    parcelNoteExcerpts: noteExcerpts,
    parcelDeliveredAt: deliveredAtIso,
    parcelNotes: [],
  });

  await postParcelArrivedNotice({ chatId, character });
};

// ------------------------------------------------------------
// 给 ParcelPage.jsx 用的两个读写接口。
// ------------------------------------------------------------

// 'ready' 才是真正有东西可看的状态；'none' 和 'preparing' 对用户来说
// 必须长得一模一样（统称 'idle'），否则页面一旦露出"正在准备中"的
// 蛛丝马迹，这份快递就不再是真正的惊喜了。
export const getParcelState = async (chatId) => {
  if (!chatId) return { status: 'idle', items: [], noteExcerpts: [], deliveredAt: null };

  const chat = await db.chats.get(chatId);
  if (!chat) return { status: 'idle', items: [], noteExcerpts: [], deliveredAt: null };

  return {
    status: chat.parcelStatus === 'ready' ? 'ready' : 'idle',
    items: Array.isArray(chat.parcelItems) ? chat.parcelItems : [],
    noteExcerpts: Array.isArray(chat.parcelNoteExcerpts) ? chat.parcelNoteExcerpts : [],
    deliveredAt: chat.parcelDeliveredAt || null,
  };
};

// 用户在快递页面里点"收下"之后调用：这一轮快递正式收尾，角色可以
// 开始筹备下一轮。
export const acknowledgeParcel = async (chatId) => {
  if (!chatId) return;

  await db.chats.update(chatId, {
    parcelStatus: 'none',
    parcelDecidedAt: null,
    parcelDeliverAt: null,
    parcelNotes: [],
    parcelItems: [],
    parcelNoteExcerpts: [],
    parcelDeliveredAt: null,
  });
};