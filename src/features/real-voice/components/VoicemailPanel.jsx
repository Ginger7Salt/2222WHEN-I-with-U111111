import React, { useEffect, useRef, useState } from 'react';
import {
  Voicemail,
  Sparkles,
  Volume2,
  Play,
  Pause,
  Trash2,
  LoaderCircle,
} from 'lucide-react';

import GlassCard from '../../../components/GlassCard';
import { hasUsableMiniMaxVoiceProfile } from '../realVoiceDefaults';
import {
  generateVoicemailDraft,
  synthesizeVoicemailAudio,
} from '../voicemailGeneration';
import { VOICEMAIL_MAX_CHARS } from '../../../services/voicemailService';

// 语音信箱设置（角色编辑页里，铃声面板下面）。
// value 是 character.voicemail：{ text, audioBlob, mimeType, audioText, updatedAt }。
// 这里改的只是编辑页里的草稿状态，点编辑页右上角的保存后才会真正写进角色。
export default function VoicemailPanel({ value, character, onChange }) {
  const audioElRef = useRef(null);
  const objectUrlRef = useRef(null);

  // 异步生成完成时要拿"最新"的值，不能用点击当时的闭包。
  const valueRef = useRef(value);
  valueRef.current = value;
  const characterRef = useRef(character);
  characterRef.current = character;

  const [busy, setBusy] = useState(null); // null | 'draft' | 'voice'
  const [error, setError] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);

  const text = String(value?.text || '');
  const trimmedText = text.trim();
  const canSynthesize = hasUsableMiniMaxVoiceProfile(character?.voiceProfile);
  const hasAudio = Boolean(value?.audioBlob);
  const audioIsFresh = hasAudio && String(value?.audioText || '').trim() === trimmedText;

  const releasePreview = () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setIsPreviewing(false);
  };

  useEffect(() => () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const handleTextChange = (event) => {
    const nextText = Array.from(event.target.value).slice(0, VOICEMAIL_MAX_CHARS).join('');

    releasePreview();
    setError('');
    onChange({
      ...(valueRef.current || {}),
      text: nextText,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDraft = async () => {
    if (busy) return;

    setBusy('draft');
    setError('');

    try {
      const draft = await generateVoicemailDraft(characterRef.current);

      releasePreview();
      onChange({
        ...(valueRef.current || {}),
        text: draft,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Voicemail] 草稿生成失败：', err);
      setError(err?.message || '草稿没有生成成功，请稍后再试。');
    } finally {
      setBusy(null);
    }
  };

  const handleSynthesize = async () => {
    if (busy || !trimmedText) return;

    setBusy('voice');
    setError('');

    try {
      const result = await synthesizeVoicemailAudio({
        text: trimmedText,
        voiceProfile: characterRef.current?.voiceProfile,
      });

      releasePreview();
      onChange({
        ...(valueRef.current || {}),
        audioBlob: result.audioBlob,
        mimeType: result.mimeType,
        audioText: result.audioText,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Voicemail] 语音合成失败：', err);
      setError(err?.message || '语音没有生成成功，请稍后再试。');
    } finally {
      setBusy(null);
    }
  };

  const handleTogglePreview = () => {
    if (!audioIsFresh) return;

    if (isPreviewing) {
      audioElRef.current?.pause();
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    objectUrlRef.current = URL.createObjectURL(value.audioBlob);

    if (!audioElRef.current) {
      audioElRef.current = new Audio();
      audioElRef.current.addEventListener('ended', () => setIsPreviewing(false));
      audioElRef.current.addEventListener('pause', () => setIsPreviewing(false));
    }

    audioElRef.current.src = objectUrlRef.current;
    audioElRef.current.play().catch(() => {});
    setIsPreviewing(true);
  };

  const handleClear = () => {
    releasePreview();
    setError('');
    onChange(null);
  };

  const buttonClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 font-medium active:scale-95 transition-all disabled:opacity-40';

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center gap-2 font-bold text-sm">
        <Voicemail className="w-4 h-4" />
        <span>语音信箱 (Voicemail)</span>
      </div>

      <p className="opacity-60 text-[10px]">
        角色接不了电话时（比如处于离线状态），会自动留下这段话。
        {canSynthesize
          ? '有 MiniMax 声音，可以把它合成为语音：接不了电话时先播放语音，同时显示文字。语音只合成一次，之后每次直接播放，不会再产生费用。'
          : '这个角色还没有可用的 MiniMax 声音，接不了电话时只会显示文字。'}
        不写就保持原样，只显示「对方暂时无法接听」。留言不要写具体原因或时间，因为语音是提前合成的。
      </p>

      <div>
        <textarea
          rows={3}
          value={text}
          onChange={handleTextChange}
          placeholder="例如：我现在不方便接电话，晚点打给你。"
          className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none resize-y overflow-y-auto max-h-32 min-h-[48px]"
        />
        <p className="opacity-40 text-[10px] text-right mt-0.5">
          {Array.from(text).length}/{VOICEMAIL_MAX_CHARS}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleDraft}
          disabled={Boolean(busy)}
          className={buttonClass}
        >
          {busy === 'draft'
            ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />}
          <span>{busy === 'draft' ? '正在写...' : (trimmedText ? '让 TA 重新写一段' : '让 TA 写一段草稿')}</span>
        </button>

        {canSynthesize && (
          <button
            type="button"
            onClick={handleSynthesize}
            disabled={Boolean(busy) || !trimmedText}
            className={buttonClass}
          >
            {busy === 'voice'
              ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              : <Volume2 className="w-3.5 h-3.5" />}
            <span>{busy === 'voice' ? '正在合成...' : (audioIsFresh ? '重新生成语音' : '生成语音并保存')}</span>
          </button>
        )}

        {audioIsFresh && (
          <button type="button" onClick={handleTogglePreview} className={buttonClass}>
            {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPreviewing ? '暂停' : '试听'}</span>
          </button>
        )}

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={`${buttonClass} text-red-500`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清除</span>
          </button>
        )}
      </div>

      {canSynthesize && hasAudio && !audioIsFresh && (
        <p className="text-[10px] text-amber-600">
          文字改过了，之前生成的语音不会再播放。需要的话请重新生成语音。
        </p>
      )}

      {canSynthesize && audioIsFresh && (
        <p className="opacity-50 text-[10px]">已生成语音。记得保存角色，语音才会一起保存。</p>
      )}

      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </GlassCard>
  );
}