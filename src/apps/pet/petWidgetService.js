import db from '../../db';
import { buildChatSystemPrompt, triggerAiResponse } from '../../services/aiService';
import { getCharacterEmotionContext } from '../memory/memoryCharacterState';

export const PET_WIDGET_CONFIG_KEY = 'pet_widget_config';
export const PET_WIDGET_POSITION_KEY = 'pet_widget_position';
export const PET_WIDGET_LAST_SEEN_KEY = 'pet_widget_last_seen';

const DEFAULT_CONFIG = {
  enabled: false,
  chatId: null,
  customAvatar: null,
  aiReactionsEnabled: false,
};

const normalizeConfig = (value) => ({
  enabled: value?.enabled === true,
  chatId: value?.chatId === undefined || value?.chatId === null
    ? null
    : value.chatId,
  customAvatar: typeof value?.customAvatar === 'string'
    ? value.customAvatar
    : null,
  aiReactionsEnabled: value?.aiReactionsEnabled === true,
});

export const getPetWidgetConfig = async () => {
  try {
    const record = await db.settings.get(PET_WIDGET_CONFIG_KEY);
    return normalizeConfig(record?.value);
  } catch (error) {
    console.warn('[PetWidget] 读取配置失败:', error);
    return { ...DEFAULT_CONFIG };
  }
};

export const savePetWidgetConfig = async (partialConfig = {}) => {
  const current = await getPetWidgetConfig();
  const nextConfig = normalizeConfig({ ...current, ...partialConfig });

  await db.settings.put({
    key: PET_WIDGET_CONFIG_KEY,
    value: nextConfig,
  });

  return nextConfig;
};

/*
 * 设置页"绑定消息框"下拉框用的列表：把 chats 和 characters 拼在一起，
 * 只暴露挑选时需要的字段，避免设置组件也要懂 chats/characters 的
 * 完整数据结构。
 */
export const getBindablePetChats = async () => {
  const [chats, characters] = await Promise.all([
    db.chats.orderBy('updatedAt').reverse().toArray(),
    db.characters.toArray(),
  ]);

  const characterMap = new Map(
    characters.map((character) => [character.id, character])
  );

  return chats.map((chat) => {
    const character = characterMap.get(chat.characterId);

    return {
      chatId: chat.id,
      characterId: chat.characterId,
      chatTitle: chat.title || '未命名聊天',
      characterName: character?.name || '未知角色',
    };
  });
};

/*
 * 桌宠面板打开时用来确认绑定的消息框还在，并拿到角色名字/头像。
 * 消息框被删除后返回 null，调用方应把桌宠当作"未绑定"处理。
 */
export const getPetChatContext = async (chatId) => {
  if (chatId === null || chatId === undefined) {
    return null;
  }

  const chat = await db.chats.get(chatId);
  if (!chat) {
    return null;
  }

  const character = await db.characters.get(chat.characterId);
  if (!character) {
    return null;
  }

  return { chat, character };
};


/*
 * 桌宠"察觉你在别处聊天"这件事，不是重新做一套感知逻辑——项目里已经
 * 有一个成熟的"跨聊天关心"机制（src/apps/messages/check-in/），用户
 * 在别的消息框发消息时，如果桌宠绑定的这个角色在那边的"跨聊天关心"
 * 设置里被勾选了，就会有概率、带冷却地往桌宠绑定的这个消息框里写一条
 * 真实的角色消息，提一句"你是不是在别处聊了很久"。
 *
 * 所以桌宠这边要做的不是生成这句话，而是：面板关着的时候，一旦这个
 * 消息框里出现了一条新的、之前没见过的角色消息，就把它当成"桌宠自己
 * 冒出来说了一句话"，用一个小气泡展示出来，而不是等用户自己点开面板
 * 才看到。这两个函数就是用来记"用户上一次看到这个消息框看到哪条为止"。
 */
export const getPetLastSeenMessageId = async (chatId) => {
  if (chatId === null || chatId === undefined) {
    return null;
  }

  try {
    const record = await db.settings.get(PET_WIDGET_LAST_SEEN_KEY);
    const stored = record?.value;

    if (!stored || stored.chatId !== chatId) {
      return null;
    }

    return stored.messageId ?? null;
  } catch (error) {
    console.warn('[PetWidget] 读取已读消息标记失败:', error);
    return null;
  }
};

export const setPetLastSeenMessageId = async (chatId, messageId) => {
  if (chatId === null || chatId === undefined || messageId === null || messageId === undefined) {
    return;
  }

  try {
    await db.settings.put({
      key: PET_WIDGET_LAST_SEEN_KEY,
      value: { chatId, messageId },
    });
  } catch (error) {
    console.warn('[PetWidget] 保存已读消息标记失败:', error);
  }
};
/*
 * 把用户上传的 png 压缩到一个头像该有的尺寸，同时保留透明通道——
 * 复用 dailyOfferingService 里 compressLocalImage 的思路，但那边为了
 * 存照片用的是 jpeg，会把透明背景吃成纯色，桌宠头像（Q 版猫猫）需要
 * 保留透明背景，所以这里单独写一份，输出 png。
 */
export const compressPetAvatar = (file) => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith('image/')) {
    reject(new Error('请选择有效的图片文件。'));
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => {
    reject(new Error('图片读取失败，请重新选择。'));
  };

  reader.onload = () => {
    const image = new Image();

    image.onerror = () => {
      reject(new Error('图片无法处理，请尝试其他文件。'));
    };

    image.onload = () => {
      const maxEdge = 512;
      const longestEdge = Math.max(image.width, image.height);
      const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;

      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('当前浏览器无法处理图片。'));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      resolve(canvas.toDataURL('image/png'));
    };

    image.src = String(reader.result || '');
  };

  reader.readAsDataURL(file);
});

/*
 * 兜底文字：不调用 AI，纯本地随机挑一句，用来在没有配置 API Key、
 * 或者用户只是想戳一下桌宠而不想正经聊天时，给一点即时的陪伴感。
 * 这些互动不会写进 db.messages，也就不会进入该消息框的正式聊天记录。
 */
const POKE_REPLIES = [
  '嗯？在的在的。',
  '戳我作甚，尾巴要炸毛了。',
  '今天过得还好吗。',
  '在忙的话，我就安静待着。',
  '被戳到了，有点开心。',
];

const HELLO_REPLIES = [
  '嗨，我在这儿。',
  '好久没冒泡了，在想你。',
  '打开面板就能看到我，挺好的。',
  '嗯，我一直都在。',
];

const HUG_REPLIES = [
  '抱一下，暖暖的。',
  '好，那就抱一会儿。',
  '这个抱抱我收下了。',
];

export const CANNED_REACTIONS = [
  { id: 'poke', label: '戳一戳', pool: POKE_REPLIES },
  { id: 'hello', label: '打个招呼', pool: HELLO_REPLIES },
  { id: 'hug', label: '抱一抱', pool: HUG_REPLIES },
];

export const pickCannedReply = (reactionId) => {
  const reaction = CANNED_REACTIONS.find((item) => item.id === reactionId);
  const pool = reaction?.pool || POKE_REPLIES;

  return pool[Math.floor(Math.random() * pool.length)];
};



/*
 * "AI 生成回复"选项打开时用的：给戳一戳/打招呼/抱一抱这类小动作生成
 * 一句真正由角色人格产出的反应，而不是固定池子里随机挑一句。
 *
 * 刻意不走 triggerAiResponse/db.messages 那条路——这些小动作本来就
 * 不是正式聊天，不需要留痕、不需要打字动画、也不需要占用消息框的
 * 上下文长度。所以这里是一次很轻的、独立的模型调用：读同一套
 * buildChatSystemPrompt（保证角色设定、世界书、当前心情跟正式聊天
 * 一致），但不带聊天历史，只让它对着"用户刚做了个什么动作"给一句话。
 *
 * 没配置 API、或者请求失败，都返回 null，调用方会自动退回兜底文字。
 */
export const generateAiReactionReply = async ({
  chatId,
  chat,
  character,
  reactionLabel,
}) => {
  if (!chatId || !chat || !character) {
    return null;
  }

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

    const emotionContext = await getCharacterEmotionContext({
      chatId,
      characterId: character.id,
    });

    const reactionGuide = `
【注意：这不是一句普通聊天，而是用户在桌宠小面板里对你做了一个「${reactionLabel}」的小动作】
请用一句话（20 字以内）做出自然反应，符合你的性格和此刻的心情。
不要提到"系统"、"面板"、"程序"、"App"这类词，不要使用表情符号，不要加引号。
`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        temperature: 0.9,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}${emotionContext}${reactionGuide}`,
          },
          {
            role: 'user',
            content: `（用户对你做了「${reactionLabel}」）`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const replyText = String(
      data?.choices?.[0]?.message?.content || ''
    ).trim();

    return replyText || null;
  } catch (error) {
    console.warn('[PetWidget] AI 反应生成失败，退回兜底文字:', error);
    return null;
  }
};

/*
 * 真·轻互动：把用户输入写进这个消息框自己的 db.messages，然后走
 * 和 ChatRoom 完全一样的 triggerAiResponse(chatId) 流程。
 *
 * 这意味着：
 * 1. 桌宠面板里发的话，跟在完整聊天页面里发的话没有本质区别——
 *    同一个 chatId，同一套上下文/记忆拼装逻辑，回复也会写回同一个
 *    消息框，打开完整聊天记录时能看到。
 * 2. 不在这里重复实现一遍 AI 调用逻辑，减少以后两边行为不一致的
 *    维护负担。
 */
export const sendPetLightMessage = async ({ chatId, characterId, text }) => {
  const trimmed = String(text || '').trim();

  if (!chatId || !trimmed) {
    return null;
  }

  const newMessage = {
    chatId,
    characterId,
    sender: 'user',
    type: 'text',
    content: trimmed,
    metadata: {},
    quotedMessageId: null,
    isRead: true,
    timestamp: new Date().toISOString(),
  };

  const messageId = await db.messages.add(newMessage);
  newMessage.id = messageId;

  await db.chats.update(chatId, {
    updatedAt: new Date().toISOString(),
  });

  void triggerAiResponse(chatId);

  return newMessage;
};