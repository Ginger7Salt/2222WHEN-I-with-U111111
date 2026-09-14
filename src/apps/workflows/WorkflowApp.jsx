import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
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

const DEFAULT_PROFILE = {
  id: 1,
  name: '你的名字',
  handle: '@yourstory',
  bio: '记录一些人，也记录一些没有被说出口的时刻。',
  location: '',
  joined: '',
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

const formatDate = (value) => {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatTime = (value) => {
  if (!value) return '未设置';
  return String(value).slice(0, 5);
};

const getCharacterId = (character) => character?.id ?? character?.characterId;

const getCharacterName = (character) =>
  character?.name || character?.displayName || '未命名角色';

const getCharacterAvatar = (character) =>
  safeImage(character?.avatar || character?.userAvatar);

const getCharacterBanner = (character) =>
  safeImage(character?.banner || character?.cover || character?.bgImage);

const getInitial = (value) => String(value || '?').trim().slice(0, 1).toUpperCase();

const readAndCompressImage = (file, options = {}) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxWidth = options.maxWidth || 1600;
        const maxHeight = options.maxHeight || 1200;
        const ratio = Math.min(
          1,
          maxWidth / image.width,
          maxHeight / image.height
        );

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));

        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(
          canvas.toDataURL('image/jpeg', options.quality || 0.82)
        );
      };

      image.onerror = () => reject(new Error('图片读取失败'));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });

const LocalImageInput = ({
  label,
  value,
  onChange,
  circular = false,
  wide = false
}) => {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      const image = await readAndCompressImage(file, {
        maxWidth: wide ? 1800 : 1000,
        maxHeight: wide ? 900 : 1000,
        quality: 0.82
      });

      onChange(image);
    } catch (error) {
      alert(error?.message || '图片处理失败');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={[
          'group relative flex overflow-hidden bg-black/[0.04] transition hover:bg-black/[0.08]',
          circular ? 'h-24 w-24 rounded-full' : '',
          wide ? 'h-28 w-full rounded-[1.5rem]' : '',
          !circular && !wide ? 'h-24 w-24 rounded-2xl' : ''
        ].join(' ')}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="m-auto flex flex-col items-center gap-1 text-black/45">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </span>
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          {loading ? '处理中…' : <Camera className="h-5 w-5" />}
        </span>
      </button>
    </div>
  );
};

const IconButton = ({ children, onClick, label, dark = false }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={[
      'flex h-9 w-9 items-center justify-center rounded-full transition',
      dark
        ? 'bg-black text-white hover:bg-black/75'
        : 'bg-white/75 text-black hover:bg-white'
    ].join(' ')}
  >
    {children}
  </button>
);

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={[
      'relative h-5 w-9 rounded-full transition',
      value ? 'bg-black' : 'bg-black/15'
    ].join(' ')}
  >
    <span
      className={[
        'absolute top-0.5 h-4 w-4 rounded-full bg-white transition',
        value ? 'left-[18px]' : 'left-0.5'
      ].join(' ')}
    />
  </button>
);

const CharacterPortrait = ({
  character,
  active,
  index,
  onClick
}) => {
  const avatar = getCharacterAvatar(character);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative shrink-0 overflow-hidden text-left transition-all duration-500',
        active
          ? 'h-[18rem] w-[13rem] opacity-100'
          : 'h-[13rem] w-[9rem] opacity-45 grayscale hover:opacity-75'
      ].join(' ')}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black text-5xl font-serif text-white">
          {getInitial(getCharacterName(character))}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

      <div className="absolute bottom-4 left-4 right-4 text-white">
        <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] opacity-70">
          0{index + 1} / character
        </p>
        <p className="truncate font-serif text-xl italic">
          {getCharacterName(character)}
        </p>
      </div>
    </button>
  );
};

const ProfileEditor = ({
  profile,
  selectedCharacter,
  onProfileChange,
  onCharacterChange,
  onClose,
  onSave
}) => {
  const [draftProfile, setDraftProfile] = useState(profile || DEFAULT_PROFILE);
  const [draftCharacter, setDraftCharacter] = useState(selectedCharacter || null);
  const [saving, setSaving] = useState(false);

  const updateProfile = (key, value) => {
    setDraftProfile((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateCharacter = (key, value) => {
    setDraftCharacter((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await onSave(draftProfile, draftCharacter);
      onProfileChange(draftProfile);
      onCharacterChange(draftCharacter);
      onClose();
    } catch (error) {
      alert(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-10 pt-5 sm:px-10">
        <div className="mb-10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-sm opacity-60 transition hover:opacity-100"
          >
            <ArrowLeft className="h-4 w-4" />
            返回主页
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-black px-4 py-2 text-xs text-white disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? '保存中…' : '保存修改'}
          </button>
        </div>

        <div className="mb-12">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] opacity-40">
            Edit your page
          </p>
          <h1 className="font-serif text-4xl italic sm:text-6xl">
            个人主页
          </h1>
        </div>

        <section className="border-t border-black/10 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
                Profile
              </p>
              <h2 className="mt-1 font-serif text-2xl italic">
                你的资料
              </h2>
            </div>

            <LocalImageInput
              label="头像"
              value={safeImage(draftProfile.avatar)}
              circular
              onChange={(value) => updateProfile('avatar', value)}
            />
          </div>

          <LocalImageInput
            label="上传主页横幅"
            value={safeImage(draftProfile.banner)}
            wide
            onChange={(value) => updateProfile('banner', value)}
          />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-2 block opacity-45">名称</span>
              <input
                value={draftProfile.name || ''}
                onChange={(event) =>
                  updateProfile('name', event.target.value)
                }
                className="w-full border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
                placeholder="你的名字"
              />
            </label>

            <label className="text-xs">
              <span className="mb-2 block opacity-45">账号</span>
              <input
                value={draftProfile.handle || ''}
                onChange={(event) =>
                  updateProfile('handle', event.target.value)
                }
                className="w-full border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
                placeholder="@yourstory"
              />
            </label>
          </div>

          <label className="mt-5 block text-xs">
            <span className="mb-2 block opacity-45">个人介绍</span>
            <textarea
              value={draftProfile.bio || ''}
              onChange={(event) =>
                updateProfile('bio', event.target.value)
              }
              rows={3}
              className="w-full resize-none border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
              placeholder="写一点关于你的内容"
            />
          </label>

          <label className="mt-5 block text-xs">
            <span className="mb-2 block opacity-45">位置</span>
            <input
              value={draftProfile.location || ''}
              onChange={(event) =>
                updateProfile('location', event.target.value)
              }
              className="w-full border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
              placeholder="例如：Shanghai / Online"
            />
          </label>
        </section>

        {draftCharacter && (
          <section className="border-t border-black/10 py-8">
            <div className="mb-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
                Character
              </p>
              <h2 className="mt-1 font-serif text-2xl italic">
                当前角色页面
              </h2>
            </div>

            <LocalImageInput
              label="上传角色 Banner"
              value={getCharacterBanner(draftCharacter)}
              wide
              onChange={(value) => updateCharacter('banner', value)}
            />

            <div className="mt-6 flex items-center gap-5">
              <LocalImageInput
                label="头像"
                value={getCharacterAvatar(draftCharacter)}
                circular
                onChange={(value) => updateCharacter('avatar', value)}
              />

              <div className="flex-1">
                <label className="block text-xs">
                  <span className="mb-2 block opacity-45">角色名称</span>
                  <input
                    value={draftCharacter.name || ''}
                    onChange={(event) =>
                      updateCharacter('name', event.target.value)
                    }
                    className="w-full border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
                  />
                </label>
              </div>
            </div>

            <label className="mt-5 block text-xs">
              <span className="mb-2 block opacity-45">角色简介</span>
              <textarea
                value={draftCharacter.bio || ''}
                onChange={(event) =>
                  updateCharacter('bio', event.target.value)
                }
                rows={4}
                className="w-full resize-none border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
                placeholder="为这个角色写一段介绍"
              />
            </label>
          </section>
        )}
      </div>
    </div>
  );
};

const WorkflowForm = ({
  chat,
  workflow,
  onClose,
  onSaved
}) => {
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
  const [saving, setSaving] = useState(false);

  const toggleDay = (day) => {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('请填写工作流名称');
      return;
    }

    setSaving(true);

    try {
      if (workflow?.id) {
        await updateWorkflow(workflow.id, {
          name: name.trim(),
          time,
          weekdays,
          goal: goal.trim(),
          enabled
        });
      } else {
        await createWorkflow({
          chatId: chat?.id,
          characterId: chat?.characterId,
          name: name.trim(),
          time,
          weekdays,
          goal: goal.trim(),
          enabled
        });
      }

      onSaved();
    } catch (error) {
      alert(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white px-5 pb-8 pt-5 sm:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
              {getCharacterName(targetCharacter)}
            </p>
            <h2 className="mt-2 font-serif text-3xl italic">
              {workflow ? '编辑工作流' : '新建工作流'}
            </h2>
          </div>

          <IconButton label="关闭" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="space-y-6">
          <label className="block text-xs">
            <span className="mb-2 block opacity-45">标题</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border-b border-black/20 bg-transparent py-2 text-base outline-none focus:border-black"
              placeholder="例如：早安问候"
            />
          </label>

          <div className="grid grid-cols-2 gap-5">
            <label className="block text-xs">
              <span className="mb-2 block opacity-45">执行时间</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full border-b border-black/20 bg-transparent py-2 outline-none"
              />
            </label>

            <div>
              <span className="mb-2 block text-xs opacity-45">状态</span>
              <div className="flex items-center gap-3 py-2 text-xs">
                <Toggle value={enabled} onChange={setEnabled} />
                {enabled ? '运行中' : '已暂停'}
              </div>
            </div>
          </div>

          <div>
            <span className="mb-3 block text-xs opacity-45">重复星期</span>
            <div className="flex gap-2">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => toggleDay(day)}
                  className={[
                    'h-9 w-9 rounded-full text-xs transition',
                    weekdays.includes(day)
                      ? 'bg-black text-white'
                      : 'bg-black/[0.06] text-black/45'
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs">
            <span className="mb-2 block opacity-45">目标 / 意图</span>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={4}
              className="w-full resize-none border-b border-black/20 bg-transparent py-2 outline-none focus:border-black"
              placeholder="告诉 AI 这次主动联系想做什么"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-8 flex w-full items-center justify-center gap-2 bg-black py-3 text-sm text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? '保存中…' : '保存工作流'}
        </button>
      </div>
    </div>
  );
};

const ChatPicker = ({ chats, onPick, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
    <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto bg-white px-5 pb-8 pt-5 sm:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
            Select a chat
          </p>
          <h2 className="mt-2 font-serif text-3xl italic">
            选择对话
          </h2>
        </div>

        <IconButton label="关闭" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="space-y-1">
        {chats.length === 0 ? (
          <p className="py-10 text-center text-sm opacity-45">
            还没有可以绑定的聊天。
          </p>
        ) : (
          chats.map((chat) => {
            const character = chat.character;
            const avatar = getCharacterAvatar(character);

            return (
              <button
                type="button"
                key={chat.id}
                onClick={() => onPick(chat)}
                className="flex w-full items-center gap-4 border-b border-black/10 py-4 text-left transition hover:bg-black/[0.04]"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
                    {getInitial(getCharacterName(character))}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-lg italic">
                    {getCharacterName(character)}
                  </p>
                  <p className="truncate text-xs opacity-45">
                    {chat.title || '默认对话'}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 opacity-40" />
              </button>
            );
          })
        )}
      </div>
    </div>
  </div>
);

const TimelineItem = ({
  workflow,
  onEdit,
  onDelete,
  onToggle
}) => (
  <div className="group relative grid grid-cols-[4.5rem_1px_1fr] gap-4">
    <div className="pt-1 text-right">
      <p className="font-mono text-xs">
        {formatTime(workflow.time)}
      </p>
      <p className="mt-1 text-[10px] opacity-40">
        {formatWeekdays(workflow.weekdays)}
      </p>
    </div>

    <div className="relative bg-black/15">
      <span
        className={[
          'absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white',
          workflow.enabled ? 'bg-black' : 'bg-black/20'
        ].join(' ')}
      />
    </div>

    <div className="relative pb-9">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl italic">
            {workflow.name || '未命名工作流'}
          </h3>
          <p className="mt-2 max-w-xl text-xs leading-6 opacity-55">
            {workflow.goal || '没有填写执行意图'}
          </p>
        </div>

        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <IconButton label="编辑" onClick={() => onEdit(workflow)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="删除" onClick={() => onDelete(workflow)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(workflow)}
        className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] opacity-45 transition hover:opacity-100"
      >
        <span
          className={[
            'h-1.5 w-1.5 rounded-full',
            workflow.enabled ? 'bg-black' : 'bg-black/25'
          ].join(' ')}
        />
        {workflow.enabled ? 'active' : 'paused'}
      </button>
    </div>
  </div>
);

export const WorkflowApp = ({ onBackHub }) => {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [characters, setCharacters] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pickingChat, setPickingChat] = useState(false);
  const [candidateChats, setCandidateChats] = useState([]);
  const [formTarget, setFormTarget] = useState(null);
  const [theme, setTheme] = useState('light');

  const selectedCharacter = characters[selectedIndex] || null;

  const loadPage = useCallback(async () => {
    setLoading(true);

    try {
      const [profileRows, characterRows, workflowRows] =
        await Promise.all([
          db.profile.toArray(),
          db.characters.toArray(),
          getAllWorkflowsWithContext()
        ]);

      if (profileRows[0]) {
        setProfile({
          ...DEFAULT_PROFILE,
          ...profileRows[0]
        });
      }

      setCharacters(characterRows || []);
      setWorkflows(workflowRows || []);
    } catch (error) {
      console.error('[WorkflowApp] 读取主页数据失败：', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = {
      bg: root.style.getPropertyValue('--bg-main'),
      text: root.style.getPropertyValue('--text-main'),
      soft: root.style.getPropertyValue('--control-soft-bg'),
      border: root.style.getPropertyValue('--card-border')
    };

    if (theme === 'dark') {
      root.style.setProperty('--bg-main', '#111111');
      root.style.setProperty('--text-main', '#f5f5f5');
      root.style.setProperty('--control-soft-bg', '#1d1d1d');
      root.style.setProperty('--card-border', 'rgba(255,255,255,.16)');
    } else {
      root.style.setProperty('--bg-main', '#ffffff');
      root.style.setProperty('--text-main', '#111111');
      root.style.setProperty('--control-soft-bg', '#f1f1ef');
      root.style.setProperty('--card-border', 'rgba(0,0,0,.13)');
    }

    return () => {
      root.style.setProperty('--bg-main', previous.bg);
      root.style.setProperty('--text-main', previous.text);
      root.style.setProperty('--control-soft-bg', previous.soft);
      root.style.setProperty('--card-border', previous.border);
    };
  }, [theme]);

  const characterWorkflows = useMemo(() => {
    if (!selectedCharacter) return [];

    const characterId = getCharacterId(selectedCharacter);

    return workflows
      .filter((workflow) => workflow.characterId === characterId)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [selectedCharacter, workflows]);

  const changeCharacter = (direction) => {
    if (!characters.length) return;

    setSelectedIndex((current) => {
      const next = current + direction;

      if (next < 0) return characters.length - 1;
      if (next >= characters.length) return 0;

      return next;
    });
  };

  const saveProfile = async (nextProfile, nextCharacter) => {
    const profileId = nextProfile.id || profile.id || 1;

    await db.profile.put({
      ...nextProfile,
      id: profileId
    });

    if (nextCharacter?.id) {
      await db.characters.update(nextCharacter.id, {
        name: nextCharacter.name,
        bio: nextCharacter.bio,
        avatar: nextCharacter.avatar,
        banner: nextCharacter.banner
      });
    }

    await loadPage();
  };

  const openCreateWorkflow = async () => {
    try {
      const chats = await getWorkflowCandidateChats();
      setCandidateChats(chats || []);
      setPickingChat(true);
    } catch (error) {
      console.error('[WorkflowApp] 读取聊天失败：', error);
    }
  };

  const toggleWorkflow = async (workflow) => {
    await setWorkflowEnabled(workflow.id, !workflow.enabled);
    await loadPage();
  };

  const removeWorkflow = async (workflow) => {
    if (!window.confirm(`确定删除「${workflow.name || '未命名工作流'}」吗？`)) {
      return;
    }

    await deleteWorkflow(workflow.id);
    await loadPage();
  };

  const banner = getCharacterBanner(selectedCharacter) || safeImage(profile.banner);
  const avatar = getCharacterAvatar(selectedCharacter) || safeImage(profile.avatar);

 return (
  <div
    className={[
      'fixed inset-0 z-[999] h-[100dvh] w-screen overflow-y-auto transition-colors duration-500',
      theme === 'dark'
        ? 'bg-[#111] text-[#f5f5f5]'
        : 'bg-white text-[#111]'
    ].join(' ')}
  >
    <style>{`

        .profile-scroll::-webkit-scrollbar{display:none}
        .profile-scroll{scrollbar-width:none;-ms-overflow-style:none}
        @keyframes profileFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .profile-fade{animation:profileFadeIn .55s cubic-bezier(.2,.8,.2,1) both}
        @media (hover:hover){
          .profile-photo:hover img{transform:scale(1.045)}
        }
      `}</style>

      <div className="min-h-full w-full">

        <header className="flex items-center justify-between px-5 py-5 sm:px-10">
          <button
            type="button"
            onClick={onBackHub}
            className="flex items-center gap-2 text-xs opacity-55 transition hover:opacity-100"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
              className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] opacity-50 transition hover:opacity-100"
            >
              {theme === 'light' ? 'Black mode' : 'White mode'}
            </button>

            <IconButton
              label="编辑主页"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </header>

        <main className="px-5 pb-20 sm:px-10">
          <section className="profile-fade relative min-h-[26rem] overflow-hidden sm:min-h-[34rem]">
            {banner ? (
              <img
                src={banner}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[#eeeeeb]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />

            <div className="relative flex min-h-[26rem] flex-col justify-between p-6 text-white sm:min-h-[34rem] sm:p-10">
              <div className="flex justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-70">
                    Personal archive
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-5 opacity-70">
                    {profile.joined
                      ? `Since ${profile.joined}`
                      : 'A page made of people, time and small memories.'}
                  </p>
                </div>

                <Sparkles className="h-5 w-5 opacity-80" />
              </div>

              <div className="flex items-end justify-between gap-5">
                <div className="max-w-xl">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] opacity-65">
                    {profile.handle || '@yourstory'}
                  </p>
                  <h1 className="font-serif text-5xl italic leading-[0.9] sm:text-8xl">
                    {profile.name || '你的名字'}
                  </h1>
                  <p className="mt-5 max-w-md text-sm leading-6 opacity-80">
                    {profile.bio || '写一点关于你的内容。'}
                  </p>
                </div>

                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-16 w-16 rounded-full border border-white/40 object-cover sm:h-24 sm:w-24"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-white/10 font-serif text-2xl sm:h-24 sm:w-24">
                    {getInitial(profile.name)}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="profile-fade mt-16">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
                  People in this story
                </p>
                <h2 className="mt-2 font-serif text-3xl italic sm:text-5xl">
                  选择一个人
                </h2>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <IconButton
                  label="上一个角色"
                  onClick={() => changeCharacter(-1)}
                  dark={theme === 'dark'}
                >
                  <ChevronLeft className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="下一个角色"
                  onClick={() => changeCharacter(1)}
                  dark={theme === 'dark'}
                >
                  <ChevronRight className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            {characters.length === 0 ? (
              <div className="border-y border-black/10 py-14 text-center text-sm opacity-45">
                还没有角色。先创建一个角色，再回来布置这页主页。
              </div>
            ) : (
              <div className="profile-scroll -mx-5 flex snap-x snap-mandatory items-end gap-3 overflow-x-auto px-5 pb-3 sm:-mx-10 sm:px-10">
                {characters.map((character, index) => (
                  <div key={getCharacterId(character)} className="snap-center">
                    <CharacterPortrait
                      character={character}
                      index={index}
                      active={index === selectedIndex}
                      onClick={() => setSelectedIndex(index)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedCharacter && (
            <section className="profile-fade mt-20">
              <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
                <div>
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
                        Character page
                      </p>
                      <h2 className="mt-2 font-serif text-4xl italic">
                        {getCharacterName(selectedCharacter)}
                      </h2>
                    </div>

                    <IconButton
                      label="编辑角色主页"
                      onClick={() => setEditing(true)}
                      dark={theme === 'dark'}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>

                  <p className="max-w-sm text-sm leading-7 opacity-55">
                    {selectedCharacter.bio ||
                      '这个角色还没有填写简介。你可以为他上传照片、编辑文字，并建立一条只属于他的时间线。'}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[10px] uppercase tracking-[0.18em] opacity-40">
                    <span>
                      {characterWorkflows.length} routines
                    </span>
                    <span>
                      {selectedCharacter.handle || 'private page'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-7 flex items-end justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">
                        Timeline
                      </p>
                      <h3 className="mt-2 font-serif text-3xl italic">
                        时间线
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateWorkflow}
                      className="flex items-center gap-2 text-xs opacity-55 transition hover:opacity-100"
                    >
                      <Plus className="h-4 w-4" />
                      添加
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 text-sm opacity-40">
                      正在读取时间线…
                    </div>
                  ) : characterWorkflows.length === 0 ? (
                    <div className="border-y border-black/10 py-12">
                      <Clock3 className="mb-4 h-5 w-5 opacity-40" />
                      <p className="font-serif text-xl italic">
                        这里还没有安排好的时刻。
                      </p>
                      <button
                        type="button"
                        onClick={openCreateWorkflow}
                        className="mt-4 text-xs underline underline-offset-4 opacity-55"
                      >
                        创建第一条工作流
                      </button>
                    </div>
                  ) : (
                    <div>
                      {characterWorkflows.map((workflow) => (
                        <TimelineItem
                          key={workflow.id}
                          workflow={workflow}
                          onEdit={(item) => setFormTarget({ workflow: item })}
                          onDelete={removeWorkflow}
                          onToggle={toggleWorkflow}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="mt-20 border-t border-black/10 pt-5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] opacity-40">
              <span>{profile.location || 'Personal space'}</span>
              <span>{formatDate(new Date())}</span>
            </div>
          </section>
        </main>
      </div>

      {editing && (
        <ProfileEditor
          profile={profile}
          selectedCharacter={selectedCharacter}
          onProfileChange={setProfile}
          onCharacterChange={(nextCharacter) => {
            if (!nextCharacter) return;

            setCharacters((current) =>
              current.map((character) =>
                getCharacterId(character) === getCharacterId(nextCharacter)
                  ? nextCharacter
                  : character
              )
            );
          }}
          onClose={() => setEditing(false)}
          onSave={saveProfile}
        />
      )}

      {pickingChat && (
        <ChatPicker
          chats={candidateChats}
          onClose={() => setPickingChat(false)}
          onPick={(chat) => {
            setPickingChat(false);
            setFormTarget({ chat });
          }}
        />
      )}

      {formTarget && (
        <WorkflowForm
          chat={formTarget.chat}
          workflow={formTarget.workflow}
          onClose={() => setFormTarget(null)}
          onSaved={async () => {
            setFormTarget(null);
            await loadPage();
          }}
        />
      )}
    </div>
  );
};

export default WorkflowApp;
