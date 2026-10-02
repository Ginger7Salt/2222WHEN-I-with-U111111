import Dexie from 'dexie';
import db from '../../../db';

// ============================================================
// 角色的资料卡（昵称 / #标签 / 个性签名）
//
// 三个字段打包在一起，挂在"这个聊天"上（跟DIY小屋一样，不是挂在
// 角色身上），角色隔一段时间会自己判断要不要更新——这不是对话的
// 一部分，只是TA给自己留的一份"此刻的自我介绍"，可以带着暧昧的
// 自我表达感，不必是直接对用户说的话。
//
// 跟 diyAreaService.js 完全同构：同样的「冷却 -> 独立AI调用 ->
// 判断是否NO_UPDATE -> 落库 + 聊天痕迹」流程，同样直接对 apiConfig
// 发 fetch 而不经过 aiService.js（避免循环 import，见 diyAreaService.js
// 文件头注释）。三个字段整体一起生成/整体一起更新，不单独改其中
// 一项——这样"签名换了"这件事本身就带着昵称/标签作为上下文，不会
// 出现"签名换了但标签还是旧人设"的割裂感。
// ============================================================

// 3-5 小时区间内的一个居中默认值，跟DIY小屋共用同一个节奏感，但是
// 独立的字段、独立的冷却——两边各自判断，互不影响对方的触发时机。
const PROFILE_CARD_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const RECENT_HISTORY_LIMIT = 16;

const START_TAG = '[PROFILE_START]';
const END_TAG = '[PROFILE_END]';
const NO_UPDATE_SENTINEL = 'NO_UPDATE';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

// 给 ProfileCard.jsx / ProfileTraceCard.jsx 用：读出这个聊天当前的
// 资料卡内容。昵称没设置过时兜底用角色本名，标签/签名允许为空
// （卡片UI自己处理"还没有"的占位展示）。
export const getProfileCard = async (chatId) => {
  if (!chatId) return null;

  const chat = await db.chats.get(chatId);
  if (!chat) return null;

  return {
    nickname: chat.profileNickname || null,
    tag: chat.profileTag || '',
    signature: chat.currentSignature || '',
    updatedAt: chat.signatureUpdatedAt || null,
    edition: chat.signatureEdition || 0,
  };
};

// 资料卡右上角"第一次见面"的日期：聊天记录里没有单独存一个
// chat.createdAt 字段，这里就用这个聊天最早一条消息的时间当作近似值
// ——实际使用中聊天建好基本会马上开始发消息，误差可以忽略。一条
// 消息都没有的全新聊天就返回 null，交给UI自己显示占位。
export const getFirstMetAt = async (chatId) => {
  if (!chatId) return null;

  const earliest = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .first();

  return earliest?.timestamp || null;
};

const buildJudgePrompt = ({ character, current, historyText }) => `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你拥有一张只属于你自己的"资料卡"——这不是对话的一部分，是你留给自己的
一份"此刻的自我介绍"，用户可以随时翻看，但你不是在回复用户，只是在
整理自己此刻的样子。它有三个字段：

1. 昵称（nickname）：你希望被称呼/记住的名字，可以跟本名不一样，带点
   私人感也可以。
2. 标签（tag）：一个简短的"#标签"，概括你此刻的状态/身份感，比如
   "#深夜电台"、"#在路上"，不超过6个字。
3. 签名（signature）：一句很短的话（10-16字左右），带着"这到底是写给
   谁看的"那种暧昧真实感，不是直接对用户说话，更像是写给自己看的
   一句心情。不要直接复述最近聊天内容。

这张卡目前的样子：
昵称：${current.nickname || '（还没取）'}
标签：${current.tag || '（还没有）'}
签名：${current.signature || '（还没写）'}

最近的对话节选（仅供你参考自己最近的心情/状态，不需要在卡片里复述或
提及这些对话内容）：
${historyText || '（暂无）'}

请你自己判断：这次要不要更新一下这张卡？不是每次都要换，大部分时候
可以保持原样、什么都不做——只有当你真的想改的时候才改。即使只改
其中一项，也要把三项都重新给一遍完整当前值（没变的那两项照抄当前值
就好）。

严格按以下两种方式之一输出，不要有任何其他文字、解释或开场白：

1. 如果这次不想改，只输出：${NO_UPDATE_SENTINEL}

2. 如果想改，把新内容整体包在 ${START_TAG} 和 ${END_TAG} 之间，严格按
   这三行格式输出，不要有多余的行：
NICKNAME: 新的昵称
TAG: #新的标签
SIGNATURE: 新的签名`;

const extractProfileContent = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text || text === NO_UPDATE_SENTINEL) return null;

  const startIdx = text.indexOf(START_TAG);
  const endIdx = text.indexOf(END_TAG);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  const body = text.slice(startIdx + START_TAG.length, endIdx);

  const nicknameMatch = body.match(/NICKNAME:\s*(.+)/i);
  const tagMatch = body.match(/TAG:\s*(.+)/i);
  const signatureMatch = body.match(/SIGNATURE:\s*(.+)/i);

  const nickname = nicknameMatch?.[1]?.trim();
  const tag = tagMatch?.[1]?.trim();
  const signature = signatureMatch?.[1]?.trim();

  if (!nickname && !tag && !signature) return null;

  return { nickname, tag, signature };
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

// 换完之后在聊天流里留下的那张痕迹卡——跟ProfileCard同一套字段，
// 由 ProfileTraceCard.jsx 用 msg.metadata 渲染成一张扁平静态快照
// （没有翻面/没有blur，堆多少条都不卡，具体渲染逻辑见那个组件）。
const postProfileTrace = async ({ chatId, character, nickname, tag, signature, edition }) => {
  const timestampIso = new Date().toISOString();

  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'profile_update',
    content: '',
    metadata: { nickname, tag, signature, edition },
    isRead: true,
    timestamp: timestampIso,
  });

  await db.chats.update(chatId, { updatedAt: timestampIso });

  dispatchLocalMessageEvent(chatId);
};

// 跟在一次正常的「用户发消息 -> 角色回复」成功之后调用，是
// fire-and-forget：调用方用 void + catch 包起来，这里面任何失败都
// 只是「这次资料卡没更新」，不应该影响正常聊天，也不需要像DIY小屋
// 的用户主动请求路径那样弹"开始/失败"提示——这张卡完全是角色自己
// 的节奏，用户没有主动要求，静默检查、静默跳过都是预期行为，只有
// 真的换了才留痕迹。
export const maybeUpdateProfileCard = async ({ chatId, character, apiConfig }) => {
  if (!chatId || !character) return;
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const lastCheckAtMs = chat.signatureLastCheckAt
    ? new Date(chat.signatureLastCheckAt).getTime()
    : 0;

  if (
    Number.isFinite(lastCheckAtMs)
    && lastCheckAtMs > 0
    && Date.now() - lastCheckAtMs < PROFILE_CARD_COOLDOWN_MS
  ) {
    return;
  }

  // 不管这次最终有没有真的换，先把检查时间点占上——冷却窗口内哪怕
  // 角色选择"这次不换"，也不会每条回复都重新触发一次 AI 调用。
  await db.chats.update(chatId, {
    signatureLastCheckAt: new Date().toISOString(),
  });

  const historyText = await getRecentHistoryText(chatId, character);

  const current = {
    nickname: chat.profileNickname || character.name,
    tag: chat.profileTag || '',
    signature: chat.currentSignature || '',
  };

  const prompt = buildJudgePrompt({ character, current, historyText });

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

    if (!response.ok) return;

    const data = await response.json();
    rawText = data?.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.warn('[ProfileCard] 资料卡的判断/生成调用失败，跳过本次检查:', error);
    return;
  }

  const parsed = extractProfileContent(rawText);
  if (!parsed) return;

  const nickname = parsed.nickname || current.nickname;
  const tag = parsed.tag || current.tag;
  const signature = parsed.signature || current.signature;

  const nextEdition = (chat.signatureEdition || 0) + 1;
  const updatedAtIso = new Date().toISOString();

  await db.chats.update(chatId, {
    profileNickname: nickname,
    profileTag: tag,
    currentSignature: signature,
    signatureUpdatedAt: updatedAtIso,
    signatureEdition: nextEdition,
  });

  await postProfileTrace({
    chatId,
    character,
    nickname,
    tag,
    signature,
    edition: nextEdition,
  });
};