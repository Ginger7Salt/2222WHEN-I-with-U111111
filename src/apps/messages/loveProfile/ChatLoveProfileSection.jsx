// src/apps/messages/loveProfile/ChatLoveProfileSection.jsx
//
// 聊天窗设置里的「情感偏好」单窗覆盖区块。全局默认在设置页填的问卷里；
// 这里让某一个聊天窗可以：
//   - 沿用全局（默认，什么都不用做）
//   - 为这个角色单独调整：写一句额外要求，AI 在全局回答的基础上重新生成
//     一份只用于这个聊天窗的指导
//   - 关闭：这个聊天窗不使用任何情感偏好指导
// 数据存在 db.chats 的 loveProfileOverride 字段（见 loveProfileService.js）。

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { LOVE_PROFILE_SECTIONS } from './loveProfileQuestions';
import { isQuestionnaireComplete } from './loveProfileSchema';
import {
  getGlobalLoveProfile,
  normalizeChatOverride,
  saveChatLoveProfileOverride,
  appendHistory,
  appendFeedbackLog,
} from './loveProfileService';
import { generateLoveProfilePrompt, reviseLoveProfilePrompt } from './loveProfileAiService';
import LoveProfilePromptPanel from './LoveProfilePromptPanel';

const MODE_OPTIONS = [
  { id: 'inherit', label: '沿用全局' },
  { id: 'adjust', label: '单独调整' },
  { id: 'off', label: '关闭' },
];

const nowIso = () => new Date().toISOString();

export const ChatLoveProfileSection = ({ chat, onUpdated }) => {
  const [override, setOverride] = useState(() => normalizeChatOverride(chat?.loveProfileOverride));
  const [adjustNoteDraft, setAdjustNoteDraft] = useState(
    () => normalizeChatOverride(chat?.loveProfileOverride).adjustNote
  );
  const [globalProfile, setGlobalProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getGlobalLoveProfile()
      .then((p) => {
        if (active) setGlobalProfile(p);
      })
      .catch((err) => console.warn('[loveProfile] 读取全局偏好失败：', err));
    return () => {
      active = false;
    };
  }, []);

  const globalReady =
    Boolean(globalProfile) &&
    isQuestionnaireComplete(LOVE_PROFILE_SECTIONS, globalProfile.answers || {}) &&
    Object.keys(globalProfile.answers || {}).length > 0;

  const persist = async (next) => {
    const saved = await saveChatLoveProfileOverride(chat.id, next);
    setOverride(saved);
    onUpdated?.({ loveProfileOverride: saved });
    return saved;
  };

  const handleModeChange = async (mode) => {
    if (mode === override.mode) return;
    setError('');
    try {
      await persist({ ...override, mode });
    } catch (err) {
      setError('保存失败。');
    }
  };

  const handleAdjustNoteBlur = async () => {
    if (adjustNoteDraft === override.adjustNote) return;
    try {
      await persist({ ...override, adjustNote: adjustNoteDraft });
    } catch (err) {
      setError('保存失败。');
    }
  };

  const handleGenerate = async () => {
    if (!globalReady || busy) return;

    setBusy(true);
    setError('');
    try {
      const prompt = await generateLoveProfilePrompt({
        sections: LOVE_PROFILE_SECTIONS,
        answers: globalProfile.answers,
        adjustNote: adjustNoteDraft,
      });

      await persist({
        ...override,
        adjustNote: adjustNoteDraft,
        prompt,
        generatedAt: nowIso(),
        history: override.prompt
          ? appendHistory(override.history, {
              prompt: override.prompt,
              at: nowIso(),
              via: 'regenerate',
            })
          : override.history,
      });
    } catch (err) {
      setError(err?.message || '生成失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = async (feedback) => {
    setBusy(true);
    setError('');
    try {
      const prompt = await reviseLoveProfilePrompt({
        currentPrompt: override.prompt,
        feedback,
        sections: LOVE_PROFILE_SECTIONS,
        answers: globalProfile?.answers || null,
      });

      await persist({
        ...override,
        prompt,
        generatedAt: nowIso(),
        history: appendHistory(override.history, {
          prompt: override.prompt,
          at: nowIso(),
          via: 'feedback',
          feedback,
        }),
        feedbackLog: appendFeedbackLog(override.feedbackLog, feedback),
      });
      return true;
    } catch (err) {
      setError(err?.message || '调整失败，请稍后重试。');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleManualSave = async (text) => {
    try {
      await persist({
        ...override,
        prompt: text,
        generatedAt: nowIso(),
        history: appendHistory(override.history, {
          prompt: override.prompt,
          at: nowIso(),
          via: 'manual',
        }),
      });
    } catch (err) {
      setError('保存修改失败。');
    }
  };

  const handleUndo = async () => {
    const last = override.history[override.history.length - 1];
    if (!last) return;
    try {
      await persist({
        ...override,
        prompt: last.prompt,
        generatedAt: nowIso(),
        history: override.history.slice(0, -1),
      });
    } catch (err) {
      setError('恢复失败。');
    }
  };

  const globalActive = Boolean(globalProfile?.enabled && globalProfile?.generated?.prompt);

  return (
    <div
      className="space-y-2.5 p-3.5 rounded-2xl border w-full"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex items-center gap-1.5 font-bold">
        <Heart className="w-3.5 h-3.5" />
        <span>情感偏好</span>
      </div>

      <p className="text-[10px] opacity-55 leading-relaxed">
        根据你在设置页填写的情感偏好问卷，调节这个角色表达关心的方式，不会改变角色的性格。
      </p>

      <div className="flex gap-1.5">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={busy}
            onClick={() => handleModeChange(opt.id)}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
            style={{
              background: override.mode === opt.id ? 'var(--accent-color)' : 'var(--divider)',
              color: override.mode === opt.id ? '#fff' : 'var(--text-main)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {override.mode === 'inherit' && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {globalActive
            ? '正在使用全局的情感偏好。'
            : '全局还没有可用的情感偏好。可以到设置页的"情感偏好问卷"里填写。'}
        </p>
      )}

      {override.mode === 'off' && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          这个聊天窗不会使用任何情感偏好指导。
        </p>
      )}

      {override.mode === 'adjust' && (
        <div className="space-y-2.5">
          {!globalReady && (
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--accent-color)' }}>
              需要先在设置页完成"情感偏好问卷"，才能在此基础上为这个角色单独调整。
            </p>
          )}

          <div className="space-y-1">
            <p className="text-[11px] font-medium">对这个角色的额外要求</p>
            <textarea
              rows={3}
              value={adjustNoteDraft}
              disabled={busy}
              placeholder="例如：这个角色比较内敛，别让 TA 太主动；或者：和 TA 聊天时我更想轻松一点。"
              onChange={(e) => setAdjustNoteDraft(e.target.value)}
              onBlur={handleAdjustNoteBlur}
              className="w-full p-2.5 rounded-xl border outline-none text-[11px] leading-relaxed resize-y min-h-[72px] disabled:opacity-50"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)',
              }}
            />
          </div>

          <button
            type="button"
            disabled={busy || !globalReady}
            onClick={handleGenerate}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent-color)', color: '#fff' }}
          >
            {busy ? '生成中...' : override.prompt ? '重新生成' : '生成这个角色的指导'}
          </button>

          {override.prompt && (
            <LoveProfilePromptPanel
              prompt={override.prompt}
              busy={busy}
              error={error}
              canUndo={override.history.length > 0}
              onUndo={handleUndo}
              onManualSave={handleManualSave}
              onRevise={handleRevise}
            />
          )}

          {!override.prompt && (
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              生成之前，这个聊天窗仍然使用全局的情感偏好。
            </p>
          )}
        </div>
      )}

      {error && !(override.mode === 'adjust' && override.prompt) && (
        <p className="text-[10px] text-red-500 leading-relaxed">{error}</p>
      )}
    </div>
  );
};

export default ChatLoveProfileSection;