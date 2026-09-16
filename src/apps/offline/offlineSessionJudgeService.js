import db from '../../db';
import { generateResponse } from '../../services/aiService';
import {
  getOfflineSession,
  acceptOfflineSessionProposal,
  declineOfflineSessionProposal,
} from './offlineSessionService';

const stripJsonFence = (value) => String(value || '').trim()
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

const parseDecisionJson = (content) => {
  const cleaned = stripJsonFence(content);

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first < 0 || last <= first) return null;

    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      return null;
    }
  }
};

const formatScheduledForText = (scheduledFor) => {
  try {
    return new Date(scheduledFor).toLocaleString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', weekday: 'long',
    });
  } catch {
    return String(scheduledFor);
  }
};

const postCharacterReplyMessage = async ({ chatId, characterId, content }) => {
  const nowIso = new Date().toISOString();

  return db.messages.add({
    chatId,
    characterId,
    mode: 'online',
    sender: 'character',
    type: 'text',
    content,
    metadata: {},
    isRead: false,
    timestamp: nowIso,
  });
};

/**
 * 用户提议线下见面时间后调用。判断结果会：
 * 1. 更新 offlineSessions 状态（accept -> scheduled / decline -> declined）
 * 2. 在线上聊天室里发一条角色回复消息，说明理由
 */
export const evaluateUserProposedOfflineSession = async (sessionId) => {
  const session = await getOfflineSession(sessionId);
  if (!session || session.status !== 'pending_review') return null;

  const chat = await db.chats.get(session.chatId);
  const character = await db.characters.get(session.characterId);
  if (!chat || !character) return null;

  const scheduledForText = formatScheduledForText(session.scheduledFor);

  const systemPrompt = `你正在扮演角色：${character.name}。
【角色人设】：${character.bio || '无'}
【补充设定】：${character.extraNotes || '无'}

用户向你提议了一次线下见面：
- 场景：${session.sceneLabel}
- 时间：${scheduledForText}

请你以角色的口吻、结合角色设定与性格，判断是否愿意接受这个时间。
只输出严格 JSON，不要 Markdown、不要解释：
{
  "decision": "accept 或 decline",
  "reply": "以角色口吻回复用户的一段话，说明同意或婉拒的理由，不超过80字"
}`;

  const rawContent = await generateResponse([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请给出你的判断。' },
  ]);

  const parsed = parseDecisionJson(rawContent);

  const decision = parsed?.decision === 'decline' ? 'decline' : 'accept';
  const replyText = String(parsed?.reply || '').trim()
    || (decision === 'accept' ? '好，这个时间我可以。' : '这个时间我可能没办法，改天再约吧。');

  if (decision === 'accept') {
    await acceptOfflineSessionProposal(sessionId);
  } else {
    await declineOfflineSessionProposal(sessionId);
  }

  await postCharacterReplyMessage({
    chatId: session.chatId,
    characterId: session.characterId,
    content: replyText,
  });

  return { decision, replyText };
};