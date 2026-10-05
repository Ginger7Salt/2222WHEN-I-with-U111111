// src/apps/messages/loveProfile/LoveProfileSettings.jsx
//
// 设置页里的「情感偏好问卷」全局入口：填问卷 -> AI 分析并生成一段给聊天
// 角色看的行为指导 -> 用户可以手动改、也可以用自然语言反馈让 AI 再调整。
// 这里管的是"全局默认"，对所有聊天窗生效；某个聊天窗想单独调整或关闭，
// 在该聊天窗的设置里（ChatLoveProfileSection.jsx）覆盖。
//
// 渲染时不自带外框卡片，由 SettingsPage 用 <GlassCard> 包起来（见补丁说明）。

import React, { useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import { LOVE_PROFILE_SECTIONS, LOVE_PROFILE_QUESTIONNAIRE_VERSION } from './loveProfileQuestions';
import { validateLoveProfileSections, isQuestionnaireComplete } from './loveProfileSchema';
import {
  getGlobalLoveProfile,
  saveGlobalLoveProfile,
  clearGlobalLoveProfile,
  appendHistory,
  appendFeedbackLog,
} from './loveProfileService';
import { generateLoveProfilePrompt, reviseLoveProfilePrompt } from './loveProfileAiService';
import LoveProfileQuiz from './LoveProfileQuiz';
import LoveProfilePromptPanel from './LoveProfilePromptPanel';

const nowIso = () => new Date().toISOString();

export const LoveProfileSettings = () => {
  const [profile, setProfile] = useState(null);
  const [draftAnswers, setDraftAnswers] = useState({});
  const [phase, setPhase] = useState('home'); // 'home' | 'quiz'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const sectionsCheck = useMemo(() => validateLoveProfileSections(LOVE_PROFILE_SECTIONS), []);

  useEffect(() => {
    if (!sectionsCheck.ok) {
      console.warn('[loveProfile] 题目数据不合法：', sectionsCheck.errors);
    }
  }, [sectionsCheck]);

  useEffect(() => {
    let active = true;
    getGlobalLoveProfile()
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setDraftAnswers(p.answers || {});
      })
      .catch((err) => {
        console.error('[loveProfile] 读取失败：', err);
        if (active) setError('读取已保存的问卷失败。');
      });
    return () => {
      active = false;
    };
  }, []);

  if (!sectionsCheck.ok) {
    return (
      <div className="space-y-2 text-[11px] leading-relaxed">
        <p className="text-red-500">问卷题目数据格式有误，暂时无法使用。</p>
        <p style={{ color: 'var(--text-muted)' }}>{sectionsCheck.errors[0]}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        读取中...
      </p>
    );
  }

  const persist = async (next) => {
    const saved = await saveGlobalLoveProfile(next);
    setProfile(saved);
    return saved;
  };

  const runGenerate = async (baseProfile, answers) => {
    setBusy(true);
    setError('');
    try {
      const prompt = await generateLoveProfilePrompt({
        sections: LOVE_PROFILE_SECTIONS,
        answers,
      });

      const previous = baseProfile.generated?.prompt;
      await persist({
        ...baseProfile,
        answers,
        generated: {
          prompt,
          generatedAt: nowIso(),
          basedOnAnswersAt: baseProfile.answersUpdatedAt,
        },
        history: previous
          ? appendHistory(baseProfile.history, { prompt: previous, at: nowIso(), via: 'regenerate' })
          : baseProfile.history,
      });
      return true;
    } catch (err) {
      setError(err?.message || '生成失败，请稍后重试。');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleChangeAnswer = (questionId, next) => {
    setDraftAnswers((prev) => ({ ...prev, [questionId]: next }));
  };

  const saveDraft = async () => {
    // 回答没有变化时不写库，避免把"回答更新时间"白白刷新、
    // 导致界面误提示"你修改过回答"。
    const unchanged =
      JSON.stringify(draftAnswers) === JSON.stringify(profile.answers) &&
      profile.questionnaireVersion === LOVE_PROFILE_QUESTIONNAIRE_VERSION &&
      profile.answersUpdatedAt;

    if (unchanged) return profile;

    return persist({
      ...profile,
      answers: draftAnswers,
      answersUpdatedAt: nowIso(),
      questionnaireVersion: LOVE_PROFILE_QUESTIONNAIRE_VERSION,
    });
  };

  const handleSaveDraftAndExit = async () => {
    try {
      await saveDraft();
    } catch (err) {
      console.error('[loveProfile] 保存草稿失败：', err);
    }
    setPhase('home');
  };

  const handleSubmitQuiz = async () => {
    if (!isQuestionnaireComplete(LOVE_PROFILE_SECTIONS, draftAnswers)) return;

    setBusy(true);
    setError('');
    let saved;
    try {
      saved = await saveDraft();
    } catch (err) {
      setError('保存回答失败。');
      setBusy(false);
      return;
    }

    // 无论生成成功与否都回到首页：回答已经保存，失败的提示和"生成指导"
    // 重试按钮都在首页。
    await runGenerate(saved, draftAnswers);
    setPhase('home');
  };

  const handleRetryGenerate = async () => {
    await runGenerate(profile, profile.answers);
  };

  const handleRevise = async (feedback) => {
    setBusy(true);
    setError('');
    try {
      const prompt = await reviseLoveProfilePrompt({
        currentPrompt: profile.generated.prompt,
        feedback,
        sections: LOVE_PROFILE_SECTIONS,
        answers: profile.answers,
      });

      await persist({
        ...profile,
        generated: { ...profile.generated, prompt, generatedAt: nowIso() },
        history: appendHistory(profile.history, {
          prompt: profile.generated.prompt,
          at: nowIso(),
          via: 'feedback',
          feedback,
        }),
        feedbackLog: appendFeedbackLog(profile.feedbackLog, feedback),
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
        ...profile,
        generated: { ...profile.generated, prompt: text, generatedAt: nowIso() },
        history: appendHistory(profile.history, {
          prompt: profile.generated.prompt,
          at: nowIso(),
          via: 'manual',
        }),
      });
    } catch (err) {
      setError('保存修改失败。');
    }
  };

  const handleUndo = async () => {
    const last = profile.history[profile.history.length - 1];
    if (!last) return;

    try {
      await persist({
        ...profile,
        generated: { ...profile.generated, prompt: last.prompt, generatedAt: nowIso() },
        history: profile.history.slice(0, -1),
      });
    } catch (err) {
      setError('恢复失败。');
    }
  };

  const handleToggleEnabled = async () => {
    try {
      await persist({ ...profile, enabled: !profile.enabled });
    } catch (err) {
      setError('保存开关失败。');
    }
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    try {
      const empty = await clearGlobalLoveProfile();
      setProfile(empty);
      setDraftAnswers({});
      setError('');
    } catch (err) {
      setError('清除失败。');
    }
  };

  // ------------------------------------------------------------
  // 渲染
  // ------------------------------------------------------------

  if (phase === 'quiz') {
    return (
      <LoveProfileQuiz
        sections={LOVE_PROFILE_SECTIONS}
        answers={draftAnswers}
        submitting={busy}
        onChangeAnswer={handleChangeAnswer}
        onSubmit={handleSubmitQuiz}
        onCancel={handleSaveDraftAndExit}
      />
    );
  }

  const hasAnswers = Object.keys(profile.answers || {}).length > 0;
  const hasGenerated = Boolean(profile.generated?.prompt);
  const questionnaireOutdated =
    hasAnswers && profile.questionnaireVersion !== LOVE_PROFILE_QUESTIONNAIRE_VERSION;
  const answersChangedSinceGenerate =
    hasGenerated && profile.answersUpdatedAt !== profile.generated.basedOnAnswersAt;

  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Heart className="h-4 w-4" />
        <span>情感偏好问卷</span>
      </div>

      <p className="text-[11px] leading-relaxed opacity-60">
        回答几个关于"希望被怎样爱、哪些方式会不舒服"的问题，AI 会据此整理出一段指导，让聊天角色用更贴合你的方式表达关心。
        它只调节角色"怎么表达"，不会改变角色本身的性格。你的回答只会发送给你已配置的 AI 服务，用于生成这段指导。
      </p>

      {questionnaireOutdated && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--accent-color)' }}>
          题目已经更新，建议重新填写一次。
        </p>
      )}

      {!hasAnswers && (
        <button
          type="button"
          onClick={() => setPhase('quiz')}
          className="w-full px-4 py-2.5 rounded-xl text-[11px] font-semibold"
          style={{ background: 'var(--accent-color)', color: '#fff' }}
        >
          开始填写
        </button>
      )}

      {hasAnswers && !hasGenerated && (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed">
            已保存你的回答，但还没有生成指导。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !isQuestionnaireComplete(LOVE_PROFILE_SECTIONS, profile.answers)}
              onClick={handleRetryGenerate}
              className="flex-1 px-4 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent-color)', color: '#fff' }}
            >
              {busy ? '生成中...' : '生成指导'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPhase('quiz')}
              className="px-4 py-2 rounded-xl text-[11px] font-medium disabled:opacity-40"
              style={{ background: 'var(--divider)', color: 'var(--text-main)' }}
            >
              继续填写
            </button>
          </div>
          {error && <p className="text-[10px] text-red-500 leading-relaxed">{error}</p>}
        </div>
      )}

      {hasGenerated && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium">对所有聊天窗生效</p>
              <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                关闭后所有聊天窗都不再使用；单个聊天窗可以在自己的设置里单独调整或关闭。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profile.enabled}
              onClick={handleToggleEnabled}
              className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
              style={{ background: profile.enabled ? 'var(--accent-color)' : 'var(--divider)' }}
            >
              <span
                className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
                style={{
                  background: 'var(--bg-main)',
                  transform: profile.enabled ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>

          {answersChangedSinceGenerate && (
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--accent-color)' }}>
              你修改过回答，但指导还是旧的。可以点下面的"重新填写问卷"重新生成。
            </p>
          )}

          <LoveProfilePromptPanel
            prompt={profile.generated.prompt}
            busy={busy}
            error={error}
            canUndo={profile.history.length > 0}
            onUndo={handleUndo}
            onManualSave={handleManualSave}
            onRevise={handleRevise}
          />

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPhase('quiz')}
              className="text-[10px] hover:underline disabled:opacity-40"
            >
              重新填写问卷
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowResetConfirm(true)}
              className="text-[10px] text-red-500 hover:underline disabled:opacity-40"
            >
              清除全部回答和指导
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showResetConfirm}
        title="清除情感偏好"
        message="确定要清除你的问卷回答和已生成的指导吗？清除后所有聊天窗将不再使用这份偏好，操作无法恢复。"
        confirmText="清除"
        cancelText="保留"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
      />
    </div>
  );
};

export default LoveProfileSettings;