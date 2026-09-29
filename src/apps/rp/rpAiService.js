// src/apps/rp/rpAiService.js
//
// 长RP子应用切片C：消息发送/AI调用编排。照抄 bubbleAiService.js 的整体
// 形状（订阅/通知事件、房间状态变化后前端重拉消息列表），但长RP是
// 单角色单会话，没有"广播给房间里每个成员"这层编排，逻辑比泡泡模式简单。
//
// AI接口调用本身不重新拼 fetch——直接复用 aiService.js 已经导出、专门给
// "非在线聊天主流程"用的 generateResponse（Pebbling 等独立功能也在用这个
// 口子），不走 runAiToolOrchestrator（那一套是给MCP工具用的，长RP明确
// 不接MCP，切片B设计讨论时确认过）。
//
// system prompt 由 rpPromptAssembler.assembleRpSystemPrompt 组装（读这个
// 会话绑定的预设 + 角色人设 + user人设 + 世界书占位 + 历史占位），历史
// 由 rpPromptAssembler.buildRpHistoryContext 组装（按 contextWindowSize
// 截取 + 走一遍正则脚本的 prompt 阶段）。世界书扫描逻辑还没做（留给以后
// 的世界书切片），这里先始终传空字符串，assembleRpSystemPrompt 对空
// worldBookText 的处理是"跳过这一块，不报错"。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import { getRpSessionById } from './rpService';
import {
  getRpMessages,
  addRpMessage,
  appendRpMessageVersion,
} from './rpMessageService';
import { getRpPresetById } from './rpPresetService';
import { assembleRpSystemPrompt, buildRpHistoryContext } from './rpPromptAssembler';

const listeners = new Set();

export const subscribeRpAiEvents = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notify = (event) => {
  listeners.forEach((cb) => cb(event));
};

/**
 * 组装这个会话当前应该用的 system prompt + 正则脚本。预设找不到
 * （session.presetId 是 null，或者指向的预设已被删除）时静默退回——
 * preset 传 null 给 assembleRpSystemPrompt，它会自己退化成只剩历史文本；
 * regexScripts 退化成空数组，等于不做任何正则处理。
 */
const resolvePresetAndPrompt = async ({ session, character, historyMessagesForPrompt, historyText }) => {
  const preset = session.presetId ? await getRpPresetById(session.presetId) : null;
  const regexScripts = preset?.regexScripts || [];

  const systemPrompt = assembleRpSystemPrompt({
    preset,
    character,
    session,
    worldBookText: '',
    historyText,
  });

  return { preset, regexScripts, systemPrompt };
};

/**
 * 生成一次角色回复并写入 rpMessages。isReroll 为 true 时，不新增一条消息，
 * 而是给 targetMessageId 这条已有的角色消息追加一个版本（重新生成）。
 *
 * 历史上下文的截取口径：正常发送时用"发这条新用户消息之前的全部历史 +
 * 刚写入的这条用户消息"；重新生成时用"这条要被重roll的角色消息之前的全部
 * 历史"（不能看见它自己那个即将被替换掉的版本，也不能看见它之后已经被
 * 编辑-截断规则清空的内容——因为能被reroll的消息本来就应该是当前会话
 * 最后一条）。
 */
const generateAndWriteReply = async ({ session, character, historyForContext, isReroll, targetMessageId }) => {
  notify({ type: 'RP_TYPING_START', sessionId: session.id });

  try {
    const historyText = historyForContext
      .map((m) => m.content)
      .join('\n\n');

    const { systemPrompt, regexScripts } = await resolvePresetAndPrompt({
      session,
      character,
      historyText,
    });

    const historyContext = buildRpHistoryContext(
      historyForContext,
      regexScripts,
      session.contextWindowSize
    );

    const rawReply = await generateResponse([
      { role: 'system', content: systemPrompt },
      ...historyContext,
    ]);

    const content = String(rawReply || '').trim() || '……（AI没有返回任何内容）';

    if (isReroll && targetMessageId) {
      await appendRpMessageVersion(targetMessageId, content);
    } else {
      await addRpMessage({ sessionId: session.id, senderType: 'character', content });
    }

    notify({ type: 'RP_MESSAGE_ADDED', sessionId: session.id });
  } catch (error) {
    console.error('[rpAiService] 生成角色回复失败:', error);

    if (!isReroll) {
      await addRpMessage({
        sessionId: session.id,
        senderType: 'character',
        content: `[生成失败] ${error?.message || '这条回复没能发出去，可以再试一次。'}`,
      });
      notify({ type: 'RP_MESSAGE_ADDED', sessionId: session.id });
    } else {
      notify({ type: 'RP_ERROR', sessionId: session.id, message: error?.message || '重新生成失败' });
    }
  } finally {
    notify({ type: 'RP_TYPING_END', sessionId: session.id });
  }
};

/**
 * 用户发一条消息：写入 rpMessages -> 通知界面刷新 -> 触发一次角色回复。
 */
export const sendRpMessage = async (sessionId, text) => {
  const content = String(text || '').trim();
  if (!content) return;

  const session = await getRpSessionById(sessionId);
  if (!session) return;

  const character = await db.characters.get(session.characterId);
  if (!character) return;

  await addRpMessage({ sessionId: session.id, senderType: 'user', content });
  notify({ type: 'RP_MESSAGE_ADDED', sessionId: session.id });

  const allMessages = await getRpMessages(session.id);

  await generateAndWriteReply({
    session,
    character,
    historyForContext: allMessages,
    isReroll: false,
  });
};

/**
 * 重新生成某一条角色消息（必须是这个会话当前最后一条消息——UI 侧只在
 * 最后一条角色消息上显示"重新生成"按钮，这里不重复做这层校验，交给UI
 * 保证调用前提）。
 */
export const rerollRpMessage = async (sessionId, messageId) => {
  const session = await getRpSessionById(sessionId);
  if (!session) return;

  const character = await db.characters.get(session.characterId);
  if (!character) return;

  const allMessages = await getRpMessages(session.id);
  const targetIndex = allMessages.findIndex((m) => m.id === Number(messageId));
  if (targetIndex === -1) return;

  const historyForContext = allMessages.slice(0, targetIndex);

  await generateAndWriteReply({
    session,
    character,
    historyForContext,
    isReroll: true,
    targetMessageId: Number(messageId),
  });
};

export default {
  subscribeRpAiEvents,
  sendRpMessage,
  rerollRpMessage,
};