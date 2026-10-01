// src/apps/messages/work/WorkNotebook.jsx
//
// work 聊天窗的"工作本本"：待办（db.todos，按 characterId 共享）+ 提醒
// （db.scheduledMessages，按 chatId 分聊天窗）合并成一个统一视图，取代
// 之前点"工作本本"图标直接打开 ScheduledMessageArchive 的做法——那个
// 组件本来是给恋爱向聊天室设计的"时间票据"隐喻，只有提醒、没有待办，
// 跟工作场景不搭，也不是真正"待办+提醒"统一视图。
//
// 待办沿用 todos 表既有的 characterId 过滤方式（工作助理身份全局共享，
// 所以待办也是全局的，不按 chatId 再拆分）——这跟 workGreetingService.js
// 里摘要统计、以及 aiService.js 里 todoText 的既有过滤逻辑保持一致，是
// 已经跟用户说明过的简化，不是"每个 work 聊天窗各自一份待办"的完整
// 隔离实现；真要做到聊天窗级隔离需要先给 todos 表补 chatId 字段。
//
// 提醒延续 ScheduledMessageArchive 原本的 chatId 过滤（本来就是按聊天窗
// 分开的，这点不变），复用同一套 scheduledMessageArchiveService 工具
// 函数，不重新发明一遍状态/取消策略的展示文案。
//
// 这里新增的"新建提醒"表单，就是"手动周期性入口"的落地：用户不用再
// 指望 AI 主动在 [SCHEDULE_MESSAGE ...] 里加 recurring 标记才能拿到
// 周期提醒，自己也能在这里直接勾选"周期性重复"，和 AI 触发走的是
// 同一条后端链路（createScheduledMessage 的 recurringIntervalMinutes）。

import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Circle,
  Clock3,
  ListTodo,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import db from '../../../db';
import ConfirmModal from '../../../components/ConfirmModal';
import { createScheduledMessage } from '../scheduledMessageService';
import {
  deleteScheduledMessageArchiveItem,
  formatScheduledMessageDate,
  getScheduledMessageArchive,
  getScheduledMessageDisplayState,
  getScheduledMessageTypeLabel,
  retryScheduledMessageArchiveItem,
} from '../scheduledMessageArchiveService';

const MIN_DELAY_MINUTES = 10;
const MAX_DELAY_MINUTES = 24 * 60;

const DELAY_PRESETS = [
  { label: '30 分钟后', minutes: 30 },
  { label: '1 小时后', minutes: 60 },
  { label: '2 小时后', minutes: 120 },
  { label: '4 小时后', minutes: 240 },
  { label: '明天此时', minutes: 24 * 60 },
];

const clampMinutes = (value) => {
  const minutes = Number.parseInt(value, 10);

  if (!Number.isInteger(minutes)) {
    return null;
  }

  return Math.min(Math.max(minutes, MIN_DELAY_MINUTES), MAX_DELAY_MINUTES);
};

const formatDateTimeLocal = (value, fallback = '未设时间') => {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const WorkNotebook = ({ chatId, character, onClose }) => {
  const [activeTab, setActiveTab] = useState('todos');

  const [todos, setTodos] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');

  const [newReminderIntent, setNewReminderIntent] = useState('');
  const [newReminderDelay, setNewReminderDelay] = useState(60);
  const [newReminderCustomDelay, setNewReminderCustomDelay] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const [deletingItem, setDeletingItem] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const characterId = character?.id;

  const loadData = async () => {
    setIsLoading(true);

    try {
      const [todoList, reminderList] = await Promise.all([
        characterId
          ? db.todos.where('characterId').equals(characterId).toArray()
          : Promise.resolve([]),
        getScheduledMessageArchive(chatId),
      ]);

      todoList.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      });

      setTodos(todoList);
      setReminders(reminderList);
    } catch (error) {
      console.error('[WorkNotebook] 读取工作本本失败：', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, characterId]);

  const pendingTodos = useMemo(
    () => todos.filter((todo) => !todo.isCompleted),
    [todos]
  );

  const completedTodos = useMemo(
    () => todos.filter((todo) => todo.isCompleted),
    [todos]
  );

  const handleAddTodo = async (event) => {
    event.preventDefault();
    if (!newTodoTitle.trim() || !characterId) return;

    try {
      await db.todos.add({
        title: newTodoTitle.trim(),
        dueDate: newTodoDueDate || null,
        priority: 'normal',
        category: '工作',
        characterId,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      });

      setNewTodoTitle('');
      setNewTodoDueDate('');
      loadData();
    } catch (error) {
      console.error('[WorkNotebook] 新增待办失败：', error);
    }
  };

  const handleToggleTodo = async (todo) => {
    try {
      await db.todos.update(todo.id, { isCompleted: !todo.isCompleted });
      loadData();
    } catch (error) {
      console.error('[WorkNotebook] 更新待办失败：', error);
    }
  };

  const handleAddReminder = async (event) => {
    event.preventDefault();
    if (!newReminderIntent.trim() || !chatId || !characterId) return;

    const delayMinutes = newReminderDelay === 'custom'
      ? clampMinutes(newReminderCustomDelay)
      : clampMinutes(newReminderDelay);

    if (!delayMinutes) return;

    try {
      await createScheduledMessage({
        chatId,
        characterId,
        delayMinutes,
        intent: newReminderIntent.trim(),
        scheduleType: 'reminder',
        recurringIntervalMinutes: isRecurring ? delayMinutes : null,
      });

      setNewReminderIntent('');
      setNewReminderDelay(60);
      setNewReminderCustomDelay('');
      setIsRecurring(false);
      loadData();
    } catch (error) {
      console.error('[WorkNotebook] 新增提醒失败：', error);
    }
  };

  const handleRetryReminder = async (record) => {
    if (!record?.id || retryingId) return;

    setRetryingId(record.id);

    try {
      const success = await retryScheduledMessageArchiveItem(record.id);
      if (success) loadData();
    } catch (error) {
      console.error('[WorkNotebook] 重新安排提醒失败：', error);
    } finally {
      setRetryingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    try {
      if (deletingItem.type === 'todo') {
        await db.todos.delete(deletingItem.id);
      } else if (deletingItem.type === 'reminder') {
        await deleteScheduledMessageArchiveItem(deletingItem.id);
      }

      setDeletingItem(null);
      loadData();
    } catch (error) {
      console.error('[WorkNotebook] 删除失败：', error);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        role="presentation"
        onClick={onClose}
      >
        <section
          className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
          style={{ backgroundColor: 'var(--bg-surface)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-notebook-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header
            className="flex shrink-0 items-center justify-between border-b px-5 py-4"
            style={{ borderColor: 'var(--divider)' }}
          >
            <div>
              <p
                className="text-[10px] font-bold tracking-[0.16em]"
                style={{ color: 'var(--text-muted)' }}
              >
                WORK NOTEBOOK
              </p>
              <h2
                id="work-notebook-title"
                className="mt-0.5 text-base font-semibold"
                style={{ color: 'var(--text-main)' }}
              >
                工作本本
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 opacity-60 transition-opacity hover:opacity-100"
              style={{ color: 'var(--text-main)' }}
              title="关闭工作本本"
              aria-label="关闭工作本本"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            className="flex shrink-0 border-b px-5"
            style={{ borderColor: 'var(--divider)' }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className="relative flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-bold"
              style={{
                color: activeTab === 'todos' ? 'var(--text-main)' : 'var(--text-muted)',
              }}
            >
              <ListTodo className="h-3.5 w-3.5" />
              待办{pendingTodos.length > 0 ? `（${pendingTodos.length}）` : ''}
              {activeTab === 'todos' && (
                <span
                  className="absolute inset-x-6 bottom-0 h-0.5"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reminders')}
              className="relative flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-bold"
              style={{
                color: activeTab === 'reminders' ? 'var(--text-main)' : 'var(--text-muted)',
              }}
            >
              <BellRing className="h-3.5 w-3.5" />
              提醒{reminders.length > 0 ? `（${reminders.length}）` : ''}
              {activeTab === 'reminders' && (
                <span
                  className="absolute inset-x-6 bottom-0 h-0.5"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading && (
              <p className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                正在读取工作本本……
              </p>
            )}

            {!isLoading && activeTab === 'todos' && (
              <div className="space-y-5">
                <form onSubmit={handleAddTodo} className="space-y-2">
                  <input
                    value={newTodoTitle}
                    onChange={(event) => setNewTodoTitle(event.target.value)}
                    placeholder="写下一件要做的事"
                    className="w-full border-b bg-transparent py-2 text-sm outline-none placeholder:opacity-40"
                    style={{ color: 'var(--text-main)', borderColor: 'var(--divider)' }}
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={newTodoDueDate}
                      onChange={(event) => setNewTodoDueDate(event.target.value)}
                      className="flex-1 bg-transparent text-[11px] outline-none"
                      style={{ color: 'var(--text-sub)' }}
                    />

                    <button
                      type="submit"
                      disabled={!newTodoTitle.trim()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40"
                      style={{
                        backgroundColor: 'var(--accent-color)',
                        color: 'var(--accent-foreground)',
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加
                    </button>
                  </div>
                </form>

                {pendingTodos.length === 0 && completedTodos.length === 0 ? (
                  <p className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    还没有待办，写下第一件吧。
                  </p>
                ) : (
                  <div className="space-y-1">
                    {pendingTodos.map((todo) => (
                      <article
                        key={todo.id}
                        className="group flex items-start gap-2.5 border-b py-3 last:border-b-0"
                        style={{ borderColor: 'var(--divider)' }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleTodo(todo)}
                          className="mt-0.5 shrink-0"
                          style={{ color: 'var(--accent-color)' }}
                          aria-label="标记为已完成"
                        >
                          <Circle className="h-4 w-4" strokeWidth={1.8} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm" style={{ color: 'var(--text-main)' }}>
                            {todo.title}
                          </p>
                          {todo.dueDate && (
                            <p
                              className="mt-0.5 flex items-center gap-1 text-[10.5px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Clock3 className="h-3 w-3" />
                              {formatDateTimeLocal(todo.dueDate)}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setDeletingItem({ type: 'todo', id: todo.id })}
                          className="p-1 opacity-0 transition-opacity group-hover:opacity-60"
                          style={{ color: 'var(--text-main)' }}
                          aria-label="删除待办"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </article>
                    ))}

                    {completedTodos.length > 0 && (
                      <details className="pt-2">
                        <summary
                          className="cursor-pointer text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          已完成（{completedTodos.length}）
                        </summary>

                        <div className="mt-2 space-y-1">
                          {completedTodos.map((todo) => (
                            <article
                              key={todo.id}
                              className="group flex items-start gap-2.5 border-b py-3 last:border-b-0"
                              style={{ borderColor: 'var(--divider)' }}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleTodo(todo)}
                                className="mt-0.5 shrink-0"
                                style={{ color: 'var(--accent-color)' }}
                                aria-label="标记为未完成"
                              >
                                <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                              </button>

                              <p
                                className="min-w-0 flex-1 text-sm line-through opacity-50"
                                style={{ color: 'var(--text-main)' }}
                              >
                                {todo.title}
                              </p>

                              <button
                                type="button"
                                onClick={() => setDeletingItem({ type: 'todo', id: todo.id })}
                                className="p-1 opacity-0 transition-opacity group-hover:opacity-60"
                                style={{ color: 'var(--text-main)' }}
                                aria-label="删除待办"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </article>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === 'reminders' && (
              <div className="space-y-5">
                <form onSubmit={handleAddReminder} className="space-y-3">
                  <input
                    value={newReminderIntent}
                    onChange={(event) => setNewReminderIntent(event.target.value)}
                    placeholder="提醒我做什么"
                    className="w-full border-b bg-transparent py-2 text-sm outline-none placeholder:opacity-40"
                    style={{ color: 'var(--text-main)', borderColor: 'var(--divider)' }}
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {DELAY_PRESETS.map((preset) => (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => setNewReminderDelay(preset.minutes)}
                        className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                        style={{
                          borderColor: 'var(--card-border)',
                          backgroundColor:
                            newReminderDelay === preset.minutes
                              ? 'var(--accent-color)'
                              : 'transparent',
                          color:
                            newReminderDelay === preset.minutes
                              ? 'var(--accent-foreground)'
                              : 'var(--text-sub)',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setNewReminderDelay('custom')}
                      className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                      style={{
                        borderColor: 'var(--card-border)',
                        backgroundColor:
                          newReminderDelay === 'custom'
                            ? 'var(--accent-color)'
                            : 'transparent',
                        color:
                          newReminderDelay === 'custom'
                            ? 'var(--accent-foreground)'
                            : 'var(--text-sub)',
                      }}
                    >
                      自定义
                    </button>
                  </div>

                  {newReminderDelay === 'custom' && (
                    <input
                      type="number"
                      min={MIN_DELAY_MINUTES}
                      max={MAX_DELAY_MINUTES}
                      value={newReminderCustomDelay}
                      onChange={(event) => setNewReminderCustomDelay(event.target.value)}
                      placeholder="分钟数（10–1440）"
                      className="w-full border-b bg-transparent py-1 text-xs outline-none placeholder:opacity-40"
                      style={{ color: 'var(--text-main)', borderColor: 'var(--divider)' }}
                    />
                  )}

                  <label
                    className="flex items-center gap-2 text-[11.5px]"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(event) => setIsRecurring(event.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <Repeat className="h-3.5 w-3.5" />
                    周期性重复（每隔这个时间就再提醒一次）
                  </label>

                  <button
                    type="submit"
                    disabled={!newReminderIntent.trim()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-transform active:scale-[0.98] disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--accent-foreground)',
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    设定提醒
                  </button>
                </form>

                {reminders.length === 0 ? (
                  <p className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    还没有提醒，设定第一个吧。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((record) => {
                      const state = getScheduledMessageDisplayState(record);
                      const canRetry =
                        record.status === 'failed' || record.status === 'cancelled';
                      const isRetrying = retryingId === record.id;

                      return (
                        <article
                          key={record.id}
                          className="rounded-2xl border px-3.5 py-3"
                          style={{
                            borderColor: 'var(--card-border)',
                            backgroundColor: 'var(--card-bg)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="flex items-center gap-1.5 text-[10.5px] font-bold"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {getScheduledMessageTypeLabel(record)}
                              {record.recurringIntervalMinutes ? (
                                <span
                                  className="inline-flex items-center gap-0.5"
                                  style={{ color: 'var(--accent-color)' }}
                                >
                                  <Repeat className="h-3 w-3" />
                                  周期
                                </span>
                              ) : null}
                            </span>

                            <div className="flex items-center gap-1">
                              {canRetry && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryReminder(record)}
                                  disabled={Boolean(retryingId)}
                                  className="rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
                                  style={{ color: 'var(--text-main)' }}
                                  title="重新安排这次提醒"
                                  aria-label="重新安排这次提醒"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDeletingItem({ type: 'reminder', id: record.id })}
                                className="rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
                                style={{ color: 'var(--text-main)' }}
                                title="删除这个提醒"
                                aria-label="删除这个提醒"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-main)' }}>
                            {record.intent || '（未写明具体内容）'}
                          </p>

                          <div
                            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {formatScheduledMessageDate(record.scheduledFor)}
                            </span>
                            <span>
                              {state.label}
                              {isRetrying ? '（安排中）' : ''}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title={deletingItem?.type === 'todo' ? '删除这条待办？' : '删除这个提醒？'}
        message="删除后将无法恢复。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </>
  );
};

export default WorkNotebook;