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

// 格式化两位数字
const pad2 = (n) => String(n).padStart(2, '0');

// 本地安全日期转 YYYY-MM-DD
const formatDateStr = (dateObj) => {
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
};

// 格式化手帐短日期 MM.DD
const formatShortDate = (dateObj) => {
  return `${pad2(dateObj.getMonth() + 1)}.${pad2(dateObj.getDate())}`;
};

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [character, setCharacter] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [notesMap, setNotesMap] = useState({});
  const [generatingNoteId, setGeneratingNoteId] = useState(null);

  // 学期开学基准日期配置
  const [termStartDate, setTermStartDate] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // 选中的周次与选中的星期几
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7);

  // 删除确认对话框状态
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // 新建表单状态
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

  // 今天的基准真实日期
  const todayDateObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateStr(todayDateObj), [todayDateObj]);

  // 计算某个开学日期对应的当前真实周次
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

  // 当前真实周数
  const realCurrentWeek = useMemo(() => {
    return calculateCurrentWeek(termStartDate);
  }, [termStartDate]);

  // 计算选定周的周一到周日
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

  // 当前选中的自然日信息
  const activeDayInfo = useMemo(() => {
    return weekDaysInfo.find((d) => d.dayOfWeek === activeDay) || weekDaysInfo[0];
  }, [weekDaysInfo, activeDay]);

  // 读取数据与初始化
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

  // 加载日程与随笔批注
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

  // 复制导入 Prompt
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

  // 导入 JSON
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

  // 手动添加日程
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

  // 执行删除
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

  // 由角色生成某天某日程的动态随笔便签
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

  // 严格过滤选中周次与星期下的日程
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

  // 统计历史过期的单次日程总数
  const totalExpiredCount = useMemo(() => {
    return schedules.filter(
      (s) => !s.isRepeating && s.date && s.date < todayStr
    ).length;
  }, [schedules, todayStr]);

  return (
    <>
      <style>{`
        .aura-rhythm-shell {
          --aura-bg: #efeee9;
          --aura-paper: rgba(255,255,255,.68);
          --aura-paper-strong: rgba(255,255,255,.86);
          --aura-ink: #151515;
          --aura-soft-ink: #6d6b67;
          --aura-faint-ink: #aaa7a0;
          --aura-line: rgba(21,21,21,.11);
          --aura-line-light: rgba(21,21,21,.065);
          --aura-dark: #171717;
          --aura-accent: #b66d42;
          --aura-shadow: 0 24px 70px rgba(32,27,21,.13);
          --aura-spring: cubic-bezier(.16,1,.3,1);
          --aura-elastic: cubic-bezier(.34,1.56,.64,1);
          position: relative;
          isolation: isolate;
          width: 100%;
          max-width: 432px;
          min-height: 100dvh;
          margin: 0 auto;
          overflow: hidden;
          color: var(--aura-ink);
          background:
            radial-gradient(circle at 12% 7%, rgba(255,255,255,.95), transparent 27%),
            radial-gradient(circle at 95% 23%, rgba(197,184,168,.24), transparent 32%),
            linear-gradient(145deg, #f4f3ef 0%, #e9e7e1 100%);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .aura-rhythm-shell *,
        .aura-rhythm-shell *::before,
        .aura-rhythm-shell *::after {
          box-sizing: border-box;
        }

        .aura-rhythm-shell button,
        .aura-rhythm-shell input,
        .aura-rhythm-shell textarea,
        .aura-rhythm-shell select {
          font: inherit;
        }

        .aura-rhythm-shell button {
          border: 0;
          cursor: pointer;
          color: inherit;
          background: transparent;
          -webkit-tap-highlight-color: transparent;
        }

        .aura-rhythm-shell button:disabled {
          cursor: default;
        }

        .aura-rhythm-shell input,
        .aura-rhythm-shell textarea,
        .aura-rhythm-shell select {
          outline: none;
        }

        .aura-rhythm-shell input::placeholder,
        .aura-rhythm-shell textarea::placeholder {
          color: rgba(21,21,21,.32);
        }

        .aura-rhythm-shell::before {
          content: "";
          position: fixed;
          z-index: -2;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 3%, rgba(255,255,255,.7), transparent 34%),
            linear-gradient(120deg, transparent 0 45%, rgba(255,255,255,.22) 50%, transparent 58%);
          opacity: .78;
        }

        .aura-rhythm-shell::after {
          content: "";
          position: fixed;
          z-index: 10;
          inset: 0;
          pointer-events: none;
          opacity: .16;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.34'/%3E%3C/svg%3E");
        }

        .aura-ambient {
          position: absolute;
          z-index: -1;
          top: -130px;
          left: 50%;
          width: 440px;
          height: 440px;
          transform: translateX(-50%);
          pointer-events: none;
          border-radius: 50%;
          filter: blur(36px);
          opacity: .68;
          background: radial-gradient(circle, rgba(220,214,204,.95) 0%, rgba(220,214,204,.3) 48%, transparent 72%);
          animation: auraFloat 13s ease-in-out infinite alternate;
        }

        .aura-ambient::after {
          content: "";
          position: absolute;
          top: 230px;
          left: 245px;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(165,154,141,.3), transparent 72%);
          animation: auraFloatSmall 9s ease-in-out infinite alternate;
        }

        @keyframes auraFloat {
          from { transform: translateX(-50%) translate3d(-13px,0,0) scale(1); }
          to { transform: translateX(-50%) translate3d(15px,26px,0) scale(1.08); }
        }

        @keyframes auraFloatSmall {
          from { transform: translate3d(0,0,0); }
          to { transform: translate3d(-20px,16px,0) scale(1.12); }
        }

        .aura-scroll {
          position: relative;
          z-index: 1;
          height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 22px 21px 42px;
          scrollbar-width: none;
        }

        .aura-scroll::-webkit-scrollbar {
          display: none;
        }

        .aura-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          min-height: 74px;
          animation: auraReveal .72s var(--aura-spring) both;
        }

        .aura-brand {
          padding-top: 1px;
        }

        .aura-kicker {
          margin-bottom: 7px;
          color: var(--aura-soft-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .22em;
          line-height: 1;
          text-transform: uppercase;
        }

        .aura-title {
          color: var(--aura-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 31px;
          font-weight: 400;
          letter-spacing: -.055em;
          line-height: .96;
        }

        .aura-title em {
          color: var(--aura-accent);
          font-weight: 400;
        }

        .aura-subtitle {
          margin-top: 9px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          font-style: italic;
          letter-spacing: .025em;
        }

        .aura-top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 1px;
        }

        .aura-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 37px;
          height: 37px;
          color: var(--aura-ink);
          border-radius: 50%;
          transition: transform .42s var(--aura-elastic), background .3s ease, color .3s ease;
        }

        .aura-icon-button:hover {
          background: rgba(255,255,255,.67);
          transform: translateY(-2px) scale(1.06);
        }

        .aura-icon-button:active {
          transform: scale(.87);
        }

        .aura-icon-button svg {
          width: 17px;
          height: 17px;
          stroke-width: 1.65;
        }

        .aura-clean-expired {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 30px;
          padding: 0 9px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          white-space: nowrap;
          border-bottom: 1px dashed rgba(21,21,21,.26);
          transition: color .25s ease, transform .35s var(--aura-spring);
        }

        .aura-clean-expired:hover {
          color: var(--aura-accent);
          transform: translateY(-2px);
        }

        .aura-clean-expired svg {
          width: 12px;
          height: 12px;
        }

        .aura-hairline {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 19px;
          margin-bottom: 18px;
        }

        .aura-hairline::before {
          content: "";
          width: 33px;
          height: 2px;
          background: var(--aura-accent);
        }

        .aura-hairline::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--aura-line);
        }

        .aura-week-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 60px;
          margin-bottom: 17px;
          padding: 0 8px;
          background: rgba(255,255,255,.32);
          border-radius: 21px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.64);
          animation: auraReveal .72s .06s var(--aura-spring) both;
        }

        .aura-week-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          color: var(--aura-soft-ink);
          border-radius: 50%;
          transition: background .3s ease, color .3s ease, transform .35s var(--aura-elastic);
        }

        .aura-week-arrow:hover:not(:disabled) {
          color: var(--aura-ink);
          background: rgba(255,255,255,.74);
          transform: scale(1.08);
        }

        .aura-week-arrow:active:not(:disabled) {
          transform: scale(.82);
        }

        .aura-week-arrow:disabled {
          opacity: .25;
        }

        .aura-week-arrow svg {
          width: 17px;
          height: 17px;
          stroke-width: 1.7;
        }

        .aura-week-center {
          display: flex;
          align-items: center;
          flex-direction: column;
          gap: 5px;
        }

        .aura-week-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: .07em;
        }

        .aura-current-tag {
          padding: 4px 7px 3px;
          color: #fff;
          background: var(--aura-dark);
          border-radius: 10px;
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .08em;
        }

        .aura-return-week {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: var(--aura-soft-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          letter-spacing: .02em;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color .25s ease;
        }

        .aura-return-week:hover {
          color: var(--aura-accent);
        }

        .aura-return-week svg {
          width: 10px;
          height: 10px;
        }

        .aura-week-range {
          color: var(--aura-faint-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          letter-spacing: .03em;
        }

        .aura-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          margin-bottom: 8px;
          padding: 0 3px 9px;
          border-bottom: 1px solid var(--aura-line);
          animation: auraReveal .72s .1s var(--aura-spring) both;
        }

        .aura-day {
          position: relative;
          display: flex;
          align-items: center;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
          padding: 6px 1px 5px;
          color: var(--aura-faint-ink);
          transition: color .35s ease, transform .4s var(--aura-spring);
        }

        .aura-day:hover {
          color: var(--aura-ink);
          transform: translateY(-3px);
        }

        .aura-day.is-active {
          color: var(--aura-ink);
        }

        .aura-day-name {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          line-height: 1;
        }

        .aura-day.is-active .aura-day-name {
          font-weight: 700;
        }

        .aura-day-date {
          color: currentColor;
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          opacity: .76;
        }

        .aura-day-today {
          position: absolute;
          bottom: -3px;
          width: 4px;
          height: 4px;
          background: var(--aura-accent);
          border-radius: 50%;
        }

        .aura-day-marker {
          position: absolute;
          bottom: -11px;
          left: 50%;
          width: 24px;
          height: 2px;
          background: var(--aura-ink);
          border-radius: 2px;
          transform: translateX(-50%);
          animation: auraMarker .42s var(--aura-spring) both;
        }

        @keyframes auraMarker {
          from { opacity: 0; width: 3px; }
          to { opacity: 1; width: 24px; }
        }

        .aura-arc-section {
          position: relative;
          height: 236px;
          margin: 3px -4px 2px;
          animation: auraReveal .8s .15s var(--aura-spring) both;
        }

        .aura-arc-section::before {
          content: "";
          position: absolute;
          top: 48%;
          left: 50%;
          width: 210px;
          height: 96px;
          border-radius: 50%;
          background: rgba(255,255,255,.34);
          filter: blur(28px);
          transform: translate(-50%,-50%);
          pointer-events: none;
        }

        .aura-arc-svg {
          position: absolute;
          top: 8px;
          left: 50%;
          width: 324px;
          height: 218px;
          overflow: visible;
          transform: translateX(-50%);
        }

        .aura-arc-track,
        .aura-arc-progress {
          fill: none;
          stroke-linecap: round;
        }

        .aura-arc-track {
          stroke: rgba(21,21,21,.075);
          stroke-width: 13;
        }

        .aura-arc-progress {
          stroke: var(--aura-dark);
          stroke-width: 13;
          stroke-dasharray: 465;
          stroke-dashoffset: 128;
          transition: stroke-dashoffset 1s var(--aura-spring);
        }

        .aura-arc-tick {
          fill: var(--aura-faint-ink);
        }

        .aura-arc-tick.accent {
          fill: var(--aura-accent);
        }

        .aura-orbit-caption {
          position: absolute;
          top: 18px;
          left: 23px;
          color: var(--aura-faint-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .aura-orbit-caption.right {
          top: 112px;
          right: 19px;
          left: auto;
          transform: rotate(90deg);
          transform-origin: right center;
        }

        .aura-orbit-dot {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          color: var(--aura-soft-ink);
          background: rgba(255,255,255,.74);
          border-radius: 50%;
          box-shadow: 0 8px 20px rgba(36,30,23,.09), inset 0 1px 0 rgba(255,255,255,.95);
          transition: transform .42s var(--aura-elastic), color .3s ease, background .3s ease;
        }

        .aura-orbit-dot:hover {
          color: var(--aura-accent);
          background: #fff;
          transform: scale(1.19);
        }

        .aura-orbit-dot.one {
          top: 81px;
          left: 39px;
        }

        .aura-orbit-dot.two {
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
        }

        .aura-orbit-dot.two:hover {
          transform: translateX(-50%) scale(1.19);
        }

        .aura-orbit-dot.three {
          top: 80px;
          right: 36px;
        }

        .aura-orbit-dot svg {
          width: 14px;
          height: 14px;
          stroke-width: 1.7;
        }

        .aura-arc-center {
          position: absolute;
          top: 91px;
          left: 50%;
          text-align: center;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .aura-arc-date {
          color: var(--aura-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 31px;
          font-weight: 300;
          letter-spacing: -.09em;
          line-height: 1;
          white-space: nowrap;
        }

        .aura-arc-label {
          margin-top: 8px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          font-style: italic;
          letter-spacing: .05em;
          white-space: nowrap;
        }

        .aura-flow-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin: 3px 2px 13px;
          animation: auraReveal .8s .2s var(--aura-spring) both;
        }

        .aura-flow-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .08em;
        }

        .aura-flow-title svg {
          width: 14px;
          height: 14px;
          color: var(--aura-accent);
          stroke-width: 1.8;
        }

        .aura-flow-count {
          color: var(--aura-faint-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 9px;
        }

        .aura-stream {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-bottom: 31px;
        }

        .aura-empty {
          position: relative;
          padding: 39px 20px 42px;
          color: var(--aura-faint-ink);
          text-align: center;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          font-style: italic;
          animation: auraReveal .6s var(--aura-spring) both;
        }

        .aura-empty::before,
        .aura-empty::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 27%;
          height: 1px;
          background: var(--aura-line);
        }

        .aura-empty::before {
          left: 0;
        }

        .aura-empty::after {
          right: 0;
        }

        .aura-ticket {
          position: relative;
          overflow: hidden;
          background: rgba(255,255,255,.66);
          border-radius: 23px;
          box-shadow: 0 8px 24px rgba(35,30,24,.055), inset 0 1px 0 rgba(255,255,255,.84);
          animation: ticketIn .65s var(--aura-spring) both;
          transition: transform .42s var(--aura-spring), background .35s ease, box-shadow .35s ease, opacity .35s ease;
        }

        .aura-ticket:nth-child(2) {
          animation-delay: .055s;
        }

        .aura-ticket:nth-child(3) {
          animation-delay: .1s;
        }

        .aura-ticket:nth-child(4) {
          animation-delay: .145s;
        }

        .aura-ticket:hover {
          background: rgba(255,255,255,.88);
          box-shadow: 0 15px 34px rgba(35,30,24,.1), inset 0 1px 0 rgba(255,255,255,.95);
          transform: translateX(4px);
        }

        .aura-ticket.is-expired {
          opacity: .54;
          filter: grayscale(.24);
        }

        @keyframes ticketIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .aura-expired-stamp {
          position: absolute;
          z-index: 2;
          top: 9px;
          right: 12px;
          padding: 4px 7px 3px;
          color: var(--aura-soft-ink);
          border: 1px dashed rgba(21,21,21,.3);
          border-radius: 4px;
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 7px;
          letter-spacing: .13em;
          transform: rotate(-7deg);
          pointer-events: none;
        }

        .aura-ticket-main {
          display: flex;
          min-height: 112px;
        }

        .aura-ticket-time {
          display: flex;
          align-items: center;
          flex-direction: column;
          justify-content: center;
          width: 76px;
          flex-shrink: 0;
          color: var(--aura-ink);
          background: rgba(232,229,222,.44);
          border-right: 1px dashed rgba(21,21,21,.16);
          font-family: "SF Mono", "Roboto Mono", monospace;
        }

        .aura-ticket-time strong {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -.06em;
        }

        .aura-ticket-time span {
          width: 1px;
          height: 12px;
          margin: 5px 0;
          background: rgba(21,21,21,.26);
        }

        .aura-ticket-time small {
          color: var(--aura-soft-ink);
          font-size: 10px;
        }

        .aura-ticket-content {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px 15px 12px;
        }

        .aura-ticket-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .aura-ticket-title {
          min-width: 0;
          overflow: hidden;
          color: var(--aura-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -.025em;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aura-category {
          flex-shrink: 0;
          padding: 4px 7px 3px;
          color: var(--aura-soft-ink);
          background: rgba(21,21,21,.045);
          border-radius: 10px;
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          letter-spacing: .03em;
        }

        .aura-ticket-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          margin-top: 7px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
        }

        .aura-ticket-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aura-ticket-meta svg {
          width: 11px;
          height: 11px;
          flex-shrink: 0;
          opacity: .7;
        }

        .aura-ticket-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding-top: 8px;
          color: var(--aura-faint-ink);
          border-top: 1px dashed rgba(21,21,21,.11);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
        }

        .aura-tear-button {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 0;
          color: var(--aura-faint-ink);
          transition: color .25s ease, transform .35s var(--aura-elastic);
        }

        .aura-tear-button:hover {
          color: #a54e3d;
          transform: scale(1.05);
        }

        .aura-tear-button svg {
          width: 12px;
          height: 12px;
        }

        .aura-note {
          padding: 10px 14px 11px;
          color: var(--aura-soft-ink);
          background: rgba(226,220,210,.31);
          border-top: 1px dashed rgba(21,21,21,.13);
        }

        .aura-note-existing {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .aura-note-text {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          min-width: 0;
        }

        .aura-note-author {
          flex-shrink: 0;
          color: var(--aura-accent);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 9px;
          font-style: italic;
        }

        .aura-note-content {
          color: var(--aura-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          font-style: italic;
          line-height: 1.55;
          word-break: break-word;
        }

        .aura-note-action {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          padding: 3px;
          color: var(--aura-faint-ink);
          transition: color .25s ease, transform .4s var(--aura-elastic);
        }

        .aura-note-action:hover {
          color: var(--aura-accent);
          transform: rotate(15deg) scale(1.13);
        }

        .aura-note-action svg {
          width: 13px;
          height: 13px;
        }

        .aura-note-empty {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .aura-note-placeholder {
          color: var(--aura-faint-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          font-style: italic;
        }

        .aura-note-generate {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color .25s ease, transform .35s var(--aura-spring);
        }

        .aura-note-generate:hover:not(:disabled) {
          color: var(--aura-accent);
          transform: translateY(-2px);
        }

        .aura-note-generate:disabled {
          opacity: .42;
        }

        .aura-note-generate svg {
          width: 11px;
          height: 11px;
        }

        .aura-spin {
          animation: auraSpin 1s linear infinite;
        }

        @keyframes auraSpin {
          to { transform: rotate(360deg); }
        }

        .aura-tools {
          margin-top: 5px;
          padding-top: 23px;
          border-top: 1px dashed var(--aura-line);
          animation: auraReveal .8s .23s var(--aura-spring) both;
        }

        .aura-section-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 13px;
        }

        .aura-section-label span:first-child {
          color: var(--aura-soft-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .17em;
          text-transform: uppercase;
        }

        .aura-section-label span:last-child {
          color: var(--aura-faint-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          font-style: italic;
        }

        .aura-import {
          padding: 18px 16px 16px;
          background: rgba(255,255,255,.38);
          border-radius: 24px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
        }

        .aura-import-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .aura-import-title {
          color: var(--aura-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-weight: 600;
        }

        .aura-copy-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          transition: color .25s ease, transform .35s var(--aura-spring);
        }

        .aura-copy-button:hover {
          color: var(--aura-accent);
          transform: translateY(-2px);
        }

        .aura-copy-button svg {
          width: 13px;
          height: 13px;
        }

        .aura-import-description {
          margin-bottom: 12px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          line-height: 1.65;
        }

        .aura-textarea {
          display: block;
          width: 100%;
          min-height: 72px;
          resize: vertical;
          padding: 11px 12px;
          color: var(--aura-ink);
          background: rgba(255,255,255,.55);
          border: 0;
          border-bottom: 1px solid var(--aura-line);
          border-radius: 12px 12px 4px 4px;
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 10px;
          line-height: 1.55;
          transition: background .3s ease, border-color .3s ease, box-shadow .3s ease;
        }

        .aura-textarea:focus {
          background: rgba(255,255,255,.88);
          border-color: var(--aura-accent);
          box-shadow: 0 7px 22px rgba(38,29,21,.06);
        }

        .aura-primary-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 43px;
          margin-top: 11px;
          color: #fff;
          background: var(--aura-dark);
          border-radius: 22px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .04em;
          transition: transform .4s var(--aura-spring), background .3s ease, box-shadow .3s ease, opacity .3s ease;
        }

        .aura-primary-button:hover:not(:disabled) {
          background: #30302f;
          box-shadow: 0 10px 22px rgba(20,20,20,.18);
          transform: translateY(-2px);
        }

        .aura-primary-button:active:not(:disabled) {
          transform: scale(.97);
        }

        .aura-primary-button:disabled {
          opacity: .3;
        }

        .aura-manual {
          margin-top: 13px;
          background: rgba(255,255,255,.3);
          border-radius: 22px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.5);
        }

        .aura-manual summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          color: var(--aura-ink);
          list-style: none;
          cursor: pointer;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          font-weight: 600;
        }

        .aura-manual summary::-webkit-details-marker {
          display: none;
        }

        .aura-manual summary svg {
          width: 16px;
          height: 16px;
          color: var(--aura-soft-ink);
          transition: transform .45s var(--aura-elastic);
        }

        .aura-manual[open] summary svg {
          transform: rotate(45deg);
        }

        .aura-manual-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 0 16px 17px;
          animation: auraDrawer .55s var(--aura-spring) both;
        }

        @keyframes auraDrawer {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .aura-form-field {
          min-width: 0;
        }

        .aura-form-label {
          display: block;
          margin-bottom: 6px;
          color: var(--aura-soft-ink);
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 8px;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .aura-form-input,
        .aura-form-select {
          display: block;
          width: 100%;
          min-height: 37px;
          padding: 0 2px 7px;
          color: var(--aura-ink);
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--aura-line);
          border-radius: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 12px;
          transition: border-color .3s ease, padding .3s ease;
        }

        .aura-form-input:focus,
        .aura-form-select:focus {
          padding-left: 7px;
          border-color: var(--aura-accent);
        }

        .aura-form-input[type="date"],
        .aura-form-input[type="time"],
        .aura-form-input.mono {
          font-family: "SF Mono", "Roboto Mono", monospace;
          font-size: 10px;
        }

        .aura-form-select {
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--aura-soft-ink) 50%), linear-gradient(135deg, var(--aura-soft-ink) 50%, transparent 50%);
          background-position: calc(100% - 8px) 16px, calc(100% - 4px) 16px;
          background-repeat: no-repeat;
          background-size: 4px 4px, 4px 4px;
        }

        .aura-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .aura-mode {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .aura-mode-label {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          color: var(--aura-soft-ink);
          background: rgba(255,255,255,.32);
          border-radius: 15px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          cursor: pointer;
          transition: color .25s ease, background .3s ease, transform .35s var(--aura-spring);
        }

        .aura-mode-label:hover {
          background: rgba(255,255,255,.75);
          transform: translateY(-2px);
        }

        .aura-mode-label input {
          width: 11px;
          height: 11px;
          margin: 0;
          accent-color: var(--aura-accent);
        }

        .aura-config {
          margin: 2px 0 17px;
          padding: 15px 16px 16px;
          background: rgba(255,255,255,.48);
          border-radius: 20px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.74);
          animation: auraDrawer .52s var(--aura-spring) both;
        }

        .aura-config-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .aura-config-title {
          color: var(--aura-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 13px;
          font-weight: 600;
        }

        .aura-config-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          color: var(--aura-soft-ink);
          border-radius: 50%;
          transition: background .25s ease, transform .35s var(--aura-elastic);
        }

        .aura-config-close:hover {
          background: rgba(21,21,21,.06);
          transform: rotate(90deg);
        }

        .aura-config-close svg {
          width: 14px;
          height: 14px;
        }

        .aura-config-description {
          margin-bottom: 13px;
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          line-height: 1.6;
        }

        .aura-config-row {
          display: flex;
          align-items: flex-end;
          gap: 12px;
        }

        .aura-config-row .aura-form-field {
          flex: 1;
        }

        .aura-small-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 37px;
          padding: 0 13px;
          color: #fff;
          background: var(--aura-dark);
          border-radius: 19px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 10px;
          white-space: nowrap;
          transition: transform .35s var(--aura-spring), box-shadow .3s ease;
        }

        .aura-small-button:hover {
          box-shadow: 0 8px 18px rgba(20,20,20,.16);
          transform: translateY(-2px);
        }

        .aura-toast {
          position: fixed;
          z-index: 90;
          bottom: 27px;
          left: 50%;
          max-width: min(350px, calc(100vw - 32px));
          padding: 12px 17px;
          color: #fff;
          background: rgba(23,23,23,.94);
          border-radius: 24px;
          box-shadow: 0 15px 38px rgba(0,0,0,.2);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          line-height: 1.45;
          text-align: center;
          transform: translateX(-50%);
          animation: toastIn .48s var(--aura-spring) both;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .aura-toast.error {
          background: rgba(127,53,42,.94);
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, 16px) scale(.94); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }

        .aura-modal-backdrop {
          position: fixed;
          z-index: 100;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          background: rgba(17,16,15,.45);
          animation: auraFade .3s ease both;
          backdrop-filter: blur(13px);
          -webkit-backdrop-filter: blur(13px);
        }

        .aura-modal {
          width: 100%;
          max-width: 326px;
          padding: 22px 20px 17px;
          background: rgba(247,245,240,.95);
          border-radius: 27px;
          box-shadow: 0 25px 80px rgba(0,0,0,.24);
          animation: modalIn .55s var(--aura-spring) both;
        }

        @keyframes auraFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalIn {
          from { opacity: 0; transform: translateY(18px) scale(.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .aura-modal-head {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
        }

        .aura-modal-head svg {
          width: 17px;
          height: 17px;
          color: var(--aura-accent);
          stroke-width: 1.8;
        }

        .aura-modal-title {
          color: var(--aura-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          font-weight: 600;
        }

        .aura-modal-text {
          color: var(--aura-soft-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          line-height: 1.7;
        }

        .aura-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px dashed var(--aura-line);
        }

        .aura-modal-button {
          min-height: 34px;
          padding: 0 14px;
          border-radius: 18px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 11px;
          transition: transform .35s var(--aura-spring), background .3s ease, color .3s ease;
        }

        .aura-modal-button:hover {
          transform: translateY(-2px);
        }

        .aura-modal-button.keep {
          color: var(--aura-soft-ink);
          background: rgba(21,21,21,.06);
        }

        .aura-modal-button.delete {
          color: #fff;
          background: #984d3e;
        }

        @keyframes auraReveal {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 460px) {
          .aura-rhythm-shell {
            max-width: none;
          }

          .aura-scroll {
            padding-right: 17px;
            padding-left: 17px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-rhythm-shell *,
          .aura-rhythm-shell *::before,
          .aura-rhythm-shell *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .001ms !important;
          }
        }
      `}</style>

      <div className="aura-rhythm-shell">
        <div className="aura-ambient" />

        <main className="aura-scroll">
          <header className="aura-topbar">
            <div className="aura-brand">
              <div className="aura-kicker">Rhythm / Ephemera</div>
              <h1 className="aura-title">
                时光<em>作息</em>
              </h1>
              <p className="aura-subtitle">
                {character?.name ? `与 ${character.name} 一起生活的时间轨迹` : '把日常留在这一页'}
              </p>
            </div>

            <div className="aura-top-actions">
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
                  className="aura-clean-expired"
                >
                  <Trash2 />
                  <span>撕去 {totalExpiredCount}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfig((v) => !v)}
                aria-label="打开作息设置"
                title="作息设置"
                className="aura-icon-button"
              >
                <Settings />
              </button>

              <button
                type="button"
                onClick={onBackHub}
                aria-label="返回主页"
                title="返回主页"
                className="aura-icon-button"
              >
                <ArrowLeft />
              </button>
            </div>
          </header>

          <div className="aura-hairline" />

          {showConfig && (
            <section className="aura-config">
              <div className="aura-config-head">
                <span className="aura-config-title">开学首周周一锚点</span>

                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="aura-config-close"
                  aria-label="关闭设置"
                >
                  <X />
                </button>
              </div>

              <p className="aura-config-description">
                设定学期第 1 周的周一日期，系统将严密推算任意周次的日程安排，杜绝跨周穿帮。
              </p>

              <div className="aura-config-row">
                <div className="aura-form-field">
                  <label className="aura-form-label">Term anchor</label>
                  <input
                    type="date"
                    value={termStartDate}
                    onChange={(e) => setTermStartDate(e.target.value)}
                    className="aura-form-input mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveTermStart}
                  className="aura-small-button"
                >
                  保存锚点
                </button>
              </div>
            </section>
          )}

          <section className="aura-week-control">
            <button
              type="button"
              onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
              disabled={selectedWeek <= 1}
              className="aura-week-arrow"
              aria-label="上一周"
            >
              <ChevronLeft />
            </button>

            <div className="aura-week-center">
              <div className="aura-week-label">
                <span>第 {selectedWeek} 周</span>

                {selectedWeek === realCurrentWeek ? (
                  <span className="aura-current-tag">本周</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedWeek(realCurrentWeek)}
                    className="aura-return-week"
                  >
                    <RotateCcw />
                    回到本周
                  </button>
                )}
              </div>

              <span className="aura-week-range">
                {weekDaysInfo[0].shortDate} — {weekDaysInfo[6].shortDate}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedWeek((w) => w + 1)}
              className="aura-week-arrow"
              aria-label="下一周"
            >
              <ChevronRight />
            </button>
          </section>

          <nav className="aura-days" aria-label="选择日期">
            {weekDaysInfo.map((item) => {
              const isActive = activeDay === item.dayOfWeek;

              return (
                <button
                  key={item.dayOfWeek}
                  type="button"
                  onClick={() => setActiveDay(item.dayOfWeek)}
                  className={`aura-day ${isActive ? 'is-active' : ''}`}
                >
                  <span className="aura-day-name">{item.label}</span>
                  <span className="aura-day-date">{item.shortDate}</span>

                  {item.isToday && <span className="aura-day-today" />}
                  {isActive && <span className="aura-day-marker" />}
                </button>
              );
            })}
          </nav>

          <section className="aura-arc-section">
            <span className="aura-orbit-caption">daily arc</span>
            <span className="aura-orbit-caption right">living rhythm</span>

            <svg
              className="aura-arc-svg"
              viewBox="0 0 324 218"
              aria-hidden="true"
            >
              <path
                className="aura-arc-track"
                d="M 38 181 A 130 130 0 1 1 286 181"
              />

              <path
                className="aura-arc-progress"
                d="M 38 181 A 130 130 0 1 1 286 181"
              />

              <circle className="aura-arc-tick" cx="38" cy="181" r="3" />
              <circle className="aura-arc-tick accent" cx="162" cy="42" r="3.5" />
              <circle className="aura-arc-tick" cx="286" cy="181" r="3" />
            </svg>

            <div className="aura-orbit-dot one" title="当天安排">
              <Calendar />
            </div>

            <div className="aura-orbit-dot two" title="当前周次">
              <Clock />
            </div>

            <div className="aura-orbit-dot three" title="生活节奏">
              <Sparkles />
            </div>

            <div className="aura-arc-center">
              <div className="aura-arc-date">
                {activeDayInfo.shortDate}
              </div>
              <div className="aura-arc-label">
                {activeDayInfo.label} · {currentFilteredSchedules.length} flows
              </div>
            </div>
          </section>

          <section className="aura-flow-head">
            <div className="aura-flow-title">
              <Clock />
              <span>{activeDayInfo.dateStr} 的时间流</span>
            </div>

            <span className="aura-flow-count">
              {currentFilteredSchedules.length} 张票根
            </span>
          </section>

          <section className="aura-stream">
            {currentFilteredSchedules.length === 0 ? (
              <div className="aura-empty">
                这一页还没有夹入任何日程纸条。
              </div>
            ) : (
              currentFilteredSchedules.map((item) => {
                const isExpired =
                  !item.isRepeating &&
                  item.date &&
                  item.date < todayStr;

                const noteKey = `${item.id}_${activeDayInfo.dateStr}`;
                const currentNote = notesMap[noteKey];
                const isNoteLoading = generatingNoteId === noteKey;

                const categoryLabels = {
                  course: '课程',
                  work: '公务',
                  life: '日常'
                };

                return (
                  <article
                    key={item.id}
                    className={`aura-ticket ${isExpired ? 'is-expired' : ''}`}
                  >
                    {isExpired && (
                      <div className="aura-expired-stamp">
                        EXPIRED / 已过期
                      </div>
                    )}

                    <div className="aura-ticket-main">
                      <div className="aura-ticket-time">
                        <strong>{item.startTime}</strong>
                        <span />
                        <small>{item.endTime}</small>
                      </div>

                      <div className="aura-ticket-content">
                        <div>
                          <div className="aura-ticket-title-row">
                            <h3 className="aura-ticket-title">
                              {item.title}
                            </h3>

                            <span className="aura-category">
                              {categoryLabels[item.category] || '安排'}
                            </span>
                          </div>

                          <div className="aura-ticket-meta">
                            {item.location && (
                              <span>
                                <MapPin />
                                {item.location}
                              </span>
                            )}

                            {item.teacher && (
                              <span>
                                <User />
                                {item.teacher}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="aura-ticket-footer">
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
                            className="aura-tear-button"
                            title="撕去此票根"
                          >
                            <Trash2 />
                            <span>撕下</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="aura-note">
                      {currentNote ? (
                        <div className="aura-note-existing">
                          <div className="aura-note-text">
                            <span className="aura-note-author">
                              {character?.name || '角色'} 手迹
                            </span>

                            <p className="aura-note-content">
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
                            className="aura-note-action"
                            title="重新题写批注"
                          >
                            <Sparkles className={isNoteLoading ? 'aura-spin' : ''} />
                          </button>
                        </div>
                      ) : (
                        <div className="aura-note-empty">
                          <span className="aura-note-placeholder">
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
                            className="aura-note-generate"
                          >
                            <Sparkles className={isNoteLoading ? 'aura-spin' : ''} />
                            <span>
                              {isNoteLoading ? '题写中...' : '让角色留一笔'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <section className="aura-tools">
            <div className="aura-section-label">
              <span>New flow</span>
              <span>将新的日程留在时间里</span>
            </div>

            <div className="aura-import">
              <div className="aura-import-head">
                <span className="aura-import-title">
                  使用外部 AI 批量导入
                </span>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="aura-copy-button"
                >
                  {isCopied ? (
                    <Check />
                  ) : (
                    <Copy />
                  )}
                  <span>
                    {isCopied ? '提示词已复制' : '复制提示词'}
                  </span>
                </button>
              </div>

              <p className="aura-import-description">
                将提示词发送给任意大模型，并附带你的原版课表或日程文本。把生成出的纯 JSON 贴在下方即可。
              </p>

              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="粘贴 AI 吐出的纯 JSON 文本..."
                rows={3}
                className="aura-textarea"
              />

              <button
                type="button"
                onClick={handleImportJson}
                disabled={!pasteData.trim()}
                className="aura-primary-button"
              >
                解析并夹入日程票根
              </button>
            </div>

            <details className="aura-manual">
              <summary>
                <span>手动夹入一张日程纸条</span>
                <Plus />
              </summary>

              <form
                onSubmit={handleAddSingle}
                className="aura-manual-form"
              >
                <div className="aura-form-field">
                  <label className="aura-form-label">Schedule mode</label>

                  <div className="aura-mode">
                    <label className="aura-mode-label">
                      <input
                        type="radio"
                        checked={isRepeating}
                        onChange={() => setIsRepeating(true)}
                      />
                      <span>每周固定循环</span>
                    </label>

                    <label className="aura-mode-label">
                      <input
                        type="radio"
                        checked={!isRepeating}
                        onChange={() => setIsRepeating(false)}
                      />
                      <span>单次特定日期</span>
                    </label>
                  </div>
                </div>

                <div className="aura-form-field">
                  <label className="aura-form-label">
                    Schedule title
                  </label>

                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：高等数学 / 通勤地铁 / 组会"
                    className="aura-form-input"
                  />
                </div>

                <div className="aura-form-grid">
                  {isRepeating ? (
                    <div className="aura-form-field">
                      <label className="aura-form-label">
                        Weekday
                      </label>

                      <select
                        value={dayOfWeek}
                        onChange={(e) =>
                          setDayOfWeek(Number(e.target.value))
                        }
                        className="aura-form-select"
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
                    <div className="aura-form-field">
                      <label className="aura-form-label">
                        Specific date
                      </label>

                      <input
                        type="date"
                        required
                        value={singleDate}
                        onChange={(e) => setSingleDate(e.target.value)}
                        className="aura-form-input mono"
                      />
                    </div>
                  )}

                  <div className="aura-form-field">
                    <label className="aura-form-label">
                      Category
                    </label>

                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="aura-form-select"
                    >
                      <option value="course">学生课程</option>
                      <option value="work">工作日程</option>
                      <option value="life">生活日常</option>
                    </select>
                  </div>
                </div>

                <div className="aura-form-grid">
                  <div className="aura-form-field">
                    <label className="aura-form-label">
                      Start time
                    </label>

                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="aura-form-input mono"
                    />
                  </div>

                  <div className="aura-form-field">
                    <label className="aura-form-label">
                      End time
                    </label>

                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="aura-form-input mono"
                    />
                  </div>
                </div>

                {isRepeating && category === 'course' && (
                  <div className="aura-form-field">
                    <label className="aura-form-label">
                      Course weeks
                    </label>

                    <input
                      type="text"
                      value={weeks}
                      onChange={(e) => setWeeks(e.target.value)}
                      placeholder="如 1-16 或 1,3,5"
                      className="aura-form-input mono"
                    />
                  </div>
                )}

                <div className="aura-form-grid">
                  <div className="aura-form-field">
                    <label className="aura-form-label">
                      Location
                    </label>

                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="如：教三101"
                      className="aura-form-input"
                    />
                  </div>

                  <div className="aura-form-field">
                    <label className="aura-form-label">
                      Person
                    </label>

                    <input
                      type="text"
                      value={teacher}
                      onChange={(e) => setTeacher(e.target.value)}
                      placeholder="如：任课老师"
                      className="aura-form-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="aura-primary-button"
                >
                  夹入此时光纸条
                </button>
              </form>
            </details>
          </section>
        </main>

        {errorMsg && (
          <div className="aura-toast error">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="aura-toast">
            {successMsg}
          </div>
        )}

        {deleteConfirmTarget && (
          <div className="aura-modal-backdrop">
            <div className="aura-modal">
              <div className="aura-modal-head">
                <AlertCircle />
                <h4 className="aura-modal-title">
                  {deleteConfirmTarget.type === 'cleanup_expired'
                    ? '撕去所有过期纸条'
                    : '撕下此页日程'}
                </h4>
              </div>

              <p className="aura-modal-text">
                {deleteConfirmTarget.type === 'cleanup_expired'
                  ? `确定要将手帐中所有已过期的 ${deleteConfirmTarget.count} 张单次旧票根统一撕下清理吗？此操作无法撤销。`
                  : `确定要将《${deleteConfirmTarget.title}》这一日程纸条从手帐中撕去吗？附带的角色批注也将一并撕毁。`}
              </p>

              <div className="aura-modal-actions">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="aura-modal-button keep"
                >
                  保留
                </button>

                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="aura-modal-button delete"
                >
                  撕去
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

