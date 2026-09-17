import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  getAlmanacReminders,
  createAlmanacReminder,
  updateAlmanacReminder,
  deleteAlmanacReminder,
  MAX_REMINDERS,
} from '../services/almanacReminderService';

const EMPTY_FORM = {
  content: '',
  time: '12:00',
  enabled: true,
};

export const AlmanacReminderManager = ({ chatId }) => {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const loadReminders = useCallback(async () => {
    if (!chatId) {
      setReminders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const items = await getAlmanacReminders(chatId);
      setReminders(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('[Almanac] 读取轻提醒失败：', error);
      setReminders([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);

  const beginCreate = () => {
    setEditingReminder(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const beginEdit = (reminder) => {
    setEditingReminder(reminder);
    setForm({
      content: reminder.content || '',
      time: reminder.time || '12:00',
      enabled: reminder.enabled !== false,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditingReminder(null);
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSaving || !form.content.trim() || !form.time) {
      return;
    }

    setIsSaving(true);

    try {
      if (editingReminder) {
        await updateAlmanacReminder(editingReminder.id, {
          content: form.content.trim(),
          time: form.time,
          enabled: form.enabled,
        });
      } else {
        const createdId = await createAlmanacReminder({
          chatId,
          content: form.content.trim(),
          time: form.time,
          enabled: form.enabled,
        });

        if (!createdId) {
          // 达到 10 条上限，或输入不完整。
          setIsSaving(false);
          return;
        }
      }

      await loadReminders();
      setShowForm(false);
      setEditingReminder(null);
      setForm(EMPTY_FORM);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (reminder) => {
    await updateAlmanacReminder(reminder.id, {
      enabled: !reminder.enabled,
    });

    await loadReminders();
  };

  const handleDelete = async (reminder) => {
    const confirmed = window.confirm(
      `确定删除这条提醒吗？\n\n"${reminder.content}"`
    );

    if (!confirmed) return;

    await deleteAlmanacReminder(reminder.id);

    if (editingReminder?.id === reminder.id) {
      cancelForm();
    }

    await loadReminders();
  };

  const isAtLimit = reminders.length >= MAX_REMINDERS;

  return (
    <section className="almanac-panel almanac-reminder-manager">
      <header className="almanac-manager-heading">
        <div className="almanac-manager-heading-copy">
          <p className="almanac-eyebrow">LIGHT REMINDERS</p>
          <h3 className="almanac-section-title">轻提醒</h3>
          <p className="almanac-manager-description">
            到点后，会用它自己的语气自然提一句，不是机械打卡。最多 {MAX_REMINDERS} 条。
          </p>
        </div>

        {!showForm && !isAtLimit && (
          <button
            type="button"
            className="almanac-secondary-button almanac-add-date-button"
            onClick={beginCreate}
          >
            <span>添加提醒</span>
            <span className="almanac-button-arrow" aria-hidden="true">↗</span>
          </button>
        )}
      </header>

      {isAtLimit && !showForm && (
        <p className="almanac-reminder-limit-hint">
          已经留了 {MAX_REMINDERS} 条提醒，删掉一条才能再添加新的。
        </p>
      )}

      {showForm && (
        <form className="almanac-countdown-form" onSubmit={handleSubmit}>
          <div className="almanac-form-heading">
            <div>
              <p className="almanac-form-kicker">
                {editingReminder ? 'EDIT REMINDER' : 'NEW REMINDER'}
              </p>
              <h4 className="almanac-form-title">
                {editingReminder ? '编辑这条提醒' : '添加一条轻提醒'}
              </h4>
            </div>
          </div>

          <div className="almanac-form-fields">
            <label className="almanac-form-field">
              <span className="almanac-form-label">提醒内容</span>
              <input
                className="almanac-form-input"
                type="text"
                value={form.content}
                placeholder="例如：中午提醒吃保健品"
                maxLength={100}
                onChange={(event) => update({ content: event.target.value })}
              />
            </label>

            <label className="almanac-form-field">
              <span className="almanac-form-label">时间</span>
              <input
                className="almanac-form-input almanac-time-input"
                type="time"
                value={form.time}
                onChange={(event) => update({ time: event.target.value })}
              />
            </label>
          </div>

          <label className="almanac-toggle-row almanac-form-toggle">
            <span>
              <strong>启用</strong>
              <small>关闭后这条提醒暂停生效，不会被删除。</small>
            </span>

            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
          </label>

          <div className="almanac-form-actions">
            <button
              type="submit"
              className="almanac-primary-button almanac-form-submit"
              disabled={isSaving || !form.content.trim() || !form.time}
            >
              {isSaving ? '正在保存…' : editingReminder ? '保存修改' : '添加提醒'}
            </button>

            <button
              type="button"
              className="almanac-text-button almanac-form-cancel"
              onClick={cancelForm}
            >
              取消
            </button>
          </div>
        </form>
      )}

      {!isLoading && reminders.length === 0 && !showForm ? (
        <div className="almanac-empty almanac-milestone-empty" role="status">
          <span className="almanac-empty-mark" aria-hidden="true">—</span>

          <div className="almanac-empty-copy">
            <strong className="almanac-empty-title">还没有轻提醒</strong>
            <small className="almanac-empty-description">
              添加一件生活里的小事，让它自然提一句。
            </small>
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="almanac-managed-milestones">
            {reminders.map((reminder, index) => (
              <article className="almanac-managed-milestone" key={reminder.id}>
                <span className="almanac-managed-milestone-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="almanac-managed-milestone-content">
                  <div className="almanac-managed-milestone-main">
                    <strong className="almanac-managed-milestone-title">
                      {reminder.content}
                    </strong>

                    <p className="almanac-managed-milestone-date">
                      {reminder.time}

                      {!reminder.enabled && (
                        <span className="almanac-milestone-tag">已暂停</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="almanac-managed-milestone-actions">
                  <button
                    type="button"
                    className="almanac-item-action-button"
                    onClick={() => handleToggleEnabled(reminder)}
                  >
                    {reminder.enabled ? '暂停' : '启用'}
                  </button>

                  <button
                    type="button"
                    className="almanac-item-action-button"
                    onClick={() => beginEdit(reminder)}
                  >
                    编辑
                  </button>

                  <button
                    type="button"
                    className="almanac-item-action-button almanac-danger-text"
                    onClick={() => {
                      void handleDelete(reminder);
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </section>
  );
};

export default AlmanacReminderManager;