import React, { useCallback, useEffect, useState } from 'react';

import {
  loadRoutineProfile,
  saveRoutineProfilePatch,
  syncRoutineObservations,
} from '../services/almanacRoutineProfileService';

import { ROUTINE_TYPES, formatHour } from '../services/almanacRoutineProfileLogic';

import {
  generateCharacterPortrait,
  setPortraitEnabled,
  editCharacterPortrait,
  canManuallyRegeneratePortrait,
} from '../services/almanacCharacterPortraitService';

import { PORTRAIT_MIN_MESSAGES } from '../services/almanacCharacterPortraitLogic';

import './almanacRoutineProfile.css';

const CONFIDENCE_TEXT = {
  low: '把握较低',
  medium: '把握中等',
  high: '把握较高',
};

const STATUS_TEXT = {
  guess: 'TA 猜的',
  confirmed: '你确认了',
  edited: '你改过',
  closed: '已关闭',
};

const SOURCE_TEXT = {
  declared: '你自己选的',
  schedule: '根据你记下的日程',
  inferred: '根据近期的时间分布，只是猜测',
};

const MAX_NOTE_LENGTH = 300;
const MAX_TEXT_LENGTH = 120;

const Dots = ({ done, total }) => (
  <div className="arp-dots" aria-hidden="true">
    {Array.from({ length: total }, (_, index) => (
      <span key={index} className={index < done ? 'arp-dot is-done' : 'arp-dot'} />
    ))}
  </div>
);

export const AlmanacRoutineProfile = ({
  chatId,
  characterName = 'TA',
  records = [],
  onConfigSaved,
}) => {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [pickingType, setPickingType] = useState(false);
  const [editingGuidance, setEditingGuidance] = useState(false);
  const [guidanceDraft, setGuidanceDraft] = useState('');
  const [editingObsId, setEditingObsId] = useState(null);
  const [obsDraft, setObsDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitError, setPortraitError] = useState('');
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [portraitTraitDraft, setPortraitTraitDraft] = useState('');
  const [portraitReasonDraft, setPortraitReasonDraft] = useState('');

  const name = characterName || 'TA';

  const reload = useCallback(async () => {
    if (!chatId) return;

    try {
      const { config, view: nextView } = await loadRoutineProfile({ chatId, records });

      setView(nextView);
      setNoteDraft(nextView.declaredNote || '');

      const synced = await syncRoutineObservations(chatId, config, nextView.observations);
      if (synced && onConfigSaved) onConfigSaved(synced);

      setError('');
    } catch (loadError) {
      console.error('[Almanac] 读取作息画像失败：', loadError);
      setError('读取失败了，可以稍后再试一次。');
    }
    // onConfigSaved 由父组件传入，不参与重新读取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, records]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const apply = async (patch) => {
    try {
      const saved = await saveRoutineProfilePatch(chatId, patch);
      if (onConfigSaved) onConfigSaved(saved);
      await reload();
    } catch (saveError) {
      console.error('[Almanac] 保存作息画像失败：', saveError);
      setError('保存失败了，可以再试一次。');
    }
  };

  const updateObservation = (id, changes) => {
    const next = (view?.observations || []).map((item) =>
      item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item
    );

    return apply({ observations: next });
  };

  const togglePortrait = async (enabled) => {
    try {
      setPortraitError('');
      const saved = await setPortraitEnabled(chatId, enabled);
      if (onConfigSaved) onConfigSaved(saved);
      await reload();
    } catch (toggleError) {
      console.error('[Almanac] 切换角色画像开关失败：', toggleError);
      setPortraitError('切换失败了，可以再试一次。');
    }
  };

  const runGeneratePortrait = async () => {
    setPortraitBusy(true);
    setPortraitError('');

    try {
      const { config: saved } = await generateCharacterPortrait(chatId);
      if (onConfigSaved) onConfigSaved(saved);
      await reload();
    } catch (generateError) {
      console.error('[Almanac] 生成角色画像失败：', generateError);
      setPortraitError(generateError?.message || '生成失败了，可以再试一次。');
    } finally {
      setPortraitBusy(false);
    }
  };

  const saveEditedPortrait = async () => {
    try {
      const saved = await editCharacterPortrait(chatId, {
        trait: portraitTraitDraft,
        reason: portraitReasonDraft,
      });
      if (onConfigSaved) onConfigSaved(saved);
      setEditingPortrait(false);
      await reload();
    } catch (editError) {
      console.error('[Almanac] 保存角色画像失败：', editError);
      setPortraitError('保存失败了，可以再试一次。');
    }
  };

  if (!chatId) return null;

  if (!view) {
    return (
      <div className="arp-root">
        <p className="arp-muted">正在翻开这一页</p>
      </div>
    );
  }

  const learning = !view.typeId;
  const visibleObservations = view.observations || [];

  const portrait = (() => {
    if (!view.typeId) return '';
    if (view.source === 'declared') return `你告诉 ${name}，你是「${view.typeLabel}」这一类。`;
    if (view.source === 'schedule') return `按你记下的日程，${name} 觉得你是「${view.typeLabel}」这一类。`;
    const peak = view.peakHour === null ? '' : `，${formatHour(view.peakHour)}前后最常出现`;
    return `${name} 觉得你大概是「${view.typeLabel}」这一类${peak}。`;
  })();

  return (
    <div className="arp-root">
            {error && <p className="arp-error">{error}</p>}

      {/* 画像与作息类型 */}
      <section className="arp-card">

        <div className="arp-page-inner">
          <p className="arp-kicker">{learning ? 'STILL LEARNING' : `${name} 眼中的你`}</p>

          {learning ? (
            <>
              <h3 className="arp-title">
                {view.daysLeft > 0
                  ? `再过 ${view.daysLeft} 天，${name} 就会大概了解你的作息`
                  : `${name} 还需要多聊几句，才敢下判断`}
              </h3>
              <p className="arp-body">
                {name} 会留意你一般几点出现、几点安静下来。这只是对时间的统计，不是读心，
                {view.daysLeft > 0
                  ? `现在只有 ${view.dayCount} 天的记录，还不敢乱猜。`
                  : '天数够了，但消息还偏少，再多相处一阵就好。'}
              </p>
              <div className="arp-progress">
                <Dots done={Math.min(view.dayCount, view.requiredDays)} total={view.requiredDays} />
                <span className="arp-hand arp-progress-text">
                  {Math.min(view.dayCount, view.requiredDays)} / {view.requiredDays}
                </span>
              </div>
            </>
          ) : (
            <>
              <h3 className="arp-title">{view.typeLabel}</h3>
              <p className="arp-body">{portrait}</p>
              <p className="arp-meta">
                {SOURCE_TEXT[view.source]}
                {view.source === 'inferred' && `，依据 ${view.dayCount} 天`}
              </p>

              <div className="arp-guidance">
                <span className="arp-label">所以 {name} 会这样对你</span>

                {editingGuidance ? (
                  <>
                    <textarea
                      className="arp-textarea"
                      value={guidanceDraft}
                      maxLength={MAX_TEXT_LENGTH}
                      rows={3}
                      onChange={(event) => setGuidanceDraft(event.target.value)}
                    />
                    <div className="arp-row">
                      <button
                        type="button"
                        className="arp-link"
                        onClick={async () => {
                          await apply({ guidance: guidanceDraft.trim() });
                          setEditingGuidance(false);
                        }}
                      >
                        保存
                      </button>
                      <button type="button" className="arp-link" onClick={() => setEditingGuidance(false)}>
                        取消
                      </button>
                      {view.guidanceIsCustom && (
                        <button
                          type="button"
                          className="arp-link"
                          onClick={async () => {
                            await apply({ guidance: '' });
                            setEditingGuidance(false);
                          }}
                        >
                          恢复默认
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="arp-hand arp-guidance-text">{view.guidance}</p>
                    <button
                      type="button"
                      className="arp-link"
                      onClick={() => {
                        setGuidanceDraft(view.guidance);
                        setEditingGuidance(true);
                      }}
                    >
                      改一改
                    </button>
                    {view.guidanceIsCustom && <span className="arp-meta"> 已按你的话来</span>}
                  </>
                )}
              </div>
            </>
          )}

          <div className="arp-type-actions">
            <button type="button" className="arp-link" onClick={() => setPickingType((value) => !value)}>
              {pickingType ? '收起' : learning ? '我想自己告诉 TA 我的作息类型' : '换一个类型'}
            </button>

            {view.source === 'declared' && (
              <button
                type="button"
                className="arp-link"
                onClick={() =>
                  apply({ chronotype: null, chronotypeSource: null, guidance: '' })
                }
              >
                交还给 {name} 自己判断
              </button>
            )}
          </div>

          {pickingType && (
            <ul className="arp-type-list">
              {ROUTINE_TYPES.map((type) => (
                <li key={type.id}>
                  <button
                    type="button"
                    className={type.id === view.typeId ? 'arp-type is-active' : 'arp-type'}
                    onClick={async () => {
                      await apply({
                        chronotype: type.id,
                        chronotypeSource: 'declared',
                        guidance: '',
                      });
                      setPickingType(false);
                    }}
                  >
                    <strong>{type.label}</strong>
                    <span>{type.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 观察记录 */}
      <section className="arp-card">

        <div className="arp-page-inner">
          <p className="arp-kicker">OBSERVATIONS</p>
          <h3 className="arp-title">{name} 悄悄记下的</h3>

          {visibleObservations.length === 0 ? (
            <p className="arp-body">
              {learning
                ? '记录还不够，先空着。观察够了，这里才会多出一条。'
                : '目前没有值得记的观察。'}
            </p>
          ) : (
            <ul className="arp-obs-list">
              {visibleObservations.map((item) => {
                const closed = item.status === 'closed';
                const editing = editingObsId === item.id;

                return (
                  <li key={item.id} className={closed ? 'arp-obs is-closed' : 'arp-obs'}>
                    {editing ? (
                      <>
                        <textarea
                          className="arp-textarea"
                          value={obsDraft}
                          maxLength={MAX_TEXT_LENGTH}
                          rows={3}
                          onChange={(event) => setObsDraft(event.target.value)}
                        />
                        <div className="arp-row">
                          <button
                            type="button"
                            className="arp-link"
                            disabled={!obsDraft.trim()}
                            onClick={async () => {
                              await updateObservation(item.id, {
                                text: obsDraft.trim(),
                                status: 'edited',
                                enabled: true,
                              });
                              setEditingObsId(null);
                            }}
                          >
                            保存
                          </button>
                          <button type="button" className="arp-link" onClick={() => setEditingObsId(null)}>
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="arp-hand arp-obs-text">{item.text}</p>
                        <p className="arp-meta">
                          {STATUS_TEXT[item.status] || STATUS_TEXT.guess}
                          {item.source === 'inferred' && item.status !== 'edited' &&
                            ` · 依据 ${item.evidenceDays} 天 · ${CONFIDENCE_TEXT[item.confidence] || ''}`}
                          {closed && ' · 不会告诉 TA'}
                        </p>
                        <div className="arp-row">
                          {closed ? (
                            <button
                              type="button"
                              className="arp-link"
                              onClick={() => updateObservation(item.id, { status: 'guess', enabled: true })}
                            >
                              重新打开
                            </button>
                          ) : (
                            <>
                              {item.status !== 'confirmed' && (
                                <button
                                  type="button"
                                  className="arp-link"
                                  onClick={() =>
                                    updateObservation(item.id, { status: 'confirmed', enabled: true })
                                  }
                                >
                                  确实是这样
                                </button>
                              )}
                              <button
                                type="button"
                                className="arp-link"
                                onClick={() => {
                                  setObsDraft(item.text);
                                  setEditingObsId(item.id);
                                }}
                              >
                                改一改
                              </button>
                              <button
                                type="button"
                                className="arp-link"
                                onClick={() =>
                                  updateObservation(item.id, { status: 'closed', enabled: false })
                                }
                              >
                                关掉
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 更深一层的印象（AI 根据聊天内容写的） */}
      <section className="arp-card">
        <div className="arp-page-inner">
          <p className="arp-kicker">A DEEPER IMPRESSION</p>
          <h3 className="arp-title">更深一层的印象</h3>
          <p className="arp-body">
            这一项会让 {name} 真的读一遍你们聊过的一些内容，写一句 TA 眼里你是个什么样的人，并说明理由。
            跟上面按时间统计出来的观察不一样，这项默认关闭，需要你自己打开，而且每次生成都会用到你配置的 API。
          </p>

          <label className="arp-switch-row">
            <span>
              <strong>打开这一项</strong>
              <small>关闭后不会调用 AI，已经生成过的内容还留着，重新打开还能看到。</small>
            </span>
            <input
              type="checkbox"
              className="arp-switch"
              checked={view.portraitEnabled}
              onChange={(event) => void togglePortrait(event.target.checked)}
            />
          </label>

          {view.portraitEnabled && (
            <>
              {portraitError && <p className="arp-error">{portraitError}</p>}

              {view.totalUserMessages < PORTRAIT_MIN_MESSAGES ? (
                <p className="arp-meta">
                  还需要再多聊一些（目前 {view.totalUserMessages} / {PORTRAIT_MIN_MESSAGES} 句），
                  内容太少的话 {name} 也写不出什么靠谱的印象。
                </p>
              ) : editingPortrait ? (
                <>
                  <label className="arp-label" htmlFor="arp-portrait-trait">
                    印象（一句话）
                  </label>
                  <textarea
                    id="arp-portrait-trait"
                    className="arp-textarea"
                    value={portraitTraitDraft}
                    maxLength={40}
                    rows={2}
                    onChange={(event) => setPortraitTraitDraft(event.target.value)}
                  />
                  <label className="arp-label" htmlFor="arp-portrait-reason">
                    理由
                  </label>
                  <textarea
                    id="arp-portrait-reason"
                    className="arp-textarea"
                    value={portraitReasonDraft}
                    maxLength={200}
                    rows={3}
                    onChange={(event) => setPortraitReasonDraft(event.target.value)}
                  />
                  <div className="arp-row">
                    <button
                      type="button"
                      className="arp-link"
                      disabled={!portraitTraitDraft.trim()}
                      onClick={saveEditedPortrait}
                    >
                      保存
                    </button>
                    <button type="button" className="arp-link" onClick={() => setEditingPortrait(false)}>
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {view.portrait ? (
                    <>
                      <p className="arp-hand arp-guidance-text">{view.portrait.trait}</p>
                      {view.portrait.reason && <p className="arp-body">{view.portrait.reason}</p>}
                      <p className="arp-meta">
                        {view.portrait.status === 'edited' ? '你改过' : `${name} 写的`}
                        {view.portrait.generatedAt &&
                          ` · ${new Date(view.portrait.generatedAt).toLocaleDateString()}`}
                      </p>
                    </>
                  ) : (
                    <p className="arp-body">还没生成过，点下面的按钮试试。</p>
                  )}

                  <div className="arp-row">
                    <button
                      type="button"
                      className="arp-link"
                      disabled={
                        portraitBusy ||
                        !canManuallyRegeneratePortrait({
                          enabled: view.portraitEnabled,
                          totalUserMessages: view.totalUserMessages,
                          portrait: view.portrait,
                        }).allowed
                      }
                      onClick={runGeneratePortrait}
                    >
                      {portraitBusy ? '正在生成…' : view.portrait ? '重新生成' : '生成'}
                    </button>

                    {view.portrait && (
                      <button
                        type="button"
                        className="arp-link"
                        onClick={() => {
                          setPortraitTraitDraft(view.portrait.trait || '');
                          setPortraitReasonDraft(view.portrait.reason || '');
                          setEditingPortrait(true);
                        }}
                      >
                        改一改
                      </button>
                    )}
                  </div>

                  {view.portrait &&
                    (() => {
                      const check = canManuallyRegeneratePortrait({
                        enabled: view.portraitEnabled,
                        totalUserMessages: view.totalUserMessages,
                        portrait: view.portrait,
                      });
                      if (check.allowed || check.reason !== 'cooldown') return null;
                      const hours = Math.max(1, Math.ceil(check.retryAfterMs / 3600000));
                      return <p className="arp-meta">大概 {hours} 小时后才能再重新生成一次。</p>;
                    })()}
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* 我来告诉 TA */}
      <section className="arp-card">

        <div className="arp-page-inner">
          <p className="arp-kicker">IN YOUR OWN WORDS</p>
          <h3 className="arp-title">我来告诉 {name}</h3>
          <p className="arp-body">
            比如“我是夜班，周一到周四”。你亲口说的，比任何猜测都优先。偏好和喜好请放进记忆里，这里只写作息和相处方式。
          </p>

          <textarea
            className="arp-textarea arp-note"
            value={noteDraft}
            maxLength={MAX_NOTE_LENGTH}
            rows={4}
            placeholder="想让 TA 知道的作息或相处方式"
            onChange={(event) => {
              setNoteDraft(event.target.value);
              setNoteSaved(false);
            }}
          />

          <div className="arp-row">
            <button
              type="button"
              className="arp-link"
              disabled={noteDraft.trim() === (view.declaredNote || '')}
              onClick={async () => {
                await apply({ declaredNote: noteDraft.trim() });
                setNoteSaved(true);
              }}
            >
              保存
            </button>
            <span className="arp-meta">
              {noteSaved ? '已经告诉 TA 了' : `${noteDraft.length} / ${MAX_NOTE_LENGTH}`}
            </span>
          </div>
        </div>
      </section>

      {/* 总开关 */}
      <label className="arp-switch-row">
        <span>
          <strong>让 {name} 参考这份画像</strong>
          <small>
            关闭后，上面这些都不会写进 {name} 的提示词。你随时可以改，也可以关掉任何一项。
          </small>
        </span>

        <input
          type="checkbox"
          className="arp-switch"
          checked={view.enabled}
          onChange={(event) => void apply({ enabled: event.target.checked })}
        />
      </label>
    </div>
  );
};

export default AlmanacRoutineProfile;