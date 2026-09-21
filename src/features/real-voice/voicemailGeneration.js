import { generateResponse } from '../../services/aiService';
import { buildRhythmPersonaBrief } from '../../services/rhythmReminderService';
import { VOICEMAIL_MAX_CHARS } from '../../services/voicemailService';
import { synthesizeMiniMaxSpeech } from './minimaxClient';
import { hasUsableMiniMaxVoiceProfile } from './realVoiceDefaults';

// 把 AI 返回的文字整理成一段干净的留言：去掉引号 / 代码围栏、
// 把多段合成一段、去掉 emoji（全站不用 emoji，语音合成也会把它读得很怪）。
const cleanDraft = (raw) => {
  let text = String(raw || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\s*\|\|\|\s*/g, ' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  text = text.replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, '').trim();

  return Array.from(text).slice(0, VOICEMAIL_MAX_CHARS).join('');
};

/**
 * 让 AI 按角色人设写一段语音信箱留言草稿（只返回文字，用户可以再编辑）。
 * 内容刻意写得通用：语音是提前合成、之后反复播放的，不能带具体原因或时间。
 */
export const generateVoicemailDraft = async (character) => {
  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

  const systemPrompt = `你是「${character?.name || '角色'}」。
性格人设：${character?.bio || '体贴细腻'}。${worldBookText}${extraNotesText}

用户刚刚给你打了电话，但你现在没办法接。请以你自己的口吻，写一段自动播放的语音信箱留言。
要求：
- 只写 1 到 2 句短话，总共不超过 50 个字。
- 用你平时和用户聊天时使用的语言和语气。
- 内容要通用：表达"现在不方便接电话，晚点会联系你"的意思即可。不要写具体原因、具体时间、具体地点，因为这段话会被提前录好、以后每次都播放。
- 不要使用 emoji，不要写括号里的动作或旁白，不要加引号。
- 只输出留言本身，不要任何解释。`;

  const reply = await generateResponse([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请写这段语音信箱留言。' },
  ]);

  const draft = cleanDraft(reply);

  if (!draft) {
    throw new Error('AI 没有返回可用的内容，请再试一次。');
  }

  return draft;
};

/**
 * 用角色的 MiniMax 声音把留言合成为语音（只合成这一次，结果由调用方存起来）。
 */
export const synthesizeVoicemailAudio = async ({ text, voiceProfile }) => {
  if (!hasUsableMiniMaxVoiceProfile(voiceProfile)) {
    throw new Error('这个角色还没有可用的 MiniMax 声音。');
  }

  const cleanText = String(text || '').trim();

  if (!cleanText) {
    throw new Error('请先写下留言文字。');
  }

  const result = await synthesizeMiniMaxSpeech({ text: cleanText, voiceProfile });

  return {
    audioBlob: result.audioBlob,
    mimeType: result.mimeType || result.audioBlob?.type || 'audio/mpeg',
    audioText: cleanText,
  };
};