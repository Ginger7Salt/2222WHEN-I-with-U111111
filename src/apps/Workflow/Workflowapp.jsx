import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  History
} from 'lucide-react';

import {
  getAllWorkflowsWithContext,
  getWorkflowCandidateChats,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowEnabled
} from '../../services/workflow/workflowService';
import AnimatedSheet from './AnimatedSheet';
import WorkflowRunTimeline from './WorkflowRunTimeline';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const formatWeekdays = (weekdays) => {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return '未设置';
  if (weekdays.length === 7) return '每天';
  const sorted = [...weekdays].sort();
  return sorted.map((day) => WEEKDAY_LABELS[day]).join('、');
};

const StatusBadge = ({ workflow, tone = 'dark' }) => {
  const textClass = tone === 'light' ? 'text-white/85' : 'opacity-55';

  if (!workflow.lastRunAt) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${tone === 'light' ? 'text-white/60' : 'opacity-45'}`}>
        <CircleDashed className="h-3 w-3" />
        尚未运行
      </span>
    );
  }

  if (workflow.lastRunStatus === 'error') {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${textClass}`}>
        <CircleAlert className="h-3 w-3" />
        {workflow.lastRunError ? workflow.lastRunError.slice(0, 20) : '上次执行失败'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${textClass}`}>
      <CheckCircle2 className="h-3 w-3" />
      已送达
    </span>
  );
};

/* ----------------------------- 顶部角色胶卷 ----------------------------- */

const CharacterFilmstrip = ({ groups, activeCharacterId, onPick }) => (
  <div className="flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
    {groups.map((group) => {
      const isActive = group.character?.id === activeCharacterId;
      return (
        <button
          key={group.character?.id || 'unknown'}
          type="button"
          onClick={() => onPick(group.character?.id)}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full p-[2px] transition-all duration-300"
            style={{
              border: `1.5px solid ${isActive ? 'var(--text-main)' : 'var(--card-border)'}`,
              opacity: isActive ? 1 : 0.55
            }}
          >
            <img
              src={group.character?.avatar || ''}
              alt=""
              className="h-full w-full rounded-full object-cover"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            />
          </span>
          <span className="max-w-[56px] truncate text-[10px] opacity-60">
            {group.character?.name || '未知'}
          </span>
        </button>
      );
    })}
  </div>
);

/* ------------------------------ 单张工作流卡片 ------------------------------ */

const WorkflowFrame = ({ workflow, onEdit, onToggleEnabled, onRequestDelete, onOpenHistory }) => {
  const avatar = workflow.character?.avatar;

  return (
    <div className="h-[62vh] w-[78vw] max-w-[340px] shrink-0 snap-center">
      <div className="relative h-full w-full overflow-hidden rounded-[28px]">
        {avatar ? (
          <img src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: 'var(--control-soft-bg)' }} />
        )}

        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.35) 100%)' }}
        />

        {/* 启用开关 */}
        <button
          type="button"
          onClick={() => onToggleEnabled(workflow)}
          aria-label={workflow.enabled ? '暂停工作流' : '启用工作流'}
          className="absolute right-3 top-3 flex h-5 w-9 items-center rounded-full border transition-colors duration-300"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            backgroundColor: workflow.enabled ? 'white' : 'rgba(255,255,255,0.15)'
          }}
        >
          <span
            className="h-3.5 w-3.5 rounded-full transition-all duration-300"
            style={{
              transform: workflow.enabled ? 'translateX(18px)' : 'translateX(2px)',
              backgroundColor: workflow.enabled ? '#111' : 'white',
              opacity: workflow.enabled ? 1 : 0.7
            }}
          />
        </button>

        {/* 聊天/角色小标签 */}
        <p className="absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">
          {workflow.chat?.title || workflow.character?.name || '未命名聊天'}
        </p>

        {/* 主体点击区：打开编辑 */}
        <button
          type="button"
          onClick={() => onEdit(workflow)}
          className="absolute inset-x-0 bottom-16 px-4 text-left"
        >
          <h4 className="font-serif text-xl font-semibold text-white">
            {workflow.name || '未命名工作流'}
          </h4>
          <p className="mt-1 text-[12px] text-white/70">
            {workflow.time || '--:--'} · {formatWeekdays(workflow.weekdays)}
          </p>
          {workflow.goal && (
            <p className="mt-2 line-clamp-2 font-serif text-[12px] italic leading-relaxed text-white/60">
              "{workflow.goal}"
            </p>
          )}
        </button>

        {/* 底部操作条 */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3">
          <StatusBadge workflow={workflow} tone="light" />

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onOpenHistory(workflow)} aria-label="运行记录" className="text-white/75">
              <History className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onEdit(workflow)} aria-label="编辑" className="text-white/75">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onRequestDelete(workflow)} aria-label="删除" className="text-white/75">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --------------------------- 星期选择器（表单用） --------------------------- */

const WeekdayPicker = ({ value, onChange }) => (
  <div className="flex gap-1.5">
    {WEEKDAY_LABELS.map((label, index) => {
      const active = value.includes(index);
      return (
        <button
          key={label}
          type="button"
          onClick={() =>
            onChange(active ? value.filter((day) => day !== index) : [...value, index].sort())
          }
          className="flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors duration-200"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: active ? 'var(--text-main)' : 'transparent',
            color: active ? 'var(--bg-main)' : 'var(--text-main)'
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);

/* -------------------------------- 新建/编辑表单 -------------------------------- */

const WorkflowFormSheet = ({ chat, workflow, onClose, onSaved }) => {
  const isEdit = Boolean(workflow);
  const [name, setName] = useState(workflow?.name || '');
  const [time, setTime] = useState(workflow?.time || '08:00');
  const [weekdays, setWeekdays] = useState(workflow?.weekdays || [0, 1, 2, 3, 4, 5, 6]);
  const [goal, setGoal] = useState(workflow?.goal || '');
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  const targetChat = workflow?.chat || chat;
  const targetCharacter = workflow?.character || chat?.character;

  const handleSave = useCallback(
    async (closeWithAnimation) => {
      setErrorText('');
      if (!time) return setErrorText('请填写触发时间。');
      if (weekdays.length === 0) return setErrorText('请至少选择一个星期。');

      setIsSaving(true);
      try {
        if (isEdit) {
          await updateWorkflow(workflow.id, { name, time, weekdays, goal, enabled });
        } else {
          await createWorkflow({
            chatId: targetChat.id,
            characterId: targetChat.characterId,
            name,
            time,
            weekdays,
            goal,
            enabled
          });
        }
        onSaved();
        closeWithAnimation();
      } catch (error) {
        setErrorText(error?.message || '保存失败，请重试。');
      } finally {
        setIsSaving(false);
      }
    },
    [isEdit, workflow, targetChat, name, time, weekdays, goal, enabled, onSaved]
  );

  return (
    <div
      className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-t p-5 pb-8"
      style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
            {targetCharacter?.name || '未知角色'}
          </p>
          <h3 className="font-serif text-lg font-semibold">{isEdit ? '编辑工作流' : '新建工作流'}</h3>
        </div>
        <button type="button" onClick={onClose} className="opacity-50">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="比如：早安问候"
            className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--text-main)]"
            style={{ borderColor: 'var(--card-border)' }}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">时间</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <span className="text-[11px] opacity-60">启用</span>
            <button
              type="button"
              onClick={() => setEnabled((prev) => !prev)}
              className="relative h-5 w-9 rounded-full border transition-colors duration-300"
              style={{ borderColor: 'var(--card-border)', backgroundColor: enabled ? 'var(--text-main)' : 'transparent' }}
            >
              <span
                className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-300"
                style={{
                  left: enabled ? '18px' : '2px',
                  backgroundColor: enabled ? 'var(--bg-main)' : 'var(--text-main)',
                  opacity: enabled ? 1 : 0.6
                }}
              />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">重复星期</label>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">目标 / 意图</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="告诉 AI 这次主动联系想做什么"
            rows={4}
            className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--card-border)' }}
          />
        </div>

        {errorText && <p className="text-[12px] opacity-70">{errorText}</p>}

        <button
          type="button"
          onClick={() => handleSave(onClose)}
          disabled={isSaving}
          className="w-full rounded-2xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50 active:opacity-80"
          style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
        >
          {isSaving ? '保存中…' : isEdit ? '保存修改' : '创建工作流'}
        </button>
      </div>
    </div>
  );
};

/* --------------------------------- 聊天选择器 --------------------------------- */

const ChatPickerSheet = ({ chats, onPick, onClose }) => (
  <div
    className="max-h-[80vh] overflow-y-auto rounded-t-3xl border-t p-5 pb-8"
    style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
  >
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-serif text-lg font-semibold">挂在哪个聊天下？</h3>
      <button type="button" onClick={onClose} className="opacity-50">
        <X className="h-5 w-5" />
      </button>
    </div>

    {chats.length === 0 ? (
      <p className="py-6 text-center text-sm opacity-50">还没有任何聊天，先去开始一段对话吧。</p>
    ) : (
      <div className="space-y-2">
        {chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => onPick(chat)}
            className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-transform active:scale-[0.98]"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <img
              src={chat.character?.avatar || ''}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{chat.character?.name || '未知角色'}</p>
              <p className="truncate text-[11px] opacity-50">{chat.title || '默认对话'}</p>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

/* ----------------------------------- 主页面 ----------------------------------- */

export const WorkflowApp = ({ onBackHub }) => {
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [candidateChats, setCandidateChats] = useState([]);
  const [isPickingChat, setIsPickingChat] = useState(false);
  const [formTarget, setFormTarget] = useState(null); // { chat } | { workflow } | null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [activeCharacterId, setActiveCharacterId] = useState(null);
  const scrollRef = useRef(null);
  const frameRefs = useRef({});

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllWorkflowsWithContext();
      setWorkflows(data);
    } catch (error) {
      console.error('[WorkflowApp] 读取工作流失败：', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupedByCharacter = useMemo(() => {
    const groups = new Map();
    for (const workflow of workflows) {
      const key = workflow.characterId;
      if (!groups.has(key)) groups.set(key, { character: workflow.character, items: [] });
      groups.get(key).items.push(workflow);
    }
    return Array.from(groups.values());
  }, [workflows]);

  useEffect(() => {
    if (!activeCharacterId && groupedByCharacter.length > 0) {
      setActiveCharacterId(groupedByCharacter[0].character?.id);
    }
  }, [groupedByCharacter, activeCharacterId]);

  const handleJumpToCharacter = useCallback((characterId) => {
    setActiveCharacterId(characterId);
    const firstWorkflowOfChar = workflows.find((w) => w.characterId === characterId);
    if (firstWorkflowOfChar && frameRefs.current[firstWorkflowOfChar.id]) {
      frameRefs.current[firstWorkflowOfChar.id].scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [workflows]);

  const handleOpenCreate = useCallback(async () => {
    try {
      const chats = await getWorkflowCandidateChats();
      setCandidateChats(chats);
      setIsPickingChat(true);
    } catch (error) {
      console.error('[WorkflowApp] 读取聊天列表失败：', error);
    }
  }, []);

  const handleToggleEnabled = useCallback(
    async (workflow) => {
      await setWorkflowEnabled(workflow.id, !workflow.enabled);
      await reload();
    },
    [reload]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteWorkflow(deleteTarget.id);
    setDeleteTarget(null);
    await reload();
  }, [deleteTarget, reload]);

  const activeCount = workflows.filter((w) => w.enabled).length;

  return (
    <div className="min-h-[100dvh] pb-28" style={{ backgroundColor: 'var(--bg-main)' }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <button
          type="button"
          onClick={onBackHub}
          aria-label="返回"
          className="rounded-full border p-2"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: 'var(--text-main)' }} />
        </button>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">Standing Routines</p>
          <h2 className="font-serif text-xl font-semibold">工作流</h2>
        </div>
      </header>

      <p className="mt-3 px-5 font-mono text-[10px] uppercase tracking-[0.18em] opacity-45">
        {isLoading ? '加载中…' : `${activeCount} / ${workflows.length} 条工作流正在运行`}
      </p>

      {!isLoading && groupedByCharacter.length === 0 ? (
        <p className="py-16 text-center text-sm opacity-50">还没有任何工作流，点击下方按钮创建第一条吧。</p>
      ) : (
        <>
          <div className="mt-5">
            <CharacterFilmstrip
              groups={groupedByCharacter}
              activeCharacterId={activeCharacterId}
              onPick={handleJumpToCharacter}
            />
          </div>

          <div
            ref={scrollRef}
            className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
          >
            {workflows.map((workflow) => (
              <div key={workflow.id} ref={(el) => (frameRefs.current[workflow.id] = el)}>
                <WorkflowFrame
                  workflow={workflow}
                  onEdit={(target) => setFormTarget({ workflow: target })}
                  onToggleEnabled={handleToggleEnabled}
                  onRequestDelete={setDeleteTarget}
                  onOpenHistory={setHistoryTarget}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={handleOpenCreate}
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold shadow-lg transition-transform active:scale-95"
        style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
      >
        <Plus className="h-4 w-4" />
        新建工作流
      </button>

      <AnimatedSheet open={isPickingChat} onExited={() => {}}>
        {(closeWithAnimation) => (
          <ChatPickerSheet
            chats={candidateChats}
            onClose={closeWithAnimation}
            onPick={(chat) => {
              closeWithAnimation();
              setTimeout(() => setFormTarget({ chat }), 260);
            }}
          />
        )}
      </AnimatedSheet>

      <AnimatedSheet open={!!formTarget} onExited={() => setFormTarget(null)}>
        {(closeWithAnimation) => (
          <WorkflowFormSheet
            chat={formTarget?.chat}
            workflow={formTarget?.workflow}
            onClose={closeWithAnimation}
            onSaved={() => void reload()}
          />
        )}
      </AnimatedSheet>

      {/* 删除确认：小弹层，同样带动效 */}
      <AnimatedSheet open={!!deleteTarget} onExited={() => setDeleteTarget(null)}>
        {(closeWithAnimation) => (
          <div
            className="rounded-t-3xl border-t p-6 pb-8 text-center"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
          >
            <p className="text-sm opacity-70">
              删除工作流「{deleteTarget?.name || '未命名工作流'}」？此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeWithAnimation}
                className="flex-1 rounded-2xl border py-3 text-sm"
                style={{ borderColor: 'var(--card-border)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleConfirmDelete();
                  closeWithAnimation();
                }}
                className="flex-1 rounded-2xl py-3 text-sm font-semibold"
                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
              >
                确认删除
              </button>
            </div>
          </div>
        )}
      </AnimatedSheet>

      {historyTarget && (
        <WorkflowRunTimeline workflow={historyTarget} onBack={() => setHistoryTarget(null)} />
      )}
    </div>
  );
};

export default WorkflowApp;