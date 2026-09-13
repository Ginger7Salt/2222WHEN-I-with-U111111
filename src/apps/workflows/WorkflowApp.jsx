import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  ArrowLeft,
  Plus,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Save,
  Image as ImageIcon
} from 'lucide-react';

import db from '../../db';
import GlassCard from '../../components/GlassCard';
import ImageUploader from '../../components/ImageUploader';

import {
  getAllWorkflowsWithContext,
  getWorkflowCandidateChats,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowEnabled
} from '../../services/workflow/workflowService';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const TORN_EDGE_CLIP =
  'polygon(0% 0%, 100% 0%, 100% 90%, 95% 100%, 90% 88%, 85% 100%, 80% 88%, 75% 100%, 70% 88%, 65% 100%, 60% 88%, 55% 100%, 50% 88%, 45% 100%, 40% 88%, 35% 100%, 30% 88%, 25% 100%, 20% 88%, 15% 100%, 10% 88%, 5% 100%, 0% 88%)';

/**
 * 只允许显示本地保存的数据。
 * 外部 http / https 图片不会被渲染，避免页面使用外部 URL。
 */
const isLocalImage = (value) => {
  if (!value || typeof value !== 'string') return false;

  return (
    value.startsWith('data:image/') ||
    value.startsWith('blob:')
  );
};

const safeImage = (value) => {
  return isLocalImage(value) ? value : '';
};

const escapeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const createDefaultPageData = (character = {}) => ({
  eyebrow: 'CHOOSE YOUR PERSPECTIVE',
  title: 'Who\nare you?',
  intro:
    '像从一卷旧胶卷里抽出一张相片。选择一个角色，进入属于他的独立世界。',
  cameraCaption: 'USE THE FRAME TO REMEMBER',
  cameraLabel: 'FOCUS',
  archiveLabel: 'PRIVATE ARCHIVE',
  profileTitle: character.name || '',
  profileDesc: character.bio || '',
  profileStatus: 'ARCHIVED',
  timelineTitle: 'Fragments',
  timelineSubtitle: 'PERSONAL TIMELINE',
  events: []
});

const getCharacterPageData = (character) => {
  const saved = character?.cameraPage || {};
  const defaults = createDefaultPageData(character);

  const sourceEvents =
    Array.isArray(saved.events) && saved.events.length > 0
      ? saved.events
      : Array.isArray(character?.cameraEvents)
        ? character.cameraEvents
        : defaults.events;

  return {
    ...defaults,
    ...saved,
    events: sourceEvents.map((event) => ({
      date: event?.date || event?.[0] || '',
      title: event?.title || event?.[1] || '',
      content: event?.content || event?.[2] || ''
    }))
  };
};

const formatWeekdays = (weekdays) => {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return '未设置';
  if (weekdays.length === 7) return '每天';

  const sorted = [...weekdays].sort();
  return sorted.map((day) => WEEKDAY_LABELS[day]).join('、');
};

const StatusBadge = ({ workflow }) => {
  if (!workflow.lastRunAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-45">
        <CircleDashed className="h-3 w-3" />
        尚未运行
      </span>
    );
  }

  if (workflow.lastRunStatus === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70">
        <CircleAlert className="h-3 w-3" />
        {workflow.lastRunError
          ? workflow.lastRunError.slice(0, 24)
          : '上次执行失败'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-55">
      <CheckCircle2 className="h-3 w-3" />
      已送达
    </span>
  );
};

const WashiTape = ({ rotate = -6 }) => (
  <span
    className="pointer-events-none absolute -top-2 left-5 h-3.5 w-10 opacity-[0.14]"
    style={{
      backgroundColor: 'var(--text-main)',
      transform: `rotate(${rotate}deg)`
    }}
  />
);

const WorkflowCard = ({
  workflow,
  rotate,
  onEdit,
  onToggleEnabled,
  onRequestDelete,
  confirmingDelete,
  onCancelDelete,
  onConfirmDelete
}) => {
  return (
    <div
      className="relative"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <WashiTape rotate={rotate < 0 ? 8 : -8} />

      <GlassCard className="cursor-default p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
              {workflow.chat?.title ||
                workflow.character?.name ||
                '未命名聊天'}
            </p>

            <h4 className="mt-1 truncate font-serif text-[16px] font-semibold">
              {workflow.name || '未命名工作流'}
            </h4>

            <p className="mt-1 text-[11px] opacity-55">
              {workflow.time || '--:--'} ·{' '}
              {formatWeekdays(workflow.weekdays)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleEnabled(workflow)}
            aria-label={workflow.enabled ? '暂停工作流' : '启用工作流'}
            className="relative h-5 w-9 shrink-0 rounded-full border transition-colors"
            style={{
              borderColor: 'var(--card-border)',
              backgroundColor: workflow.enabled
                ? 'var(--text-main)'
                : 'transparent'
            }}
          >
            <span
              className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
              style={{
                left: workflow.enabled ? '18px' : '2px',
                backgroundColor: workflow.enabled
                  ? 'var(--bg-main)'
                  : 'var(--text-main)',
                opacity: workflow.enabled ? 1 : 0.6
              }}
            />
          </button>
        </div>

        {workflow.goal && (
          <p
            className="mt-3 border-l-2 pl-3 font-serif text-[12px] italic leading-relaxed opacity-70"
            style={{ borderColor: 'var(--card-border)' }}
          >
            "{workflow.goal}"
          </p>
        )}

        <div
          className="mt-3 flex items-center justify-between border-t pt-2.5"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <StatusBadge workflow={workflow} />

          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="opacity-60">删除这条工作流？</span>

              <button
                type="button"
                onClick={() => onConfirmDelete(workflow)}
                className="font-semibold underline underline-offset-2"
              >
                确认
              </button>

              <button
                type="button"
                onClick={onCancelDelete}
                className="opacity-50"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onEdit(workflow)}
                aria-label="编辑"
                className="opacity-45 transition-opacity hover:opacity-90"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onRequestDelete(workflow.id)}
                aria-label="删除"
                className="opacity-45 transition-opacity hover:opacity-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

const WeekdayPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {WEEKDAY_LABELS.map((label, index) => {
      const active = value.includes(index);

      return (
        <button
          key={label}
          type="button"
          onClick={() =>
            onChange(
              active
                ? value.filter((day) => day !== index)
                : [...value, index].sort()
            )
          }
          className="flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: active
              ? 'var(--text-main)'
              : 'transparent',
            color: active ? 'var(--bg-main)' : 'var(--text-main)'
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const WorkflowFormSheet = ({
  chat,
  workflow,
  onClose,
  onSaved
}) => {
  const isEdit = Boolean(workflow);

  const [name, setName] = useState(workflow?.name || '');
  const [time, setTime] = useState(workflow?.time || '08:00');
  const [weekdays, setWeekdays] = useState(
    workflow?.weekdays || [0, 1, 2, 3, 4, 5, 6]
  );
  const [goal, setGoal] = useState(workflow?.goal || '');
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  const targetChat = workflow?.chat || chat;
  const targetCharacter = workflow?.character || chat?.character;

  const handleSave = useCallback(async () => {
    setErrorText('');

    if (!time) {
      setErrorText('请填写触发时间。');
      return;
    }

    if (weekdays.length === 0) {
      setErrorText('请至少选择一个星期。');
      return;
    }

    if (!targetChat?.id && !isEdit) {
      setErrorText('没有找到对应聊天，无法创建工作流。');
      return;
    }

    setIsSaving(true);

    try {
      if (isEdit) {
        await updateWorkflow(workflow.id, {
          name,
          time,
          weekdays,
          goal,
          enabled
        });
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
    } catch (error) {
      setErrorText(error?.message || '保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  }, [
    isEdit,
    workflow,
    targetChat,
    name,
    time,
    weekdays,
    goal,
    enabled,
    onSaved
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div
        className="max-h-[88vh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border-t p-5 pb-8"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--card-border)'
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
              {targetCharacter?.name || '未知角色'}
            </p>

            <h3 className="font-serif text-lg font-semibold">
              {isEdit ? '编辑工作流' : '新建工作流'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              名称
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="比如：早安问候"
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
                时间
              </label>

              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--card-border)' }}
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <span className="text-[11px] opacity-60">启用</span>

              <button
                type="button"
                onClick={() => setEnabled((prev) => !prev)}
                className="relative h-5 w-9 rounded-full border"
                style={{
                  borderColor: 'var(--card-border)',
                  backgroundColor: enabled
                    ? 'var(--text-main)'
                    : 'transparent'
                }}
              >
                <span
                  className="absolute top-0.5 h-3.5 w-3.5 rounded-full"
                  style={{
                    left: enabled ? '18px' : '2px',
                    backgroundColor: enabled
                      ? 'var(--bg-main)'
                      : 'var(--text-main)'
                  }}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              重复星期
            </label>

            <WeekdayPicker
              value={weekdays}
              onChange={setWeekdays}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              目标 / 意图
            </label>

            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="告诉 AI 这次主动联系想做什么，比如提醒喝水、查一下今天天气再关心一句"
              rows={4}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          {errorText && (
            <p className="text-[12px] opacity-70">
              {errorText}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-2xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: 'var(--text-main)',
              color: 'var(--bg-main)'
            }}
          >
            {isSaving
              ? '保存中…'
              : isEdit
                ? '保存修改'
                : '创建工作流'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatPickerSheet = ({
  chats,
  onPick,
  onClose
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
    <div
      className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border-t p-5 pb-8"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--card-border)'
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">
          挂在哪个聊天下？
        </h3>

        <button
          type="button"
          onClick={onClose}
          className="opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {chats.length === 0 ? (
        <p className="py-6 text-center text-sm opacity-50">
          还没有任何聊天，先去开始一段对话吧。
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onPick(chat)}
              className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
              style={{ borderColor: 'var(--card-border)' }}
            >
              {safeImage(chat.character?.avatar) ? (
                <img
                  src={safeImage(chat.character.avatar)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)'
                  }}
                >
                  <ImageIcon className="h-4 w-4 opacity-40" />
                </span>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {chat.character?.name || '未知角色'}
                </p>

                <p className="truncate text-[11px] opacity-50">
                  {chat.title || '默认对话'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

const ImageField = ({
  label,
  value,
  onChange
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-wider opacity-55">
          {label}
        </label>

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] opacity-50 underline underline-offset-2"
          >
            移除图片
          </button>
        )}
      </div>

      {value ? (
        <div className="relative overflow-hidden border border-dashed p-2">
          <img
            src={value}
            alt=""
            className="h-28 w-full object-cover"
          />

          <div className="mt-2">
            <ImageUploader
              label="重新上传图片"
              compressOptions={{
                maxWidth: 1600,
                maxHeight: 1200,
                quality: 0.78,
                outputType: 'base64'
              }}
              onCompressedImage={onChange}
            />
          </div>
        </div>
      ) : (
        <ImageUploader
          label={`上传${label}`}
          compressOptions={{
            maxWidth: 1600,
            maxHeight: 1200,
            quality: 0.78,
            outputType: 'base64'
          }}
          onCompressedImage={onChange}
        />
      )}
    </div>
  );
};

const CameraEditor = ({
  character,
  onSaved,
  onNotify
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState(character?.name || '');
  const [avatar, setAvatar] = useState(safeImage(character?.avatar));
  const [banner, setBanner] = useState(safeImage(character?.banner));

  const [page, setPage] = useState(
    getCharacterPageData(character)
  );

  useEffect(() => {
    setName(character?.name || '');
    setAvatar(safeImage(character?.avatar));
    setBanner(safeImage(character?.banner));
    setPage(getCharacterPageData(character));
    setIsEditing(false);
  }, [character]);

  const updatePage = (key, value) => {
    setPage((previous) => ({
      ...previous,
      [key]: value
    }));
  };

  const updateEvent = (index, key, value) => {
    setPage((previous) => ({
      ...previous,
      events: previous.events.map((event, eventIndex) =>
        eventIndex === index
          ? { ...event, [key]: value }
          : event
      )
    }));
  };

  const addEvent = () => {
    setPage((previous) => ({
      ...previous,
      events: [
        ...previous.events,
        {
          date: '',
          title: '',
          content: ''
        }
      ]
    }));
  };

  const removeEvent = (index) => {
    setPage((previous) => ({
      ...previous,
      events: previous.events.filter(
        (_, eventIndex) => eventIndex !== index
      )
    }));
  };

  const savePage = async () => {
    if (!character?.id) {
      onNotify('没有找到角色，无法保存');
      return;
    }

    setIsSaving(true);

    try {
      await db.characters.update(character.id, {
        name: name.trim() || character.name || '未命名角色',
        avatar: avatar || '',
        banner: banner || '',
        bio: page.profileDesc || '',
        cameraPage: {
          ...page,
          profileTitle:
            page.profileTitle || name || character.name || '',
          events: page.events.map((event) => ({
            date: event.date || '',
            title: event.title || '',
            content: event.content || ''
          }))
        },
        updatedAt: new Date().toISOString()
      });

      setIsEditing(false);
      onSaved();
      onNotify('角色页面已保存');
    } catch (error) {
      console.error('[CameraEditor] 保存失败：', error);
      onNotify(error?.message || '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const displayTitle =
    page.profileTitle || name || character?.name || '未命名角色';

  const displayEvents = page.events || [];

  return (
    <section className="camera-page">
      <header className="camera-topbar">
        <div className="camera-brand">
          {page.archiveLabel || 'PRIVATE ARCHIVE'}
        </div>

        <div className="camera-top-actions">
          <span className="camera-year">USER EDITABLE ARCHIVE</span>

          <button
            type="button"
            onClick={() => setIsEditing((previous) => !previous)}
            className="camera-text-button"
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? '预览' : '编辑页面'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={savePage}
              disabled={isSaving}
              className="camera-save-button"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? '保存中' : '保存'}
            </button>
          )}
        </div>
      </header>

      {isEditing && (
        <div className="camera-editor-panel">
          <div className="camera-editor-heading">
            <div>
              <span className="camera-mini-label">
                PAGE PERSONALIZATION
              </span>
              <h3>编辑角色页面</h3>
            </div>

            <span className="camera-save-tip">
              图片会压缩后保存到当前角色资料
            </span>
          </div>

          <div className="camera-editor-grid">
            <div className="camera-editor-column">
              <label className="camera-field-label">
                角色名称
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="camera-input"
                  placeholder="输入角色名称"
                />
              </label>

              <label className="camera-field-label">
                页面眉标题
                <input
                  value={page.eyebrow}
                  onChange={(event) =>
                    updatePage('eyebrow', event.target.value)
                  }
                  className="camera-input"
                  placeholder="例如：CHOOSE YOUR PERSPECTIVE"
                />
              </label>

              <label className="camera-field-label">
                主标题
                <textarea
                  value={page.title}
                  onChange={(event) =>
                    updatePage('title', event.target.value)
                  }
                  rows={3}
                  className="camera-input camera-textarea"
                  placeholder="可以使用换行"
                />
              </label>

              <label className="camera-field-label">
                页面说明
                <textarea
                  value={page.intro}
                  onChange={(event) =>
                    updatePage('intro', event.target.value)
                  }
                  rows={4}
                  className="camera-input camera-textarea"
                />
              </label>

              <label className="camera-field-label">
                头像旁标题
                <input
                  value={page.profileTitle}
                  onChange={(event) =>
                    updatePage('profileTitle', event.target.value)
                  }
                  className="camera-input"
                />
              </label>

              <label className="camera-field-label">
                角色简介
                <textarea
                  value={page.profileDesc}
                  onChange={(event) =>
                    updatePage('profileDesc', event.target.value)
                  }
                  rows={4}
                  className="camera-input camera-textarea"
                />
              </label>
            </div>

            <div className="camera-editor-column">
              <label className="camera-field-label">
                页面状态
                <input
                  value={page.profileStatus}
                  onChange={(event) =>
                    updatePage('profileStatus', event.target.value)
                  }
                  className="camera-input"
                />
              </label>

              <label className="camera-field-label">
                相机文字
                <input
                  value={page.cameraCaption}
                  onChange={(event) =>
                    updatePage('cameraCaption', event.target.value)
                  }
                  className="camera-input"
                />
              </label>

              <label className="camera-field-label">
                对焦文字
                <input
                  value={page.cameraLabel}
                  onChange={(event) =>
                    updatePage('cameraLabel', event.target.value)
                  }
                  className="camera-input"
                />
              </label>

              <label className="camera-field-label">
                时间线标题
                <input
                  value={page.timelineTitle}
                  onChange={(event) =>
                    updatePage('timelineTitle', event.target.value)
                  }
                  className="camera-input"
                />
              </label>

              <label className="camera-field-label">
                时间线副标题
                <input
                  value={page.timelineSubtitle}
                  onChange={(event) =>
                    updatePage('timelineSubtitle', event.target.value)
                  }
                  className="camera-input"
                />
              </label>

              <ImageField
                label="角色头像"
                value={avatar}
                onChange={setAvatar}
              />

              <ImageField
                label="Banner 图片"
                value={banner}
                onChange={setBanner}
              />
            </div>
          </div>
        </div>
      )}

      <div className="camera-content">
        <section className="camera-intro">
          <div>
            <p className="camera-eyebrow">
              {page.eyebrow || 'CHOOSE YOUR PERSPECTIVE'}
            </p>

            <h1 className="camera-main-title">
              {escapeText(page.title || '').split('\n').map(
                (line, index) => (
                  <React.Fragment key={`${line}-${index}`}>
                    {line}
                    {index <
                      escapeText(page.title || '').split('\n').length -
                        1 && <br />}
                  </React.Fragment>
                )
              )}
            </h1>
          </div>

          <p className="camera-intro-copy">
            {page.intro}
          </p>
        </section>

        <section className="camera-stage">
          <div className="camera-glow" />

          <div className="camera-object">
            <div className="camera-body">
              <div className="camera-shutter" />
              <div className="camera-flash" />

              <div className="camera-viewfinder">
                {safeImage(banner) ? (
                  <img
                    src={safeImage(banner)}
                    alt=""
                    className="camera-banner-image"
                  />
                ) : (
                  <div className="camera-empty-image">
                    <ImageIcon className="h-8 w-8" />
                    <span>上传 Banner 图片</span>
                  </div>
                )}

                <div className="camera-focus-label">
                  {page.cameraLabel || 'FOCUS'} <span>●</span>
                </div>

                <div className="camera-info">
                  <div className="camera-name">
                    {String(displayTitle).toUpperCase()}
                  </div>

                  <div className="camera-number">
                    NO. {String(character?.id || '01')}
                  </div>
                </div>
              </div>

              <div className="camera-caption">
                {page.cameraCaption || 'USE THE FRAME TO REMEMBER'}
              </div>

              <div className="camera-lens" />
            </div>
          </div>
        </section>

        <section className="camera-profile">
          <div className="camera-profile-left">
            {safeImage(avatar) ? (
              <img
                src={safeImage(avatar)}
                alt={displayTitle}
                className="camera-avatar"
              />
            ) : (
              <div className="camera-avatar-placeholder">
                <ImageIcon className="h-8 w-8" />
                <span>未上传头像</span>
              </div>
            )}

            <h2 className="camera-profile-title">
              {displayTitle}
            </h2>

            <p className="camera-profile-desc">
              {page.profileDesc}
            </p>
          </div>

          <div className="camera-profile-right">
            <div className="camera-profile-topline">
              <span>
                CHARACTER / {String(character?.id || '001')}
              </span>

              <span>
                {page.profileStatus || 'ARCHIVED'}
              </span>
            </div>

            <div className="camera-timeline-heading">
              <h2>{page.timelineTitle || 'Fragments'}</h2>
              <span>
                {page.timelineSubtitle || 'PERSONAL TIMELINE'}
              </span>
            </div>

            <div className="camera-timeline">
              {displayEvents.length === 0 ? (
                <p className="camera-empty-events">
                  还没有时间线内容。
                  {isEditing && ' 点击下方按钮添加第一条内容。'}
                </p>
              ) : (
                displayEvents.map((event, index) => (
                  <article
                    className="camera-event"
                    key={`event-${index}`}
                  >
                    <div className="camera-event-dot" />

                    {isEditing ? (
                      <div className="camera-event-editor">
                        <input
                          value={event.date}
                          onChange={(inputEvent) =>
                            updateEvent(
                              index,
                              'date',
                              inputEvent.target.value
                            )
                          }
                          className="camera-input"
                          placeholder="日期，例如：2026.09.12"
                        />

                        <input
                          value={event.title}
                          onChange={(inputEvent) =>
                            updateEvent(
                              index,
                              'title',
                              inputEvent.target.value
                            )
                          }
                          className="camera-input"
                          placeholder="时间线标题"
                        />

                        <textarea
                          value={event.content}
                          onChange={(inputEvent) =>
                            updateEvent(
                              index,
                              'content',
                              inputEvent.target.value
                            )
                          }
                          rows={3}
                          className="camera-input camera-textarea"
                          placeholder="时间线内容"
                        />

                        <button
                          type="button"
                          onClick={() => removeEvent(index)}
                          className="camera-remove-event"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除此条
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="camera-event-date">
                          {event.date}
                        </div>

                        <h3>{event.title}</h3>

                        <p>{event.content}</p>
                      </>
                    )}
                  </article>
                ))
              )}
            </div>

            {isEditing && (
              <button
                type="button"
                onClick={addEvent}
                className="camera-add-event"
              >
                <Plus className="h-4 w-4" />
                添加时间线内容
              </button>
            )}
          </div>
        </section>

        <div className="camera-footer">
          <span>NO FIXED NAVIGATION / JUST FOLLOW THE LIGHT</span>
          <span>↘ END OF FRAME</span>
        </div>
      </div>
    </section>
  );
};

export const WorkflowApp = ({ onBackHub }) => {
  const [workflows, setWorkflows] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [candidateChats, setCandidateChats] = useState([]);
  const [isPickingChat, setIsPickingChat] = useState(false);
  const [formTarget, setFormTarget] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [toast, setToast] = useState('');

  const notify = useCallback((message) => {
    setToast(message);

    window.clearTimeout(window.__cameraToastTimer);

    window.__cameraToastTimer = window.setTimeout(() => {
      setToast('');
    }, 2400);
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);

    try {
      const [workflowData, characterData] = await Promise.all([
        getAllWorkflowsWithContext(),
        db.characters.toArray()
      ]);

      setWorkflows(workflowData || []);
      setCharacters(characterData || []);

      setSelectedCharacterId((previous) => {
        if (
          previous &&
          characterData?.some(
            (character) => character.id === previous
          )
        ) {
          return previous;
        }

        return characterData?.[0]?.id || null;
      });
    } catch (error) {
      console.error('[WorkflowApp] 读取数据失败：', error);
      notify('读取页面数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupedByCharacter = useMemo(() => {
    const groups = new Map();

    for (const workflow of workflows) {
      const key = workflow.characterId || 'unknown';

      if (!groups.has(key)) {
        groups.set(key, {
          character: workflow.character,
          items: []
        });
      }

      groups.get(key).items.push(workflow);
    }

    return Array.from(groups.values());
  }, [workflows]);

  const selectedCharacter = useMemo(() => {
    return (
      characters.find(
        (character) => character.id === selectedCharacterId
      ) || null
    );
  }, [characters, selectedCharacterId]);

  const handleOpenCreate = useCallback(async () => {
    try {
      const chats = await getWorkflowCandidateChats();
      setCandidateChats(chats || []);
      setIsPickingChat(true);
    } catch (error) {
      console.error('[WorkflowApp] 读取聊天列表失败：', error);
      notify('读取聊天列表失败');
    }
  }, [notify]);

  const handleToggleEnabled = useCallback(
    async (workflow) => {
      try {
        await setWorkflowEnabled(
          workflow.id,
          !workflow.enabled
        );
        await reload();
      } catch (error) {
        notify(error?.message || '更新工作流失败');
      }
    },
    [reload, notify]
  );

  const handleConfirmDelete = useCallback(
    async (workflow) => {
      try {
        await deleteWorkflow(workflow.id);
        setConfirmingDeleteId(null);
        await reload();
        notify('工作流已删除');
      } catch (error) {
        notify(error?.message || '删除工作流失败');
      }
    },
    [reload, notify]
  );

  const activeCount = workflows.filter(
    (workflow) => workflow.enabled
  ).length;

  return (
    <>
      <style>{`
        :root {
          --camera-bg: #f7f6f2;
          --camera-paper: #ffffff;
          --camera-paper-soft: #eceae4;
          --camera-ink: #111111;
          --camera-muted: #76746e;
          --camera-line: rgba(17,17,17,.16);
          --camera-shadow: rgba(17,17,17,.16);
        }

        .camera-page {
          min-height: 100%;
          width: 100%;
          overflow: hidden;
          background:
            radial-gradient(circle at 82% 12%, rgba(0,0,0,.06), transparent 25rem),
            var(--camera-bg);
          color: var(--camera-ink);
          font-family: Arial, "Noto Sans SC", sans-serif;
        }

        .camera-page *,
        .camera-page *::before,
        .camera-page *::after {
          box-sizing: border-box;
        }

        .camera-topbar {
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 clamp(20px, 5vw, 80px);
          border-bottom: 1px solid var(--camera-line);
        }

        .camera-brand {
          font-size: 11px;
          letter-spacing: .3em;
          opacity: .72;
        }

        .camera-top-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .camera-year,
        .camera-text-button,
        .camera-save-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 10px;
          letter-spacing: .13em;
          cursor: pointer;
        }

        .camera-year {
          color: var(--camera-muted);
        }

        .camera-text-button:hover {
          opacity: .6;
        }

        .camera-save-button {
          border: 1px solid var(--camera-ink);
          padding: 8px 12px;
          letter-spacing: .04em;
        }

        .camera-save-button:disabled {
          opacity: .45;
          cursor: wait;
        }

        .camera-content {
          width: min(1440px, 100%);
          margin: 0 auto;
          padding: clamp(28px, 5vw, 72px) clamp(20px, 5vw, 80px) 70px;
        }

        .camera-intro {
          display: grid;
          grid-template-columns: 1fr minmax(260px, 430px);
          align-items: end;
          gap: 40px;
          margin-bottom: 34px;
        }

        .camera-eyebrow {
          margin: 0 0 18px;
          color: var(--camera-muted);
          font-size: 10px;
          letter-spacing: .28em;
        }

        .camera-main-title {
          margin: 0;
          white-space: normal;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(52px, 9vw, 126px);
          font-weight: 400;
          line-height: .78;
          letter-spacing: -.08em;
        }

        .camera-intro-copy {
          max-width: 360px;
          margin: 0 0 6px;
          color: var(--camera-muted);
          font-size: 13px;
          line-height: 1.8;
        }

        .camera-stage {
          position: relative;
          min-height: 650px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .camera-glow {
          position: absolute;
          width: min(75vw, 680px);
          height: min(75vw, 680px);
          border-radius: 50%;
          background: linear-gradient(135deg, #dedbd2, #ffffff);
          filter: blur(55px);
          opacity: .85;
        }

        .camera-object {
          position: relative;
          z-index: 2;
          width: min(88vw, 540px);
          aspect-ratio: 1.02/.82;
          transform: rotate(-2deg);
          transition: transform .5s ease;
        }

        .camera-object:hover {
          transform: rotate(0deg) scale(1.015);
        }

        .camera-body {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(0,0,0,.42);
          border-radius: 10px;
          background: linear-gradient(145deg, #ffffff, #cbc9c2 62%, #f4f3ef);
          box-shadow: 25px 30px 80px var(--camera-shadow), inset 0 1px rgba(255,255,255,.8);
          padding: 28px 25px 24px;
        }

        .camera-body::after {
          content: "";
          position: absolute;
          inset: 10px;
          border: 1px solid rgba(0,0,0,.12);
          pointer-events: none;
        }

        .camera-viewfinder {
          position: absolute;
          left: 8%;
          right: 8%;
          top: 12%;
          bottom: 17%;
          overflow: hidden;
          border: 5px solid #e1dfd8;
          background: #dedcd5;
          box-shadow: inset 0 0 0 1px #777, 0 4px 12px rgba(0,0,0,.45);
        }

        .camera-viewfinder::before,
        .camera-viewfinder::after {
          content: "";
          position: absolute;
          z-index: 3;
          pointer-events: none;
        }

        .camera-viewfinder::before {
          inset: 0;
          background:
            linear-gradient(90deg, transparent 49.8%, rgba(255,255,255,.45) 50%, transparent 50.2%),
            linear-gradient(0deg, transparent 49.8%, rgba(255,255,255,.45) 50%, transparent 50.2%);
        }

        .camera-viewfinder::after {
          inset: 12px;
          border: 1px solid rgba(255,255,255,.7);
        }

        .camera-banner-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: grayscale(.35) contrast(1.04);
        }

        .camera-empty-image {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #66645e;
          font-size: 11px;
          letter-spacing: .1em;
        }

        .camera-focus-label {
          position: absolute;
          z-index: 4;
          top: 13px;
          left: 15px;
          color: white;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: .16em;
          text-shadow: 0 1px 4px rgba(0,0,0,.65);
        }

        .camera-focus-label span {
          color: #fff;
        }

        .camera-info {
          position: absolute;
          z-index: 4;
          right: 16px;
          bottom: 13px;
          left: 16px;
          display: flex;
          align-items: end;
          justify-content: space-between;
          color: white;
          text-shadow: 0 1px 4px rgba(0,0,0,.65);
        }

        .camera-name {
          max-width: 75%;
          overflow: hidden;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(22px, 5vw, 42px);
          letter-spacing: -.05em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .camera-number {
          color: #eee;
          font-family: monospace;
          font-size: 10px;
        }

        .camera-caption {
          position: absolute;
          bottom: 7%;
          left: 8%;
          color: #66645e;
          font-size: 9px;
          letter-spacing: .18em;
          text-transform: uppercase;
        }

        .camera-lens {
          position: absolute;
          right: 26px;
          bottom: -33px;
          z-index: 5;
          width: 74px;
          height: 74px;
          border: 5px solid #d2d0c9;
          border-radius: 50%;
          background:
            radial-gradient(circle, #fff 0 22%, #666 23% 25%, #202020 27% 48%, #888 49% 51%, #222 52%);
          box-shadow: 0 8px 20px rgba(0,0,0,.45);
        }

        .camera-flash {
          position: absolute;
          top: 12px;
          right: 28%;
          width: 48px;
          height: 10px;
          border-radius: 2px;
          background: #aaa9a3;
        }

        .camera-shutter {
          position: absolute;
          top: -14px;
          right: 23%;
          width: 60px;
          height: 18px;
          border: 1px solid #aaa;
          border-radius: 5px 5px 0 0;
          background: #deddd8;
        }

        .camera-profile {
          display: grid;
          grid-template-columns: minmax(230px, .7fr) minmax(0, 1.3fr);
          gap: clamp(28px, 6vw, 100px);
          margin-top: 30px;
          padding-top: 32px;
          border-top: 1px solid var(--camera-line);
        }

        .camera-profile-left {
          position: relative;
        }

        .camera-avatar,
        .camera-avatar-placeholder {
          width: min(230px, 48vw);
          aspect-ratio: 1;
          border-radius: 50% 50% 45% 52%;
          object-fit: cover;
          box-shadow: 18px 18px 0 rgba(0,0,0,.06);
        }

        .camera-avatar {
          filter: grayscale(.25);
        }

        .camera-avatar-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px dashed #aaa;
          color: #777;
          font-size: 11px;
        }

        .camera-profile-title {
          margin: 26px 0 14px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(42px, 7vw, 82px);
          font-weight: 400;
          line-height: .88;
          letter-spacing: -.08em;
        }

        .camera-profile-desc {
          max-width: 330px;
          color: var(--camera-muted);
          font-size: 13px;
          line-height: 1.8;
          white-space: pre-wrap;
        }

        .camera-profile-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--camera-muted);
          font-family: monospace;
          font-size: 10px;
          letter-spacing: .15em;
        }

        .camera-timeline-heading {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 45px 0 24px;
        }

        .camera-timeline-heading h2 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 30px;
          font-weight: 400;
        }

        .camera-timeline-heading span {
          color: var(--camera-muted);
          font-family: monospace;
          font-size: 10px;
        }

        .camera-timeline {
          position: relative;
          padding-left: 25px;
        }

        .camera-timeline::before {
          content: "";
          position: absolute;
          top: 8px;
          bottom: 0;
          left: 4px;
          width: 1px;
          background: linear-gradient(#777, transparent);
        }

        .camera-event {
          position: relative;
          margin-bottom: 32px;
        }

        .camera-event-dot {
          position: absolute;
          top: 6px;
          left: -24px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #333;
          box-shadow: 0 0 12px rgba(0,0,0,.35);
        }

        .camera-event-date {
          color: #777;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: .12em;
        }

        .camera-event h3 {
          margin: 7px 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 20px;
          font-weight: 400;
        }

        .camera-event p {
          max-width: 520px;
          margin: 0;
          color: var(--camera-muted);
          font-size: 12px;
          line-height: 1.8;
          white-space: pre-wrap;
        }

        .camera-footer {
          display: flex;
          align-items: end;
          justify-content: space-between;
          margin-top: 100px;
          color: #777;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: .12em;
        }

        .camera-editor-panel {
          width: min(1280px, calc(100% - 40px));
          margin: 0 auto 20px;
          padding: 20px;
          border-top: 1px solid var(--camera-line);
          border-bottom: 1px solid var(--camera-line);
          background: rgba(255,255,255,.55);
        }

        .camera-editor-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .camera-mini-label {
          display: block;
          color: #777;
          font-family: monospace;
          font-size: 9px;
          letter-spacing: .16em;
        }

        .camera-editor-heading h3 {
          margin: 5px 0 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 24px;
          font-weight: 400;
        }

        .camera-save-tip {
          color: #777;
          font-size: 11px;
        }

        .camera-editor-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
        }

        .camera-editor-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .camera-field-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #666;
          font-size: 10px;
          letter-spacing: .08em;
        }

        .camera-input {
          width: 100%;
          border: 1px solid rgba(0,0,0,.2);
          border-radius: 0;
          background: rgba(255,255,255,.72);
          padding: 10px 11px;
          color: #111;
          font-size: 13px;
          outline: none;
        }

        .camera-input:focus {
          border-color: #111;
        }

        .camera-textarea {
          resize: vertical;
          line-height: 1.6;
        }

        .camera-event-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-bottom: 12px;
        }

        .camera-remove-event,
        .camera-add-event {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: fit-content;
          border: 1px solid rgba(0,0,0,.2);
          background: transparent;
          padding: 8px 10px;
          color: #555;
          font-size: 11px;
          cursor: pointer;
        }

        .camera-remove-event:hover,
        .camera-add-event:hover {
          border-color: #111;
          color: #111;
        }

        .camera-add-event {
          margin-top: 4px;
        }

        .camera-empty-events {
          color: #888;
          font-size: 12px;
        }

        @media (max-width: 700px) {
          .camera-topbar {
            height: auto;
            min-height: 62px;
            align-items: flex-start;
            padding: 16px 18px;
          }

          .camera-top-actions {
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 8px;
          }

          .camera-year {
            display: none;
          }

          .camera-content {
            padding: 35px 18px 45px;
          }

          .camera-intro {
            display: block;
            margin-bottom: 16px;
          }

          .camera-main-title {
            margin-bottom: 22px;
            font-size: 65px;
          }

          .camera-intro-copy {
            font-size: 12px;
          }

          .camera-stage {
            min-height: 430px;
            margin: 0 -4px;
          }

          .camera-object {
            width: 94vw;
          }

          .camera-body {
            padding: 18px;
          }

          .camera-lens {
            right: 18px;
            bottom: -26px;
            width: 58px;
            height: 58px;
          }

          .camera-profile {
            display: block;
            margin-top: 50px;
            padding-top: 26px;
          }

          .camera-profile-left {
            margin-bottom: 50px;
          }

          .camera-avatar,
          .camera-avatar-placeholder {
            width: 145px;
          }

          .camera-profile-title {
            font-size: 57px;
          }

          .camera-timeline-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
            margin-top: 30px;
          }

          .camera-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            margin-top: 70px;
          }

          .camera-editor-panel {
            width: 100%;
            margin-bottom: 0;
            padding: 18px;
          }

          .camera-editor-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .camera-editor-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="space-y-6 pb-24">
        <header className="flex items-center gap-3 px-1 pt-2">
          <button
            type="button"
            onClick={onBackHub}
            aria-label="返回"
            className="rounded-full border p-2"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
              Standing Routines
            </p>

            <h2 className="font-serif text-xl font-semibold">
              工作流
            </h2>
          </div>
        </header>

        {selectedCharacter ? (
          <CameraEditor
            character={selectedCharacter}
            onSaved={reload}
            onNotify={notify}
          />
        ) : (
          <div className="px-5 py-20 text-center text-sm opacity-50">
            {isLoading
              ? '正在加载角色页面…'
              : '暂时没有角色资料，请先创建角色。'}
          </div>
        )}

        <div
          className="relative overflow-hidden px-5 pb-8 pt-6"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            clipPath: TORN_EDGE_CLIP
          }}
        >
          <p className="font-serif text-2xl italic leading-snug opacity-85">
            在你不在的时候，
            <br />
            也有人记得该说的话。
          </p>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] opacity-45">
            {isLoading
              ? '加载中…'
              : `${activeCount} / ${workflows.length} 条工作流正在运行`}
          </p>
        </div>

        {characters.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-1 pb-1">
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => setSelectedCharacterId(character.id)}
                className="flex shrink-0 items-center gap-2 border px-3 py-2 text-left text-xs"
                style={{
                  borderColor:
                    character.id === selectedCharacterId
                      ? 'var(--text-main)'
                      : 'var(--card-border)',
                  backgroundColor:
                    character.id === selectedCharacterId
                      ? 'var(--control-soft-bg)'
                      : 'transparent'
                }}
              >
                {safeImage(character.avatar) ? (
                  <img
                    src={safeImage(character.avatar)}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-black/5" />
                )}

                <span>{character.name || '未命名角色'}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-8 px-1">
          {!isLoading && groupedByCharacter.length === 0 && (
            <p className="py-10 text-center text-sm opacity-50">
              还没有任何工作流，点击下方按钮创建第一条吧。
            </p>
          )}

          {groupedByCharacter.map((group) => (
            <section
              key={group.character?.id || 'unknown'}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-1">
                {safeImage(group.character?.avatar) ? (
                  <img
                    src={safeImage(group.character.avatar)}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-black/5" />
                )}

                <h3 className="font-serif text-sm font-semibold italic opacity-80">
                  {group.character?.name || '未知角色'}
                </h3>
              </div>

              <div className="space-y-4">
                {group.items.map((workflow, index) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    rotate={index % 2 === 0 ? -1.2 : 1}
                    onEdit={(target) =>
                      setFormTarget({ workflow: target })
                    }
                    onToggleEnabled={handleToggleEnabled}
                    onRequestDelete={setConfirmingDeleteId}
                    confirmingDelete={
                      confirmingDeleteId === workflow.id
                    }
                    onCancelDelete={() =>
                      setConfirmingDeleteId(null)
                    }
                    onConfirmDelete={handleConfirmDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold shadow-lg"
          style={{
            backgroundColor: 'var(--text-main)',
            color: 'var(--bg-main)',
            borderColor: 'var(--card-border)'
          }}
        >
          <Plus className="h-4 w-4" />
          新建工作流
        </button>

        {isPickingChat && (
          <ChatPickerSheet
            chats={candidateChats}
            onClose={() => setIsPickingChat(false)}
            onPick={(chat) => {
              setIsPickingChat(false);
              setFormTarget({ chat });
            }}
          />
        )}

        {formTarget && (
          <WorkflowFormSheet
            chat={formTarget.chat}
            workflow={formTarget.workflow}
            onClose={() => setFormTarget(null)}
            onSaved={() => {
              setFormTarget(null);
              void reload();
            }}
          />
        )}

        {toast && (
          <div
            className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 border px-4 py-3 text-xs shadow-lg"
            style={{
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              borderColor: 'var(--card-border)'
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </>
  );
};

export default WorkflowApp;
