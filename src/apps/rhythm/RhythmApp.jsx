import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CalendarDays,
  Play,
  SlidersHorizontal
} from 'lucide-react';
import db from '../../db';

const pad2 = (n) => String(n).padStart(2, '0');

const formatDateStr = (dateObj) => {
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
};

const formatShortDate = (dateObj) => {
  return `${pad2(dateObj.getMonth() + 1)}.${pad2(dateObj.getDate())}`;
};

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [character, setCharacter] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [notesMap, setNotesMap] = useState({});
  const [generatingNoteId, setGeneratingNoteId] = useState(null);

  const [termStartDate, setTermStartDate] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7);

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  const [isRepeating, setIsRepeating] = useState(true);
  const [singleDate, setSingleDate] = useState(formatDateStr(new Date()));
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [weeks, setWeeks] = useState('1-16');
  const [location, setLocation] = useState('');
  const [teacher, setTeacher] = useState('');
  const [category, setCategory] = useState('course');

  const [pasteData, setPasteData] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const todayDateObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateStr(todayDateObj), [todayDateObj]);

  const calculateCurrentWeek = (startDateStr) => {
    if (!startDateStr) return 1;

    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const [y, m, d] = startDateStr.split('-').map(Number);
      const start = new Date(y, m - 1, d);
      start.setHours(0, 0, 0, 0);

      const diffTime = now.getTime() - start.getTime();
      if (diffTime < 0) return 1;

      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.floor(diffDays / 7) + 1;
    } catch {
      return 1;
    }
  };

  const realCurrentWeek = useMemo(() => {
    return calculateCurrentWeek(termStartDate);
  }, [termStartDate]);

  const weekDaysInfo = useMemo(() => {
    let baseMonday = new Date();
    baseMonday.setHours(0, 0, 0, 0);

    if (termStartDate) {
      try {
        const [y, m, d] = termStartDate.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        start.setHours(0, 0, 0, 0);

        const startDow = start.getDay() || 7;
        start.setDate(start.getDate() - (startDow - 1));
        start.setDate(start.getDate() + (selectedWeek - 1) * 7);
        baseMonday = start;
      } catch {
        // fallback
      }
    } else {
      const curDow = baseMonday.getDay() || 7;
      baseMonday.setDate(baseMonday.getDate() - (curDow - 1));
      baseMonday.setDate(baseMonday.getDate() + (selectedWeek - realCurrentWeek) * 7);
    }

    const days = [];
    const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + i);

      const dateStr = formatDateStr(d);

      days.push({
        dayOfWeek: i + 1,
        label: weekNames[i],
        dateObj: d,
        dateStr,
        shortDate: formatShortDate(d),
        isToday: dateStr === todayStr
      });
    }

    return days;
  }, [selectedWeek, termStartDate, realCurrentWeek, todayStr]);

  const activeDayInfo = useMemo(() => {
    return weekDaysInfo.find((d) => d.dayOfWeek === activeDay) || weekDaysInfo[0];
  }, [weekDaysInfo, activeDay]);

  useEffect(() => {
    const init = async () => {
      if (currentCharacterId) {
        const char = await db.characters.get(currentCharacterId);
        setCharacter(char || null);
      }

      const savedTerm = await db.settings.get('term_start_date');

      if (savedTerm?.value) {
        setTermStartDate(savedTerm.value);
        const curW = calculateCurrentWeek(savedTerm.value);
        setSelectedWeek(curW);
      }

      loadSchedules();
    };

    init();
  }, [currentCharacterId]);

  const loadSchedules = async () => {
    try {
      const data = await db.schedules
        .where('characterId')
        .equals(currentCharacterId || 0)
        .toArray();

      data.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      setSchedules(data);

      const notes = await db.rhythmNotes
        .where('characterId')
        .equals(currentCharacterId || 0)
        .toArray();

      const map = {};

      notes.forEach((n) => {
        map[`${n.scheduleId}_${n.date}`] = n;
      });

      setNotesMap(map);
    } catch (err) {
      console.error('读取作息数据失败:', err);
    }
  };

  const handleSaveTermStart = async () => {
    if (!termStartDate) return;

    await db.settings.put({
      key: 'term_start_date',
      value: termStartDate
    });

    const curW = calculateCurrentWeek(termStartDate);
    setSelectedWeek(curW);
    setShowConfig(false);
    setSuccessMsg('学期基准日期已更新。');

    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const getPromptText = () => {
    return `你是一个专业的时间数据格式化助手。请帮我将以下给出的【日程/课表文本】整理成标准的 JSON 数据。

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
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(getPromptText());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleImportJson = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let cleanData = pasteData.trim();

      if (cleanData.startsWith('```json')) {
        cleanData = cleanData.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanData.startsWith('```')) {
        cleanData = cleanData.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanData);

      if (!Array.isArray(parsed)) {
        throw new Error('导入格式必须为数组列表');
      }

      const validated = parsed.map((item, index) => {
        if (!item.title || !item.startTime || !item.endTime) {
          throw new Error(`第 ${index + 1} 个日程信息不完整(必填: title, startTime, endTime)`);
        }

        const rep = item.isRepeating !== false;
        let parsedWeeks = [];

        if (Array.isArray(item.weeks) && item.weeks.length > 0) {
          parsedWeeks = item.weeks.map(Number);
        } else if (item.category === 'course' && rep) {
          parsedWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        }

        let dow = Number(item.dayOfWeek || 1);

        if (!rep && item.date) {
          const [y, m, d] = item.date.split('-').map(Number);
          dow = new Date(y, m - 1, d).getDay() || 7;
        }

        return {
          characterId: currentCharacterId || 0,
          title: String(item.title).trim(),
          dayOfWeek: dow,
          startTime: String(item.startTime).trim(),
          endTime: String(item.endTime).trim(),
          isRepeating: rep,
          date: rep ? '' : String(item.date || '').trim(),
          weeks: parsedWeeks,
          location: String(item.location || '').trim(),
          teacher: String(item.teacher || '').trim(),
          category: ['course', 'work', 'life'].includes(item.category)
            ? item.category
            : 'life',
          createdAt: new Date().toISOString()
        };
      });

      await db.transaction('rw', db.schedules, async () => {
        for (const schedule of validated) {
          await db.schedules.add(schedule);
        }
      });

      setSuccessMsg(`成功同步了 ${validated.length} 项生活日程票根。`);
      setPasteData('');
      loadSchedules();

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(`解析失败: ${err.message}`);
    }
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();

    if (!title.trim()) return;

    let parsedWeeks = [];

    if (isRepeating && category === 'course') {
      if (weeks.includes('-')) {
        const [start, end] = weeks.split('-').map(Number);

        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            parsedWeeks.push(i);
          }
        }
      } else {
        parsedWeeks = weeks
          .split(',')
          .map(Number)
          .filter((n) => !isNaN(n));
      }
    }

    let targetDow = Number(dayOfWeek);
    let targetDate = '';

    if (!isRepeating) {
      targetDate = singleDate;

      const [y, m, d] = singleDate.split('-').map(Number);
      targetDow = new Date(y, m - 1, d).getDay() || 7;
    }

    try {
      await db.schedules.add({
        characterId: currentCharacterId || 0,
        title: title.trim(),
        dayOfWeek: targetDow,
        startTime,
        endTime,
        isRepeating,
        date: targetDate,
        weeks: parsedWeeks,
        location: location.trim(),
        teacher: teacher.trim(),
        category,
        createdAt: new Date().toISOString()
      });

      setTitle('');
      setLocation('');
      setTeacher('');
      loadSchedules();

      setSuccessMsg('已夹入新的手帐日程。');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err) {
      setErrorMsg(`添加失败: ${err.message}`);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmTarget) return;

    try {
      if (deleteConfirmTarget.type === 'single') {
        await db.schedules.delete(deleteConfirmTarget.id);
        await db.rhythmNotes
          .where('scheduleId')
          .equals(deleteConfirmTarget.id)
          .delete();

        setSuccessMsg('已将此页日程纸条撕下。');
      } else if (deleteConfirmTarget.type === 'cleanup_expired') {
        const expiredList = schedules.filter(
          (s) => !s.isRepeating && s.date && s.date < todayStr
        );

        for (const item of expiredList) {
          await db.schedules.delete(item.id);
          await db.rhythmNotes.where('scheduleId').equals(item.id).delete();
        }

        setSuccessMsg(`已整理清理了 ${expiredList.length} 张已过期的旧纸条。`);
      }

      loadSchedules();
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err) {
      console.error('删除日程失败:', err);
    } finally {
      setDeleteConfirmTarget(null);
    }
  };

  const handleGenerateCharacterNote = async (schedule, dateStr) => {
    if (!character) return;

    const noteKey = `${schedule.id}_${dateStr}`;
    setGeneratingNoteId(noteKey);

    try {
      const apiSettings = await db.settings.get('apiConfig');
      const apiConfig = apiSettings?.value || {};

      if (!apiConfig.baseUrl || !apiConfig.apiKey) {
        throw new Error('请先在系统设置中配置 API Key 与接口');
      }

      const prompt = `你正在与用户共同生活。你的名字是「${character.name}」，人设为：${character.bio || '体贴温柔'}。
用户在 ${dateStr} 的安排为：《${schedule.title}》（时间：${schedule.startTime} - ${schedule.endTime}${schedule.location ? `，地点：${schedule.location}` : ''}）。
请以手写手帐便签的随性口吻，在这条日程旁留下一句简短的铅笔批注或温暖叮嘱（控制在 30 字以内）。
要求：
- 绝对禁止使用任何 Emoji。
- 充满真实陪伴感与生活气息，像在纸条边角留下的手迹。
- 直接输出批注文字本身，不要带任何引号、前后缀或署名。`;

      const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.8,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        throw new Error('随笔批注生成失败');
      }

      const data = await response.json();

      const text = String(
        data?.choices?.[0]?.message?.content || ''
      )
        .replace(/["'“”]/g, '')
        .trim();

      if (text) {
        const existing = notesMap[noteKey];

        if (existing?.id) {
          await db.rhythmNotes.update(existing.id, {
            content: text,
            createdAt: new Date().toISOString()
          });
        } else {
          await db.rhythmNotes.add({
            scheduleId: schedule.id,
            characterId: currentCharacterId || 0,
            date: dateStr,
            content: text,
            createdAt: new Date().toISOString()
          });
        }

        loadSchedules();
      }
    } catch (err) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 3500);
    } finally {
      setGeneratingNoteId(null);
    }
  };

  const currentFilteredSchedules = useMemo(() => {
    const targetDate = activeDayInfo.dateStr;

    return schedules.filter((s) => {
      if (s.isRepeating) {
        if (Number(s.dayOfWeek) !== activeDay) return false;

        if (s.category === 'course') {
          return Array.isArray(s.weeks) && s.weeks.includes(selectedWeek);
        }

        return true;
      }

      return s.date === targetDate;
    });
  }, [schedules, activeDay, activeDayInfo.dateStr, selectedWeek]);

  const totalExpiredCount = useMemo(() => {
    return schedules.filter(
      (s) => !s.isRepeating && s.date && s.date < todayStr
    ).length;
  }, [schedules, todayStr]);

  const categoryLabels = {
    course: '课程',
    work: '工作',
    life: '生活'
  };

  return (
    <div className="rhythm-page">
      <style>{`
        .rhythm-page {
          --rh-bg: #e9e9ed;
          --rh-surface: rgba(255,255,255,.72);
          --rh-solid: #ffffff;
          --rh-ink: #151518;
          --rh-muted: #707076;
          --rh-soft: #a5a5aa;
          --rh-line: rgba(0,0,0,.08);
          --rh-line-strong: rgba(0,0,0,.15);
          --rh-dark: #151518;
          --rh-ease: cubic-bezier(.16,1,.3,1);
          --rh-elastic: cubic-bezier(.34,1.56,.64,1);
          min-height: 100vh;
          width: 100%;
          padding: 20px 12px;
          display: flex;
          justify-content: center;
          color: var(--rh-ink);
          background:
            radial-gradient(circle at 50% -10%, rgba(255,255,255,.9), transparent 38%),
            linear-gradient(135deg, #eeeeF1 0%, #e3e3e8 100%);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
          overflow-x: hidden;
        }

        .rhythm-page *,
        .rhythm-page *::before,
        .rhythm-page *::after {
          box-sizing: border-box;
        }

        .rhythm-page button,
        .rhythm-page input,
        .rhythm-page select,
        .rhythm-page textarea {
          font: inherit;
        }

        .rhythm-page button {
          border: 0;
        }

        .rhythm-page button:focus-visible,
        .rhythm-page input:focus-visible,
        .rhythm-page select:focus-visible,
        .rhythm-page textarea:focus-visible {
          outline: 2px solid rgba(0,0,0,.3);
          outline-offset: 2px;
        }

        .rhythm-shell {
          position: relative;
          width: min(100%, 440px);
          min-height: calc(100vh - 40px);
          border-radius: 40px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255,255,255,.76), rgba(246,246,248,.94));
          box-shadow:
            0 35px 90px rgba(0,0,0,.18),
            0 0 0 1px rgba(0,0,0,.07),
            inset 0 1px rgba(255,255,255,.9);
          isolation: isolate;
        }

        .rhythm-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: .22;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
        }

        .rhythm-aura {
          position: absolute;
          inset: 0 0 auto;
          height: 430px;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .rhythm-aura::before,
        .rhythm-aura::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          filter: blur(48px);
          animation: auraFloat 12s ease-in-out infinite alternate;
        }

        .rhythm-aura::before {
          width: 300px;
          height: 300px;
          left: 4%;
          top: -100px;
          background: rgba(255,255,255,.92);
        }

        .rhythm-aura::after {
          width: 270px;
          height: 270px;
          right: -100px;
          top: 110px;
          background: rgba(193,193,200,.6);
          animation-delay: -4s;
        }

        @keyframes auraFloat {
          from {
            transform: translate3d(0,0,0) scale(1);
          }
          to {
            transform: translate3d(14px,24px,0) scale(1.08);
          }
        }

        .rhythm-content {
          position: relative;
          z-index: 2;
          min-height: calc(100vh - 40px);
          padding: 20px 22px 42px;
        }

        .rhythm-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 36px;
        }

        .rhythm-icon-button {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--rh-ink);
          background: rgba(255,255,255,.55);
          box-shadow: 0 4px 14px rgba(0,0,0,.05);
          cursor: pointer;
          transition:
            transform .35s var(--rh-elastic),
            background .3s ease,
            box-shadow .3s ease;
        }

        .rhythm-icon-button:hover {
          transform: translateY(-2px) scale(1.05);
          background: rgba(255,255,255,.9);
          box-shadow: 0 8px 20px rgba(0,0,0,.1);
        }

        .rhythm-icon-button:active {
          transform: scale(.9);
        }

        .rhythm-top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rhythm-expired-button {
          min-height: 30px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          color: var(--rh-muted);
          background: rgba(255,255,255,.42);
          border: 1px dashed rgba(0,0,0,.18);
          font-size: 10px;
          cursor: pointer;
          transition: all .3s var(--rh-ease);
        }

        .rhythm-expired-button:hover {
          color: var(--rh-ink);
          background: rgba(255,255,255,.8);
          transform: translateY(-2px);
        }

        .rhythm-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-top: 25px;
        }

        .rhythm-kicker {
          display: block;
          margin-bottom: 7px;
          color: var(--rh-muted);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .24em;
          text-transform: uppercase;
        }

        .rhythm-title {
          margin: 0;
          color: #08080a;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 32px;
          font-style: italic;
          font-weight: 400;
          line-height: .95;
          letter-spacing: -.05em;
        }

        .rhythm-title-sub {
          display: block;
          margin-top: 9px;
          color: var(--rh-muted);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .rhythm-date-stamp {
          text-align: right;
          color: var(--rh-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: .04em;
          line-height: 1.7;
        }

        .rhythm-date-stamp strong {
          display: block;
          color: var(--rh-ink);
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -.04em;
        }

        .rhythm-editorial-line {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 20px 0 17px;
        }

        .rhythm-editorial-line span:first-child {
          width: 34px;
          height: 2px;
          border-radius: 2px;
          background: var(--rh-dark);
        }

        .rhythm-editorial-line span:last-child {
          flex: 1;
          height: 1px;
          background: var(--rh-line-strong);
        }

        .rhythm-config {
          margin-bottom: 18px;
          padding: 17px;
          border-radius: 24px;
          background: rgba(255,255,255,.6);
          box-shadow: 0 12px 30px rgba(0,0,0,.05);
          animation: riseIn .45s var(--rh-ease) both;
        }

        .rhythm-config-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 9px;
        }

        .rhythm-config-title {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-weight: 600;
        }

        .rhythm-config-copy {
          margin: 0 0 13px;
          color: var(--rh-muted);
          font-size: 10px;
          line-height: 1.7;
        }

        .rhythm-inline-form {
          display: flex;
          gap: 8px;
        }

        .rhythm-input,
        .rhythm-select,
        .rhythm-textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid var(--rh-line);
          border-radius: 13px;
          color: var(--rh-ink);
          background: rgba(255,255,255,.72);
          transition:
            border-color .3s ease,
            box-shadow .3s ease,
            background .3s ease;
        }

        .rhythm-input,
        .rhythm-select {
          height: 38px;
          padding: 0 11px;
        }

        .rhythm-textarea {
          display: block;
          min-height: 86px;
          padding: 12px;
          resize: vertical;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          line-height: 1.6;
        }

        .rhythm-input:hover,
        .rhythm-select:hover,
        .rhythm-textarea:hover,
        .rhythm-input:focus,
        .rhythm-select:focus,
        .rhythm-textarea:focus {
          border-color: rgba(0,0,0,.25);
          background: rgba(255,255,255,.95);
          box-shadow: 0 0 0 4px rgba(0,0,0,.035);
          outline: none;
        }

        .rhythm-primary-button,
        .rhythm-dark-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 16px;
          border-radius: 999px;
          color: #fff;
          background: var(--rh-dark);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition:
            transform .3s var(--rh-elastic),
            box-shadow .3s ease,
            opacity .3s ease;
        }

        .rhythm-primary-button:hover,
        .rhythm-dark-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,.18);
        }

        .rhythm-primary-button:active,
        .rhythm-dark-button:active {
          transform: scale(.95);
        }

        .rhythm-week-switcher {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 70px;
          margin-bottom: 21px;
          padding: 0 10px;
          border-radius: 25px;
          background: rgba(255,255,255,.52);
          box-shadow:
            inset 0 1px rgba(255,255,255,.8),
            0 8px 24px rgba(0,0,0,.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .rhythm-round-nav {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--rh-ink);
          background: rgba(255,255,255,.62);
          cursor: pointer;
          transition: all .3s var(--rh-elastic);
        }

        .rhythm-round-nav:hover {
          transform: scale(1.1);
          background: #fff;
        }

        .rhythm-round-nav:active {
          transform: scale(.88);
        }

        .rhythm-round-nav:disabled {
          opacity: .25;
          cursor: default;
        }

        .rhythm-week-center {
          text-align: center;
        }

        .rhythm-week-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: var(--rh-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-weight: 600;
        }

        .rhythm-current-badge {
          padding: 3px 7px;
          border-radius: 999px;
          color: #fff;
          background: var(--rh-dark);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: .03em;
        }

        .rhythm-back-week {
          margin-top: 4px;
          padding: 0;
          color: var(--rh-muted);
          background: transparent;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .rhythm-week-range {
          display: block;
          margin-top: 5px;
          color: var(--rh-soft);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
        }

        .rhythm-day-strip {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-bottom: 20px;
        }

        .rhythm-day {
          position: relative;
          min-width: 0;
          padding: 10px 3px 9px;
          border-radius: 18px;
          color: var(--rh-muted);
          background: transparent;
          cursor: pointer;
          transition:
            transform .35s var(--rh-elastic),
            color .3s ease,
            background .35s ease,
            box-shadow .35s ease;
        }

        .rhythm-day:hover {
          transform: translateY(-3px);
          color: var(--rh-ink);
        }

        .rhythm-day.active {
          color: #fff;
          background: var(--rh-dark);
          box-shadow: 0 9px 18px rgba(0,0,0,.17);
          transform: translateY(-3px);
        }

        .rhythm-day-name {
          display: block;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          text-align: center;
        }

        .rhythm-day-date {
          display: block;
          margin-top: 5px;
          opacity: .72;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
          text-align: center;
        }

        .rhythm-day-dot {
          width: 4px;
          height: 4px;
          margin: 6px auto 0;
          border-radius: 50%;
          background: currentColor;
        }

        .rhythm-dial {
          position: relative;
          height: 212px;
          margin: 4px -5px 7px;
          overflow: hidden;
        }

        .rhythm-dial svg {
          position: absolute;
          left: 50%;
          top: 0;
          width: 330px;
          height: 220px;
          overflow: visible;
          transform: translateX(-50%);
        }

        .rhythm-dial-track {
          fill: none;
          stroke: rgba(0,0,0,.065);
          stroke-width: 15;
          stroke-linecap: round;
        }

        .rhythm-dial-progress {
          fill: none;
          stroke: var(--rh-dark);
          stroke-width: 15;
          stroke-linecap: round;
          stroke-dasharray: 480;
          stroke-dashoffset: 170;
          animation: dialReveal 1.2s var(--rh-ease) both;
        }

        @keyframes dialReveal {
          from {
            stroke-dashoffset: 480;
          }
          to {
            stroke-dashoffset: 170;
          }
        }

        .rhythm-dial-center {
          position: absolute;
          left: 50%;
          top: 53%;
          text-align: center;
          transform: translate(-50%, -50%);
        }

        .rhythm-dial-number {
          color: var(--rh-ink);
          font-size: 42px;
          font-weight: 300;
          letter-spacing: -.08em;
          line-height: .9;
        }

        .rhythm-dial-label {
          margin-top: 10px;
          color: var(--rh-muted);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .18em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .rhythm-orbit {
          position: absolute;
          width: 33px;
          height: 33px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(0,0,0,.1);
          border-radius: 50%;
          color: var(--rh-ink);
          background: rgba(255,255,255,.88);
          box-shadow: 0 7px 16px rgba(0,0,0,.1);
          cursor: pointer;
          transition: transform .4s var(--rh-elastic), box-shadow .3s ease;
        }

        .rhythm-orbit:hover {
          transform: scale(1.18);
          box-shadow: 0 12px 22px rgba(0,0,0,.16);
        }

        .rhythm-orbit-one {
          left: 13%;
          top: 54px;
        }

        .rhythm-orbit-two {
          left: 50%;
          top: 24px;
          transform: translateX(-50%);
        }

        .rhythm-orbit-two:hover {
          transform: translateX(-50%) scale(1.18);
        }

        .rhythm-orbit-three {
          right: 13%;
          top: 72px;
        }

        .rhythm-overview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 0 2px 12px;
        }

        .rhythm-overview-caption {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--rh-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
        }

        .rhythm-overview-count {
          color: var(--rh-soft);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
        }

        .rhythm-list {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-bottom: 27px;
        }

        .rhythm-ticket {
          position: relative;
          overflow: hidden;
          border-radius: 26px;
          background: rgba(255,255,255,.74);
          box-shadow:
            0 10px 25px rgba(0,0,0,.055),
            inset 0 1px rgba(255,255,255,.9);
          transition:
            transform .4s var(--rh-ease),
            box-shadow .4s ease,
            opacity .4s ease;
          animation: riseIn .55s var(--rh-ease) both;
        }

        .rhythm-ticket:hover {
          transform: translateY(-4px);
          box-shadow:
            0 18px 34px rgba(0,0,0,.1),
            inset 0 1px rgba(255,255,255,.95);
        }

        .rhythm-ticket.expired {
          opacity: .54;
          filter: grayscale(.45);
        }

        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .rhythm-ticket-main {
          display: flex;
          min-height: 130px;
        }

        .rhythm-time-stub {
          position: relative;
          width: 82px;
          flex: 0 0 82px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-right: 1px dashed rgba(0,0,0,.14);
          background: rgba(0,0,0,.025);
        }

        .rhythm-time-stub::before,
        .rhythm-time-stub::after {
          content: "";
          position: absolute;
          right: -6px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ededf0;
        }

        .rhythm-time-stub::before {
          top: -6px;
        }

        .rhythm-time-stub::after {
          bottom: -6px;
        }

        .rhythm-time-start {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -.06em;
        }

        .rhythm-time-divider {
          width: 1px;
          height: 13px;
          margin: 5px 0;
          background: rgba(0,0,0,.2);
        }

        .rhythm-time-end {
          color: var(--rh-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
        }

        .rhythm-ticket-info {
          min-width: 0;
          flex: 1;
          padding: 17px 17px 14px;
        }

        .rhythm-ticket-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .rhythm-ticket-title {
          min-width: 0;
          margin: 0;
          overflow: hidden;
          color: var(--rh-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rhythm-category {
          flex: 0 0 auto;
          padding: 4px 8px;
          border-radius: 999px;
          color: var(--rh-muted);
          background: rgba(0,0,0,.05);
          font-size: 9px;
          font-weight: 600;
        }

        .rhythm-category.course {
          color: #4e4e63;
          background: #e7e7f0;
        }

        .rhythm-category.work {
          color: #5d544d;
          background: #eee8e1;
        }

        .rhythm-category.life {
          color: #536257;
          background: #e5ece6;
        }

        .rhythm-ticket-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 13px;
          min-height: 18px;
          margin-top: 12px;
          color: var(--rh-muted);
          font-size: 10px;
        }

        .rhythm-ticket-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rhythm-ticket-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 18px;
          padding-top: 9px;
          border-top: 1px dashed rgba(0,0,0,.12);
          color: var(--rh-soft);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
        }

        .rhythm-tear-button {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          color: var(--rh-muted);
          background: transparent;
          cursor: pointer;
          transition: color .25s ease, transform .25s ease;
        }

        .rhythm-tear-button:hover {
          color: #ad4c4c;
          transform: translateX(2px);
        }

        .rhythm-expired-stamp {
          position: absolute;
          top: 11px;
          right: 13px;
          padding: 4px 7px;
          border: 1px dashed rgba(80,80,85,.45);
          color: var(--rh-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8px;
          letter-spacing: .14em;
          transform: rotate(-7deg);
          pointer-events: none;
        }

        .rhythm-note {
          padding: 12px 16px;
          border-top: 1px dashed rgba(0,0,0,.12);
          background: rgba(255,255,255,.42);
        }

        .rhythm-note-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .rhythm-note-content {
          display: flex;
          align-items: flex-start;
          min-width: 0;
          gap: 8px;
        }

        .rhythm-note-label {
          flex: 0 0 auto;
          padding: 4px 7px;
          border-radius: 999px;
          color: var(--rh-muted);
          background: rgba(0,0,0,.06);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 9px;
        }

        .rhythm-note-text {
          margin: 2px 0 0;
          min-width: 0;
          color: var(--rh-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          font-style: italic;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .rhythm-note-empty {
          color: var(--rh-soft);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          font-style: italic;
        }

        .rhythm-note-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0;
          color: var(--rh-muted);
          background: transparent;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity .3s ease, transform .3s var(--rh-elastic);
        }

        .rhythm-note-action:hover {
          transform: translateY(-2px);
          opacity: .65;
        }

        .rhythm-note-action:disabled {
          opacity: .35;
          cursor: default;
        }

        .rhythm-empty {
          min-height: 145px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 26px;
          color: var(--rh-soft);
          background: rgba(255,255,255,.38);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          font-style: italic;
        }

        .rhythm-empty-mark {
          width: 34px;
          height: 1px;
          background: var(--rh-soft);
        }

        .rhythm-lower-area {
          padding-top: 22px;
          border-top: 1px dashed rgba(0,0,0,.15);
        }

        .rhythm-import-panel {
          padding: 18px;
          border-radius: 27px;
          background: rgba(255,255,255,.62);
          box-shadow:
            0 10px 27px rgba(0,0,0,.045),
            inset 0 1px rgba(255,255,255,.85);
        }

        .rhythm-panel-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .rhythm-panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--rh-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-weight: 600;
        }

        .rhythm-copy-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0;
          color: var(--rh-muted);
          background: transparent;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          cursor: pointer;
          transition: color .25s ease, transform .3s var(--rh-elastic);
        }

        .rhythm-copy-button:hover {
          color: var(--rh-ink);
          transform: translateY(-2px);
        }

        .rhythm-panel-copy {
          margin: 0 0 12px;
          color: var(--rh-muted);
          font-size: 10px;
          line-height: 1.7;
        }

        .rhythm-import-button {
          width: 100%;
          margin-top: 9px;
        }

        .rhythm-details {
          margin-top: 14px;
          border-radius: 25px;
          overflow: hidden;
          background: rgba(255,255,255,.52);
          box-shadow: 0 9px 23px rgba(0,0,0,.035);
        }

        .rhythm-details summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 18px;
          color: var(--rh-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          list-style: none;
        }

        .rhythm-details summary::-webkit-details-marker {
          display: none;
        }

        .rhythm-details summary svg {
          transition: transform .35s var(--rh-ease);
        }

        .rhythm-details[open] summary svg {
          transform: rotate(45deg);
        }

        .rhythm-form {
          padding: 0 18px 18px;
          animation: riseIn .4s var(--rh-ease) both;
        }

        .rhythm-form-divider {
          height: 1px;
          margin: 0 -18px 17px;
          border-top: 1px dashed rgba(0,0,0,.13);
        }

        .rhythm-form-group {
          margin-bottom: 13px;
        }

        .rhythm-form-label {
          display: block;
          margin-bottom: 6px;
          color: var(--rh-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
        }

        .rhythm-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .rhythm-radio-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .rhythm-radio-label {
          flex: 1;
          min-width: 120px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 11px;
          border-radius: 13px;
          color: var(--rh-muted);
          background: rgba(0,0,0,.035);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          cursor: pointer;
          transition: background .3s ease, color .3s ease;
        }

        .rhythm-radio-label:has(input:checked) {
          color: #fff;
          background: var(--rh-dark);
        }

        .rhythm-radio-label input {
          accent-color: currentColor;
        }

        .rhythm-submit {
          width: 100%;
          margin-top: 5px;
        }

        .rhythm-toast {
          position: fixed;
          left: 50%;
          bottom: 26px;
          z-index: 80;
          max-width: min(360px, calc(100vw - 32px));
          padding: 13px 17px;
          border-radius: 999px;
          color: #fff;
          background: rgba(20,20,22,.94);
          box-shadow: 0 15px 34px rgba(0,0,0,.25);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          text-align: center;
          transform: translateX(-50%);
          animation: toastIn .4s var(--rh-ease) both;
        }

        .rhythm-toast.error {
          background: rgba(139,48,48,.94);
        }

        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translate(-50%, 12px) scale(.94);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        .rhythm-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15,15,18,.42);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          animation: fadeIn .25s ease both;
        }

        .rhythm-modal {
          width: min(100%, 340px);
          padding: 22px;
          border-radius: 30px;
          color: var(--rh-ink);
          background: rgba(255,255,255,.92);
          box-shadow:
            0 26px 70px rgba(0,0,0,.25),
            inset 0 1px rgba(255,255,255,1);
          animation: modalIn .45s var(--rh-ease) both;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .rhythm-modal-head {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
        }

        .rhythm-modal-alert {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #89662d;
          background: #f5ead1;
        }

        .rhythm-modal-title {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
        }

        .rhythm-modal-copy {
          margin: 0;
          color: var(--rh-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          line-height: 1.8;
        }

        .rhythm-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 19px;
          padding-top: 15px;
          border-top: 1px dashed rgba(0,0,0,.14);
        }

        .rhythm-modal-cancel,
        .rhythm-modal-danger {
          min-height: 36px;
          padding: 0 15px;
          border-radius: 999px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          cursor: pointer;
          transition: transform .3s var(--rh-elastic), opacity .3s ease;
        }

        .rhythm-modal-cancel {
          color: var(--rh-muted);
          background: rgba(0,0,0,.055);
        }

        .rhythm-modal-danger {
          color: #fff;
          background: #a44848;
        }

        .rhythm-modal-cancel:hover,
        .rhythm-modal-danger:hover {
          transform: translateY(-2px);
          opacity: .86;
        }

        @media (max-width: 470px) {
          .rhythm-page {
            padding: 0;
          }

          .rhythm-shell {
            min-height: 100vh;
            border-radius: 0;
          }

          .rhythm-content {
            min-height: 100vh;
            padding-top: 18px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rhythm-page *,
          .rhythm-page *::before,
          .rhythm-page *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <div className="rhythm-shell">
        <div className="rhythm-aura" />

        <main className="rhythm-content">
          <header className="rhythm-topbar">
            <button
              type="button"
              onClick={onBackHub}
              aria-label="返回主页"
              className="rhythm-icon-button"
            >
              <ArrowLeft size={17} strokeWidth={1.8} />
            </button>

            <div className="rhythm-top-actions">
              {totalExpiredCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirmTarget({
                      type: 'cleanup_expired',
                      count: totalExpiredCount
                    })
                  }
                  title="撕除所有已过期单次纸条"
                  className="rhythm-expired-button"
                >
                  <Trash2 size={12} />
                  <span>清理过期 {totalExpiredCount}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfig((v) => !v)}
                aria-label="打开作息设置"
                title="作息设置"
                className="rhythm-icon-button"
              >
                <Settings size={17} strokeWidth={1.7} />
              </button>
            </div>
          </header>

          <section className="rhythm-heading">
            <div>
              <span className="rhythm-kicker">Focus & Rhythm</span>
              <h1 className="rhythm-title">时光作息</h1>
              <span className="rhythm-title-sub">
                {character?.name ? `${character.name} · Daily Arc` : 'Daily Arc · Timeline'}
              </span>
            </div>

            <div className="rhythm-date-stamp">
              <strong>{activeDayInfo.shortDate}</strong>
              {activeDayInfo.label}
            </div>
          </section>

          <div className="rhythm-editorial-line">
            <span />
            <span />
          </div>

          {showConfig && (
            <section className="rhythm-config">
              <div className="rhythm-config-head">
                <strong className="rhythm-config-title">学期时间锚点</strong>

                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="rhythm-icon-button"
                  style={{ width: 28, height: 28, background: 'transparent' }}
                  aria-label="关闭设置"
                >
                  <X size={15} />
                </button>
              </div>

              <p className="rhythm-config-copy">
                设定学期第 1 周的周一日期，系统会根据自然日推算当前周次与课程范围。
              </p>

              <div className="rhythm-inline-form">
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(e) => setTermStartDate(e.target.value)}
                  className="rhythm-input"
                />

                <button
                  type="button"
                  onClick={handleSaveTermStart}
                  className="rhythm-primary-button"
                >
                  保存锚点
                </button>
              </div>
            </section>
          )}

          <section className="rhythm-week-switcher">
            <button
              type="button"
              onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
              disabled={selectedWeek <= 1}
              className="rhythm-round-nav"
              aria-label="上一周"
            >
              <ChevronLeft size={17} />
            </button>

            <div className="rhythm-week-center">
              <div className="rhythm-week-label">
                <span>第 {selectedWeek} 周</span>

                {selectedWeek === realCurrentWeek ? (
                  <span className="rhythm-current-badge">本周</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedWeek(realCurrentWeek)}
                    className="rhythm-back-week"
                  >
                    <RotateCcw
                      size={10}
                      style={{
                        display: 'inline-block',
                        verticalAlign: '-2px',
                        marginRight: 3
                      }}
                    />
                    回到本周
                  </button>
                )}
              </div>

              <span className="rhythm-week-range">
                {weekDaysInfo[0].shortDate} — {weekDaysInfo[6].shortDate}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedWeek((w) => w + 1)}
              className="rhythm-round-nav"
              aria-label="下一周"
            >
              <ChevronRight size={17} />
            </button>
          </section>

          <nav className="rhythm-day-strip" aria-label="选择星期">
            {weekDaysInfo.map((item) => {
              const isActive = activeDay === item.dayOfWeek;

              return (
                <button
                  key={item.dayOfWeek}
                  type="button"
                  onClick={() => setActiveDay(item.dayOfWeek)}
                  className={`rhythm-day ${isActive ? 'active' : ''}`}
                >
                  <span className="rhythm-day-name">{item.label}</span>
                  <span className="rhythm-day-date">{item.shortDate}</span>

                  {item.isToday && <span className="rhythm-day-dot" />}
                </button>
              );
            })}
          </nav>

          <section className="rhythm-dial" aria-label="当日安排概览">
            <svg viewBox="0 0 330 220" aria-hidden="true">
              <path
                className="rhythm-dial-track"
                d="M 35 180 A 130 130 0 1 1 295 180"
              />
              <path
                className="rhythm-dial-progress"
                d="M 35 180 A 130 130 0 1 1 295 180"
              />
              <circle cx="35" cy="180" r="3" fill="#8d8d93" />
              <circle cx="165" cy="42" r="3" fill="#8d8d93" />
              <circle cx="295" cy="180" r="3" fill="#8d8d93" />
            </svg>

            <button
              type="button"
              className="rhythm-orbit rhythm-orbit-one"
              onClick={() => setShowConfig(true)}
              title="学期设置"
            >
              <CalendarDays size={14} strokeWidth={1.7} />
            </button>

            <button
              type="button"
              className="rhythm-orbit rhythm-orbit-two"
              onClick={() => setSelectedWeek(realCurrentWeek)}
              title="回到本周"
            >
              <Clock size={14} strokeWidth={1.7} />
            </button>

            <button
              type="button"
              className="rhythm-orbit rhythm-orbit-three"
              onClick={() => setActiveDay(new Date().getDay() || 7)}
              title="回到今天"
            >
              <Sparkles size={14} strokeWidth={1.7} />
            </button>

            <div className="rhythm-dial-center">
              <div className="rhythm-dial-number">
                {String(currentFilteredSchedules.length).padStart(2, '0')}
              </div>
              <div className="rhythm-dial-label">Daily Entries</div>
            </div>
          </section>

          <section>
            <div className="rhythm-overview">
              <div className="rhythm-overview-caption">
                <Clock size={14} strokeWidth={1.7} />
                <span>{activeDayInfo.dateStr} · 当日安排</span>
              </div>

              <span className="rhythm-overview-count">
                {currentFilteredSchedules.length} entries
              </span>
            </div>

            {currentFilteredSchedules.length === 0 ? (
              <div className="rhythm-empty">
                <span className="rhythm-empty-mark" />
                <span>这一页尚未夹入任何日程纸条。</span>
              </div>
            ) : (
              <div className="rhythm-list">
                {currentFilteredSchedules.map((item, index) => {
                  const isExpired =
                    !item.isRepeating &&
                    item.date &&
                    item.date < todayStr;

                  const noteKey = `${item.id}_${activeDayInfo.dateStr}`;
                  const currentNote = notesMap[noteKey];
                  const isNoteLoading = generatingNoteId === noteKey;

                  return (
                    <article
                      key={item.id}
                      className={`rhythm-ticket ${isExpired ? 'expired' : ''}`}
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      {isExpired && (
                        <div className="rhythm-expired-stamp">
                          EXPIRED
                        </div>
                      )}

                      <div className="rhythm-ticket-main">
                        <div className="rhythm-time-stub">
                          <span className="rhythm-time-start">
                            {item.startTime}
                          </span>

                          <span className="rhythm-time-divider" />

                          <span className="rhythm-time-end">
                            {item.endTime}
                          </span>
                        </div>

                        <div className="rhythm-ticket-info">
                          <div className="rhythm-ticket-heading">
                            <h3 className="rhythm-ticket-title">
                              {item.title}
                            </h3>

                            <span
                              className={`rhythm-category ${item.category || 'life'}`}
                            >
                              {categoryLabels[item.category] || '安排'}
                            </span>
                          </div>

                          <div className="rhythm-ticket-meta">
                            {item.location && (
                              <span>
                                <MapPin size={11} strokeWidth={1.8} />
                                {item.location}
                              </span>
                            )}

                            {item.teacher && (
                              <span>
                                <User size={11} strokeWidth={1.8} />
                                {item.teacher}
                              </span>
                            )}
                          </div>

                          <div className="rhythm-ticket-footer">
                            <span>
                              {!item.isRepeating
                                ? `单次 · ${item.date}`
                                : item.category === 'course' &&
                                  item.weeks?.length > 0
                                ? `周次 ${item.weeks[0]}-${item.weeks[item.weeks.length - 1]}`
                                : '每周循环'}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmTarget({
                                  type: 'single',
                                  id: item.id,
                                  title: item.title
                                })
                              }
                              className="rhythm-tear-button"
                              title="撕去此票根"
                            >
                              <Trash2 size={12} />
                              <span>撕下</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="rhythm-note">
                        {currentNote ? (
                          <div className="rhythm-note-row">
                            <div className="rhythm-note-content">
                              <span className="rhythm-note-label">
                                {character?.name || '角色'} 手迹
                              </span>

                              <p className="rhythm-note-text">
                                “{currentNote.content}”
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleGenerateCharacterNote(
                                  item,
                                  activeDayInfo.dateStr
                                )
                              }
                              disabled={isNoteLoading}
                              className="rhythm-note-action"
                              title="重新题写批注"
                            >
                              <Sparkles
                                size={12}
                                className={isNoteLoading ? 'animate-spin' : ''}
                              />
                            </button>
                          </div>
                        ) : (
                          <div className="rhythm-note-row">
                            <span className="rhythm-note-empty">
                              空白边角尚未留下手写便签
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                handleGenerateCharacterNote(
                                  item,
                                  activeDayInfo.dateStr
                                )
                              }
                              disabled={isNoteLoading || !character}
                              className="rhythm-note-action"
                            >
                              <Sparkles
                                size={11}
                                className={isNoteLoading ? 'animate-spin' : ''}
                              />
                              <span>
                                {isNoteLoading ? '题写中...' : '让角色留一笔'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rhythm-lower-area">
            <div className="rhythm-import-panel">
              <div className="rhythm-panel-title-row">
                <div className="rhythm-panel-title">
                  <SlidersHorizontal size={15} strokeWidth={1.7} />
                  <span>批量导入日程</span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="rhythm-copy-button"
                >
                  {isCopied ? (
                    <Check size={12} />
                  ) : (
                    <Copy size={12} />
                  )}

                  <span>
                    {isCopied ? '提示词已复制' : '复制解析提示词'}
                  </span>
                </button>
              </div>

              <p className="rhythm-panel-copy">
                将提示词发送给任意大模型，并将返回的纯 JSON
                粘贴到下方即可批量夹入日程。
              </p>

              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="粘贴 AI 吐出的纯 JSON 文本..."
                rows={3}
                className="rhythm-textarea"
              />

              <button
                type="button"
                onClick={handleImportJson}
                disabled={!pasteData.trim()}
                className="rhythm-dark-button rhythm-import-button"
                style={{ opacity: pasteData.trim() ? 1 : 0.4 }}
              >
                解析并夹入日程票根
              </button>
            </div>

            <details className="rhythm-details">
              <summary>
                <span>手动夹入手写日程纸条</span>
                <Plus size={16} strokeWidth={1.8} />
              </summary>

              <form onSubmit={handleAddSingle} className="rhythm-form">
                <div className="rhythm-form-divider" />

                <div className="rhythm-form-group">
                  <label className="rhythm-form-label">日程性质</label>

                  <div className="rhythm-radio-row">
                    <label className="rhythm-radio-label">
                      <input
                        type="radio"
                        checked={isRepeating}
                        onChange={() => setIsRepeating(true)}
                      />
                      <span>每周固定循环</span>
                    </label>

                    <label className="rhythm-radio-label">
                      <input
                        type="radio"
                        checked={!isRepeating}
                        onChange={() => setIsRepeating(false)}
                      />
                      <span>单次特定日期</span>
                    </label>
                  </div>
                </div>

                <div className="rhythm-form-group">
                  <label className="rhythm-form-label">
                    日程 / 课程名称
                  </label>

                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：高等数学 / 通勤地铁 / 组会"
                    className="rhythm-input"
                  />
                </div>

                <div className="rhythm-form-grid rhythm-form-group">
                  {isRepeating ? (
                    <div>
                      <label className="rhythm-form-label">星期几</label>

                      <select
                        value={dayOfWeek}
                        onChange={(e) =>
                          setDayOfWeek(Number(e.target.value))
                        }
                        className="rhythm-select"
                      >
                        <option value={1}>周一</option>
                        <option value={2}>周二</option>
                        <option value={3}>周三</option>
                        <option value={4}>周四</option>
                        <option value={5}>周五</option>
                        <option value={6}>周六</option>
                        <option value={7}>周日</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="rhythm-form-label">具体日期</label>

                      <input
                        type="date"
                        required
                        value={singleDate}
                        onChange={(e) => setSingleDate(e.target.value)}
                        className="rhythm-input"
                      />
                    </div>
                  )}

                  <div>
                    <label className="rhythm-form-label">类型</label>

                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="rhythm-select"
                    >
                      <option value="course">学生课程</option>
                      <option value="work">工作日程</option>
                      <option value="life">生活日常</option>
                    </select>
                  </div>
                </div>

                <div className="rhythm-form-grid rhythm-form-group">
                  <div>
                    <label className="rhythm-form-label">开始时间</label>

                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="rhythm-input"
                    />
                  </div>

                  <div>
                    <label className="rhythm-form-label">结束时间</label>

                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="rhythm-input"
                    />
                  </div>
                </div>

                {isRepeating && category === 'course' && (
                  <div className="rhythm-form-group">
                    <label className="rhythm-form-label">
                      上课周次区间，如 1-16 或 1,3,5
                    </label>

                    <input
                      type="text"
                      value={weeks}
                      onChange={(e) => setWeeks(e.target.value)}
                      className="rhythm-input"
                    />
                  </div>
                )}

                <div className="rhythm-form-grid rhythm-form-group">
                  <div>
                    <label className="rhythm-form-label">地点 · 选填</label>

                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="如：教三 101"
                      className="rhythm-input"
                    />
                  </div>

                  <div>
                    <label className="rhythm-form-label">
                      人物 / 老师 · 选填
                    </label>

                    <input
                      type="text"
                      value={teacher}
                      onChange={(e) => setTeacher(e.target.value)}
                      placeholder="如：任课老师"
                      className="rhythm-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="rhythm-dark-button rhythm-submit"
                >
                  <Plus size={14} />
                  <span>夹入此时光纸条</span>
                </button>
              </form>
            </details>
          </section>
        </main>
      </div>

      {errorMsg && (
        <div className="rhythm-toast error">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rhythm-toast">
          {successMsg}
        </div>
      )}

      {deleteConfirmTarget && (
        <div className="rhythm-modal-backdrop">
          <div className="rhythm-modal">
            <div className="rhythm-modal-head">
              <span className="rhythm-modal-alert">
                <AlertCircle size={16} />
              </span>

              <h4 className="rhythm-modal-title">
                {deleteConfirmTarget.type === 'cleanup_expired'
                  ? '撕去所有过期纸条'
                  : '撕下此页日程'}
              </h4>
            </div>

            <p className="rhythm-modal-copy">
              {deleteConfirmTarget.type === 'cleanup_expired'
                ? `确定要将手帐中所有已过期的 ${deleteConfirmTarget.count} 张单次旧票根统一撕下清理吗？此操作无法撤销。`
                : `确定要将《${deleteConfirmTarget.title}》这一日程纸条从手帐中撕去吗？附带的角色批注也将一并撕毁。`}
            </p>

            <div className="rhythm-modal-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="rhythm-modal-cancel"
              >
                保留
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                className="rhythm-modal-danger"
              >
                撕去
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
