import React, { useCallback, useEffect, useState } from 'react';

import {
  loadRoutineProfile,
  saveRoutineProfilePatch,
  syncRoutineObservations,
} from '../services/almanacRoutineProfileService';

import { ROUTINE_TYPES, formatHour } from '../services/almanacRoutineProfileLogic';

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