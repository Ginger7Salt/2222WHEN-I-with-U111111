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
// 会话绑定的预设 + 角色人设 + user人设 + 世界书占位 + 前情提要 + 历史占位），
// 历史由 rpPromptAssembler.buildRpHistoryContext 组装（按 contextWindowSize
// 截取 + 走一遍正则脚本的 prompt 阶段）。世界书扫描逻辑还没做（留给以后
// 的世界书切片），这里先始终传空字符串，assembleRpSystemPrompt 对空
// worldBookText 的处理是"跳过这一块，不报错"。
//
// 切片D：已存档（archived）的消息在这个文件里被彻底当作不存在——不管是
// 拼历史文本、组装 contextWindowSize 截取用的数组，还是喂给自动总结的
// "新发生的剧情"，都先把 archived 的消息过滤掉。存档是"跟这个角色的AI
// 上下文永久说再见"，只靠前情提要记得它。
//
// 自动总结（跟用户确认过：现在就接全自动，每 summaryIntervalTurns 轮
// [= *2 条消息] 自动触发一次）：每次用户消息发送、角色也回复完之后，
// 检查"上次总结覆盖到的消息之后，又新发生了多少条未存档消息"，够数就
// 另外发一次AI请求，把旧的前情提要和这批新剧情揉成一份新的前情提要，
// 整份覆盖写回 session.summaryText。总结失败不影响这一轮正常收发（静默
// 失败，因为 summaryCoveredThroughMessageId 没被更新，下次发消息时条件
// 仍然满足，等于自动重试）。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import { getRpSessionById, updateRpSessionSummary } from './rpService';
import {
  getRpMessages,
  addRpMessage,
  appendRpMessageVersion,
  archiveRpMessagesBefore,
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
const resolvePresetAndPrompt = async ({ session, character, historyText }) => {
  const preset = session.presetId ? await getRpPresetById(session.presetId) : null;
  const regexScripts = preset?.regexScripts || [];

  const systemPrompt = assembleRpSystemPrompt({
    preset,
    character,
    session,
    worldBookText: '',
    summaryText: session.summaryText || '',
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
 * 最后一条）。historyForContext 传进来之前调用方已经把 archived 的消息
 * 过滤掉了。
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
    return true;
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
    return false;
  } finally {
    notify({ type: 'RP_TYPING_END', sessionId: session.id });
  }
};

/**
 * 拼一段"旧提要 + 新剧情 -> 请融合成新提要"的总结请求文本。只让AI输出
 * 提要正文本身，不要标题、不要客套话——这段文本之后会原样塞进下一轮的
 * system prompt里，多余的寒暄只会污染正文。
 */
const buildSummaryPrompt = (existingSummary, batchText) => `你是一个长篇角色扮演故事的记忆整理模块。下面是这个故事到目前为止的"前情提要"（可能为空，代表这是第一次总结），以及最新发生的一段剧情。

请把新剧情自然地融合进旧的前情提要里，输出一份更新后的、完整的前情提要——保留对之后剧情有用的关键事件、人物关系变化、约定和伏笔，去掉无关的寒暄和重复细节，尽量精炼。只输出前情提要正文本身，不要加"前情提要："这类标题，不要加任何解释或客套话。

【已有的前情提要】
${existingSummary || '（暂无，这是第一次总结）'}

【最新发生的剧情】
${batchText}`;

/**
 * 检查是否该自动生成一次新的前情提要，够数就真的发一次AI请求。
 * activeMessages 必须是已经过滤掉 archived 的、按时间正序的全量消息。
 */
const maybeGenerateSummary = async (session, character, activeMessages) => {
  const turnsThresholdMessages = (session.summaryIntervalTurns || 50) * 2;
  const coveredThroughId = session.summaryCoveredThroughMessageId || 0;
  const newMessages = activeMessages.filter((m) => m.id > coveredThroughId);

  if (newMessages.length < turnsThresholdMessages) return;

  try {
    const batchText = newMessages
      .map((m) => {
        const speaker = m.senderType === 'user' ? (session.userName || '你') : (character?.name || 'TA');
        return `${speaker}: ${m.content}`;
      })
      .join('\n');

    const prompt = buildSummaryPrompt(session.summaryText, batchText);
    const newSummary = await generateResponse([{ role: 'user', content: prompt }]);

    await updateRpSessionSummary(session.id, {
      summaryText: String(newSummary || '').trim(),
      summaryCoveredThroughMessageId: newMessages[newMessages.length - 1].id,
    });

    notify({ type: 'RP_SUMMARY_UPDATED', sessionId: session.id });
  } catch (error) {
    // 总结失败不影响这一轮正常收发，静默失败——见文件顶部注释，下次发
    // 消息时条件仍然满足会自动重试，不需要在这里单独通知/重试。
    console.warn('[rpAiService] 自动总结失败，将在下次满足条件时重试:', error?.message || error);
  }
};

/**
 * 用户发一条消息：写入 rpMessages -> 通知界面刷新 -> 触发一次角色回复
 * -> 顺带检查一下是否该自动总结了。
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

  const allMessages = (await getRpMessages(session.id)).filter((m) => !m.archived);

  const replied = await generateAndWriteReply({
    session,
    character,
    historyForContext: allMessages,
    isReroll: false,
  });

  if (replied) {
    const messagesAfterReply = (await getRpMessages(session.id)).filter((m) => !m.archived);
    await maybeGenerateSummary(session, character, messagesAfterReply);
  }
};

/**
 * 重新生成某一条角色消息（必须是这个会话当前最后一条消息——UI 侧只在
 * 最后一条角色消息上显示"重新生成"按钮，这里不重复做这层校验，交给UI
 * 保证调用前提）。重新生成不产生新的"轮"，不会触发自动总结检查。
 */
export const rerollRpMessage = async (sessionId, messageId) => {
  const session = await getRpSessionById(sessionId);
  if (!session) return;

  const character = await db.characters.get(session.characterId);
  if (!character) return;

  const allMessages = (await getRpMessages(session.id)).filter((m) => !m.archived);
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

/**
 * 存档移出：包一层 rpMessageService.archiveRpMessagesBefore，顺便通知
 * 界面刷新（存档之后这些消息应该从渲染里彻底消失，不只是折叠）。
 */
export const archiveRpMessages = async (sessionId, beforeMessageId) => {
  await archiveRpMessagesBefore(sessionId, beforeMessageId);
  notify({ type: 'RP_MESSAGE_ADDED', sessionId: Number(sessionId) });
};

export default {
  subscribeRpAiEvents,
  sendRpMessage,
  rerollRpMessage,
  archiveRpMessages,
};