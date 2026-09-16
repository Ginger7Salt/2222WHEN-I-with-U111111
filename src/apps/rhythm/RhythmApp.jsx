import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  Calendar,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Clock,
  MapPin,
  User,
  AlertCircle
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

      let text = String(data?.choices?.[0]?.message?.content || '')
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

  return (
    <div
      className="rhythm-shell mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-4 pb-24 pt-4 text-left select-none"
      style={{
        color: 'var(--text-main)',
        backgroundColor: 'var(--bg-main)'
      }}
    >
      <style>{`
        .rhythm-shell {
          --bg-main: #fbfbfc;
          --surface-main: rgba(255,255,255,.66);
          --surface-solid: #fbfbfc;
          --surface-soft: rgba(255,255,255,.42);
          --text-main: #121214;
          --text-sub: #636366;
          --text-muted: #aaaab0;
          --accent-color: #171719;
          --accent-foreground: #fff;
          --card-bg: rgba(255,255,255,.58);
          --control-soft-bg: rgba(255,255,255,.42);
          --card-border: rgba(0,0,0,.085);
          --line-soft: rgba(0,0,0,.055);
          --line-strong: rgba(0,0,0,.14);
          --spring: cubic-bezier(.16,1,.3,1);
          --elastic: cubic-bezier(.34,1.56,.64,1);
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-height: 100vh;
          padding: 20px 22px 46px;
          color: var(--text-main);
          background:
            radial-gradient(circle at 12% 0%, rgba(220,220,228,.65), transparent 32%),
            radial-gradient(circle at 100% 26%, rgba(205,205,214,.42), transparent 30%),
            #e8e8ec;
          border-radius: 48px;
          box-shadow:
            0 40px 100px -24px rgba(0,0,0,.25),
            0 0 0 1px rgba(0,0,0,.08),
            inset 0 0 0 2px rgba(255,255,255,.85);
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "SF Pro Display",
            "PingFang SC",
            "Helvetica Neue",
            sans-serif;
        }

        .rhythm-shell::before {
          position: absolute;
          z-index: -2;
          top: -130px;
          left: -130px;
          width: 610px;
          height: 580px;
          content: "";
          pointer-events: none;
          opacity: .88;
          filter: blur(22px);
          background:
            radial-gradient(circle at 40% 25%, rgba(226,226,233,.92), transparent 35%),
            radial-gradient(circle at 82% 65%, rgba(203,203,211,.62), transparent 34%);
          animation: rhythmAura 13s ease-in-out infinite alternate;
        }

        .rhythm-shell::after {
          position: absolute;
          inset: 0;
          z-index: -1;
          content: "";
          pointer-events: none;
          opacity: .095;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='rhythmNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23rhythmNoise)' opacity='.35'/%3E%3C/svg%3E");
        }

        .rhythm-shell > *:not(style) {
          position: relative;
          z-index: 1;
        }

        .rhythm-shell button,
        .rhythm-shell input,
        .rhythm-shell textarea,
        .rhythm-shell select {
          font: inherit;
        }

        .rhythm-shell button {
          -webkit-tap-highlight-color: transparent;
        }

        .rhythm-header {
          margin-bottom: 27px !important;
          padding: 0 1px !important;
          animation: rhythmRise .7s var(--spring) both;
        }

        .rhythm-header > div:first-child {
          height: 42px;
        }

        .rhythm-header button {
          border: 1px solid rgba(0,0,0,.075) !important;
          border-radius: 50% !important;
          background: rgba(255,255,255,.38) !important;
          transition:
            transform .38s var(--elastic),
            background .3s ease,
            box-shadow .3s ease,
            color .3s ease;
        }

        .rhythm-header button:hover {
          color: #08080a !important;
          background: rgba(255,255,255,.82) !important;
          box-shadow: 0 10px 24px rgba(0,0,0,.08);
          transform: scale(1.08);
        }

        .rhythm-header button:active {
          transform: scale(.88);
        }

        .rhythm-header > div:nth-child(2) {
          margin-top: 25px !important;
          align-items: flex-end !important;
        }

        .rhythm-header > div:nth-child(2) > div:first-child > p {
          margin-bottom: 8px !important;
          color: var(--text-sub) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px !important;
          font-weight: 600;
          letter-spacing: .23em !important;
        }

        .rhythm-header h1 {
          color: #08080a !important;
          font-family: Georgia, "Songti SC", serif !important;
          font-size: 31px !important;
          font-style: italic;
          font-weight: 400 !important;
          letter-spacing: -.055em !important;
          line-height: .98 !important;
        }

        .rhythm-header > div:nth-child(2) > p {
          color: var(--text-sub) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px !important;
          line-height: 1.55;
          text-align: right;
        }

        .rhythm-header > div:nth-child(2)::after {
          position: absolute;
          right: 0;
          bottom: -17px;
          left: 0;
          height: 1px;
          content: "";
          background: linear-gradient(
            90deg,
            var(--text-main) 0 31px,
            rgba(0,0,0,.09) 31px 100%
          );
        }

        .rhythm-config {
          position: relative;
          margin: 0 0 21px !important;
          padding: 18px !important;
          overflow: hidden;
          border: 1px solid var(--card-border) !important;
          border-radius: 24px !important;
          background: rgba(255,255,255,.56) !important;
          box-shadow: 0 12px 32px rgba(0,0,0,.055);
          animation: rhythmPanelIn .55s var(--spring) both;
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
        }

        .rhythm-config::before {
          position: absolute;
          top: 0;
          right: 22px;
          left: 22px;
          height: 1px;
          content: "";
          background: linear-gradient(90deg, transparent, rgba(0,0,0,.16), transparent);
        }

        .rhythm-config input {
          height: 38px;
          border: 1px solid var(--line-strong) !important;
          border-radius: 12px !important;
          background: rgba(255,255,255,.72) !important;
          outline: none;
          transition: border .25s ease, box-shadow .25s ease;
        }

        .rhythm-config input:focus,
        .rhythm-shell input:focus,
        .rhythm-shell textarea:focus,
        .rhythm-shell select:focus {
          border-color: rgba(0,0,0,.28) !important;
          box-shadow: 0 0 0 4px rgba(0,0,0,.045);
        }

        .rhythm-config button {
          border-radius: 999px !important;
          transition: transform .3s var(--elastic), opacity .25s ease;
        }

        .rhythm-config button:hover {
          transform: translateY(-1px);
        }

        .rhythm-week-switch {
          min-height: 64px;
          margin-bottom: 16px !important;
          padding: 7px 10px !important;
          border: 0 !important;
          border-radius: 20px !important;
          background: rgba(255,255,255,.32) !important;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          animation: rhythmRise .7s .08s var(--spring) both;
        }

        .rhythm-week-switch > button {
          width: 34px !important;
          height: 34px !important;
          color: var(--text-sub) !important;
          border-radius: 50% !important;
          transition:
            color .25s ease,
            background .25s ease,
            transform .35s var(--elastic);
        }

        .rhythm-week-switch > button:hover {
          color: var(--text-main) !important;
          background: rgba(255,255,255,.78);
          transform: scale(1.09);
        }

        .rhythm-week-switch > button:active {
          transform: scale(.86);
        }

        .rhythm-week-switch span {
          color: var(--text-main);
        }

        .rhythm-week-switch span[class*="bg-"] {
          border-radius: 999px !important;
          background: var(--text-main) !important;
          color: white !important;
        }

        .rhythm-date-strip {
          position: relative;
          display: grid !important;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          min-height: 116px;
          margin-bottom: 30px !important;
          padding: 7px !important;
          border: 1px solid rgba(0,0,0,.06) !important;
          border-radius: 29px !important;
          background: rgba(255,255,255,.66) !important;
          box-shadow: 0 12px 32px rgba(0,0,0,.055);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          animation: rhythmRise .72s .13s var(--spring) both;
        }

        .rhythm-date-strip::before {
          position: absolute;
          top: 1px;
          right: 25%;
          left: 25%;
          height: 1px;
          content: "";
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent);
        }

        .rhythm-date-strip > button {
          position: relative;
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted) !important;
          border-radius: 23px !important;
          background: transparent !important;
          transition:
            color .35s ease,
            background .45s var(--spring),
            transform .45s var(--spring),
            box-shadow .45s var(--spring);
        }

        .rhythm-date-strip > button:hover {
          color: var(--text-main) !important;
          background: rgba(255,255,255,.76) !important;
          transform: translateY(-3px);
        }

        .rhythm-date-strip > button:active {
          transform: scale(.92);
        }

        .rhythm-date-strip > button[style*="opacity: 1"] {
          color: #fff !important;
          background: var(--text-main) !important;
          box-shadow: 0 13px 25px rgba(0,0,0,.19);
          transform: translateY(-5px);
        }

        .rhythm-date-strip > button span:first-child {
          font-size: 10px !important;
          font-weight: 650;
          letter-spacing: .04em;
        }

        .rhythm-date-strip > button span:nth-child(2) {
          margin-top: 9px !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 25px !important;
          font-weight: 500;
          letter-spacing: -.12em;
          line-height: 1;
        }

        .rhythm-date-strip > button span:nth-child(3) {
          margin-top: 7px !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8px !important;
          letter-spacing: .05em;
          opacity: .58;
        }

        .rhythm-date-strip > button span[style*="border-radius"] {
          position: absolute;
          top: 9px;
          right: 9px;
          width: 4px !important;
          height: 4px !important;
          min-height: 4px;
          margin: 0 !important;
          background: #98989e !important;
        }

        .rhythm-date-strip > button[style*="opacity: 1"] span[style*="border-radius"] {
          background: #fff !important;
        }

        .rhythm-schedule-area {
          margin-bottom: 30px !important;
          animation: rhythmRise .75s .2s var(--spring) both;
        }

        .rhythm-schedule-area > div:first-child {
          margin-bottom: 14px;
          padding: 0 3px;
        }

        .rhythm-schedule-area > div:first-child span:first-child {
          color: var(--text) !important;
          font-family: Georgia, "Songti SC", serif !important;
          font-size: 16px !important;
          font-weight: 500 !important;
          letter-spacing: .02em;
        }

        .rhythm-schedule-area > div:first-child span:first-child svg {
          display: none;
        }

        .rhythm-schedule-area > div:first-child span:first-child::before {
          display: inline-block;
          width: 22px;
          height: 2px;
          margin-right: 9px;
          content: "";
          vertical-align: middle;
          border-radius: 2px;
          background: var(--text-main);
        }

        .rhythm-schedule-area > div:first-child span:last-child {
          color: var(--text-muted) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px !important;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .rhythm-schedule-area > div:nth-child(2) > div {
          border: 1px dashed rgba(0,0,0,.13) !important;
          border-radius: 24px !important;
          background: rgba(255,255,255,.32) !important;
          color: var(--text-muted) !important;
        }

        .rhythm-ticket {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.055) !important;
          border-radius: 25px !important;
          background: rgba(255,255,255,.56) !important;
          box-shadow: 0 5px 18px rgba(0,0,0,.025);
          transition:
            background .35s ease,
            transform .45s var(--spring),
            box-shadow .45s var(--spring),
            opacity .35s ease;
          animation: rhythmTicketIn .7s var(--spring) both;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .rhythm-ticket:nth-child(2) {
          animation-delay: .07s;
        }

        .rhythm-ticket:nth-child(3) {
          animation-delay: .14s;
        }

        .rhythm-ticket:nth-child(4) {
          animation-delay: .21s;
        }

        .rhythm-ticket:hover {
          background: rgba(255,255,255,.88) !important;
          box-shadow: 0 12px 32px rgba(0,0,0,.055);
          transform: translateX(5px);
        }

        .rhythm-ticket::before {
          position: absolute;
          top: 18px;
          bottom: 18px;
          left: 84px;
          width: 1px;
          content: "";
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,.03),
            rgba(0,0,0,.16),
            rgba(0,0,0,.03)
          );
        }

        .rhythm-ticket > div:first-of-type {
          min-height: 112px;
        }

        .rhythm-ticket > div:first-of-type > div:first-child {
          position: relative;
          z-index: 1;
          width: 85px !important;
          padding: 17px 10px !important;
          border-right: 1px dashed var(--line-strong) !important;
          background: rgba(248,248,250,.34) !important;
        }

        .rhythm-ticket > div:first-of-type > div:first-child span:first-child {
          color: var(--text) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 14px !important;
          font-weight: 600 !important;
        }

        .rhythm-ticket > div:first-of-type > div:first-child span:last-child {
          color: var(--text-sub) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px !important;
        }

        .rhythm-ticket > div:first-of-type > div:nth-child(2) {
          padding: 17px 18px 17px 18px !important;
        }

        .rhythm-ticket h3 {
          overflow: hidden;
          color: var(--text) !important;
          font-family: Georgia, "Songti SC", serif !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rhythm-ticket h3 + span {
          padding: 4px 8px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: rgba(0,0,0,.045) !important;
          color: var(--text-sub) !important;
          font-size: 9px !important;
          letter-spacing: .05em;
        }

        .rhythm-ticket > div:first-of-type > div:nth-child(2) > div:nth-child(2) {
          gap: 5px 12px;
          margin-top: 10px !important;
          color: var(--text-sub) !important;
          font-size: 10px !important;
        }

        .rhythm-ticket > div:first-of-type > div:nth-child(2) > div:nth-child(2) svg {
          width: 11px;
          height: 11px;
          color: var(--text-sub);
        }

        .rhythm-ticket > div:first-of-type > div:nth-child(2) > div:last-child {
          margin-top: 14px !important;
          padding-top: 10px !important;
          border-top: 1px dashed var(--line-strong) !important;
          color: var(--text-sub) !important;
          font-family: Georgia, "Songti SC", serif !important;
          font-size: 11px !important;
          font-style: italic;
          line-height: 1.6;
        }

        .rhythm-ticket > div:first-of-type > div:nth-child(2) > div:last-child::before {
          margin-right: 5px;
          color: var(--text-muted);
          content: "✦";
          font-style: normal;
        }

        .rhythm-ticket > div:last-child {
          min-height: 40px;
          border-top: 1px dashed var(--line-strong) !important;
          padding: 10px 18px !important;
          background: rgba(248,248,250,.32) !important;
        }

        .rhythm-ticket > div:last-child p {
          color: var(--text) !important;
          font-family: Georgia, "Songti SC", serif !important;
          font-size: 11px !important;
          font-style: italic;
          line-height: 1.6;
        }

        .rhythm-ticket > div:last-child button {
          color: var(--text-sub) !important;
          transition: color .25s ease, opacity .25s ease, transform .3s var(--elastic);
        }

        .rhythm-ticket > div:last-child button:hover {
          color: var(--text) !important;
          transform: translateY(-1px);
        }

        .rhythm-tools {
          margin-top: 25px !important;
          padding-top: 22px !important;
          border-top: 1px dashed var(--line-strong) !important;
          animation: rhythmRise .75s .28s var(--spring) both;
        }

        .rhythm-import,
        .rhythm-manual {
          border: 1px solid var(--card-border) !important;
          border-radius: 23px !important;
          background: rgba(255,255,255,.56) !important;
          box-shadow: 0 8px 26px rgba(0,0,0,.035);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .rhythm-import {
          padding: 17px 18px !important;
        }

        .rhythm-import textarea,
        .rhythm-manual input,
        .rhythm-manual select {
          border: 1px solid var(--line-strong) !important;
          border-radius: 12px !important;
          background: rgba(255,255,255,.68) !important;
          outline: none;
          transition: border .25s ease, box-shadow .25s ease, background .25s ease;
        }

        .rhythm-import textarea {
          min-height: 75px;
          padding: 12px !important;
          line-height: 1.6;
        }

        .rhythm-import > button,
        .rhythm-manual form > button {
          min-height: 38px;
          border-radius: 999px !important;
          background: var(--text-main) !important;
          color: #fff !important;
          box-shadow: 0 10px 22px rgba(0,0,0,.13);
          transition:
            transform .35s var(--elastic),
            opacity .25s ease,
            box-shadow .3s ease;
        }

        .rhythm-import > button:hover,
        .rhythm-manual form > button:hover {
          box-shadow: 0 14px 28px rgba(0,0,0,.18);
          transform: translateY(-2px);
        }

        .rhythm-import > button:active,
        .rhythm-manual form > button:active {
          transform: scale(.97);
        }

        .rhythm-manual {
          overflow: hidden;
        }

        .rhythm-manual summary {
          min-height: 52px;
          padding: 0 18px !important;
          transition: background .3s ease;
        }

        .rhythm-manual summary:hover {
          background: rgba(255,255,255,.55);
        }

        .rhythm-manual summary svg {
          transition: transform .4s var(--elastic);
        }

        .rhythm-manual[open] summary svg {
          transform: rotate(45deg);
        }

        .rhythm-manual form {
          padding: 18px !important;
          border-top: 1px dashed var(--line-strong) !important;
        }

        .rhythm-manual form > div {
          gap: 12px;
        }

        .rhythm-manual label {
          color: var(--text-sub) !important;
        }

        .rhythm-manual input,
        .rhythm-manual select {
          min-height: 36px;
          padding: 0 11px !important;
        }

        .rhythm-manual textarea::placeholder,
        .rhythm-manual input::placeholder,
        .rhythm-import textarea::placeholder {
          color: var(--text-muted);
        }

        .rhythm-toast {
          z-index: 80 !important;
          bottom: 28px !important;
          min-width: 220px;
          max-width: calc(100vw - 40px);
          padding: 12px 17px !important;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.08) !important;
          border-radius: 999px !important;
          box-shadow: 0 18px 46px rgba(0,0,0,.18) !important;
          background: rgba(255,255,255,.82) !important;
          color: var(--text-main) !important;
          text-align: center;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          animation: rhythmToastIn .5s var(--elastic) both;
        }

        .rhythm-toast-error {
          border-color: rgba(155,60,60,.2) !important;
          color: #8d3535 !important;
        }

        .rhythm-toast-success {
          border-color: rgba(70,110,75,.18) !important;
          color: #41694a !important;
        }

        .rhythm-modal-backdrop {
          z-index: 90 !important;
          background: rgba(18,18,20,.38) !important;
          animation: rhythmFadeIn .3s ease both;
        }

        .rhythm-modal {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.1) !important;
          border-radius: 27px !important;
          background: rgba(251,251,252,.88) !important;
          box-shadow: 0 30px 80px rgba(0,0,0,.24) !important;
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
          animation: rhythmModalIn .55s var(--elastic) both;
        }

        .rhythm-modal::before {
          position: absolute;
          top: 0;
          right: 30px;
          left: 30px;
          height: 1px;
          content: "";
          background: linear-gradient(90deg, transparent, rgba(0,0,0,.2), transparent);
        }

        .rhythm-modal > div:last-child {
          border-top-color: var(--line-strong) !important;
        }

        .rhythm-modal button {
          border-radius: 999px !important;
          transition: transform .3s var(--elastic), opacity .25s ease;
        }

        .rhythm-modal button:hover {
          transform: translateY(-1px);
        }

        @keyframes rhythmAura {
          from {
            transform: translate3d(-10px, 0, 0) scale(1);
          }
          to {
            transform: translate3d(18px, 26px, 0) scale(1.08);
          }
        }

        @keyframes rhythmRise {
          from {
            opacity: 0;
            transform: translateY(13px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes rhythmTicketIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes rhythmPanelIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes rhythmToastIn {
          from {
            opacity: 0;
            transform: translate(-50%, 16px) scale(.92);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        @keyframes rhythmModalIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes rhythmFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (max-width: 430px) {
          .rhythm-shell {
            width: 100%;
            min-height: 100vh;
            padding-right: 18px;
            padding-left: 18px;
            border-radius: 0;
            box-shadow: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rhythm-shell *,
          .rhythm-shell::before,
          .rhythm-shell::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <header className="rhythm-header relative mb-5 px-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHub}
            aria-label="返回主页"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              color: 'var(--text-main)',
              backgroundColor: 'var(--control-soft-bg)',
              border: '1px solid var(--card-border)'
            }}
          >
            <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>

          <div className="flex items-center gap-2">
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
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-serif rounded-full transition-all active:scale-95"
                style={{
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--card-border)',
                  backgroundColor: 'var(--control-soft-bg)'
                }}
              >
                <Trash2 className="w-3 h-3" />
                <span>撕去过期({totalExpiredCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              aria-label="打开作息设置"
              title="作息设置"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                color: 'var(--text-main)',
                backgroundColor: 'transparent',
                border: '1px solid var(--card-border)'
              }}
            >
              <Settings className="h-[17px] w-[17px]" strokeWidth={1.7} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <p
              className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em]"
              style={{ color: 'var(--text-sub)' }}
            >
              Rhythm & Ephemera
            </p>

            <h1
              className="font-serif text-[26px] font-semibold leading-none tracking-[0.06em]"
              style={{ color: 'var(--text-main)' }}
            >
              时光作息
            </h1>
          </div>

          <p
            className="font-mono text-[11px] tracking-wider"
            style={{ color: 'var(--text-sub)' }}
          >
            {activeDayInfo.shortDate} · {activeDayInfo.label}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span
            className="h-px w-8"
            style={{ backgroundColor: 'var(--accent-color)' }}
          />
          <span
            className="h-px flex-1 opacity-40"
            style={{ backgroundColor: 'var(--card-border)' }}
          />
        </div>
      </header>

      {showConfig && (
        <div
          className="rhythm-config mb-5 space-y-2.5 border border-dashed p-3.5 text-xs rounded-sm transition-all"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)'
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-serif font-semibold">开学首周周一锚点</span>

            <button
              onClick={() => setShowConfig(false)}
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p
            className="text-[10px] leading-relaxed"
            style={{ color: 'var(--text-sub)' }}
          >
            设定学期第 1 周的周一日期，系统将严密推算任意周次的日程安排，杜绝跨周穿帮。
          </p>

          <div className="flex gap-2 pt-1">
            <input
              type="date"
              value={termStartDate}
              onChange={(e) => setTermStartDate(e.target.value)}
              className="flex-1 border px-2 py-1 font-mono text-xs rounded"
              style={{
                color: 'var(--text-main)',
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)'
              }}
            />

            <button
              onClick={handleSaveTermStart}
              className="px-3 py-1 font-serif text-xs font-medium rounded transition-opacity hover:opacity-85"
              style={{
                color: 'var(--accent-foreground)',
                backgroundColor: 'var(--accent-color)'
              }}
            >
              保存锚点
            </button>
          </div>
        </div>
      )}

      <div
        className="rhythm-week-switch mb-4 flex items-center justify-between px-2 py-1.5 border rounded-sm"
        style={{
          borderColor: 'var(--card-border)',
          backgroundColor: 'var(--control-soft-bg)'
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
          disabled={selectedWeek <= 1}
          className="flex h-7 w-7 items-center justify-center rounded transition-all active:scale-90 disabled:opacity-30"
          style={{ color: 'var(--text-main)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-xs font-semibold tracking-wider">
              第 {selectedWeek} 周
            </span>

            {selectedWeek === realCurrentWeek ? (
              <span
                className="px-1.5 py-0.2 font-mono text-[9px] rounded"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                本周
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedWeek(realCurrentWeek)}
                className="flex items-center gap-0.5 font-mono text-[9px] opacity-70 hover:opacity-100 underline underline-offset-2"
                style={{ color: 'var(--text-sub)' }}
              >
                <RotateCcw className="w-2.5 h-2.5" />
                回到本周
              </button>
            )}
          </div>

          <span
            className="font-mono text-[9px] opacity-60"
            style={{ color: 'var(--text-sub)' }}
          >
            {weekDaysInfo[0].shortDate} — {weekDaysInfo[6].shortDate}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedWeek((w) => w + 1)}
          className="flex h-7 w-7 items-center justify-center rounded transition-all active:scale-90"
          style={{ color: 'var(--text-main)' }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div
        className="rhythm-date-strip mb-5 flex items-end justify-between border-b pb-1.5"
        style={{ borderColor: 'var(--card-border)' }}
      >
        {weekDaysInfo.map((item) => {
          const isActive = activeDay === item.dayOfWeek;

          return (
            <button
              key={item.dayOfWeek}
              type="button"
              onClick={() => setActiveDay(item.dayOfWeek)}
              className="group relative flex flex-1 flex-col items-center pb-1 text-center transition-all"
              style={{
                color: isActive ? 'var(--text-main)' : 'var(--text-sub)',
                opacity: isActive ? 1 : 0.6
              }}
            >
              <span
                className={`font-serif text-[11px] ${
                  isActive ? 'font-semibold' : 'font-normal'
                }`}
              >
                {item.label}
              </span>

              <span className="font-mono text-[8px] tracking-tight mt-0.5 opacity-80">
                {item.shortDate}
              </span>

              {item.isToday && (
                <span
                  className="mt-0.5 h-1 w-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                />
              )}

              {isActive && (
                <span
                  className="absolute bottom-[-2px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: 'var(--text-main)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="rhythm-schedule-area flex-1 space-y-3.5 mb-8">
        <div className="flex items-center justify-between text-xs px-0.5">
          <span
            className="flex items-center gap-1.5 font-serif font-medium tracking-wider"
            style={{ color: 'var(--text-sub)' }}
          >
            <Clock className="w-3.5 h-3.5" />
            {activeDayInfo.dateStr} 安排票根
          </span>

          <span
            className="font-mono text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            共 {currentFilteredSchedules.length} 张
          </span>
        </div>

        {currentFilteredSchedules.length === 0 ? (
          <div
            className="py-12 text-center text-xs font-serif italic border border-dashed rounded-sm"
            style={{
              borderColor: 'var(--card-border)',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--control-soft-bg)'
            }}
          >
            这一页尚未夹入任何日程纸条。
          </div>
        ) : (
          <div className="space-y-3">
            {currentFilteredSchedules.map((item) => {
              const isExpired =
                !item.isRepeating && item.date && item.date < todayStr;

              const noteKey = `${item.id}_${activeDayInfo.dateStr}`;
              const currentNote = notesMap[noteKey];
              const isNoteLoading = generatingNoteId === noteKey;

              const categoryLabels = {
                course: '课程',
                work: '公务',
                life: '日常'
              };

              return (
                <div
                  key={item.id}
                  className={`rhythm-ticket relative flex flex-col border rounded-sm transition-all overflow-hidden ${
                    isExpired ? 'opacity-55' : ''
                  }`}
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--card-bg)'
                  }}
                >
                  {isExpired && (
                    <div
                      className="absolute right-3 top-2 rotate-[-8deg] border border-dashed px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest pointer-events-none select-none"
                      style={{
                        borderColor: 'var(--text-muted)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      EXPIRED / 已过期
                    </div>
                  )}

                  <div className="flex items-stretch">
                    <div
                      className="w-[85px] shrink-0 p-2.5 flex flex-col justify-center items-center text-center select-none border-r border-dashed"
                      style={{
                        borderColor: 'var(--card-border)',
                        backgroundColor: 'var(--control-soft-bg)'
                      }}
                    >
                      <span className="font-mono text-xs font-bold tracking-tight">
                        {item.startTime}
                      </span>

                      <span
                        className="my-0.5 h-2 w-px opacity-30"
                        style={{ backgroundColor: 'var(--text-main)' }}
                      />

                      <span className="font-mono text-[10px] opacity-60">
                        {item.endTime}
                      </span>
                    </div>

                    <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h3 className="font-serif text-[13px] font-semibold truncate text-[var(--text-main)]">
                            {item.title}
                          </h3>

                          <span
                            className="font-serif text-[9px] px-1 py-0.2 rounded border shrink-0 opacity-70"
                            style={{
                              borderColor: 'var(--card-border)',
                              color: 'var(--text-sub)'
                            }}
                          >
                            {categoryLabels[item.category] || '安排'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-serif text-[10px] opacity-70">
                          {item.location && (
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-2.5 h-2.5 opacity-60" />
                              {item.location}
                            </span>
                          )}

                          {item.teacher && (
                            <span className="flex items-center gap-0.5 truncate">
                              <User className="w-2.5 h-2.5 opacity-60" />
                              {item.teacher}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="mt-2 pt-1 border-t border-dashed flex justify-between items-center opacity-60 text-[9px] font-mono"
                        style={{ borderColor: 'var(--card-border)' }}
                      >
                        <span>
                          {!item.isRepeating
                            ? `单次 · ${item.date}`
                            : item.category === 'course' && item.weeks?.length > 0
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
                          className="flex items-center gap-0.5 p-0.5 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                          title="撕去此票根"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>撕下</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className="border-t border-dashed px-3 py-2 text-left"
                    style={{
                      borderColor: 'var(--card-border)',
                      backgroundColor: 'var(--control-soft-bg)'
                    }}
                  >
                    {currentNote ? (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <span
                            className="font-serif text-[9px] px-1 py-0.2 rounded shrink-0"
                            style={{
                              backgroundColor: 'var(--card-border)',
                              color: 'var(--text-sub)'
                            }}
                          >
                            {character?.name || '角色'} 手迹
                          </span>

                          <p className="font-serif text-[11px] italic leading-relaxed text-[var(--text-main)] break-words">
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
                          className="opacity-50 hover:opacity-100 transition-opacity p-1 shrink-0"
                          title="重新题写批注"
                        >
                          <Sparkles
                            className={`w-3 h-3 ${
                              isNoteLoading ? 'animate-spin' : ''
                            }`}
                          />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span
                          className="font-serif text-[10px] italic opacity-50"
                          style={{ color: 'var(--text-sub)' }}
                        >
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
                          className="flex items-center gap-1 font-serif text-[10px] underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-main)' }}
                        >
                          <Sparkles
                            className={`w-2.5 h-2.5 ${
                              isNoteLoading ? 'animate-spin' : ''
                            }`}
                          />
                          <span>
                            {isNoteLoading ? '题写中...' : '让角色留一笔'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="rhythm-tools border-t border-dashed pt-5 space-y-4"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div
          className="rhythm-import border rounded-sm p-3.5 space-y-2.5"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)'
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-serif text-xs font-semibold">
              使用外部 AI 助手批量导入
            </span>

            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 font-serif text-xs opacity-75 hover:opacity-100"
              style={{ color: 'var(--text-main)' }}
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}

              <span>{isCopied ? '提示词已复制' : '复制解析提示词'}</span>
            </button>
          </div>

          <p
            className="text-[10px] leading-relaxed"
            style={{ color: 'var(--text-sub)' }}
          >
            将提示词发送给任意大模型，并附带你的原版课表或日程文本。将生成出的纯 JSON 贴在下方导入：
          </p>

          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="粘贴 AI 吐出的纯 JSON 文本..."
            rows={2}
            className="w-full p-2 text-xs font-mono border rounded resize-none focus:outline-none"
            style={{
              borderColor: 'var(--card-border)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)'
            }}
          />

          <button
            onClick={handleImportJson}
            disabled={!pasteData.trim()}
            className="w-full py-1.5 font-serif text-xs font-medium rounded transition-opacity disabled:opacity-40"
            style={{
              backgroundColor: 'var(--text-main)',
              color: 'var(--bg-main)'
            }}
          >
            解析并夹入日程票根
          </button>
        </div>

        <details
          className="rhythm-manual group border rounded-sm"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)'
          }}
        >
          <summary className="flex items-center justify-between p-3 font-serif text-xs font-semibold cursor-pointer select-none">
            <span>手动夹入手写日程纸条</span>
            <Plus className="w-3.5 h-3.5 transition-transform group-open:rotate-45" />
          </summary>

          <form
            onSubmit={handleAddSingle}
            className="p-3.5 pt-0 space-y-3 text-xs border-t border-dashed"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <div className="space-y-1 pt-2">
              <label
                className="block text-[10px] font-serif"
                style={{ color: 'var(--text-sub)' }}
              >
                日程性质
              </label>

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-serif">
                  <input
                    type="radio"
                    checked={isRepeating}
                    onChange={() => setIsRepeating(true)}
                  />
                  每周固定循环
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-serif">
                  <input
                    type="radio"
                    checked={!isRepeating}
                    onChange={() => setIsRepeating(false)}
                  />
                  单次特定日期
                </label>
              </div>
            </div>

            <div>
              <label
                className="block text-[10px] font-serif mb-1"
                style={{ color: 'var(--text-sub)' }}
              >
                日程 / 课程名称
              </label>

              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="如：高等数学 / 通勤地铁 / 组会"
                className="w-full p-1.5 border rounded font-serif text-xs focus:outline-none"
                style={{
                  borderColor: 'var(--card-border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {isRepeating ? (
                <div>
                  <label
                    className="block text-[10px] font-serif mb-1"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    星期几
                  </label>

                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full p-1.5 border rounded font-serif text-xs"
                    style={{
                      borderColor: 'var(--card-border)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)'
                    }}
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
                  <label
                    className="block text-[10px] font-serif mb-1"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    具体日期
                  </label>

                  <input
                    type="date"
                    required
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full p-1.5 border rounded font-mono text-xs"
                    style={{
                      borderColor: 'var(--card-border)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)'
                    }}
                  />
                </div>
              )}

              <div>
                <label
                  className="block text-[10px] font-serif mb-1"
                  style={{ color: 'var(--text-sub)' }}
                >
                  类型
                </label>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-1.5 border rounded font-serif text-xs"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="course">学生课程</option>
                  <option value="work">工作日程</option>
                  <option value="life">生活日常</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className="block text-[10px] font-serif mb-1"
                  style={{ color: 'var(--text-sub)' }}
                >
                  开始时间
                </label>

                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-1.5 border rounded font-mono text-xs"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-[10px] font-serif mb-1"
                  style={{ color: 'var(--text-sub)' }}
                >
                  结束时间
                </label>

                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-1.5 border rounded font-mono text-xs"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            {isRepeating && category === 'course' && (
              <div>
                <label
                  className="block text-[10px] font-serif mb-1"
                  style={{ color: 'var(--text-sub)' }}
                >
                  上课周次区间 (如 1-16 或 1,3,5)
                </label>

                <input
                  type="text"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  className="w-full p-1.5 border rounded font-mono text-xs"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className="block text-[10px] font-serif mb-1"
                  style={{ color: 'var(--text-sub)' }}
                >
                  地点 (选填)
                </label>

                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：教三101"
                  className="w-full p-1.5 border rounded font-serif text-xs"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-[10px] font-serif mb-1"
                  style={{ color: 'var(--text-sub)' }}
                >
                  人物/老师 (选填)
                </label>

                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="如：任课老师"
                  className="w-full p-1.5 border rounded font-serif text-xs"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 font-serif text-xs font-medium rounded transition-opacity"
              style={{
                backgroundColor: 'var(--text-main)',
                color: 'var(--bg-main)'
              }}
            >
              夹入此时光纸条
            </button>
          </form>
        </details>
      </div>

      {errorMsg && (
        <div className="rhythm-toast rhythm-toast-error fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-xs font-serif border">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rhythm-toast rhythm-toast-success fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-xs font-serif border">
          {successMsg}
        </div>
      )}

      {deleteConfirmTarget && (
        <div className="rhythm-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div
            className="rhythm-modal w-full max-w-[320px] rounded border p-4 space-y-3 text-left shadow-lg"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />

              <h4 className="font-serif text-sm font-semibold">
                {deleteConfirmTarget.type === 'cleanup_expired'
                  ? '撕去所有过期纸条'
                  : '撕下此页日程'}
              </h4>
            </div>

            <p
              className="font-serif text-xs leading-relaxed"
              style={{ color: 'var(--text-sub)' }}
            >
              {deleteConfirmTarget.type === 'cleanup_expired'
                ? `确定要将手帐中所有已过期的 ${deleteConfirmTarget.count} 张单次旧票根统一撕下清理吗？此操作无法撤销。`
                : `确定要将《${deleteConfirmTarget.title}》这一日程纸条从手帐中撕去吗？附带的角色批注也将一并撕毁。`}
            </p>

            <div
              className="flex justify-end gap-2 pt-2 border-t border-dashed"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-3 py-1 font-serif text-xs rounded border transition-opacity hover:opacity-80"
                style={{
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-sub)'
                }}
              >
                保留
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-3 py-1 font-serif text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 transition-colors"
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


