import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  Clock3,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

import db from '../../db';
import {
  getAllWorkflowsWithContext,
  getWorkflowCandidateChats,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowEnabled
} from '../../services/workflow/workflowService';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const DEFAULT_WORKFLOW_PROFILE = {
  key: 'current_user',
  name: 'User',
  handle: '@WHAT',
  bio: 'We are all in the gutter, but some of us are looking at the stars.',
  location: 'Archive Space',
  avatar: '',
  banner: ''
};

const safeImage = (value) => {
  if (typeof value !== 'string') return '';
  if (value.startsWith('data:image/')) return value;
  if (value.startsWith('blob:')) return value;
  return '';
};

const formatWeekdays = (weekdays) => {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return '未设置';
  if (weekdays.length === 7) return '每天';
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_LABELS[day])
    .join('、');
};

const formatTime = (value) => {
  if (!value) return '00:00';
  return String(value).slice(0, 5);
};

const getCharacterId = (character) => character?.id ?? character?.characterId;
const getCharacterName = (character) => character?.name || character?.displayName || '未命名角色';

const getCharacterAvatar = (character) =>
  safeImage(character?.workflowAvatar || character?.avatar || character?.userAvatar);

const getCharacterBanner = (character) =>
  safeImage(character?.workflowBanner || character?.banner || character?.bgImage);

const getInitial = (value) => String(value || '?').trim().slice(0, 1).toUpperCase();

// 本地 Canvas 压缩图片为 Base64，不消耗服务端也不走外链
const compressImage = (file, options = {}) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('请选择有效的图片文件'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = options.maxWidth || 1600;
        const maxHeight = options.maxHeight || 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', options.quality || 0.82));
      };
      img.onerror = () => reject(new Error('图片解析失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });

// 无缝上传组件
const LocalImageUploader = ({
  label,
  value,
  onChange,
  aspect = 'square',
  className = ''
}) => {
  const inputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const base64 = await compressImage(file, {
        maxWidth: aspect === 'wide' ? 1800 : 900,
        maxHeight: aspect === 'wide' ? 1000 : 900,
        quality: 0.82
      });
      onChange(base64);
    } catch (err) {
      alert(err.message || '图片处理失败');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const getShapeClasses = () => {
    if (aspect === 'circle') return 'h-24 w-24 rounded-full';
    if (aspect === 'wide') return 'h-36 w-full rounded-2xl';
    return 'h-28 w-28 rounded-2xl';
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <div
        onClick={() => inputRef.current?.click()}
        className={`group relative flex cursor-pointer items-center justify-center overflow-hidden border border-black/10 bg-black/[0.03] transition-all hover:bg-black/[0.06] ${getShapeClasses()}`}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 p-3 text-center text-black/40">
            <ImagePlus className="h-5 w-5 stroke-[1.5]" />
            <span className="text-[10px] tracking-wider">{label}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 backdrop-blur-[2px] transition group-hover:opacity-100">
          {isProcessing ? (
            <span className="text-xs">压缩中…</span>
          ) : (
            <Camera className="h-5 w-5 stroke-[1.5]" />
          )}
        </div>
      </div>
    </div>
  );
};

// 【保留原业务】精确的工作流运行状态徽标
const WorkflowStatusIndicator = ({ workflow }) => {
  if (!workflow.lastRunAt) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider opacity-40">
        <CircleDashed className="h-2.5 w-2.5" />
        尚未运行
      </span>
    );
  }

  if (workflow.lastRunStatus === 'error') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-rose-500 opacity-80" title={workflow.lastRunError}>
        <CircleAlert className="h-2.5 w-2.5" />
        {workflow.lastRunError ? workflow.lastRunError.slice(0, 18) : '执行异常'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider opacity-60">
      <CheckCircle2 className="h-2.5 w-2.5" />
      已送达
    </span>
  );
};

// 照相机相片质感角色卡
const CameraFilmItem = ({ character, index, isActive, onClick }) => {
  const avatar = getCharacterAvatar(character);
  const banner = getCharacterBanner(character);
  const displayPhoto = banner || avatar;

  return (
    <div
      onClick={onClick}
      className={`group relative shrink-0 cursor-pointer select-none transition-all duration-500 ease-out ${
        isActive
          ? 'h-[22rem] w-[15.5rem] opacity-100 scale-100'
          : 'h-[17rem] w-[11.5rem] opacity-35 scale-95 grayscale hover:opacity-60 hover:grayscale-0'
      }`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
        {displayPhoto ? (
          <img
            src={displayPhoto}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 font-serif text-6xl italic text-white/40">
            {getInitial(getCharacterName(character))}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute bottom-5 left-5 right-5 text-white">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/60">
              0{index + 1} / FILM
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          </div>
          <p className="mt-2 truncate font-serif text-2xl italic tracking-wide text-white">
            {getCharacterName(character)}
          </p>
        </div>
      </div>
    </div>
  );
};

// 【保留原业务】时间轴项：完整包含会话名、状态指示、行内两步确认删除与开关
const TimelineEntry = ({
  workflow,
  onEdit,
  onRequestDelete,
  confirmingDelete,
  onCancelDelete,
  onConfirmDelete,
  onToggle
}) => (
  <div className="group relative grid grid-cols-[4.5rem_1px_1fr] gap-5 py-5">
    <div className="pt-0.5 text-right">
      <p className="font-mono text-xs font-medium tracking-wider">
        {formatTime(workflow.time)}
      </p>
      <p className="mt-1 text-[10px] tracking-tight opacity-40">
        {formatWeekdays(workflow.weekdays)}
      </p>
    </div>

    {/* 极细时间轴线 */}
    <div className="relative bg-current opacity-15">
      <span
        className={`absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full border-2 border-white transition-all ${
          workflow.enabled ? 'bg-current opacity-100 ring-2 ring-current/20' : 'bg-current opacity-25'
        }`}
      />
    </div>

    <div className="pb-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-40">
              {workflow.chat?.title || workflow.character?.name || '未命名聊天'}
            </p>
            <span className="opacity-25">·</span>
            <WorkflowStatusIndicator workflow={workflow} />
          </div>

          <h4 className="mt-1 font-serif text-xl italic tracking-wide">
            {workflow.name || '未命名事务'}
          </h4>

          {workflow.goal && (
            <p className="mt-1.5 max-w-lg text-xs leading-relaxed opacity-60">
              {workflow.goal}
            </p>
          )}
        </div>

        {/* 操作区：带行内两步安全删除 */}
        <div className="flex shrink-0 items-center gap-1.5">
          {confirmingDelete ? (
            <div className="flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 text-[11px] backdrop-blur-sm">
              <button
                type="button"
                onClick={onConfirmDelete}
                className="font-medium text-rose-500 hover:underline"
              >
                确认删除
              </button>
              <span className="opacity-30">/</span>
              <button
                type="button"
                onClick={onCancelDelete}
                className="opacity-60 hover:opacity-100"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onEdit(workflow)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
                title="编辑"
              >
                <Pencil className="h-3.5 w-3.5 opacity-70" />
              </button>
              <button
                type="button"
                onClick={onRequestDelete}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onToggle(workflow)}
          className={`flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] transition ${
            workflow.enabled ? 'opacity-70' : 'opacity-30'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              workflow.enabled ? 'bg-current' : 'bg-current/30'
            }`}
          />
          {workflow.enabled ? 'ACTIVE ROUTINE' : 'PAUSED'}
        </button>
      </div>
    </div>
  </div>
);

// 专属编辑抽屉（独立保存，不污染全局）
const ProfileAndVisualEditor = ({
  userProfile,
  currentCharacter,
  onClose,
  onSave
}) => {
  const [draftUser, setDraftUser] = useState(userProfile);
  const [draftChar, setDraftChar] = useState(currentCharacter);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draftUser, draftChar);
      onClose();
    } catch (e) {
      alert(e.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end bg-black/40 backdrop-blur-sm transition-all">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 text-[#111] shadow-2xl transition-all sm:p-10">
        <div className="flex items-center justify-between border-b border-black/10 pb-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">
              Personal Aesthetic
            </p>
            <h2 className="mt-1 font-serif text-2xl italic">专属档案美化</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full opacity-50 hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-8 space-y-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg italic">你的独立展板</h3>
              <span className="text-[10px] text-black/40">
                仅在当前工作流子页面生效
              </span>
            </div>

            <div>
              <span className="mb-2 block text-xs opacity-50">横幅背景 (Banner)</span>
              <LocalImageUploader
                label="上传专属横幅"
                aspect="wide"
                value={draftUser?.banner}
                onChange={(img) => setDraftUser((prev) => ({ ...prev, banner: img }))}
              />
            </div>

            <div className="flex items-center gap-5 pt-2">
              <div>
                <span className="mb-2 block text-xs opacity-50">专属头像</span>
                <LocalImageUploader
                  label="上传头像"
                  aspect="circle"
                  value={draftUser?.avatar}
                  onChange={(img) => setDraftUser((prev) => ({ ...prev, avatar: img }))}
                />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <span className="mb-1 block text-xs opacity-50">你的称呼</span>
                  <input
                    value={draftUser?.name || ''}
                    onChange={(e) => setDraftUser((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full border-b border-black/20 bg-transparent py-1 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs opacity-50">Handle 标识</span>
                  <input
                    value={draftUser?.handle || ''}
                    onChange={(e) => setDraftUser((prev) => ({ ...prev, handle: e.target.value }))}
                    className="w-full border-b border-black/20 bg-transparent py-1 text-sm outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs opacity-50">随笔格言 / Bio</span>
              <textarea
                rows={2}
                value={draftUser?.bio || ''}
                onChange={(e) => setDraftUser((prev) => ({ ...prev, bio: e.target.value }))}
                className="w-full resize-none border-b border-black/20 bg-transparent py-1 text-xs outline-none focus:border-black"
              />
            </div>
          </section>

          {draftChar && (
            <section className="space-y-4 border-t border-black/10 pt-8">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg italic">
                  角色相片：{getCharacterName(draftChar)}
                </h3>
                <span className="text-[10px] text-black/40">独立胶片写真</span>
              </div>

              <div>
                <span className="mb-2 block text-xs opacity-50">
                  相片/封面（将在滑动相册与顶部优先展示）
                </span>
                <LocalImageUploader
                  label="上传角色专属写真大图"
                  aspect="wide"
                  value={draftChar.workflowBanner || draftChar.banner}
                  onChange={(img) =>
                    setDraftChar((prev) => ({ ...prev, workflowBanner: img }))
                  }
                />
              </div>

              <div className="flex items-center gap-5 pt-2">
                <div>
                  <span className="mb-2 block text-xs opacity-50">专属头像</span>
                  <LocalImageUploader
                    label="头像"
                    aspect="circle"
                    value={draftChar.workflowAvatar || draftChar.avatar}
                    onChange={(img) =>
                      setDraftChar((prev) => ({ ...prev, workflowAvatar: img }))
                    }
                  />
                </div>
                <div className="flex-1">
                  <span className="mb-1 block text-xs opacity-50">角色专属语录</span>
                  <textarea
                    rows={3}
                    value={draftChar.workflowBio || draftChar.bio || ''}
                    onChange={(e) =>
                      setDraftChar((prev) => ({ ...prev, workflowBio: e.target.value }))
                    }
                    placeholder="为这个角色写一段独白..."
                    className="w-full resize-none border-b border-black/20 bg-transparent py-1 text-xs outline-none focus:border-black"
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="mt-10 border-t border-black/10 pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-xs uppercase tracking-widest text-white transition hover:bg-black/80 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {isSaving ? '正在写入档案…' : '确认并应用美化'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 【保留原业务】新增/编辑工作流表单：严格保留原版的空星期校验与 errorText 输出
const WorkflowFormModal = ({ chat, workflow, onClose, onSaved }) => {
  const isEdit = Boolean(workflow?.id);
  const targetChat = workflow?.chat || chat;
  const targetCharacter = workflow?.character || chat?.character;

  const [name, setName] = useState(workflow?.name || '');
  const [time, setTime] = useState(workflow?.time || '09:00');
  const [goal, setGoal] = useState(workflow?.goal || '');
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [weekdays, setWeekdays] = useState(
    Array.isArray(workflow?.weekdays) && workflow.weekdays.length
      ? workflow.weekdays
      : [1, 2, 3, 4, 5]
  );
  const [errorText, setErrorText] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleDay = (day) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorText('请输入工作流名称。');
      return;
    }

    if (weekdays.length === 0) {
      setErrorText('请至少选择一个重复星期。');
      return;
    }

    setSaving(true);
    setErrorText('');

    try {
      if (isEdit) {
        await updateWorkflow(workflow.id, {
          name: name.trim(),
          time,
          weekdays,
          goal: goal.trim(),
          enabled
        });
      } else {
        await createWorkflow({
          chatId: targetChat.id,
          characterId: targetChat.characterId,
          name: name.trim(),
          time,
          weekdays,
          goal: goal.trim(),
          enabled
        });
      }
      onSaved();
    } catch (e) {
      setErrorText(e?.message || '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 text-[#111] shadow-2xl sm:rounded-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-black/10 pb-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">
              {targetCharacter?.name || '未知角色'} · {targetChat?.title || '主会话'}
            </p>
            <h3 className="mt-1 font-serif text-2xl italic">
              {isEdit ? '修整时间节点' : '建立时刻安排'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 opacity-40 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-5 text-xs">
          <div>
            <span className="mb-1 block opacity-50">事务名称</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorText) setErrorText('');
              }}
              placeholder="例如：早安问候"
              className="w-full border-b border-black/20 bg-transparent py-2 text-sm outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="mb-1 block opacity-50">触发时刻</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border-b border-black/20 bg-transparent py-2 font-mono text-sm outline-none"
              />
            </div>
            <div>
              <span className="mb-1 block opacity-50">运转状态</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className="mt-2 flex items-center gap-2 font-mono text-xs uppercase"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    enabled ? 'bg-black' : 'bg-black/20'
                  }`}
                />
                {enabled ? 'Active' : 'Paused'}
              </button>
            </div>
          </div>

          <div>
            <span className="mb-2 block opacity-50">重复周期</span>
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const isSelected = weekdays.includes(day);
                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() => toggleDay(day)}
                    className={`h-8 w-8 rounded-full font-mono text-[11px] transition ${
                      isSelected
                        ? 'bg-black text-white'
                        : 'bg-black/5 text-black/40 hover:bg-black/10'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-1 block opacity-50">触发意图 (Goal)</span>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="交代此时角色需要做的事..."
              className="w-full resize-none border-b border-black/20 bg-transparent py-2 text-xs outline-none focus:border-black"
            />
          </div>

          {errorText && (
            <p className="font-mono text-xs text-rose-500">
              {errorText}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-xs uppercase tracking-widest text-white transition hover:bg-black/85 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? '记录中…' : '保存进入时间线'}
        </button>
      </div>
    </div>
  );
};

// 选对话绑定弹层
const ChatSelectorModal = ({ chats, onSelect, onClose }) => (
  <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
    <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 text-[#111] shadow-2xl sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-black/10 pb-4">
        <h3 className="font-serif text-xl italic">挂接对话通道</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 opacity-40 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 space-y-1">
        {chats.length === 0 ? (
          <p className="py-8 text-center text-xs opacity-40">暂无可用对话</p>
        ) : (
          chats.map((chat) => (
            <button
              type="button"
              key={chat.id}
              onClick={() => onSelect(chat)}
              className="flex w-full items-center gap-3.5 border-b border-black/5 p-3 text-left transition hover:bg-black/[0.03]"
            >
              <img
                src={getCharacterAvatar(chat.character)}
                alt=""
                className="h-10 w-10 rounded-full object-cover bg-black/5"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-sm font-semibold">
                  {getCharacterName(chat.character)}
                </p>
                <p className="truncate font-mono text-[10px] opacity-40">
                  {chat.title || '默认会话'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  </div>
);

// 主应用入口
export const WorkflowApp = ({ onBackHub }) => {
  const [userProfile, setUserProfile] = useState(DEFAULT_WORKFLOW_PROFILE);
  const [characters, setCharacters] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [themeMode, setThemeMode] = useState('light');

  const [isEditingVisuals, setIsEditingVisuals] = useState(false);
  const [isPickingChat, setIsPickingChat] = useState(false);
  const [candidateChats, setCandidateChats] = useState([]);
  const [formSheetTarget, setFormSheetTarget] = useState(null);
  
  // 【保留原业务】行内删除状态管理
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const containerRef = useRef(null);
  const touchStartRef = useRef(0);

  // 1. 初始化读取数据（优先读取工作流独立档案）
  const reloadData = useCallback(async () => {
    try {
      const [chars, wfs] = await Promise.all([
        db.characters.toArray(),
        getAllWorkflowsWithContext()
      ]);

      let customProfile = null;
      if (db.workflowProfiles) {
        customProfile = await db.workflowProfiles.get('current_user');
      }

      if (!customProfile) {
        const sysProfile = await db.profile.toCollection().first();
        customProfile = {
          key: 'current_user',
          name: sysProfile?.name || DEFAULT_WORKFLOW_PROFILE.name,
          handle: sysProfile?.handle || DEFAULT_WORKFLOW_PROFILE.handle,
          bio: sysProfile?.bio || DEFAULT_WORKFLOW_PROFILE.bio,
          location: sysProfile?.location || DEFAULT_WORKFLOW_PROFILE.location,
          avatar: sysProfile?.avatar || '',
          banner: sysProfile?.banner || ''
        };
      }

      setUserProfile(customProfile);
      setCharacters(chars || []);
      setWorkflows(wfs || []);
    } catch (err) {
      console.error('[WorkflowApp] 初始化读取失败:', err);
    }
  }, []);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  // 2. 黑白模式与主题 CSS 变量双向同步
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.style.setProperty('--bg-main', '#0a0a0a');
      root.style.setProperty('--text-main', '#f2f2f2');
      root.style.setProperty('--control-soft-bg', '#181818');
      root.style.setProperty('--card-border', 'rgba(255,255,255,0.12)');
    } else {
      root.style.setProperty('--bg-main', '#ffffff');
      root.style.setProperty('--text-main', '#0f0f0f');
      root.style.setProperty('--control-soft-bg', '#f5f5f5');
      root.style.setProperty('--card-border', 'rgba(0,0,0,0.08)');
    }
  }, [themeMode]);

  const currentCharacter = characters[selectedIndex] || null;

  const currentWorkflows = useMemo(() => {
    if (!currentCharacter) return [];
    const charId = getCharacterId(currentCharacter);
    return workflows
      .filter((w) => w.characterId === charId)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [currentCharacter, workflows]);

  const switchCharacter = (step) => {
    if (!characters.length) return;
    setSelectedIndex((prev) => {
      const next = prev + step;
      if (next < 0) return characters.length - 1;
      if (next >= characters.length) return 0;
      return next;
    });
  };

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    if (delta > 45) {
      switchCharacter(-1);
    } else if (delta < -45) {
      switchCharacter(1);
    }
  };

  const handleSaveVisuals = async (nextUser, nextChar) => {
    if (db.workflowProfiles) {
      await db.workflowProfiles.put({
        ...nextUser,
        key: 'current_user',
        updatedAt: Date.now()
      });
    }

    if (nextChar?.id) {
      await db.characters.update(nextChar.id, {
        workflowBanner: nextChar.workflowBanner,
        workflowAvatar: nextChar.workflowAvatar,
        workflowBio: nextChar.workflowBio
      });
    }

    await reloadData();
  };

  const handleCreateNewWorkflow = async () => {
    try {
      const chats = await getWorkflowCandidateChats();
      setCandidateChats(chats || []);
      setIsPickingChat(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleWorkflow = async (wf) => {
    await setWorkflowEnabled(wf.id, !wf.enabled);
    await reloadData();
  };

  // 【保留原业务】非原生弹窗、两步行内确认删除
  const handleConfirmDelete = async (workflowId) => {
    try {
      await deleteWorkflow(workflowId);
      setConfirmingDeleteId(null);
      await reloadData();
    } catch (e) {
      alert(e?.message || '删除失败');
    }
  };

  const activeBanner =
    getCharacterBanner(currentCharacter) || safeImage(userProfile.banner);
  const activeUserAvatar = safeImage(userProfile.avatar);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[9999] h-[100dvh] w-screen overflow-y-auto overflow-x-hidden font-sans transition-colors duration-500 ${
        themeMode === 'dark' ? 'bg-[#0a0a0a] text-[#f2f2f2]' : 'bg-white text-[#111]'
      }`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <style>{`
        .film-scroll::-webkit-scrollbar { display: none; }
        .film-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      {/* 极简顶栏 */}
      <header className="relative z-20 flex items-center justify-between px-6 pt-5 pb-3">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-2 text-xs tracking-widest uppercase opacity-60 transition hover:opacity-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Hub</span>
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
            className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-45 hover:opacity-100"
          >
            {themeMode === 'light' ? 'DARK' : 'WHITE'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditingVisuals(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            title="定制专属主页"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 1. 顶部大展板 */}
      <div className="relative mx-auto w-full px-4 sm:px-8">
        <div className="relative min-h-[22rem] w-full overflow-hidden rounded-3xl bg-zinc-800 text-white sm:min-h-[28rem]">
          {activeBanner ? (
            <img
              src={activeBanner}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out"
            />
          ) : (
            <div className="absolute inset-0 bg-[#161616]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          <div className="relative flex h-full min-h-[22rem] flex-col justify-between p-6 sm:min-h-[28rem] sm:p-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">
                  PERSONAL ARCHIVE
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/40">
                  {userProfile.location || 'CHRONICLE SPACE'}
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-white/50" />
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="max-w-lg">
                <span className="font-mono text-[10px] tracking-wider text-white/60">
                  {userProfile.handle || '@USER'}
                </span>
                <h1 className="mt-1 font-serif text-4xl italic tracking-wide text-white sm:text-6xl">
                  {userProfile.name || 'User'}
                </h1>
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/70">
                  {userProfile.bio}
                </p>
              </div>

              <div className="shrink-0">
                {activeUserAvatar ? (
                  <img
                    src={activeUserAvatar}
                    alt=""
                    className="h-16 w-16 rounded-full border border-white/30 object-cover shadow-lg sm:h-20 sm:w-20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/10 font-serif text-xl sm:h-20 sm:w-20">
                    {getInitial(userProfile.name)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 相机相片感选人画廊 */}
      <section className="mt-12 px-4 sm:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-40">
              Select Protagonist
            </p>
            <h2 className="mt-1 font-serif text-3xl italic tracking-tight sm:text-4xl">
              挑选人物
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => switchCharacter(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-current/10 opacity-60 transition hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => switchCharacter(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-current/10 opacity-60 transition hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {characters.length === 0 ? (
          <div className="py-12 text-center text-xs opacity-40">
            暂无角色，请在宿主应用中创建角色后再来挑选
          </div>
        ) : (
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="film-scroll -mx-4 flex items-center gap-4 overflow-x-auto px-4 py-2 sm:-mx-8 sm:px-8"
          >
            {characters.map((char, idx) => (
              <CameraFilmItem
                key={getCharacterId(char)}
                character={char}
                index={idx}
                isActive={idx === selectedIndex}
                onClick={() => setSelectedIndex(idx)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3. 独立角色页面详情与时间轴 */}
      {currentCharacter && (
        <section className="mt-16 px-4 pb-24 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-40">
                    Solo Journal
                  </p>
                  <h3 className="mt-1 font-serif text-3xl italic tracking-wide">
                    {getCharacterName(currentCharacter)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingVisuals(true)}
                  className="rounded-full p-2 opacity-50 hover:opacity-100"
                  title="上传专属照片"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-4 text-xs leading-relaxed opacity-60">
                {currentCharacter.workflowBio ||
                  currentCharacter.bio ||
                  '未填写专属描述，点击右上角笔形图标即可为他撰写独白或上传胶片写真。'}
              </p>

              <div className="mt-8 flex gap-6 font-mono text-[10px] uppercase tracking-widest opacity-40">
                <span>{currentWorkflows.length} ROUTINES</span>
                <span>CHRONICLE LINKED</span>
              </div>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between border-b border-current/10 pb-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">
                    Timeline Sequence
                  </p>
                  <h4 className="mt-1 font-serif text-2xl italic">运行时刻</h4>
                </div>

                <button
                  type="button"
                  onClick={handleCreateNewWorkflow}
                  className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider opacity-60 hover:opacity-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>添加时刻</span>
                </button>
              </div>

              {currentWorkflows.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock3 className="mx-auto h-5 w-5 opacity-30" />
                  <p className="mt-3 font-serif text-base italic opacity-50">
                    还没有为 {getCharacterName(currentCharacter)} 设立任何时间流。
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateNewWorkflow}
                    className="mt-3 text-xs underline underline-offset-4 opacity-70"
                  >
                    创建第一条工作流
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-current/5">
                  {currentWorkflows.map((wf) => (
                    <TimelineEntry
                      key={wf.id}
                      workflow={wf}
                      onEdit={(item) => setFormSheetTarget({ workflow: item })}
                      confirmingDelete={confirmingDeleteId === wf.id}
                      onRequestDelete={() => setConfirmingDeleteId(wf.id)}
                      onCancelDelete={() => setConfirmingDeleteId(null)}
                      onConfirmDelete={() => handleConfirmDelete(wf.id)}
                      onToggle={handleToggleWorkflow}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 选对话绑定弹层 */}
      {isPickingChat && (
        <ChatSelectorModal
          chats={candidateChats}
          onSelect={(chat) => {
            setIsPickingChat(false);
            setFormSheetTarget({ chat });
          }}
          onClose={() => setIsPickingChat(false)}
        />
      )}

      {/* 编辑/新建工作流 */}
      {formSheetTarget && (
        <WorkflowFormModal
          chat={formSheetTarget.chat}
          workflow={formSheetTarget.workflow}
          onClose={() => setFormSheetTarget(null)}
          onSaved={async () => {
            setFormSheetTarget(null);
            await reloadData();
          }}
        />
      )}

      {/* 独立美化抽屉 */}
      {isEditingVisuals && (
        <ProfileAndVisualEditor
          userProfile={userProfile}
          currentCharacter={currentCharacter}
          onClose={() => setIsEditingVisuals(false)}
          onSave={handleSaveVisuals}
        />
      )}
    </div>
  );
};

export default WorkflowApp;
