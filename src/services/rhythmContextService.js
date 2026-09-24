// src/services/rhythmContextService.js
//
// 给 Rhythm 主动寄语补上"聊天上下文"，避免寄语和刚刚的对话割裂。
// 只做读取和拼装文字，不写任何数据；出任何错都降级为空，
// 不能影响寄语本身的生成。
//
// 只取轻量的一小段：最近几条对话 + 最近几条阶段摘要 + 记忆 + 距上次说话多久，
// 不复用聊天主链路里那个带表情包、卡片语法的大提示词。

import Dexie from 'dexie';
import db from '../db';
import { getChatMemoryContext } from './memoryProvider';

const RECENT_MESSAGE_LIMIT = 12;
// 多读一些再筛选，因为线下消息、错误消息、无文字消息会被过滤掉
const RECENT_MESSAGE_FETCH = 40;
const MESSAGE_TEXT_MAX_CHARS = 120;
const SUMMARY_ENTRY_LIMIT = 3;
const SUMMARY_TEXT_MAX_CHARS = 200;

const truncate = (text, maxChars) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > maxChars ? `${value.slice(0, maxChars)}...` : value;
};

const getMessageText = (message) => {
  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content;
  }

  const versions = Array.isArray(message?.versions) ? message.versions : [];
  const current = versions[message?.currentVersionIndex ?? versions.length - 1];

  return typeof current?.content === 'string' ? current.content : '';
};

const isUsableMessage = (message) => (
  message
  && message.type !== 'error'
  && message.mode !== 'offline'
  && ['user', 'character', 'ai', 'assistant'].includes(message.sender)
  && getMessageText(message).trim()
);

const formatGap = (milliseconds) => {
  const minutes = Math.max(1, Math.round(milliseconds / 60000));

  if (minutes < 60) return `约 ${minutes} 分钟`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `约 ${hours} 小时`;

  return `约 ${Math.round(hours / 24)} 天`;
};

const getRecentUsableMessages = async (chatId) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(RECENT_MESSAGE_FETCH)
    .toArray();

  return rows
    .filter(isUsableMessage)
    .slice(0, RECENT_MESSAGE_LIMIT)
    .reverse();
};

const buildSummaryBlock = (chat) => {
  let entries = [];

  if (Array.isArray(chat?.summary)) {
    entries = chat.summary;
  } else if (typeof chat?.summary === 'string' && chat.summary.trim()) {
    entries = [{ content: chat.summary, createdAt: '早期记录' }];
  }

  const recent = entries
    .filter((item) => typeof item?.content === 'string' && item.content.trim())
    .slice(-SUMMARY_ENTRY_LIMIT);

  if (recent.length === 0) return '';

  return `\n【你们之间的阶段性记录】：\n${recent
    .map((item) => `- [${item.createdAt || '历史'}] ${truncate(item.content, SUMMARY_TEXT_MAX_CHARS)}`)
    .join('\n')}`;
};

/*
 * 返回可以直接拼进寄语 system 提示词的一段文字（以换行开头），
 * 没有任何可用内容时返回空字符串。
 */
export const buildRhythmChatContext = async ({ chatId, chat, character }) => {
  try {
    const messages = await getRecentUsableMessages(chatId);
    const pieces = [];

    if (messages.length > 0) {
      const userName = String(chat?.userName || character?.userName || '用户').trim();
      const characterName = String(character?.name || '你').trim();

      const lines = messages.map((message) => {
        const speaker = message.sender === 'user' ? userName : characterName;
        return `${speaker}：${truncate(getMessageText(message), MESSAGE_TEXT_MAX_CHARS)}`;
      });

      const last = messages[messages.length - 1];
      const lastTime = new Date(last.timestamp || 0).getTime();
      const gapText = Number.isFinite(lastTime) && lastTime > 0
        ? `距离你们上一次说话${formatGap(Date.now() - lastTime)}，最后一条是${last.sender === 'user' ? userName : '你'}说的。`
        : '';

      pieces.push(
        `\n【你们最近的对话（按时间从早到晚）】：\n${lines.join('\n')}${gapText ? `\n${gapText}` : ''}`,
      );
    }

    const summaryBlock = buildSummaryBlock(chat);
    if (summaryBlock) pieces.push(summaryBlock);

    try {
      const latestUserMessage = [...messages]
        .reverse()
        .find((message) => message.sender === 'user');

      const memoryText = await getChatMemoryContext({
        chatId,
        userText: latestUserMessage ? getMessageText(latestUserMessage) : '',
        recentMessages: messages,
      });

      if (memoryText && String(memoryText).trim()) {
        pieces.push(String(memoryText));
      }
    } catch (error) {
      console.warn('[RhythmContext] 记忆检索已跳过：', error);
    }

    return pieces.join('');
  } catch (error) {
    console.warn('[RhythmContext] 聊天上下文读取失败，寄语按无上下文生成：', error);
    return '';
  }
};