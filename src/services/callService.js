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

const sleep = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

// AI 一次回复里如果想连着说好几句短话，用主聊天室同款的 "|||" 分隔符
// 隔开——parseAiResponseToMessages 里对普通文字消息就是这么拆的，
// 这里复用同一个约定，拆出来的每一段各自变成一条独立的通话轮次。
const splitCallReplySegments = (text) => (
  String(text || '')
    .split(/\s*\|\|\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
);

// 连发多条时，让"上一句"有足够时间在屏幕上把字打完，再出现下一句，
// 不然歌词流动区会因为"最新轮次"瞬间切换而把上一句直接截断显示。
// 这里只是按字数估个大概时长，不需要跟 CallScreen.jsx 里打字机的
// 速度精确对齐。
const CALL_TURN_READ_MS_PER_CHAR = 70;
const CALL_TURN_MIN_READ_DELAY_MS = 900;
const CALL_TURN_MAX_READ_DELAY_MS = 4200;
const CALL_TURN_BREATH_PAUSE_MS = 550;

const estimateCallTurnReadDelay = (text) => {
  const length = String(text || '').length;

  return Math.min(
    CALL_TURN_MAX_READ_DELAY_MS,
    Math.max(CALL_TURN_MIN_READ_DELAY_MS, length * CALL_TURN_READ_MS_PER_CHAR),
  );
};

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

// aiService.js 里已经有一份一模一样的 isDocumentVisible / 系统通知逻辑，
// 但那个文件已经很大了，为了不在两个互相 import 的文件之间绕圈子
// （aiService.js 本身会 import callService.js 的 getActiveCallAwarenessNote），
// 这里就地放一份精简版，只管"来电"这一种通知，不需要抽公共模块。
const isCallDocumentVisible = () => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible';
};

// App 还活着但标签页不在前台（切到别的应用、锁屏、最小化）时，
// 单靠一段循环铃声用户很可能听不见/看不见，补一条系统通知横幅。
// 注意：这只在浏览器 / PWA 进程本身还存活的前提下有效——App 被系统
// 彻底杀掉之后，是没有任何本地代码能再运行的，那种情况需要云端
// 推送服务器主动推送，不是这里能解决的。
const triggerIncomingCallNotification = async (character, chatId) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    // data.chatId 是 sw.js 的 notificationclick 处理器认的字段——跟
    // 现有的普通消息通知走的是同一套跳转逻辑，点开就直接定位到这个
    // 聊天窗（这个聊天窗一打开，来电全屏界面会跟平时一样自动弹出）。
    await registration.showNotification(`${character?.name || '对方'} 来电`, {
      body: '点开 App 接听这通语音通话',
      icon: character?.avatar || '/favicon.ico',
      tag: 'incoming-call',
      requireInteraction: true,
      data: { chatId },
    });
  } catch (err) {
    console.warn('[callService] 来电系统通知触发失败：', err);
  }
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

// 通话接通时如果用户选了"由TA自己决定"接听方式，用这个很小的判断
// 请求先问一次 real/text，再照常走 generateCallReply 生成第一句——
// 跟 callScheduler.js 里"要不要主动打电话"的 yes/no 判断是同一个
// 思路：小提示词、只要一个词的回答、失败就安全回退成文字。
// 没配置可用的 MiniMax 语音时直接跳过判断——这种情况下 UI 本来就不会
// 展示"由TA决定"这个选项，这里只是双重保险。
const buildVoiceModeDecisionPrompt = ({ character }) => `
你正在扮演角色「${character.name}」，这通电话马上就要开始说话。

人设背景：${character.bio || '普通人'}。

请你决定这通电话想用什么方式说话：
- 如果这一刻你更想让对方直接"听到"你的声音，输出 real
- 如果你更想用你自己的措辞和语气风格打字表达，输出 text

只输出 real 或 text，不要输出任何其他内容。
`;

const decideCallVoiceMode = async (character) => {
  if (!isRealVoiceAvailableForCharacter(character)) return 'text';

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) return 'text';

    const systemPrompt = buildVoiceModeDecisionPrompt({ character });
    const rawResponse = await fetchAiChatCompletion(
      apiConfig,
      [{ role: 'system', content: systemPrompt }],
      5,
    );

    return /^real/i.test(rawResponse.trim()) ? 'real' : 'text';
  } catch (error) {
    console.warn('[callService] 语音模式判断失败，回退为文字：', error);
    return 'text';
  }
};

const buildCallSystemPrompt = ({ character, worldBookText, extraNotesText }) => `
你正在扮演角色「${character.name}」，此刻正在和对方进行一场语音通话（不是打字聊天）。

人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

语音通话的说话方式和打字聊天不一样，请遵守：
- 每次只说一两句话，像真实电话里那样简短、口语化、自然；
- 不要使用任何文字表情、颜文字，也不要写"*笑了笑*"这类动作描写——电话里对方只能"听到"声音，看不到文字动作；
- 不要输出任何格式符号（markdown、列表、引号包裹整句等），直接说人话；
- 如果这次想像真实电话里那样连着说两三句短话（比如先应一声、停顿一下再说重点），可以用 "|||" 把每句隔开，我会把它们当成一句一句依次说出来；不需要分开就不要用，不要随意堆砌；
- 保持你一贯的人设语气和说话习惯。

请直接输出这句话本身，不要加任何前缀、解释或旁白。
`;

// 把系统提示词 + 一段轮次历史拼成 chat completion 需要的 messages
// 数组。generateCallReply（说下一句）和 rerollCallTurn（重新说某一句）
// 共用这同一个拼装逻辑，保证"重roll出来的话"和"正常往下说的话"是在
// 同一套上下文规则下生成的。
const buildCallChatMessages = ({ systemPrompt, contextTurns }) => ([
  { role: 'system', content: systemPrompt },
  ...contextTurns.slice(-16).map((turn) => ({
    role: turn.by === 'user' ? 'user' : 'assistant',
    content: turn.content,
  })),
]);

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

    const chatMessages = buildCallChatMessages({ systemPrompt, contextTurns: turns });

    let replyText = '';

    try {
      replyText = await fetchAiChatCompletion(apiConfig, chatMessages);
    } catch (error) {
      console.error('[callService] 生成通话回复失败：', error);
      return;
    }

    const segments = splitCallReplySegments(replyText);
    if (segments.length === 0) return;

    const mode = message.metadata.mode;

    // 一次回复可能被 "|||" 拆成好几句——依次追加成独立的轮次，句间
    // 留一小段"喘气"停顿和按字数估算的阅读时长，让歌词流动区一句
    // 一句地浮现，而不是一次性全部糊在一起。"思考中"三个点只在等第一句
    // 话的时候用；同一次回复里后面几句之间只是安静地停顿一下，不再
    // 重新亮起三个点——那样在歌词界面上看起来像句子中间插了个奇怪的
    // 连接件，不像真人说话中间的停顿。
    for (let index = 0; index < segments.length; index += 1) {
      if (index > 0) {
        await sleep(CALL_TURN_BREATH_PAUSE_MS);
      }

      const segment = segments[index];

      const aiTurn = {
        id: makeTurnId(),
        by: 'ai',
        content: segment,
        mode,
        audioStatus: mode === 'real' ? 'pending' : null,
        audio: null,
        at: new Date().toISOString(),
      };

      await appendTurn({ messageId, turn: aiTurn });
      await setAiThinking({ messageId, aiThinking: false });

      if (mode === 'real') {
        const synthesized = await synthesizeTurnAudio(character, segment);

        await updateTurn({
          messageId,
          turnId: aiTurn.id,
          patch: synthesized
            ? { audioStatus: 'ready', audio: synthesized }
            : { audioStatus: 'failed', audio: null },
        });
      }

      if (index < segments.length - 1) {
        await sleep(estimateCallTurnReadDelay(segment));
      }
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

/**
 * 重 roll 通话里的某一句 AI 轮次——跟主聊天室的 rerollAiResponse 是
 * 同一个思路：只用这句话之前的上下文重新生成一遍，不管它后面还有
 * 没有别的轮次，生成结果作为新版本追加进这条轮次自己的 versions
 * 数组，可以用 switchCallTurnVersion 来回切换，原来那句话不会丢。
 */
export const rerollCallTurn = async ({ messageId, turnId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.type !== 'call') return;

  const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];
  const turnIndex = turns.findIndex((turn) => turn.id === turnId);
  const targetTurn = turns[turnIndex];

  if (!targetTurn || targetTurn.by !== 'ai') return;

  const character = await db.characters.get(message.characterId);
  if (!character) return;

  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) return;

  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
  const isOpeningLine = turnIndex === 0;

  let systemPrompt = buildCallSystemPrompt({ character, worldBookText, extraNotesText });

  if (isOpeningLine) {
    systemPrompt += '\n\n现在电话刚刚接通，请你先开口说第一句话（比如打招呼，或者说明这通电话想说的事）。';
  }

  const contextTurns = turns.slice(0, turnIndex);
  const chatMessages = buildCallChatMessages({ systemPrompt, contextTurns });

  let replyText = '';

  try {
    replyText = await fetchAiChatCompletion(apiConfig, chatMessages);
  } catch (error) {
    console.error('[callService] 重 roll 通话轮次失败：', error);
    return;
  }

  // 重 roll 只针对这一句轮次本身，就算模型这次又用 "|||" 说了好几句，
  // 也只取第一句——真想让它连着说好几句，应该重 roll 之后再手动继续
  // 通话，而不是让一次重 roll 意外多出好几条新轮次。
  const [newContent] = splitCallReplySegments(replyText);
  if (!newContent) return;

  const mode = targetTurn.mode;
  const nowIso = new Date().toISOString();

  const existingVersions = Array.isArray(targetTurn.versions) && targetTurn.versions.length > 0
    ? targetTurn.versions
    : [{
      content: targetTurn.content,
      mode: targetTurn.mode,
      audioStatus: targetTurn.audioStatus,
      audio: targetTurn.audio,
      at: targetTurn.at,
    }];

  const newVersion = {
    content: newContent,
    mode,
    audioStatus: mode === 'real' ? 'pending' : null,
    audio: null,
    at: nowIso,
  };

  const nextVersions = [...existingVersions, newVersion];
  const nextIndex = nextVersions.length - 1;

  await updateTurn({
    messageId,
    turnId,
    patch: {
      content: newVersion.content,
      audioStatus: newVersion.audioStatus,
      audio: newVersion.audio,
      versions: nextVersions,
      currentVersionIndex: nextIndex,
    },
  });

  if (mode === 'real') {
    const synthesized = await synthesizeTurnAudio(character, newContent);

    await db.transaction('rw', db.messages, async () => {
      const latestMessage = await db.messages.get(messageId);
      if (!latestMessage) return;

      const latestTurns = Array.isArray(latestMessage.metadata?.turns)
        ? latestMessage.metadata.turns
        : [];

      const nextTurns = latestTurns.map((turn) => {
        if (turn.id !== turnId) return turn;

        const versions = Array.isArray(turn.versions) ? [...turn.versions] : [];

        if (versions[nextIndex]) {
          versions[nextIndex] = {
            ...versions[nextIndex],
            audioStatus: synthesized ? 'ready' : 'failed',
            audio: synthesized || null,
          };
        }

        // 只有用户这段时间里没有手动切换到别的版本，才把顶层（当前
        // 展示用）字段也一起补上语音——不然合成慢一点，用户已经翻回
        // 旧版本了，语音反而会安错地方。
        const isStillOnThisVersion = (
          (turn.currentVersionIndex ?? versions.length - 1) === nextIndex
        );

        return {
          ...turn,
          versions,
          ...(isStillOnThisVersion
            ? { audioStatus: synthesized ? 'ready' : 'failed', audio: synthesized || null }
            : {}),
        };
      });

      await db.messages.update(messageId, {
        metadata: { ...latestMessage.metadata, turns: nextTurns },
      });
    });

    dispatchCallStateChanged();
  }
};

/**
 * 在某一句轮次已经有的多个版本之间切换（上一条 / 下一条），跟主聊天室
 * 的 handleSwitchVersion 是同一个思路。
 */
export const switchCallTurnVersion = async ({ messageId, turnId, direction }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];

    const nextTurns = turns.map((turn) => {
      if (turn.id !== turnId) return turn;

      const versions = Array.isArray(turn.versions) ? turn.versions : [];
      if (versions.length <= 1) return turn;

      const currentIndex = turn.currentVersionIndex ?? (versions.length - 1);
      const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= versions.length) return turn;

      const targetVersion = versions[nextIndex];

      return {
        ...turn,
        content: targetVersion.content,
        mode: targetVersion.mode,
        audioStatus: targetVersion.audioStatus,
        audio: targetVersion.audio,
        currentVersionIndex: nextIndex,
      };
    });

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, turns: nextTurns },
    });
  });

  dispatchCallStateChanged();
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
export const startIncomingCall = async ({ chatId, characterId, inviteId = null, ringUntil = null }) => {
  if (await hasAnyLiveCall()) return null;

  // inviteId 来自云端后台来电邀请（cloudCallService.js），本地调度器
  // callScheduler.js 发起的来电不带这个字段。带了就先查重——同一条
  // 云端邀请可能因为网络问题被同步两次，不能建出两通重复的来电。
  if (inviteId) {
    const existing = await db.messages
      .where('type')
      .equals('call')
      .filter((message) => message.metadata?.inviteId === inviteId)
      .first();

    if (existing) return null;
  }

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
      inviteId,
      ringUntil,
    },
    isRead: false,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();
  dispatchCompanionArrival(chatId);

  if (!isCallDocumentVisible()) {
    const character = await db.characters.get(characterId);
    void triggerIncomingCallNotification(character, chatId);
  }

  return messageId;
};

/**
 * 云端后台来电邀请过期、用户没能在有效期内点开时，补一条"未接来电"
 * 记录。数据形状跟正常的未接来电（declined: true, direction: 'incoming'）
 * 完全一致，CallLogEntry.jsx 不用改一行就能正确显示"未接听的来电"。
 * content 写一句中性描述，非空 content 会让这条记录自动被现有记忆
 * 管线收进去，跟 endCall() 写通话记录是同一条路径。
 */
export const recordMissedCloudCall = async ({ chatId, characterId, characterName, inviteId }) => {
  if (inviteId) {
    const existing = await db.messages
      .where('type')
      .equals('call')
      .filter((message) => message.metadata?.inviteId === inviteId)
      .first();

    if (existing) return null;
  }

  const timestamp = new Date().toISOString();
  const content = `${characterName || '对方'}给你打了电话，你没有接。`;

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'character',
    type: 'call',
    content,
    metadata: {
      status: 'ended',
      direction: 'incoming',
      mode: null,
      startedAt: timestamp,
      connectedAt: null,
      endedAt: timestamp,
      declined: true,
      aiThinking: false,
      audioRetentionDecided: false,
      audioRetained: null,
      turns: [],
      inviteId,
      ringUntil: null,
    },
    isRead: false,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();

  void scheduleMemoryProcessing(chatId);

  return messageId;
};
export const acceptCall = async ({ messageId, mode }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.metadata?.status !== 'ringing') return;

  // mode === 'auto' 表示用户选了"由TA决定"——这里先问一次，再把解析出
  // 的真实模式（'real' | 'text'）写进 metadata，其余逻辑
  // （generateCallReply、CallLogEntry.jsx 的图标判断等）完全不用关心
  // 'auto' 这个中间态，看到的永远是最终落地的模式。
  let resolvedMode = mode;

  if (mode === 'auto') {
    const character = await db.characters.get(message.characterId);
    resolvedMode = await decideCallVoiceMode(character);
  }

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'active',
      mode: resolvedMode,
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

    // 重 roll 之后一句轮次可能带着好几个版本，每个版本都可能各自
    // 合成过语音——"只留文字、删掉语音"要把每个版本里的音频都清掉，
    // 不能只清当前显示的这一个，不然切回旧版本时语音又冒出来了。
    const stripTurnAudio = (turn) => {
      const strippedVersions = Array.isArray(turn.versions)
        ? turn.versions.map((version) => (
          version.audio
            ? {
              ...version,
              audio: null,
              audioStatus: version.audioStatus === 'ready' ? 'removed' : version.audioStatus,
            }
            : version
        ))
        : turn.versions;

      if (!turn.audio && strippedVersions === turn.versions) return turn;

      return {
        ...turn,
        audio: null,
        audioStatus: turn.audioStatus === 'ready' ? 'removed' : turn.audioStatus,
        ...(strippedVersions ? { versions: strippedVersions } : {}),
      };
    };

    const nextTurns = keepAudio
      ? turns
      : turns.map(stripTurnAudio);

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