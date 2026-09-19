import db from '../db';
import { buildRhythmPersonaBrief } from './rhythmReminderService';
import { scheduleMemoryProcessing } from '../apps/memory/memoryScheduler';

import {
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from '../features/real-voice/realVoiceDefaults';

import { synthesizeMiniMaxSpeech } from '../features/real-voice/minimaxClient';

// 语音通话是消息流里的一种特殊消息类型（type: 'call'），跟拍一拍/
// 石头剪刀布互动是同一个思路：不新建 Dexie 表、不做 schema 升级，
// 只是往 metadata 里塞一个会不断被原地更新的 turns 数组。
//
// 之所以不像"离线场景"那样整屏替换，是因为用户明确要求通话进行时
// 依然要能在 ChatRoom 里正常打字——既然通话只是消息流里的一条消息，
// 它天然不会挡住下面的输入框，这个约束就自动满足了。

const makeTurnId = () => (
  `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const dispatchCallStateChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('call-state-changed'));
};

// 复用现有"伴侣发来新东西"事件：App.jsx 已经监听这个事件来播放
// 提示音，来电这里搭一趟顺风车，不用再额外接一套通知机制。
const dispatchCompanionArrival = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', {
    detail: { chatId, sender: 'character' },
  }));
};

export const isRealVoiceAvailableForCharacter = (character) => (
  hasUsableMiniMaxVoiceProfile(character?.voiceProfile)
);

/**
 * 当前是否已经存在一通"响铃中/进行中"的通话。
 * UI 一次只承载一通通话，来电调度器和用户手动拨打之前都要先检查这个。
 */
export const hasAnyLiveCall = async () => {
  const liveCalls = await db.messages
    .where('type')
    .equals('call')
    .filter((message) => (
      message.metadata?.status === 'ringing'
      || message.metadata?.status === 'active'
    ))
    .toArray();

  return liveCalls.length > 0;
};

/**
 * 供 aiService.js 在组装主聊天系统提示词时调用：如果这个聊天窗当前
 * 正在通话（响铃中或进行中），给 AI 一句简短的处境提示，让它知道
 * "我们正在通话"，但不强制它每次都提起——具体怎么表现交给它自己判断。
 */
export const getActiveCallAwarenessNote = async (chatId) => {
  if (!chatId) return '';

  const liveCalls = await db.messages
    .where('type')
    .equals('call')
    .filter((message) => (
      message.chatId === chatId
      && (message.metadata?.status === 'ringing' || message.metadata?.status === 'active')
    ))
    .toArray();

  const liveCall = liveCalls[0];
  if (!liveCall) return '';

  if (liveCall.metadata.status === 'ringing') {
    return '\n\n【通话状态】：你刚刚拨打/发起了一通电话，对方还没有接起，此刻仍在等待接通。这条文字消息和那通电话是两件平行发生的事，不必特意解释。';
  }

  return '\n\n【通话状态】：你和对方此刻正在语音通话中（一场独立、正在进行的通话）。这条文字消息是通话之外额外发来的一条消息，可以自然地提到你们正在通话，也可以完全不提。';
};

const appendTurn = async ({ messageId, turn }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns)
      ? message.metadata.turns
      : [];

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, turns: [...turns, turn] },
    });
  });

  dispatchCallStateChanged();
};

const updateTurn = async ({ messageId, turnId, patch }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns)
      ? message.metadata.turns
      : [];

    const nextTurns = turns.map((turn) => (
      turn.id === turnId ? { ...turn, ...patch } : turn
    ));

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, turns: nextTurns },
    });
  });

  dispatchCallStateChanged();
};

// 显式的"对方正在想怎么回"标记，写进 metadata 里，而不是让 UI 自己
// 猜（比如"最后一条是用户轮次就当作在思考"）——开场白、用户发言之后
// 都要经过这里，单一出口，UI 不用关心是哪种情况触发的。
const setAiThinking = async ({ messageId, aiThinking }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, aiThinking },
    });
  });

  dispatchCallStateChanged();
};

const fetchAiChatCompletion = async (apiConfig, chatMessages, maxTokens = 160) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: chatMessages,
      temperature: 0.85,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

const buildCallSystemPrompt = ({ character, worldBookText, extraNotesText }) => `
你正在扮演角色「${character.name}」，此刻正在和对方进行一场语音通话（不是打字聊天）。

人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

语音通话的说话方式和打字聊天不一样，请遵守：
- 每次只说一两句话，像真实电话里那样简短、口语化、自然；
- 不要使用任何文字表情、颜文字，也不要写"*笑了笑*"这类动作描写——电话里对方只能"听到"声音，看不到文字动作；
- 不要输出任何格式符号（markdown、列表、引号包裹整句等），直接说人话；
- 保持你一贯的人设语气和说话习惯。

请直接输出这句话本身，不要加任何前缀、解释或旁白。
`;

const synthesizeTurnAudio = async (character, text) => {
  const profile = normalizeVoiceProfile(character?.voiceProfile);

  if (!hasUsableMiniMaxVoiceProfile(profile) || !text?.trim()) {
    return null;
  }

  try {
    const result = await synthesizeMiniMaxSpeech({
      text,
      voiceProfile: profile,
      voiceIntent: { language: profile.minimax.language || 'auto' },
    });

    return { audioBlob: result.audioBlob, mimeType: result.mimeType };
  } catch (error) {
    console.warn('[callService] 通话语音合成失败：', error);
    return null;
  }
};

/**
 * 让角色针对当前通话说下一句话：开场白（turns 为空时）或者对用户
 * 刚发的一句话的回应。text 模式直接是一条文字轮次；real 模式先写入
 * 一条 pending 的文字轮次，再异步补上语音。
 */
const generateCallReply = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.type !== 'call' || message.metadata?.status !== 'active') {
    return;
  }

  await setAiThinking({ messageId, aiThinking: true });

  try {
    const character = await db.characters.get(message.characterId);
    if (!character) return;

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) return;

    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
    const turns = Array.isArray(message.metadata.turns) ? message.metadata.turns : [];
    const isOpeningLine = turns.length === 0;

    let systemPrompt = buildCallSystemPrompt({ character, worldBookText, extraNotesText });

    if (isOpeningLine) {
      systemPrompt += '\n\n现在电话刚刚接通，请你先开口说第一句话（比如打招呼，或者说明这通电话想说的事）。';
    }

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...turns.slice(-16).map((turn) => ({
        role: turn.by === 'user' ? 'user' : 'assistant',
        content: turn.content,
      })),
    ];

    let replyText = '';

    try {
      replyText = await fetchAiChatCompletion(apiConfig, chatMessages);
    } catch (error) {
      console.error('[callService] 生成通话回复失败：', error);
      return;
    }

    if (!replyText) return;

    const mode = message.metadata.mode;

    const aiTurn = {
      id: makeTurnId(),
      by: 'ai',
      content: replyText,
      mode,
      audioStatus: mode === 'real' ? 'pending' : null,
      audio: null,
      at: new Date().toISOString(),
    };

    await appendTurn({ messageId, turn: aiTurn });

    if (mode === 'real') {
      const synthesized = await synthesizeTurnAudio(character, replyText);

      await updateTurn({
        messageId,
        turnId: aiTurn.id,
        patch: synthesized
          ? { audioStatus: 'ready', audio: synthesized }
          : { audioStatus: 'failed', audio: null },
      });
    }
  } finally {
    // 无论成功、提前 return 还是抛异常，"正在思考"的状态都要收掉，
    // 不然一次失败的请求会让打字指示器永远转下去。
    await setAiThinking({ messageId, aiThinking: false });
  }
};

/**
 * 用户在通话里发了一句话（始终是打字，不做语音转文字）。
 */
export const sendCallTurn = async ({ messageId, text }) => {
  const content = String(text || '').trim();
  if (!content || !messageId) return;

  const userTurn = {
    id: makeTurnId(),
    by: 'user',
    content,
    mode: null,
    audioStatus: null,
    audio: null,
    at: new Date().toISOString(),
  };

  await appendTurn({ messageId, turn: userTurn });

  void generateCallReply({ messageId });
};

const connectOutgoingCall = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.metadata?.status !== 'ringing') return;

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'active',
      connectedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();
  void generateCallReply({ messageId });
};

/**
 * 用户主动拨打电话。mode 在拨打前就已经选好（'real' | 'text'）。
 */
export const startOutgoingCall = async ({ chatId, characterId, mode }) => {
  if (await hasAnyLiveCall()) return null;

  const timestamp = new Date().toISOString();

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'call',
    content: '',
    metadata: {
      status: 'ringing',
      direction: 'outgoing',
      mode,
      startedAt: timestamp,
      connectedAt: null,
      endedAt: null,
      declined: false,
      aiThinking: false,
      audioRetentionDecided: false,
      audioRetained: null,
      turns: [],
    },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();

  // 短暂"拨打中"再接通，营造一点真实电话的接通感。
  window.setTimeout(() => {
    void connectOutgoingCall({ messageId });
  }, 1400 + Math.random() * 900);

  return messageId;
};

/**
 * 角色主动打进来（由 callScheduler.js 调用）。这里只负责"响铃"，
 * 接听方式（mode）要等用户接听时才选。
 */
export const startIncomingCall = async ({ chatId, characterId }) => {
  if (await hasAnyLiveCall()) return null;

  const timestamp = new Date().toISOString();

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'character',
    type: 'call',
    content: '',
    metadata: {
      status: 'ringing',
      direction: 'incoming',
      mode: null,
      startedAt: timestamp,
      connectedAt: null,
      endedAt: null,
      declined: false,
      aiThinking: false,
      audioRetentionDecided: false,
      audioRetained: null,
      turns: [],
    },
    isRead: false,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();
  dispatchCompanionArrival(chatId);

  return messageId;
};

export const acceptCall = async ({ messageId, mode }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.metadata?.status !== 'ringing') return;

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'active',
      mode,
      connectedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();

  if (message.metadata.direction === 'incoming') {
    void generateCallReply({ messageId });
  }
};

export const declineCall = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message) return;

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'ended',
      declined: true,
      endedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();
};

// 把通话轮次拼成一段可读文字，写进这条 call 消息自己的 content 字段。
// memorySignals.js 的 isUsableMessage 只要求 type !== 'error'、非空
// content、sender 在支持列表里——call 消息本来就满足后两条，只要把
// content 填上，现有的记忆提炼流程（memoryScheduler.js）就会像扫普通
// 文字消息一样自动扫到它，完全不用改记忆系统本身。
const buildCallTranscript = ({ character, userName, turns }) => {
  const safeTurns = Array.isArray(turns) ? turns : [];
  const aiLabel = character?.name || 'TA';
  const userLabel = userName || '我';

  const lines = safeTurns
    .map((turn) => String(turn?.content || '').trim())
    .map((content, index) => ({ content, by: safeTurns[index]?.by }))
    .filter((turn) => turn.content)
    .map((turn) => `${turn.by === 'ai' ? aiLabel : userLabel}：${turn.content}`);

  if (lines.length === 0) return '';

  return `[语音通话记录]\n${lines.join('\n')}`;
};

/**
 * 挂断通话。按照约定，通话只能由用户手动挂断，没有不活动自动超时。
 * 挂断的同时把这通电话的文字记录写进 content，并入记忆提炼队列——
 * 跟普通消息触发记忆扫描是同一条路径，参考 aiService.js 里的用法。
 */
export const endCall = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message) return;

  const [chat, character] = await Promise.all([
    db.chats.get(message.chatId),
    db.characters.get(message.characterId),
  ]);

  const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];
  const userName = chat?.userName || character?.userName || '';
  const transcript = buildCallTranscript({ character, userName, turns });

  await db.messages.update(messageId, {
    content: transcript,
    metadata: {
      ...message.metadata,
      status: 'ended',
      endedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();

  if (transcript) {
    void scheduleMemoryProcessing(message.chatId);
  }
};

/**
 * 真实语音通话结束后，询问用户要不要把合成出来的语音留在本地——
 * 音频 Blob 直接存在 IndexedDB 里，通话越多、语音越长，占用的本地
 * 空间也会越涨，所以给用户一个"只留文字、删掉语音"的选项。
 * 这个决定只需要做一次，做过之后 CallReviewModal 就不会再追问。
 */
export const setAudioRetention = async ({ messageId, keepAudio }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];

    const nextTurns = keepAudio
      ? turns
      : turns.map((turn) => (
        turn.audio
          ? { ...turn, audio: null, audioStatus: turn.audioStatus === 'ready' ? 'removed' : turn.audioStatus }
          : turn
      ));

    await db.messages.update(messageId, {
      metadata: {
        ...message.metadata,
        turns: nextTurns,
        audioRetentionDecided: true,
        audioRetained: keepAudio,
      },
    });
  });

  dispatchCallStateChanged();
};