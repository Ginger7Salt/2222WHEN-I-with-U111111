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
// 会话绑定的预设 + 角色人设 + user人设 + 世界书注入 + 前情提要 + 历史占位），
// 历史由 rpPromptAssembler.buildRpHistoryContext 组装（按 contextWindowSize
// 截取 + 走一遍正则脚本的 prompt 阶段）。
//
// 切片E：世界书扫描——每次生成回复之前，从"最近 WORLD_BOOK_SCAN_WINDOW
// 条未存档消息"里找关键词命中，命中的条目（跨这个会话挂的所有世界书汇总，
// 不分书优先级，总数封顶 WORLD_BOOK_MAX_ENTRIES 条）拼成一段文本传给
// assembleRpSystemPrompt。这两个数字先给个能用的默认值，以后想调整
// 直接改这两个常量即可，不用改调用它们的逻辑。
//
// 切片D：已存档（archived）的消息在这个文件里被彻底当作不存在——不管是
// 拼历史文本、组装 contextWindowSize 截取用的数组，还是喂给自动总结的
// "新发生的剧情"，都先把 archived 的消息过滤掉。存档是"跟这个角色的AI
// 上下文永久说再见"，只靠前情提要记得它。
//
// 自动总结（跟用户确认过：现在就接全自动，每 summaryIntervalTurns 轮
// [= *2 条消息] 自动触发一次）：每次用户消息发送、角色也回复完之后，检查
// "上次总结覆盖到的消息之后，又新发生了多少条未存档消息"，够数就另外发
// 一次AI请求，只总结这一批新剧情，追加成 session.summaryEntries 里的一个
// 新条目——不是滚动覆盖成一份大文本（跟用户确认过：每次总结各自是独立
// 条目，可以在设置面板里单独编辑/删除）。"上次覆盖到哪条消息"直接看
// summaryEntries 最后一条的 coveredThroughMessageId。总结失败不影响这一轮
// 正常收发（静默失败，因为没有新条目写入，下次发消息时条件仍然满足，
// 等于自动重试）。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import { getRpSessionById, addRpSessionSummaryEntry } from './rpService';
import {
  getRpMessages,
  addRpMessage,
  appendRpMessageVersion,
  archiveRpMessagesBefore,
} from './rpMessageService';
import { getRpPresetById } from './rpPresetService';
import { scanRpWorldBooks } from './rpWorldBookService';
import { assembleRpSystemPrompt, buildRpHistoryContext } from './rpPromptAssembler';

const WORLD_BOOK_SCAN_WINDOW = 6;
const WORLD_BOOK_MAX_ENTRIES = 5;

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
const resolvePresetAndPrompt = async ({ session, character, historyForContext, historyText }) => {
  const preset = session.presetId ? await getRpPresetById(session.presetId) : null;
  const regexScripts = preset?.regexScripts || [];

  const scanText = historyForContext
    .slice(-WORLD_BOOK_SCAN_WINDOW)
    .map((m) => m.content)
    .join('\n');

  const worldBookText = await scanRpWorldBooks(
    session.attachedWorldBookIds,
    scanText,
    { maxEntries: WORLD_BOOK_MAX_ENTRIES }
  );

  // 把所有独立的总结条目按发生顺序拼成一段文本喂给AI——AI只需要看到连贯
  // 的前情提要正文，不需要知道底下其实是分开存的多个条目。
  const summaryText = (session.summaryEntries || []).map((entry) => entry.text).join('\n\n');

  const systemPrompt = assembleRpSystemPrompt({
    preset,
    character,
    session,
    worldBookText,
    summaryText,
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
      historyForContext,
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
 * 拼一段"总结这一批新剧情"的请求文本。只让AI输出这一段的总结正文本身，
 * 不要标题、不要客套话——这段文本会作为一个独立条目存进
 * session.summaryEntries，不再跟旧的提要文本融合（跟用户确认过：每次
 * 总结各自独立成条，不要把所有总结内容挤在一起）。
 */
const buildSummaryPrompt = (batchText) => `你是一个长篇角色扮演故事的记忆整理模块。下面是这个故事里最新发生的一段剧情。

请把这段剧情总结成一份简短的摘要——保留对之后剧情有用的关键事件、人物关系变化、约定和伏笔，去掉无关的寒暄和重复细节，尽量精炼。只输出摘要正文本身，不要加"总结："这类标题，不要加任何解释或客套话，也不需要提及这是第几次总结。

【这一段的剧情】
${batchText}`;

/**
 * 检查是否该自动生成一次新的总结条目，够数就真的发一次AI请求。
 * activeMessages 必须是已经过滤掉 archived 的、按时间正序的全量消息。
 */
const maybeGenerateSummary = async (session, character, activeMessages) => {
  const turnsThresholdMessages = (session.summaryIntervalTurns || 50) * 2;
  const existingEntries = session.summaryEntries || [];
  const coveredThroughId = existingEntries.length
    ? existingEntries[existingEntries.length - 1].coveredThroughMessageId || 0
    : 0;
  const newMessages = activeMessages.filter((m) => m.id > coveredThroughId);

  if (newMessages.length < turnsThresholdMessages) return;

  try {
    const batchText = newMessages
      .map((m) => {
        const speaker = m.senderType === 'user' ? (session.userName || '你') : (character?.name || 'TA');
        return `${speaker}: ${m.content}`;
      })
      .join('\n');

    const prompt = buildSummaryPrompt(batchText);
    const newSummary = await generateResponse([{ role: 'user', content: prompt }]);

    await addRpSessionSummaryEntry(session.id, {
      text: String(newSummary || '').trim(),
      coveredFromMessageId: newMessages[0].id,
      coveredThroughMessageId: newMessages[newMessages.length - 1].id,
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
 * 输入框为空时点发送按钮触发的"继续"（跟用户确认过的行为，UI侧在
 * RpRoom.jsx 里判断"输入框为空但会话里至少有一条消息"才会调用这个）：
 * 不新增任何用户消息，直接照当前完整的历史生成下一条角色回复——如果
 * 最后一条本来就是用户消息，效果就是"接着那条继续生成"；如果最后一条
 * 已经是角色的回复，效果就是"角色自己继续推进剧情"。这两种情况在这里
 * 是同一个操作，不需要分支处理。会正常触发自动总结检查，跟 sendRpMessage
 * 走的是同一套收尾逻辑。
 */
export const continueRpMessage = async (sessionId) => {
  const session = await getRpSessionById(sessionId);
  if (!session) return;

  const character = await db.characters.get(session.characterId);
  if (!character) return;

  const allMessages = (await getRpMessages(session.id)).filter((m) => !m.archived);
  if (allMessages.length === 0) return;

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
  continueRpMessage,
  rerollRpMessage,
  archiveRpMessages,
};