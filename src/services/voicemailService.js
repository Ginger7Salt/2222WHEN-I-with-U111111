// 语音信箱：角色接不了电话时，留给用户的一段话（文字 + 可选的、已经合成好的语音）。
//
// 数据按【角色】存，放在 character.voicemail：
//   { text, audioBlob, mimeType, audioText, updatedAt }
// audioBlob 存的是 Blob（和 character.ringtone 是同一个存法），
// audioText 是"这段语音合成时用的文字"。用户之后改了 text，audioText 就对不上了，
// 旧语音不会再被播放，需要重新生成，避免"屏幕上写的"和"耳朵里听到的"不一致。
//
// 注意：这个文件刻意不引入 aiService。aiService 会引入 callService，
// 而 callService 要用这里的函数，一旦这里再引入 aiService 就绕成环了。
// 需要调用 AI / 语音合成的部分放在 features/real-voice/voicemailGeneration.js。

export const VOICEMAIL_MAX_CHARS = 80;

// 有语音时，通话界面最长停留多久兜底（正常情况下是语音播完约 2 秒后就挂断）。
export const VOICEMAIL_AUDIO_SAFETY_MS = 60000;

// 语音播完之后再停留一会儿，让用户能看完文字。
export const VOICEMAIL_AFTER_PLAY_MS = 2000;

const isBlob = (value) => typeof Blob !== 'undefined' && value instanceof Blob;

/**
 * 读出角色当前"可以使用"的语音信箱；没写文字就返回 null。
 * audioBlob 只有在它对应的文字和当前文字一致时才会给出。
 */
export const getVoicemail = (character) => {
  const raw = character?.voicemail;
  const text = String(raw?.text ?? '').trim();

  if (!text) return null;

  const audioIsFresh = (
    isBlob(raw?.audioBlob)
    && raw.audioBlob.size > 0
    && String(raw?.audioText ?? '').trim() === text
  );

  return {
    text,
    audioBlob: audioIsFresh ? raw.audioBlob : null,
    mimeType: audioIsFresh ? (raw.mimeType || raw.audioBlob.type || 'audio/mpeg') : '',
  };
};

/**
 * 只有文字（没有语音）时，通话界面按字数估一个阅读时间。
 */
export const estimateVoicemailReadMs = (text) => {
  const length = Array.from(String(text || '')).length;
  return Math.min(16000, Math.max(4500, 3500 + length * 180));
};