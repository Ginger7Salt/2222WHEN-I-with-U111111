// src/apps/messages/interactions/halloween/trickService.js
//
// 恶作剧按钮：user 和 char 都能用（user 点输入条上的按钮；char 则在回复
// 正文里带 [TRICK] 标签，由 aiService.js 解析后调用这里）。效果是双向
// 广播的——不管是谁发起，这条消息都会出现在消息流里，双方都能看到
// "谁对谁恶作剧了一下"，并在自己这端播一次全屏幽灵+文字动画（见
// ChatTrickNotice.jsx）。写法完全照抄 pokeService.js 的 createPokeMessage，
// 只是不需要角色反应文案这一层。

import db from '../../../../db';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

// direction: 'user_to_char' = 用户对角色恶作剧，'char_to_user' = 角色主动
// 对用户恶作剧。
export const createTrickMessage = async ({
  chatId,
  characterId,
  direction,
  actorLabel = '',
  targetLabel = '',
}) => {
  if (!chatId || !characterId || !direction) {
    return null;
  }

  const timestamp = new Date().toISOString();

  const content = actorLabel && targetLabel
    ? `${actorLabel} 对 ${targetLabel} 恶作剧了一下`
    : '恶作剧了一下';

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: direction === 'char_to_user' ? 'character' : 'user',
    type: 'trick',
    content,
    metadata: { direction },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });

  dispatchLocalMessageEvent(chatId);

  return messageId;
};