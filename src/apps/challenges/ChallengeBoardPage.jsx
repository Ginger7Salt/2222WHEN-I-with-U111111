import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Stamp, Plus, Music2, X, Pencil } from 'lucide-react';

import {
  getOrCreateChallengeBoard,
  updatePolaroidSlot,
  addPlaylistTrack,
  removePlaylistTrack,
  saveLoveMemoNote,
  getPresets,
  createUserAssignedTask,
  completeTaskWithNote,
  getTasksForChat,
  deleteTask,
} from './challengeService';
import './challengeBoard.css';

// ============================================================
// 异地任务挑战（情侣任务打卡板）—— Slice A 的面板外壳。
//
// 这一版只接了数据模型 + 能手动摆弄的部分：拍立得上传/文案、歌单增删、
// 情书便签手写保存、"+添加任务"（用户发起，自定义文字或从模板库选）、
// 角色发起任务的用户完成+感想。角色自己什么时候决定完成"用户发起"的
// 任务、角色自主判断给用户派新任务、便签真正由角色生成——这些都要等
// 下一个切片接上AI调用之后才会真的动起来，这一版它们只是数据结构已经
// 留好了位置，UI上如实展示"待TA自己来完成"而不是假装能点。
// ============================================================

const ADD_TASK_SOURCES = [
  { key: 'custom', label: '自定义文字' },
  { key: 'questionnaire', label: '情侣问卷' },
  { key: 'task', label: '情侣任务' },
];

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

const ChallengeBoardPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [questionnairePresets, setQuestionnairePresets] = useState([]);
  const [taskPresets, setTaskPresets] = useState([]);

  const [memoDraft, setMemoDraft] = useState('');
  const [memoDirty, setMemoDirty] = useState(false);

  const [trackDraft, setTrackDraft] = useState({ title: '', artist: '', url: '' });

  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskSource, setAddTaskSource] = useState('custom');
  const [addTaskText, setAddTaskText] = useState('');
  const [addTaskPresetId, setAddTaskPresetId] = useState('');

  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [completionDraft, setCompletionDraft] = useState('');

  const fileInputRefs = useRef({});
  const mountedRef = useRef(true);

  const reloadAll = async () => {
    const [nextBoard, nextTasks] = await Promise.all([
      getOrCreateChallengeBoard(chatId),
      getTasksForChat(chatId),
    ]);
    if (!mountedRef.current) return;
    setBoard(nextBoard);
    setTasks(nextTasks);
    setMemoDraft(nextBoard?.memoNote || '');
    setMemoDirty(false);
  };

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      const [nextBoard, nextTasks, qPresets, tPresets] = await Promise.all([
        getOrCreateChallengeBoard(chatId),
        getTasksForChat(chatId),
        getPresets('questionnaire'),
        getPresets('task'),
      ]);
      if (!mountedRef.current) return;
      setBoard(nextBoard);
      setTasks(nextTasks);
      setQuestionnairePresets(qPresets);
      setTaskPresets(tPresets);
      setMemoDraft(nextBoard?.memoNote || '');
      setIsLoading(false);
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [chatId]);

  const polaroids = useMemo(() => {
    const list = board?.polaroids || [];
    return [0, 1, 2].map((slot) => list.find((p) => p.slot === slot) || { slot, imageBase64: null, caption: '' });
  }, [board]);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const customTasks = tasks.filter((t) => t.sourceType === 'custom');
  const presetTasks = tasks.filter((t) => t.sourceType === 'preset');

  const handlePolaroidFileChange = async (slot, file) => {
    if (!file) return;
    await updatePolaroidSlot(chatId, slot, { file });
    reloadAll();
  };

  const handlePolaroidCaptionBlur = async (slot, caption) => {
    await updatePolaroidSlot(chatId, slot, { caption });
    reloadAll();
  };

  const handleAddTrack = async () => {
    if (!trackDraft.title.trim()) return;
    await addPlaylistTrack(chatId, trackDraft);
    setTrackDraft({ title: '', artist: '', url: '' });
    reloadAll();
  };

  const handleRemoveTrack = async (trackId) => {
    await removePlaylistTrack(chatId, trackId);
    reloadAll();
  };

  const handleSaveMemo = async () => {
    await saveLoveMemoNote(chatId, memoDraft);
    reloadAll();
  };

  const resetAddTaskForm = () => {
    setShowAddTask(false);
    setAddTaskSource('custom');
    setAddTaskText('');
    setAddTaskPresetId('');
  };

  const handleSubmitAddTask = async () => {
    if (addTaskSource === 'custom') {
      if (!addTaskText.trim()) return;
      await createUserAssignedTask(chatId, { sourceType: 'custom', content: addTaskText });
    } else {
      const presetList = addTaskSource === 'questionnaire' ? questionnairePresets : taskPresets;
      const preset = presetList.find((p) => String(p.id) === String(addTaskPresetId));
      if (!preset) return;
      await createUserAssignedTask(chatId, {
        sourceType: 'preset',
        content: preset.text,
        sourcePresetId: preset.id,
      });
    }
    resetAddTaskForm();
    reloadAll();
  };

  const handleConfirmCompletion = async (taskId) => {
    if (!completionDraft.trim()) return;
    await completeTaskWithNote(taskId, completionDraft);
    setCompletingTaskId(null);
    setCompletionDraft('');
    reloadAll();
  };

  const handleDeleteTask = async (taskId) => {
    await deleteTask(taskId);
    reloadAll();
  };

  const renderTaskCard = (task) => {
    const isCompleted = task.status === 'completed';
    const isUserAssigned = task.assignedBy === 'user'; // 用户发起，角色完成
    const directionLabel = isUserAssigned ? '想让TA完成' : 'TA想让你完成';

    return (
      <div key={task.id} className={`cb-challenge-card${isCompleted ? ' is-completed' : ''}`}>
        <div className="cb-challenge-info-left">
          <span className="cb-challenge-num">{directionLabel}</span>
          <span className="cb-challenge-text">{task.content}</span>
          <span className="cb-challenge-meta">
            {isCompleted
              ? `已于 ${formatDate(task.completedAt)} 达成${task.completionNote ? ` · ${task.completionNote}` : ''}`
              : isUserAssigned
                ? '待TA自己来完成'
                : '点击盖上浪漫印章'}
          </span>
        </div>

        {isCompleted ? (
          <div className="cb-stamp-badge">
            <span>✓ 达成</span>
          </div>
        ) : isUserAssigned ? (
          <div className="cb-stamp-badge is-waiting">
            <span>等待TA</span>
          </div>
        ) : completingTaskId === task.id ? null : (
          <button
            type="button"
            className="cb-stamp-badge"
            onClick={() => {
              setCompletingTaskId(task.id);
              setCompletionDraft('');
            }}
          >
            <span>PLEDGE</span>
          </button>
        )}

        {!isUserAssigned && !isCompleted && (
          <button
            type="button"
            onClick={() => handleDeleteTask(task.id)}
            className="cb-track-remove-btn"
            title="删除"
            style={{ position: 'absolute', top: 6, right: 6 }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up"
      style={{ background: 'var(--bg-main)' }}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
          style={{ background: 'var(--control-soft-bg)' }}
          title="返回"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Stamp className="h-4 w-4" />
        <span className="text-sm font-medium">
          {character?.name ? `和${character.name}的异地任务挑战` : '异地任务挑战'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto challenge-board-page">
        {isLoading ? null : (
          <div className="cb-scroll-area">
            <div className="cb-paper-film-grain" />
            <div className="cb-diffuse-stage">
              <div className="cb-diffuse-orb cb-orb-rose" />
              <div className="cb-diffuse-orb cb-orb-wine" />
              <div className="cb-diffuse-orb cb-orb-amber" />
            </div>

            <div className="cb-magazine-page">
              <div className="cb-magazine-inner-frame">
                {/* 报头 */}
                <header className="cb-masthead">
                  <div className="cb-masthead-topline">
                    <span>OUR PACT</span>
                    <span>SPECIAL EDITION</span>
                    <span>{new Date().getFullYear()}</span>
                  </div>
                  <div className="cb-masthead-title-wrap">
                    <div className="cb-title-script">Our Challenges</div>
                    <div className="cb-title-editorial">异地任务挑战存根</div>
                  </div>
                  <div className="cb-masthead-sub-badge">
                    <span>✦ 我们的心动挑战存根 ✦</span>
                  </div>
                </header>

                {/* 拍立得画廊 */}
                <section className="cb-polaroid-gallery">
                  {polaroids.map((p, idx) => {
                    const tiltClass =
                      idx === 0 ? 'cb-polaroid-tilt-left' : idx === 1 ? 'cb-polaroid-tilt-center' : 'cb-polaroid-tilt-right';
                    return (
                      <div key={p.slot} className={`cb-polaroid-frame ${tiltClass}`}>
                        <div
                          className="cb-polaroid-image-box"
                          style={p.imageBase64 ? { backgroundImage: `url(${p.imageBase64})` } : undefined}
                          onClick={() => fileInputRefs.current[p.slot]?.click()}
                        >
                          {!p.imageBase64 && (
                            <button type="button" className="cb-polaroid-upload-btn">
                              <Pencil className="h-4 w-4" />
                              <span>点击上传</span>
                            </button>
                          )}
                        </div>
                        <input
                          ref={(el) => {
                            fileInputRefs.current[p.slot] = el;
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePolaroidFileChange(p.slot, e.target.files?.[0])}
                        />
                        <input
                          className="cb-polaroid-caption-input"
                          placeholder="写一句这张照片的说明…"
                          defaultValue={p.caption}
                          onBlur={(e) => handlePolaroidCaptionBlur(p.slot, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </section>

                <div className="cb-dual-deck-row">
                  {/* 左栏：歌单 + 便签 */}
                  <aside>
                    <div className="cb-playlist-card">
                      <div className="cb-playlist-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Music2 className="h-3.5 w-3.5" />
                          Our Playlist
                        </span>
                      </div>

                      <div className="cb-track-list">
                        {(board?.playlist || []).map((track) => (
                          <a
                            key={track.id}
                            className="cb-track-item"
                            href={track.url || undefined}
                            target={track.url ? '_blank' : undefined}
                            rel={track.url ? 'noreferrer' : undefined}
                            onClick={(e) => {
                              if (!track.url) e.preventDefault();
                            }}
                          >
                            <div className="cb-track-info">
                              <span className="cb-track-title">{track.title}</span>
                              {track.artist && <span className="cb-track-artist">{track.artist}</span>}
                            </div>
                            <button
                              type="button"
                              className="cb-track-remove-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveTrack(track.id);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </a>
                        ))}
                      </div>

                      <div className="cb-add-track-row">
                        <input
                          placeholder="歌名"
                          value={trackDraft.title}
                          onChange={(e) => setTrackDraft((d) => ({ ...d, title: e.target.value }))}
                        />
                        <input
                          placeholder="歌手（可选）"
                          value={trackDraft.artist}
                          onChange={(e) => setTrackDraft((d) => ({ ...d, artist: e.target.value }))}
                        />
                        <input
                          placeholder="外部链接（网易云/Spotify，可选）"
                          value={trackDraft.url}
                          onChange={(e) => setTrackDraft((d) => ({ ...d, url: e.target.value }))}
                        />
                        <button type="button" className="cb-add-task-btn" style={{ justifyContent: 'center' }} onClick={handleAddTrack}>
                          <Plus className="h-3 w-3" />
                          <span>加入歌单</span>
                        </button>
                      </div>
                    </div>

                    <div className="cb-love-memo-note">
                      <div className="cb-memo-header">
                        <span>NOTES</span>
                        <span>{formatDate(board?.memoNoteUpdatedAt) || '还没写过'}</span>
                      </div>
                      <textarea
                        className="cb-memo-body"
                        placeholder={`${character?.name || 'TA'}还没留下便签……（这一版先由你代笔，角色自己生成留到下个版本）`}
                        value={memoDraft}
                        onChange={(e) => {
                          setMemoDraft(e.target.value);
                          setMemoDirty(true);
                        }}
                      />
                      {memoDirty && (
                        <button type="button" className="cb-memo-save-btn" onClick={handleSaveMemo}>
                          保存便签
                        </button>
                      )}
                    </div>
                  </aside>

                  {/* 右栏：挑战打卡板 */}
                  <main className="cb-challenge-panel">
                    <div className="cb-challenge-topbar">
                      <div className="cb-challenge-title-group">
                        <span>MEMORIES & PACT</span>
                        <h3>心动挑战进行时</h3>
                      </div>
                      <div className="cb-progress-pill">
                        {completedCount} / {tasks.length} DONE
                      </div>
                    </div>

                    {!showAddTask ? (
                      <button type="button" className="cb-add-task-btn" onClick={() => setShowAddTask(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        <span>添加任务</span>
                      </button>
                    ) : (
                      <div className="cb-add-track-row" style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ADD_TASK_SOURCES.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              className="cb-stamp-badge"
                              style={{
                                background: addTaskSource === s.key ? 'var(--cb-wine-red)' : undefined,
                                color: addTaskSource === s.key ? '#fff' : undefined,
                              }}
                              onClick={() => {
                                setAddTaskSource(s.key);
                                setAddTaskPresetId('');
                              }}
                            >
                              <span>{s.label}</span>
                            </button>
                          ))}
                        </div>

                        {addTaskSource === 'custom' ? (
                          <textarea
                            className="cb-memo-body"
                            style={{ color: 'var(--cb-ink-primary)', background: '#fff', border: '1px solid var(--cb-hairline)', borderRadius: 8, padding: 8 }}
                            placeholder="想让TA做点什么？"
                            value={addTaskText}
                            onChange={(e) => setAddTaskText(e.target.value)}
                          />
                        ) : (
                          <select
                            value={addTaskPresetId}
                            onChange={(e) => setAddTaskPresetId(e.target.value)}
                            style={{ fontSize: 12, padding: 8, borderRadius: 8, border: '1px solid var(--cb-hairline)' }}
                          >
                            <option value="">选一条…</option>
                            {(addTaskSource === 'questionnaire' ? questionnairePresets : taskPresets).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.text}
                              </option>
                            ))}
                          </select>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="cb-add-task-btn" onClick={handleSubmitAddTask}>
                            确认添加
                          </button>
                          <button type="button" className="cb-track-remove-btn" onClick={resetAddTaskForm}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {customTasks.length > 0 && <div className="cb-section-label">自定义任务</div>}
                    <div className="cb-challenge-grid">
                      {customTasks.map((task) =>
                        completingTaskId === task.id ? (
                          <div key={task.id} className="cb-challenge-card">
                            <div className="cb-challenge-info-left" style={{ width: '100%' }}>
                              <span className="cb-challenge-text">{task.content}</span>
                              <textarea
                                className="cb-memo-body"
                                style={{ color: 'var(--cb-ink-primary)', background: '#fff', border: '1px solid var(--cb-hairline)', borderRadius: 8, padding: 6, marginTop: 6 }}
                                placeholder="写几句完成感想…"
                                value={completionDraft}
                                onChange={(e) => setCompletionDraft(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                <button type="button" className="cb-add-task-btn" onClick={() => handleConfirmCompletion(task.id)}>
                                  盖章确认
                                </button>
                                <button type="button" className="cb-track-remove-btn" onClick={() => setCompletingTaskId(null)}>
                                  取消
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          renderTaskCard(task)
                        ),
                      )}
                    </div>

                    {presetTasks.length > 0 && <div className="cb-section-label">模板题库任务</div>}
                    <div className="cb-challenge-grid">
                      {presetTasks.map((task) =>
                        completingTaskId === task.id ? (
                          <div key={task.id} className="cb-challenge-card">
                            <div className="cb-challenge-info-left" style={{ width: '100%' }}>
                              <span className="cb-challenge-text">{task.content}</span>
                              <textarea
                                className="cb-memo-body"
                                style={{ color: 'var(--cb-ink-primary)', background: '#fff', border: '1px solid var(--cb-hairline)', borderRadius: 8, padding: 6, marginTop: 6 }}
                                placeholder="写几句完成感想…"
                                value={completionDraft}
                                onChange={(e) => setCompletionDraft(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                <button type="button" className="cb-add-task-btn" onClick={() => handleConfirmCompletion(task.id)}>
                                  盖章确认
                                </button>
                                <button type="button" className="cb-track-remove-btn" onClick={() => setCompletingTaskId(null)}>
                                  取消
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          renderTaskCard(task)
                        ),
                      )}
                    </div>

                    {tasks.length === 0 && <div className="cb-empty-hint">还没有任务，点上面的"添加任务"开始第一个挑战吧</div>}
                  </main>
                </div>

                <footer className="cb-colophon">
                  MADE WITH LOVE · <strong>{character?.name || 'US'}</strong>
                </footer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallengeBoardPage;