import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  MapPin,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  User,
  X
} from 'lucide-react';

import db from '../../db';
import CharacterDailyPlanCard from './CharacterDailyPlanCard';
import OutfitEntryCard from './outfit/OutfitEntryCard';

/* =====================================================================
 * 一、常量与纯函数（与 React 无关，便于单独测试）
 * ===================================================================== */

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const CATEGORY_LABELS = {
  course: '课程',
  work: '工作',
  life: '日常'
};

const DEFAULT_COURSE_WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

const pad2 = (n) => String(n).padStart(2, '0');

const formatDateStr = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatShortDate = (d) => `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;

const parseDateStr = (str) => {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** 周一 = 1 … 周日 = 7 */
const getIsoDow = (date) => date.getDay() || 7;

const getMonday = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - (getIsoDow(d) - 1));
  return d;
};

/**
 * 以「学期第 1 周所在的那一周的周一」为基准计算当前周次。
 * 旧版按起始日期本身 +7 天翻页，起始日不是周一时周次会在周中跳变。
 */
const calcWeekNumber = (startDateStr, now = new Date()) => {
  if (!startDateStr) return 1;
  const start = parseDateStr(startDateStr);
  if (Number.isNaN(start.getTime())) return 1;

  const diffDays = Math.round(
    (getMonday(now).getTime() - getMonday(start).getTime()) / 86400000
  );
  return diffDays < 0 ? 1 : Math.floor(diffDays / 7) + 1;
};

/** 支持 "1-16"、"1,3,5"、"1-4,6,8-10" */
const parseWeeksInput = (text) => {
  const set = new Set();

  String(text)
    .split(/[,，、\s]+/)
    .filter(Boolean)
    .forEach((part) => {
      const range = part.match(/^(\d+)[-~—–](\d+)$/);

      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= 60; i++) {
          set.add(i);
        }
      } else if (/^\d+$/.test(part)) {
        set.add(Number(part));
      }
    });

  return [...set].sort((a, b) => a - b);
};

/** [1,2,3,5,7,8] -> "1-3,5,7-8" */
const formatWeeks = (weeks) => {
  if (!weeks?.length) return '';

  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const parts = [];
  let start = sorted[0];
  let prev = start;

  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }

  return parts.join(',');
};

const scheduleMatchesDay = (schedule, day, week) => {
  if (!schedule.isRepeating) return schedule.date === day.dateStr;
  if (Number(schedule.dayOfWeek) !== day.dayOfWeek) return false;

  // 单次撕下某一周 / 勾选撕下若干周 留下的"排除清单"，三种类型通用
  if (Array.isArray(schedule.excludedWeeks) && schedule.excludedWeeks.includes(week)) {
    return false;
  }

  // "撕下本周及以后" 对无固定周次上限的工作/日常日程留下的截止周
  if (Number.isFinite(schedule.repeatEndWeek) && week > schedule.repeatEndWeek) {
    return false;
  }

  if (schedule.category === 'course') {
    return Array.isArray(schedule.weeks) && schedule.weeks.includes(week);
  }
  return true;
};

/** 课程类日程当前仍然生效的周次（排除掉已被撕下的周） */
const getActiveCourseWeeks = (schedule) => {
  const weeks = Array.isArray(schedule.weeks) ? schedule.weeks : [];
  const excluded = Array.isArray(schedule.excludedWeeks) ? schedule.excludedWeeks : [];
  return weeks.filter((w) => !excluded.includes(w));
};

/** 由"学期第几周 + 星期几"反推出具体日期，用于撕下单周时清理对应的批注 */
const getDateStrForWeekDay = (termStartDate, week, dayOfWeek) => {
  if (!termStartDate) return '';
  const start = parseDateStr(termStartDate);
  if (Number.isNaN(start.getTime())) return '';

  const d = getMonday(start);
  d.setDate(d.getDate() + (Number(week) - 1) * 7 + (Number(dayOfWeek) - 1));
  return formatDateStr(d);
};

const isExpiredOnce = (schedule, todayStr) =>
  !schedule.isRepeating && schedule.date && schedule.date < todayStr;

/** 把 AI 吐出的 JSON 单项规范成数据库记录 */
const normalizeImportedItem = (item, index, ownerId) => {
  if (!item || !item.title || !item.startTime || !item.endTime) {
    throw new Error(
      `第 ${index + 1} 项信息不完整（必填：title、startTime、endTime）`
    );
  }

  const category = ['course', 'work', 'life'].includes(item.category)
    ? item.category
    : 'life';
  const repeating = item.isRepeating !== false;

  let weeks = [];
  if (Array.isArray(item.weeks) && item.weeks.length > 0) {
    weeks = item.weeks.map(Number).filter(Number.isFinite);
  } else if (category === 'course' && repeating) {
    weeks = DEFAULT_COURSE_WEEKS;
  }

  const date = repeating ? '' : String(item.date || '').trim();
  let dayOfWeek = Number(item.dayOfWeek) || 1;
  if (!repeating && date) dayOfWeek = getIsoDow(parseDateStr(date));

  return {
    characterId: ownerId,
    title: String(item.title).trim(),
    dayOfWeek,
    startTime: String(item.startTime).trim(),
    endTime: String(item.endTime).trim(),
    isRepeating: repeating,
    date,
    weeks,
    excludedWeeks: [],
    repeatEndWeek: null,
    location: String(item.location || '').trim(),
    teacher: String(item.teacher || '').trim(),
    category,
    createdAt: new Date().toISOString()
  };
};

const parseImportedSchedules = (raw, ownerId) => {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('导入内容必须是数组');

  return parsed.map((item, i) => normalizeImportedItem(item, i, ownerId));
};

const buildScheduleFromForm = (form, ownerId) => {
  const repeating = form.isRepeating;
  const isCourse = repeating && form.category === 'course';
  const weeks = isCourse ? parseWeeksInput(form.weeks) : [];

  if (isCourse && weeks.length === 0) {
    throw new Error('请填写有效的周次，例如 1-16 或 1,3,5');
  }

  return {
    characterId: ownerId,
    title: form.title.trim(),
    dayOfWeek: repeating
      ? Number(form.dayOfWeek)
      : getIsoDow(parseDateStr(form.singleDate)),
    startTime: form.startTime,
    endTime: form.endTime,
    isRepeating: repeating,
    date: repeating ? '' : form.singleDate,
    weeks,
    excludedWeeks: [],
    repeatEndWeek: null,
    location: form.location.trim(),
    teacher: form.teacher.trim(),
    category: form.category,
    createdAt: new Date().toISOString()
  };
};

const IMPORT_PROMPT = `你是一个专业的时间数据格式化助手。请帮我将以下给出的【日程/课表文本】整理成标准的 JSON 数据。

要求：
1. 只输出标准的 JSON 数组格式，没有任何其他 markdown 语法、解释文本或 Emoji。
2. JSON 数组中每个对象必须且只能包含以下字段：
  - "title": 日程或课程名称（例如："高等数学"、"每周例会"、"去寄快递"）
  - "category": 类型，必须是 "course"（课表）、"work"（工作/会议）或 "life"（生活日常/通勤）之一
  - "startTime": 开始时间，格式 "HH:MM"（例如："08:00"、"18:30"）
  - "endTime": 结束时间，格式 "HH:MM"（例如："09:45"、"19:30"）
  - "isRepeating": 布尔值。如果是每周重复的填 true；如果是单次特定日期事件填 false
  - "date": 字符串，格式 "YYYY-MM-DD"。如果是单次事件填具体日期；如果是每周重复事件填 ""
  - "dayOfWeek": 星期几，数字 1-7（1代表周一，7代表周日）。单次事件填对应日期的星期
  - "weeks": 数组格式，表示周次（例如 [1,2,3,4,5,6]）。非课程填 []
  - "location": 地点（没有填 ""）
  - "teacher": 人物/老师（没有填 ""）

我的日程文本如下：
------------------------
[在此替换粘贴你的日程文本]
------------------------`;

/** 调用用户配置的接口，为一条日程生成角色批注 */
async function requestCharacterNote({ character, schedule, dateStr }) {
  const apiSettings = await db.settings.get('apiConfig');
  const cfg = apiSettings?.value || {};

  if (!cfg.baseUrl || !cfg.apiKey) {
    throw new Error('请先在系统设置中配置 API 地址与 Key');
  }

  const place = schedule.location ? `，地点：${schedule.location}` : '';
  const prompt = `你正在与用户共同生活。你的名字是「${character.name}」，人设为：${character.bio || '体贴温柔'}。
用户在 ${dateStr} 的安排为：《${schedule.title}》（时间：${schedule.startTime} - ${schedule.endTime}${place}）。
请以手写手帐便签的随性口吻，在这条日程旁留下一句简短的铅笔批注或温暖叮嘱（控制在 30 字以内）。
要求：
- 绝对禁止使用任何 Emoji。
- 充满真实陪伴感与生活气息，像在纸条边角留下的手迹。
- 直接输出批注文字本身，不要带任何引号、前后缀或署名。`;

  const res = await fetch(
    `${String(cfg.baseUrl).replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请写下这条批注。' }
        ],
        temperature: 0.8,
        max_tokens: 200
      })
    }
  );

  if (!res.ok) throw new Error(`批注生成失败（${res.status}）`);

  const data = await res.json();

  // 只去掉首尾引号，保留句中的撇号
  return String(data?.choices?.[0]?.message?.content || '')
    .trim()
    .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '');
}

/* =====================================================================
 * 二、数据 Hook：角色 / 日程 / 批注 / 学期锚点
 * ===================================================================== */

function useRhythmData(characterId) {
  const ownerId = characterId || 0;

  const [character, setCharacter] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [notesMap, setNotesMap] = useState({});
  const [termStartDate, setTermStartDate] = useState('');

  const reload = useCallback(async () => {
    try {
      const [list, notes] = await Promise.all([
        db.schedules.where('characterId').equals(ownerId).toArray(),
        db.rhythmNotes.where('characterId').equals(ownerId).toArray()
      ]);

      list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      setSchedules(list);

      const map = {};
      notes.forEach((n) => {
        map[`${n.scheduleId}_${n.date}`] = n;
      });
      setNotesMap(map);
    } catch (err) {
      console.error('读取作息数据失败:', err);
    }
  }, [ownerId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const char = characterId ? await db.characters.get(characterId) : null;
        const savedTerm = await db.settings.get('term_start_date');
        if (cancelled) return;

        setCharacter(char || null);
        setTermStartDate(savedTerm?.value || '');
        await reload();
      } catch (err) {
        console.error('初始化作息页失败:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [characterId, reload]);

  const saveTermStart = useCallback(async (value) => {
    await db.settings.put({ key: 'term_start_date', value });
    setTermStartDate(value);
  }, []);

  return {
    ownerId,
    character,
    schedules,
    notesMap,
    termStartDate,
    reload,
    saveTermStart
  };
}

/* =====================================================================
 * 三、子组件
 * ===================================================================== */

function Header({ characterName, expiredCount, onBack, onCleanup, onToggleConfig }) {
  return (
    <header className="rh-header">
      <div className="rh-topbar">
        <button
          type="button"
          className="rh-icon-btn"
          onClick={onBack}
          aria-label="返回主页"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>

        <div className="rh-topbar-actions">
          {expiredCount > 0 && (
            <button
              type="button"
              className="rh-chip-btn"
              onClick={onCleanup}
              title="清理所有已过期的单次日程"
            >
              <Trash2 size={14} />
              清理过期 {expiredCount}
            </button>
          )}

          <button
            type="button"
            className="rh-icon-btn"
            onClick={onToggleConfig}
            aria-label="作息设置"
            title="作息设置"
          >
            <Settings size={18} strokeWidth={1.7} />
          </button>
        </div>
      </div>

      <h1 className="rh-title">时光作息</h1>
      <p className="rh-subtitle">
        <User size={14} />
        绑定角色：{characterName || '未绑定'}
      </p>
    </header>
  );
}

function ConfigPanel({ value, onSave, onClose }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <section className="rh-card rh-config" aria-label="学期设置">
      <div className="rh-card-head">
        <h2 className="rh-card-title">学期第 1 周</h2>
        <button
          type="button"
          className="rh-icon-btn rh-icon-btn--sm"
          onClick={onClose}
          aria-label="关闭设置"
        >
          <X size={16} />
        </button>
      </div>

      <p className="rh-hint">
        选择学期第 1 周内的任意一天，系统会自动对齐到当周周一，并据此推算每个周次的日期，避免跨周错位。
      </p>

      <div className="rh-inline-form">
        <input
          type="date"
          className="rh-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="学期第 1 周的日期"
        />
        <button
          type="button"
          className="rh-btn"
          disabled={!draft}
          onClick={() => onSave(draft)}
        >
          保存
        </button>
      </div>
    </section>
  );
}

function WeekSwitcher({ week, realWeek, rangeLabel, onPrev, onNext, onReset }) {
  return (
    <nav className="rh-week" aria-label="切换周次">
      <button
        type="button"
        className="rh-icon-btn rh-icon-btn--plain"
        onClick={onPrev}
        disabled={week <= 1}
        aria-label="上一周"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="rh-week-center">
        <div className="rh-week-main">
          <span className="rh-week-name">第 {week} 周</span>
          {week === realWeek ? (
            <span className="rh-badge">本周</span>
          ) : (
            <button type="button" className="rh-link" onClick={onReset}>
              <RotateCcw size={12} />
              回到本周
            </button>
          )}
        </div>
        <span className="rh-week-range">{rangeLabel}</span>
      </div>

      <button
        type="button"
        className="rh-icon-btn rh-icon-btn--plain"
        onClick={onNext}
        aria-label="下一周"
      >
        <ChevronRight size={20} />
      </button>
    </nav>
  );
}

function DayStrip({ days, activeDay, counts, onSelect }) {
  return (
    <div className="rh-daystrip" role="group" aria-label="选择星期">
      {days.map((day) => {
        const count = counts[day.dayOfWeek] || 0;
        const cls = [
          'rh-day',
          activeDay === day.dayOfWeek && 'is-active',
          day.isToday && 'is-today',
          count > 0 && 'has-items'
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={day.dayOfWeek}
            type="button"
            className={cls}
            aria-pressed={activeDay === day.dayOfWeek}
            aria-label={`${day.label} ${day.shortDate}，${count} 项日程${
              day.isToday ? '，今天' : ''
            }`}
            onClick={() => onSelect(day.dayOfWeek)}
          >
            <span className="rh-day-name">{day.label}</span>
            <span className="rh-day-num">{day.dateObj.getDate()}</span>
            <span className="rh-day-dot" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function TicketCard({
  item,
  dateStr,
  expired,
  note,
  characterName,
  canGenerate,
  isGenerating,
  onGenerate,
  onDelete
}) {
  const repeatLabel = !item.isRepeating
    ? `单次 · ${item.date}`
    : item.category === 'course' && item.weeks?.length > 0
    ? `第 ${formatWeeks(getActiveCourseWeeks(item))} 周`
    : item.repeatEndWeek
    ? `每周重复 · 至第 ${item.repeatEndWeek} 周`
    : '每周重复';

  return (
    <article
      className={`rh-ticket${expired ? ' is-expired' : ''}`}
      data-category={item.category}
    >
      <div className="rh-ticket-time">
        <span className="rh-ticket-start">{item.startTime}</span>
        <span className="rh-ticket-end">{item.endTime}</span>
      </div>

      <div className="rh-ticket-body">
        <div className="rh-ticket-head">
          <h3 className="rh-ticket-title">{item.title}</h3>
          <span className="rh-tag">{CATEGORY_LABELS[item.category] || '安排'}</span>
        </div>

        {(item.location || item.teacher) && (
          <div className="rh-ticket-meta">
            {item.location && (
              <span>
                <MapPin size={13} />
                {item.location}
              </span>
            )}
            {item.teacher && (
              <span>
                <User size={13} />
                {item.teacher}
              </span>
            )}
          </div>
        )}

        <div className="rh-ticket-foot">
          <span>
            {repeatLabel}
            {expired && <em className="rh-expired-mark">已过期</em>}
          </span>

          <button
            type="button"
            className="rh-link rh-link--danger"
            onClick={onDelete}
            aria-label={`撕下日程：${item.title}`}
          >
            <Trash2 size={13} />
            撕下
          </button>
        </div>
      </div>

      <div className="rh-ticket-note">
        {note ? (
          <>
            <span className="rh-note-by">{characterName || '角色'} 手迹</span>
            <p className="rh-note-text">“{note.content}”</p>
            <button
              type="button"
              className="rh-icon-btn rh-icon-btn--sm rh-icon-btn--plain"
              onClick={onGenerate}
              disabled={isGenerating}
              aria-label="重新题写批注"
              title="重新题写批注"
            >
              <Sparkles size={14} className={isGenerating ? 'rh-spin' : ''} />
            </button>
          </>
        ) : (
          <>
            <span className="rh-note-empty">边角还没有留下手写便签</span>
            <button
              type="button"
              className="rh-link"
              onClick={onGenerate}
              disabled={isGenerating || !canGenerate}
            >
              <Sparkles size={13} className={isGenerating ? 'rh-spin' : ''} />
              {isGenerating ? '题写中…' : '让角色留一笔'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function EmptyDay({ onAdd }) {
  return (
    <div className="rh-empty">
      <p>这一天还没有日程。</p>
      <button type="button" className="rh-btn rh-btn--ghost" onClick={onAdd}>
        <Plus size={15} />
        添加日程
      </button>
    </div>
  );
}

function ImportPanel({ onImport }) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默失败，用户仍可手动选取
    }
  };

  const handleSubmit = async () => {
    const ok = await onImport(text);
    if (ok) setText('');
  };

  return (
    <details className="rh-card rh-panel">
      <summary>
        <span>用 AI 批量导入</span>
        <Plus size={16} className="rh-panel-icon" />
      </summary>

      <div className="rh-panel-body">
        <p className="rh-hint">
          复制提示词，连同你的课表或日程文本一起发给任意大模型，再把它返回的纯 JSON 粘贴到下方。
        </p>

        <button type="button" className="rh-btn rh-btn--ghost" onClick={handleCopy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? '提示词已复制' : '复制解析提示词'}
        </button>

        <textarea
          className="rh-input rh-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="粘贴 AI 返回的 JSON…"
          rows={4}
          aria-label="待导入的 JSON"
        />

        <button
          type="button"
          className="rh-btn rh-btn--block"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          解析并导入
        </button>
      </div>
    </details>
  );
}

const EMPTY_FORM = {
  isRepeating: true,
  singleDate: '',
  title: '',
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:30',
  weeks: '1-16',
  location: '',
  teacher: '',
  category: 'course'
};

function ManualForm({ open, onToggle, onAdd, defaultDate }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, singleDate: defaultDate });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const ok = await onAdd(form);
    if (ok) setForm((f) => ({ ...f, title: '', location: '', teacher: '' }));
  };

  return (
    <details
      className="rh-card rh-panel"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary>
        <span>手动添加日程</span>
        <Plus size={16} className="rh-panel-icon" />
      </summary>

      <form className="rh-panel-body" onSubmit={handleSubmit}>
        <div className="rh-seg" role="radiogroup" aria-label="日程性质">
          <label>
            <input
              type="radio"
              name="rh-repeat"
              checked={form.isRepeating}
              onChange={() => setForm((f) => ({ ...f, isRepeating: true }))}
            />
            <span>每周循环</span>
          </label>
          <label>
            <input
              type="radio"
              name="rh-repeat"
              checked={!form.isRepeating}
              onChange={() => setForm((f) => ({ ...f, isRepeating: false }))}
            />
            <span>单次日期</span>
          </label>
        </div>

        <div className="rh-field">
          <label htmlFor="rh-title">名称</label>
          <input
            id="rh-title"
            type="text"
            className="rh-input"
            required
            value={form.title}
            onChange={set('title')}
            placeholder="如：高等数学 / 通勤 / 组会"
          />
        </div>

        <div className="rh-grid-2">
          {form.isRepeating ? (
            <div className="rh-field">
              <label htmlFor="rh-dow">星期</label>
              <select
                id="rh-dow"
                className="rh-input"
                value={form.dayOfWeek}
                onChange={set('dayOfWeek')}
              >
                {WEEK_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rh-field">
              <label htmlFor="rh-date">日期</label>
              <input
                id="rh-date"
                type="date"
                className="rh-input"
                required
                value={form.singleDate}
                onChange={set('singleDate')}
              />
            </div>
          )}

          <div className="rh-field">
            <label htmlFor="rh-cat">类型</label>
            <select
              id="rh-cat"
              className="rh-input"
              value={form.category}
              onChange={set('category')}
            >
              <option value="course">学生课程</option>
              <option value="work">工作日程</option>
              <option value="life">生活日常</option>
            </select>
          </div>
        </div>

        <div className="rh-grid-2">
          <div className="rh-field">
            <label htmlFor="rh-start">开始</label>
            <input
              id="rh-start"
              type="time"
              className="rh-input"
              required
              value={form.startTime}
              onChange={set('startTime')}
            />
          </div>
          <div className="rh-field">
            <label htmlFor="rh-end">结束</label>
            <input
              id="rh-end"
              type="time"
              className="rh-input"
              required
              value={form.endTime}
              onChange={set('endTime')}
            />
          </div>
        </div>

        {form.isRepeating && form.category === 'course' && (
          <div className="rh-field">
            <label htmlFor="rh-weeks">上课周次（如 1-16 或 1,3,5）</label>
            <input
              id="rh-weeks"
              type="text"
              className="rh-input"
              value={form.weeks}
              onChange={set('weeks')}
            />
          </div>
        )}

        <div className="rh-grid-2">
          <div className="rh-field">
            <label htmlFor="rh-loc">地点（选填）</label>
            <input
              id="rh-loc"
              type="text"
              className="rh-input"
              value={form.location}
              onChange={set('location')}
              placeholder="如：教三 101"
            />
          </div>
          <div className="rh-field">
            <label htmlFor="rh-teacher">人物 / 老师（选填）</label>
            <input
              id="rh-teacher"
              type="text"
              className="rh-input"
              value={form.teacher}
              onChange={set('teacher')}
              placeholder="如：任课老师"
            />
          </div>
        </div>

        <button type="submit" className="rh-btn rh-btn--block">
          添加到手帐
        </button>
      </form>
    </details>
  );
}

function ConfirmDialog({ target, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isCleanup = target.type === 'cleanup_expired';

  return (
    <div className="rh-backdrop" onClick={onCancel}>
      <div
        className="rh-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rh-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rh-dialog-head">
          <AlertCircle size={18} />
          <h2 id="rh-dialog-title">
            {isCleanup ? '清理所有过期日程' : '撕下这条日程'}
          </h2>
        </div>

        <p>
          {isCleanup
            ? `将清理 ${target.count} 条已过期的单次日程及其批注，此操作无法撤销。`
            : `将撕下《${target.title}》，附带的角色批注也会一并删除。`}
        </p>

        <div className="rh-dialog-actions">
          <button type="button" className="rh-btn rh-btn--ghost" onClick={onCancel}>
            保留
          </button>
          <button
            type="button"
            className="rh-btn rh-btn--danger"
            onClick={onConfirm}
            autoFocus
          >
            {isCleanup ? '全部清理' : '撕下'}
          </button>
        </div>
      </div>
    </div>
  );
}

const DELETE_SCOPE_OPTIONS = [
  { value: 'single', label: '仅撕下今天这一次', hint: '只去掉当前查看的这一周，其余周次照常保留。' },
  { value: 'from_week_onward', label: '撕下今天及以后', hint: '从这一周开始的之后全部不再出现，之前的周次保留。' },
  { value: 'custom', label: '勾选要撕下的周次', hint: '自由挑选若干周单独撕下，不要求连续。' },
  { value: 'all', label: '撕下整条循环日程', hint: '连同所有周次、所有批注一起撕掉，无法撤销。' }
];

/** 循环日程的删除范围选择框：今天 / 今天及以后 / 自选周次 / 全部 */
function DeleteScopeDialog({ target, onCancel, onConfirm }) {
  const { item, week } = target;

  const [scope, setScope] = useState('single');
  const [customSelected, setCustomSelected] = useState(() => new Set());
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const candidateWeeks = useMemo(() => {
    const excluded = Array.isArray(item.excludedWeeks) ? item.excludedWeeks : [];

    if (item.category === 'course') {
      return getActiveCourseWeeks(item);
    }

    return Array.from({ length: 16 }, (_, i) => week + i).filter(
      (w) => !excluded.includes(w)
    );
  }, [item, week]);

  const toggleWeek = (w) => {
    setCustomSelected((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const handleConfirm = () => {
    if (scope === 'custom') {
      const extra = parseWeeksInput(customText);
      const weeks = [...new Set([...customSelected, ...extra])];
      if (weeks.length === 0) return;
      onConfirm({ scope, weeks });
      return;
    }
    onConfirm({ scope });
  };

  const confirmDisabled =
    scope === 'custom' && customSelected.size === 0 && parseWeeksInput(customText).length === 0;

  return (
    <div className="rh-backdrop" onClick={onCancel}>
      <div
        className="rh-dialog rh-dialog--wide"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rh-scope-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rh-dialog-head">
          <AlertCircle size={18} />
          <h2 id="rh-scope-dialog-title">撕下《{item.title}》</h2>
        </div>

        <p>这是一条循环日程，想撕下的范围是？</p>

        <div className="rh-scope-options" role="radiogroup" aria-label="撕下范围">
          {DELETE_SCOPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="rh-scope-option">
              <input
                type="radio"
                name="rh-delete-scope"
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
              />
              <span className="rh-scope-option-body">
                <strong>{opt.label}</strong>
                <em>{opt.hint}</em>
              </span>
            </label>
          ))}
        </div>

        {scope === 'custom' && (
          <div className="rh-week-pick">
            {candidateWeeks.length > 0 ? (
              <div className="rh-week-grid">
                {candidateWeeks.map((w) => (
                  <label key={w} className="rh-week-chip">
                    <input
                      type="checkbox"
                      checked={customSelected.has(w)}
                      onChange={() => toggleWeek(w)}
                    />
                    <span>{w}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rh-hint">这条日程暂时没有可勾选的未来周次，可以在下方手动输入。</p>
            )}

            <div className="rh-field">
              <label htmlFor="rh-scope-extra">其他周次（如 20 或 20,22-24）</label>
              <input
                id="rh-scope-extra"
                type="text"
                className="rh-input"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="不在上面列表里的周次可以手动补充"
              />
            </div>
          </div>
        )}

        <div className="rh-dialog-actions">
          <button type="button" className="rh-btn rh-btn--ghost" onClick={onCancel}>
            保留
          </button>
          <button
            type="button"
            className="rh-btn rh-btn--danger"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            撕下
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * 四、页面主体
 * ===================================================================== */

export default function RhythmApp({ onBackHub, currentCharacterId, currentChatId }) {
  const {
    ownerId,
    character,
    schedules,
    notesMap,
    termStartDate,
    reload,
    saveTermStart
  } = useRhythmData(currentCharacterId);

  const todayDate = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateStr(todayDate), [todayDate]);

  const realCurrentWeek = useMemo(
    () => calcWeekNumber(termStartDate, todayDate),
    [termStartDate, todayDate]
  );

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(getIsoDow(todayDate));
  const [showConfig, setShowConfig] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [generatingKey, setGeneratingKey] = useState(null);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const toolsRef = useRef(null);

  // 锚点变化（加载完成 / 保存）后，自动跳到真实的本周
  useEffect(() => {
    setSelectedWeek(realCurrentWeek);
  }, [realCurrentWeek]);

  const flash = useCallback((type, text, ms = 2600) => {
    clearTimeout(toastTimer.current);
    setToast({ type, text });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ---------- 派生数据 ---------- */

  const weekDays = useMemo(() => {
    const baseMonday = termStartDate
      ? getMonday(parseDateStr(termStartDate))
      : getMonday(todayDate);

    const weekOffset = termStartDate ? selectedWeek - 1 : selectedWeek - realCurrentWeek;
    baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

    return WEEK_LABELS.map((label, i) => {
      const dateObj = new Date(baseMonday);
      dateObj.setDate(baseMonday.getDate() + i);
      const dateStr = formatDateStr(dateObj);

      return {
        dayOfWeek: i + 1,
        label,
        dateObj,
        dateStr,
        shortDate: formatShortDate(dateObj),
        isToday: dateStr === todayStr
      };
    });
  }, [termStartDate, selectedWeek, realCurrentWeek, todayDate, todayStr]);

  const activeDayInfo = weekDays.find((d) => d.dayOfWeek === activeDay) || weekDays[0];

  const countsByDay = useMemo(() => {
    const counts = {};
    weekDays.forEach((day) => {
      counts[day.dayOfWeek] = schedules.filter((s) =>
        scheduleMatchesDay(s, day, selectedWeek)
      ).length;
    });
    return counts;
  }, [weekDays, schedules, selectedWeek]);

  const daySchedules = useMemo(
    () => schedules.filter((s) => scheduleMatchesDay(s, activeDayInfo, selectedWeek)),
    [schedules, activeDayInfo, selectedWeek]
  );

  const expiredCount = useMemo(
    () => schedules.filter((s) => isExpiredOnce(s, todayStr)).length,
    [schedules, todayStr]
  );

  /* ---------- 操作 ---------- */

  const handleSaveTermStart = async (value) => {
    try {
      await saveTermStart(value);
      setShowConfig(false);
      flash('success', '学期基准日期已更新');
    } catch (err) {
      flash('error', `保存失败：${err.message}`);
    }
  };

  const handleImport = async (raw) => {
    try {
      const records = parseImportedSchedules(raw, ownerId);

      await db.transaction('rw', db.schedules, async () => {
        for (const record of records) await db.schedules.add(record);
      });

      await reload();
      flash('success', `已导入 ${records.length} 项日程`);
      return true;
    } catch (err) {
      flash('error', `解析失败：${err.message}`, 4000);
      return false;
    }
  };

  const handleAdd = async (form) => {
    try {
      await db.schedules.add(buildScheduleFromForm(form, ownerId));
      await reload();
      flash('success', '已添加到手帐');
      return true;
    } catch (err) {
      flash('error', `添加失败：${err.message}`);
      return false;
    }
  };

  /** 处理循环日程的"仅今天 / 今天及以后 / 自选周次 / 全部"四种撕下范围 */
  const applyRepeatingDeletion = async (target, payload) => {
    const { item, week } = target;
    const scope = payload?.scope || 'single';

    const deleteWhole = async () => {
      await db.schedules.delete(item.id);
      await db.rhythmNotes.where('scheduleId').equals(item.id).delete();
    };

    const deleteNoteForWeek = async (w) => {
      const d = getDateStrForWeekDay(termStartDate, w, item.dayOfWeek);
      if (d) await db.rhythmNotes.where({ scheduleId: item.id, date: d }).delete();
    };

    if (scope === 'all') {
      await deleteWhole();
      flash('success', '已撕下整条循环日程');
      return;
    }

    if (scope === 'single') {
      const nextExcluded = [...new Set([...(item.excludedWeeks || []), week])];
      await db.schedules.update(item.id, { excludedWeeks: nextExcluded });
      await deleteNoteForWeek(week);
      flash('success', '已撕下这一周的日程');
      return;
    }

    if (scope === 'from_week_onward') {
      if (item.category === 'course') {
        const remaining = getActiveCourseWeeks(item).filter((w) => w < week);
        if (remaining.length === 0) {
          await deleteWhole();
        } else {
          await db.schedules.update(item.id, { weeks: remaining });
        }
      } else if (week - 1 < 1) {
        await deleteWhole();
      } else {
        await db.schedules.update(item.id, { repeatEndWeek: week - 1 });
      }
      flash('success', '已撕下本周及以后的日程');
      return;
    }

    if (scope === 'custom') {
      const weeksToExclude = payload?.weeks || [];
      if (weeksToExclude.length === 0) return;

      const nextExcluded = [...new Set([...(item.excludedWeeks || []), ...weeksToExclude])];
      const activeWeeks = item.category === 'course' ? getActiveCourseWeeks(item) : null;

      if (activeWeeks && activeWeeks.every((w) => nextExcluded.includes(w))) {
        await deleteWhole();
      } else {
        await db.schedules.update(item.id, { excludedWeeks: nextExcluded });
      }

      for (const w of weeksToExclude) await deleteNoteForWeek(w);
      flash('success', `已撕下选中的 ${weeksToExclude.length} 周`);
    }
  };

  const handleConfirmDelete = async (payload) => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'single') {
        await db.schedules.delete(deleteTarget.id);
        await db.rhythmNotes.where('scheduleId').equals(deleteTarget.id).delete();
        flash('success', '已撕下这条日程');
      } else if (deleteTarget.type === 'repeating') {
        await applyRepeatingDeletion(deleteTarget, payload);
      } else {
        const expired = schedules.filter((s) => isExpiredOnce(s, todayStr));

        for (const item of expired) {
          await db.schedules.delete(item.id);
          await db.rhythmNotes.where('scheduleId').equals(item.id).delete();
        }
        flash('success', `已清理 ${expired.length} 条过期日程`);
      }

      await reload();
    } catch (err) {
      console.error('删除日程失败:', err);
      flash('error', '删除失败，请重试');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGenerateNote = async (schedule, dateStr) => {
    if (!character) return;

    const key = `${schedule.id}_${dateStr}`;
    setGeneratingKey(key);

    try {
      const content = await requestCharacterNote({ character, schedule, dateStr });
      if (!content) throw new Error('角色这次没有写出内容，请再试一次');

      const existing = notesMap[key];
      const now = new Date().toISOString();

      if (existing?.id) {
        await db.rhythmNotes.update(existing.id, { content, createdAt: now });
      } else {
        await db.rhythmNotes.add({
          scheduleId: schedule.id,
          characterId: ownerId,
          date: dateStr,
          content,
          createdAt: now
        });
      }

      await reload();
    } catch (err) {
      flash('error', err.message, 3500);
    } finally {
      setGeneratingKey(null);
    }
  };

  const openManualForm = () => {
    setManualOpen(true);
    requestAnimationFrame(() =>
      toolsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="rh-shell">
      <style>{STYLES}</style>

      <div className="rh-page">
        <Header
          characterName={character?.name}
          expiredCount={expiredCount}
          onBack={onBackHub}
          onCleanup={() =>
            setDeleteTarget({ type: 'cleanup_expired', count: expiredCount })
          }
          onToggleConfig={() => setShowConfig((v) => !v)}
        />

        {showConfig && (
          <ConfigPanel
            value={termStartDate}
            onSave={handleSaveTermStart}
            onClose={() => setShowConfig(false)}
          />
        )}

        <section className="rh-calendar" aria-label="周历">
          <WeekSwitcher
            week={selectedWeek}
            realWeek={realCurrentWeek}
            rangeLabel={`${weekDays[0].shortDate} — ${weekDays[6].shortDate}`}
            onPrev={() => setSelectedWeek((w) => Math.max(1, w - 1))}
            onNext={() => setSelectedWeek((w) => w + 1)}
            onReset={() => setSelectedWeek(realCurrentWeek)}
          />
          <DayStrip
            days={weekDays}
            activeDay={activeDay}
            counts={countsByDay}
            onSelect={setActiveDay}
          />
        </section>

        <section className="rh-schedule" aria-label="当日日程">
          <div className="rh-section-head">
            <h2>
              <Clock size={15} />
              {activeDayInfo.dateStr} {activeDayInfo.label}
            </h2>
            <span>共 {daySchedules.length} 项</span>
          </div>

          {daySchedules.length === 0 ? (
            <EmptyDay onAdd={openManualForm} />
          ) : (
            <div className="rh-ticket-list" key={activeDayInfo.dateStr}>
              {daySchedules.map((item) => {
                const key = `${item.id}_${activeDayInfo.dateStr}`;

                return (
                  <TicketCard
                    key={item.id}
                    item={item}
                    dateStr={activeDayInfo.dateStr}
                    expired={isExpiredOnce(item, todayStr)}
                    note={notesMap[key]}
                    characterName={character?.name}
                    canGenerate={Boolean(character)}
                    isGenerating={generatingKey === key}
                    onGenerate={() => handleGenerateNote(item, activeDayInfo.dateStr)}
                    onDelete={() =>
                      item.isRepeating
                        ? setDeleteTarget({
                            type: 'repeating',
                            item,
                            week: selectedWeek
                          })
                        : setDeleteTarget({
                            type: 'single',
                            id: item.id,
                            title: item.title
                          })
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="rh-extras">
          <CharacterDailyPlanCard chatId={currentChatId} />
          <OutfitEntryCard chatId={currentChatId} />
        </section>

        <section className="rh-tools" ref={toolsRef} aria-label="管理日程">
          <div className="rh-section-head">
            <h2>管理日程</h2>
          </div>

          <ManualForm
            open={manualOpen}
            onToggle={setManualOpen}
            onAdd={handleAdd}
            defaultDate={activeDayInfo.dateStr}
          />
          <ImportPanel onImport={handleImport} />
        </section>
      </div>

      {toast && (
        <div className={`rh-toast rh-toast--${toast.type}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      {deleteTarget && deleteTarget.type === 'repeating' ? (
        <DeleteScopeDialog
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : deleteTarget ? (
        <ConfirmDialog
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}

/* =====================================================================
 * 五、样式
 *  - 全部使用 .rh- 前缀类名，不再依赖 Tailwind，也不再使用 !important
 *  - 颜色优先读取宿主主题变量（--bg-main / --card-bg …），
 *    因此深色模式、换肤会自动跟随；变量缺失时使用右侧的回退值
 *  - 课程 / 工作 / 日常用三种固定的强调色区分，是页面里唯一的“多色”信息
 * ===================================================================== */

const STYLES = `
:where(.rh-shell) *,
:where(.rh-shell) *::before,
:where(.rh-shell) *::after { box-sizing: border-box; }

:where(.rh-shell) :where(button, input, select, textarea) {
  font: inherit;
  color: inherit;
  margin: 0;
}
:where(.rh-shell) :where(button) {
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
:where(.rh-shell) :where(h1, h2, h3, p) { margin: 0; }
:where(.rh-shell) svg { flex-shrink: 0; }

.rh-shell {
  /* 主题色：跟随宿主 */
  --rh-bg: var(--bg-main, #f2f3f5);
  --rh-surface: var(--card-bg, #ffffff);
  --rh-soft: var(--control-soft-bg, #eaecf0);
  --rh-line: var(--card-border, #d9dce2);
  --rh-text: var(--text-main, #1c2028);
  --rh-sub: var(--text-sub, #596070);
  --rh-muted: var(--text-muted, #6f7685);
  --rh-accent: var(--accent-color, #2d3a52);
  --rh-accent-fg: var(--accent-foreground, #ffffff);

  /* 语义色 */
  --rh-danger: #c0392b;
  --rh-success: #2f7d5b;
  --rh-course: #3b6fb6;
  --rh-work: #8f5b0c;
  --rh-life: #2f7a5f;

  /* 字体 */
  --rh-serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif;
  --rh-sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;

  /* 圆角层级：控件 < 卡片 < 容器 */
  --rh-r-control: 10px;
  --rh-r-card: 16px;
  --rh-r-wrap: 20px;

  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: var(--rh-bg);
  color: var(--rh-text);
  font-family: var(--rh-sans);
  font-size: 14px;
  line-height: 1.55;
  -webkit-tap-highlight-color: transparent;
}

.rh-page {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding:
    calc(20px + env(safe-area-inset-top, 0px))
    clamp(16px, 4vw, 32px)
    calc(48px + env(safe-area-inset-bottom, 0px));
}

/* ---------- 焦点 ---------- */
.rh-shell :focus-visible {
  outline: 2px solid var(--rh-accent);
  outline-offset: 2px;
}

/* ---------- 顶部 ---------- */
.rh-header { display: flex; flex-direction: column; gap: 6px; }

.rh-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.rh-topbar-actions { display: flex; align-items: center; gap: 8px; }

.rh-title {
  font-family: var(--rh-serif);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: 0.04em;
}

.rh-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--rh-sub);
  font-size: 13px;
}

/* ---------- 按钮 ---------- */
.rh-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--rh-line);
  border-radius: 50%;
  background: var(--rh-surface);
  color: var(--rh-text);
  transition: background-color .2s ease, transform .15s ease;
}
.rh-icon-btn:hover { background: var(--rh-soft); }
.rh-icon-btn:active { transform: scale(.92); }
.rh-icon-btn:disabled { opacity: .35; cursor: default; }
.rh-icon-btn--sm { width: 32px; height: 32px; }
.rh-icon-btn--plain { border-color: transparent; background: transparent; color: var(--rh-sub); }

.rh-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px dashed var(--rh-line);
  border-radius: 999px;
  background: var(--rh-surface);
  color: var(--rh-sub);
  font-size: 13px;
}
.rh-chip-btn:hover { color: var(--rh-danger); border-color: var(--rh-danger); }

.rh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--rh-accent);
  border-radius: var(--rh-r-control);
  background: var(--rh-accent);
  color: var(--rh-accent-fg);
  font-size: 14px;
  font-weight: 500;
  transition: opacity .2s ease, transform .15s ease, background-color .2s ease;
}
.rh-btn:hover { opacity: .9; }
.rh-btn:active { transform: scale(.98); }
.rh-btn:disabled { opacity: .4; cursor: default; }
.rh-btn--block { width: 100%; }
.rh-btn--ghost {
  background: transparent;
  color: var(--rh-text);
  border-color: var(--rh-line);
}
.rh-btn--ghost:hover { background: var(--rh-soft); opacity: 1; }
.rh-btn--danger { background: var(--rh-danger); border-color: var(--rh-danger); color: #fff; }

.rh-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  color: var(--rh-sub);
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.rh-link:hover { color: var(--rh-text); }
.rh-link:disabled { opacity: .45; cursor: default; }
.rh-link--danger:hover { color: var(--rh-danger); }

/* ---------- 通用卡片 / 表单 ---------- */
.rh-card {
  border: 1px solid var(--rh-line);
  border-radius: var(--rh-r-card);
  background: var(--rh-surface);
}

.rh-card-head { display: flex; align-items: center; justify-content: space-between; }
.rh-card-title { font-family: var(--rh-serif); font-size: 16px; font-weight: 600; }
.rh-hint { color: var(--rh-sub); font-size: 13px; line-height: 1.65; }

.rh-config { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
.rh-inline-form { display: flex; gap: 8px; }
.rh-inline-form .rh-input { flex: 1; min-width: 0; }

.rh-input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--rh-line);
  border-radius: var(--rh-r-control);
  background: var(--rh-bg);
  color: var(--rh-text);
  font-size: 14px;
}
.rh-input::placeholder { color: var(--rh-muted); }
.rh-textarea {
  padding: 10px 12px;
  min-height: 110px;
  line-height: 1.6;
  resize: vertical;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  font-size: 13px;
}

.rh-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rh-field > label { color: var(--rh-sub); font-size: 13px; }
.rh-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* 分段控件：每周循环 / 单次日期 */
.rh-seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--rh-soft);
}
.rh-seg label { position: relative; cursor: pointer; }
.rh-seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.rh-seg span {
  display: block;
  padding: 8px 0;
  border-radius: 9px;
  color: var(--rh-sub);
  font-size: 13px;
  text-align: center;
  transition: background-color .2s ease, color .2s ease;
}
.rh-seg input:checked + span {
  background: var(--rh-surface);
  color: var(--rh-text);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1);
}
.rh-seg label:has(input:focus-visible) span {
  outline: 2px solid var(--rh-accent);
  outline-offset: 1px;
}

.rh-badge {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--rh-accent);
  color: var(--rh-accent-fg);
  font-size: 12px;
}

/* ---------- 周历 ---------- */
.rh-calendar { display: flex; flex-direction: column; gap: 10px; }

.rh-week {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 4px 6px;
}
.rh-week-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.rh-week-main { display: flex; align-items: center; gap: 8px; }
.rh-week-name { font-family: var(--rh-serif); font-size: 16px; font-weight: 600; }
.rh-week-range { color: var(--rh-sub); font-size: 12px; font-variant-numeric: tabular-nums; }

.rh-daystrip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--rh-line);
  border-radius: var(--rh-r-wrap);
  background: var(--rh-surface);
}

.rh-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 78px;
  padding: 8px 0 6px;
  border-radius: 14px;
  color: var(--rh-sub);
  transition: background-color .2s ease, color .2s ease, transform .15s ease;
}
.rh-day:hover { background: var(--rh-soft); }
.rh-day:active { transform: scale(.95); }

.rh-day-name { font-size: 12px; line-height: 1.3; }

.rh-day-num {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--rh-text);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.rh-day.is-today .rh-day-num { box-shadow: inset 0 0 0 1.5px var(--rh-accent); }

.rh-day-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--rh-accent);
  opacity: 0;
}
.rh-day.has-items .rh-day-dot { opacity: .75; }

.rh-day.is-active { background: var(--rh-accent); color: var(--rh-accent-fg); }
.rh-day.is-active:hover { background: var(--rh-accent); }
.rh-day.is-active .rh-day-num { color: inherit; }
.rh-day.is-active.is-today .rh-day-num { box-shadow: inset 0 0 0 1.5px currentColor; }
.rh-day.is-active .rh-day-dot { background: currentColor; }

/* ---------- 日程 ---------- */
.rh-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 2px;
}
.rh-section-head h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--rh-serif);
  font-size: 16px;
  font-weight: 600;
}
.rh-section-head span { color: var(--rh-sub); font-size: 13px; }

.rh-ticket-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: rh-fade .22s ease both;
}

.rh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 40px 20px;
  border: 1px dashed var(--rh-line);
  border-radius: var(--rh-r-card);
  color: var(--rh-sub);
  text-align: center;
}

/* 票根：左侧色条 = 类型，虚线 = 撕口 */
.rh-ticket {
  --rh-cat: var(--rh-life);
  position: relative;
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--rh-line);
  border-radius: var(--rh-r-card);
  background: var(--rh-surface);
}
.rh-ticket[data-category="course"] { --rh-cat: var(--rh-course); }
.rh-ticket[data-category="work"] { --rh-cat: var(--rh-work); }
.rh-ticket[data-category="life"] { --rh-cat: var(--rh-life); }

.rh-ticket::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--rh-cat);
}
.rh-ticket.is-expired { opacity: .6; }

.rh-ticket-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 14px 8px 14px 12px;
  border-right: 1px dashed var(--rh-line);
  background: var(--rh-soft);
  font-variant-numeric: tabular-nums;
}
.rh-ticket-start { font-size: 17px; font-weight: 600; line-height: 1.2; }
.rh-ticket-end { color: var(--rh-sub); font-size: 13px; }

.rh-ticket-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px 14px;
}
.rh-ticket-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rh-ticket-title {
  min-width: 0;
  overflow: hidden;
  font-family: var(--rh-serif);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rh-tag {
  flex-shrink: 0;
  padding: 1px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--rh-cat) 13%, transparent);
  color: var(--rh-cat);
  font-size: 12px;
  font-weight: 500;
}

.rh-ticket-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--rh-sub);
  font-size: 13px;
}
.rh-ticket-meta span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }

.rh-ticket-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--rh-line);
  color: var(--rh-sub);
  font-size: 12px;
}
.rh-expired-mark { margin-left: 8px; color: var(--rh-danger); font-style: normal; }

.rh-ticket-note {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px 10px 18px;
  border-top: 1px dashed var(--rh-line);
  background: var(--rh-soft);
}
.rh-note-by {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--rh-line);
  color: var(--rh-sub);
  font-size: 12px;
}
.rh-note-text {
  flex: 1;
  min-width: 0;
  font-family: var(--rh-serif);
  font-size: 14px;
  font-style: italic;
  line-height: 1.6;
  word-break: break-word;
}
.rh-note-empty { color: var(--rh-muted); font-size: 13px; }

.rh-spin { animation: rh-rotate 1s linear infinite; }

/* ---------- 附加卡片 / 工具区 ---------- */
.rh-extras { display: flex; flex-direction: column; gap: 14px; }
.rh-extras:empty { display: none; }

.rh-tools { display: flex; flex-direction: column; gap: 10px; scroll-margin-top: 12px; }
.rh-tools .rh-section-head { margin-bottom: 2px; }

.rh-panel summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.rh-panel summary::-webkit-details-marker { display: none; }
.rh-panel-icon { color: var(--rh-sub); transition: transform .2s ease; }
.rh-panel[open] .rh-panel-icon { transform: rotate(45deg); }

.rh-panel-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-top: 1px dashed var(--rh-line);
}
.rh-panel-body > .rh-btn--ghost { align-self: flex-start; }

/* ---------- 提示 / 弹窗 ---------- */
.rh-toast {
  position: fixed;
  left: 50%;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 10;
  max-width: calc(100vw - 32px);
  padding: 10px 18px;
  border: 1px solid var(--rh-line);
  border-left-width: 4px;
  border-radius: 12px;
  background: var(--rh-surface);
  color: var(--rh-text);
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .18);
  transform: translateX(-50%);
  animation: rh-toast-in .25s ease both;
}
.rh-toast--success { border-left-color: var(--rh-success); }
.rh-toast--error { border-left-color: var(--rh-danger); }

.rh-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 12, 16, .45);
  animation: rh-fade .2s ease both;
}
.rh-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 340px;
  padding: 20px;
  border: 1px solid var(--rh-line);
  border-radius: var(--rh-r-wrap);
  background: var(--rh-surface);
  color: var(--rh-text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .28);
}
.rh-dialog-head { display: flex; align-items: center; gap: 8px; color: var(--rh-danger); }
.rh-dialog-head h2 { color: var(--rh-text); font-family: var(--rh-serif); font-size: 16px; }
.rh-dialog p { color: var(--rh-sub); font-size: 14px; line-height: 1.7; }
.rh-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--rh-line);
}

/* ---------- 循环日程的撕下范围选择框 ---------- */
.rh-dialog--wide { max-width: 400px; max-height: 86vh; overflow-y: auto; }

.rh-scope-options { display: flex; flex-direction: column; gap: 6px; }
.rh-scope-option { position: relative; display: block; cursor: pointer; }
.rh-scope-option input {
  position: absolute;
  top: 14px;
  left: 12px;
  margin: 0;
}
.rh-scope-option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 10px 34px;
  border: 1px solid var(--rh-line);
  border-radius: var(--rh-r-control);
  background: var(--rh-bg);
}
.rh-scope-option-body strong { font-size: 13px; color: var(--rh-text); }
.rh-scope-option-body em { font-style: normal; font-size: 12px; color: var(--rh-sub); }
.rh-scope-option input:checked + .rh-scope-option-body {
  border-color: var(--rh-accent);
  background: var(--rh-soft);
}

.rh-week-pick { display: flex; flex-direction: column; gap: 10px; }
.rh-week-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
  padding: 2px;
}
.rh-week-chip { position: relative; cursor: pointer; }
.rh-week-chip input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.rh-week-chip span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 1px solid var(--rh-line);
  border-radius: 8px;
  font-size: 12px;
  color: var(--rh-sub);
  font-variant-numeric: tabular-nums;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.rh-week-chip input:checked + span {
  background: var(--rh-accent);
  color: var(--rh-accent-fg);
  border-color: var(--rh-accent);
  font-weight: 600;
}

/* ---------- 动画 ---------- */
@keyframes rh-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rh-rotate { to { transform: rotate(360deg); } }
@keyframes rh-toast-in {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* ---------- 小屏 ---------- */
@media (max-width: 420px) {
  .rh-grid-2 { grid-template-columns: 1fr; }
  .rh-title { font-size: 27px; }
  .rh-ticket { grid-template-columns: 68px minmax(0, 1fr); }
  .rh-day-num { width: 30px; height: 30px; font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .rh-shell *, .rh-shell *::before, .rh-shell *::after {
    animation-duration: .01ms;
    animation-iteration-count: 1;
    transition-duration: .01ms;
  }
}
`;