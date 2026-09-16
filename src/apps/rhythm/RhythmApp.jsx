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

const rhythmStyles = `
.rhythm-shell {
  --rhythm-bg: #f2f2f4;
  --rhythm-paper: rgba(255,255,255,.78);
  --rhythm-paper-strong: rgba(255,255,255,.94);
  --rhythm-ink: #171719;
  --rhythm-sub: #6f6f75;
  --rhythm-muted: #a8a8ae;
  --rhythm-line: rgba(20,20,24,.1);
  --rhythm-line-soft: rgba(20,20,24,.06);
  --rhythm-dark: #171719;
  --rhythm-accent: #77777e;
  --rhythm-spring: cubic-bezier(.16,1,.3,1);
  --rhythm-elastic: cubic-bezier(.34,1.56,.64,1);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 100vh;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: 26px 20px 112px;
  color: var(--rhythm-ink)!important;
  background:
    radial-gradient(circle at 12% 0%, rgba(255,255,255,.98), transparent 31%),
    radial-gradient(circle at 100% 24%, rgba(215,215,222,.72), transparent 34%),
    linear-gradient(145deg,#f9f9fa 0%,#efeff2 52%,#e5e5e9 100%)!important;
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;
  box-shadow: 0 25px 90px rgba(0,0,0,.08);
}

.rhythm-shell::before,
.rhythm-shell::after {
  content: "";
  position: absolute;
  z-index: -2;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(52px);
  opacity: .58;
  animation: rhythmFloat 13s ease-in-out infinite alternate;
}

.rhythm-shell::before {
  width: 310px;
  height: 310px;
  top: -100px;
  left: -120px;
  background: radial-gradient(circle,rgba(255,255,255,.98),transparent 70%);
}

.rhythm-shell::after {
  width: 270px;
  height: 270px;
  top: 250px;
  right: -145px;
  background: radial-gradient(circle,rgba(207,207,215,.8),transparent 70%);
  animation-delay: -6s;
}

.rhythm-shell *,
.rhythm-shell *::before,
.rhythm-shell *::after {
  box-sizing: border-box;
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

.rhythm-shell > style {
  display: none;
}

.rhythm-shell > header {
  position: relative;
  z-index: 2;
  margin-bottom: 25px!important;
  padding: 0 2px!important;
}

.rhythm-shell > header::after {
  content: "";
  display: block;
  width: 100%;
  height: 1px;
  margin-top: 17px;
  background: linear-gradient(90deg,#151519 0 12%,rgba(20,20,24,.1) 12% 100%);
}

.rhythm-shell > header > div:first-child {
  min-height: 38px;
}

.rhythm-shell > header button {
  border: 0!important;
  border-radius: 50%!important;
  color: var(--rhythm-ink)!important;
  background: rgba(255,255,255,.42)!important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8),0 8px 22px rgba(0,0,0,.05);
  transition: transform .35s var(--rhythm-elastic),background .35s ease,box-shadow .35s ease!important;
}

.rhythm-shell > header button:hover {
  background: rgba(255,255,255,.8)!important;
  box-shadow: 0 11px 25px rgba(0,0,0,.1);
  transform: translateY(-2px) scale(1.04);
}

.rhythm-shell > header button:active {
  transform: scale(.9)!important;
}

.rhythm-shell > header > div:nth-child(2) {
  margin-top: 22px!important;
}

.rhythm-shell > header p,
.rhythm-shell > header h1 {
  color: var(--rhythm-ink)!important;
}

.rhythm-shell > header p:first-child {
  color: var(--rhythm-sub)!important;
  letter-spacing: .27em!important;
  font-size: 9px!important;
}

.rhythm-shell > header h1 {
  font-family: Georgia,"Times New Roman",serif!important;
  font-size: 29px!important;
  font-weight: 500!important;
  letter-spacing: .06em!important;
}

.rhythm-shell > header > div:last-child {
  color: var(--rhythm-sub)!important;
  font-variant-numeric: tabular-nums;
}

.rhythm-shell > header > div:last-child > span:first-child {
  background: var(--rhythm-dark)!important;
  color: #fff!important;
  width: 30px!important;
  height: 2px!important;
  opacity: 1!important;
}

.rhythm-shell > header > div:last-child > span:last-child {
  background: var(--rhythm-line)!important;
  opacity: 1!important;
}

.rhythm-shell > div:not([class*="fixed"]) {
  position: relative;
  z-index: 1;
}

.rhythm-shell > div:nth-of-type(1)[class*="border-dashed"] {
  border: 0!important;
  border-left: 2px solid var(--rhythm-dark)!important;
  border-radius: 0!important;
  padding: 17px 18px!important;
  margin-bottom: 22px!important;
  background: rgba(255,255,255,.38)!important;
  box-shadow: 0 13px 30px rgba(0,0,0,.045);
  animation: rhythmReveal .5s var(--rhythm-spring) both;
}

.rhythm-shell > div:nth-of-type(1)[class*="border-dashed"] input {
  border: 0!important;
  border-bottom: 1px solid var(--rhythm-line)!important;
  border-radius: 0!important;
  background: transparent!important;
}

.rhythm-shell > div:nth-of-type(1)[class*="border-dashed"] button {
  border-radius: 999px!important;
  background: var(--rhythm-dark)!important;
  color: #fff!important;
  transition: transform .3s var(--rhythm-elastic),opacity .25s ease!important;
}

.rhythm-shell > div:nth-of-type(1)[class*="border-dashed"] button:active {
  transform: scale(.94);
}

.rhythm-shell > div[class*="justify-between"][class*="border"][class*="rounded-sm"] {
  min-height: 58px;
  margin-bottom: 20px!important;
  padding: 8px 5px!important;
  border: 0!important;
  border-bottom: 1px solid var(--rhythm-line)!important;
  border-radius: 0!important;
  background: rgba(255,255,255,.22)!important;
}

.rhythm-shell > div[class*="justify-between"][class*="border"][class*="rounded-sm"] button {
  border: 0!important;
  color: var(--rhythm-ink)!important;
  transition: transform .3s var(--rhythm-elastic),opacity .25s ease!important;
}

.rhythm-shell > div[class*="justify-between"][class*="border"][class*="rounded-sm"] button:hover {
  transform: scale(1.16);
}

.rhythm-shell > div[class*="justify-between"][class*="border"][class*="rounded-sm"] span {
  color: var(--rhythm-ink)!important;
}

.rhythm-shell > div[class*="justify-between"][class*="border"][class*="rounded-sm"] span[style*="background"] {
  border-radius: 999px!important;
  padding: 3px 8px!important;
  background: var(--rhythm-dark)!important;
  color: #fff!important;
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] {
  position: relative;
  gap: 2px;
  margin-bottom: 27px!important;
  padding-bottom: 11px!important;
  border-color: var(--rhythm-line)!important;
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] button {
  position: relative;
  min-height: 47px;
  border: 0!important;
  color: var(--rhythm-sub)!important;
  opacity: .65!important;
  transition: color .35s ease,opacity .35s ease,transform .35s var(--rhythm-spring)!important;
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] button:hover {
  opacity: 1!important;
  transform: translateY(-3px);
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] button[style*="opacity: 1"] {
  color: var(--rhythm-ink)!important;
  opacity: 1!important;
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] button span:first-child {
  font-family: Georgia,"Times New Roman",serif!important;
  font-size: 13px!important;
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] button span:nth-child(2) {
  color: var(--rhythm-muted)!important;
}

.rhythm-shell > div[class*="items-end"][class*="border-b"] button > span.absolute {
  bottom: -12px!important;
  width: 30px!important;
  height: 3px!important;
  border-radius: 99px!important;
  background: var(--rhythm-dark)!important;
  box-shadow: 0 3px 10px rgba(0,0,0,.22);
}

.rhythm-shell > div[class*="space-y-3.5"] {
  margin-bottom: 42px!important;
}

.rhythm-shell > div[class*="space-y-3.5"] > div:first-child {
  margin-bottom: 15px;
  padding: 0 2px;
  color: var(--rhythm-sub)!important;
}

.rhythm-shell > div[class*="space-y-3.5"] > div:first-child svg {
  color: var(--rhythm-ink);
}

.rhythm-shell > div[class*="space-y-3.5"] > div:first-child span:last-child {
  color: var(--rhythm-muted)!important;
}

.rhythm-shell > div[class*="space-y-3"] > div {
  animation: rhythmReveal .55s var(--rhythm-spring) both;
}

.rhythm-shell > div[class*="space-y-3"] > div:nth-child(2) { animation-delay: .04s; }
.rhythm-shell > div[class*="space-y-3"] > div:nth-child(3) { animation-delay: .08s; }
.rhythm-shell > div[class*="space-y-3"] > div:nth-child(4) { animation-delay: .12s; }

.rhythm-ticket {
  position: relative;
  overflow: hidden;
  border: 0!important;
  border-radius: 25px!important;
  background: rgba(255,255,255,.7)!important;
  box-shadow: 0 12px 30px rgba(0,0,0,.055),inset 0 1px 0 rgba(255,255,255,.9);
  transition: transform .45s var(--rhythm-spring),box-shadow .45s ease,background .45s ease,opacity .4s ease!important;
}

.rhythm-ticket:hover {
  transform: translateY(-4px) scale(1.008);
  background: rgba(255,255,255,.93)!important;
  box-shadow: 0 20px 38px rgba(0,0,0,.1),inset 0 1px 0 rgba(255,255,255,1);
}

.rhythm-ticket > div:first-of-type {
  min-height: 106px;
}

.rhythm-ticket > div:first-of-type > div:first-child {
  position: relative;
  width: 88px!important;
  border: 0!important;
  border-right: 1px dashed rgba(20,20,24,.16)!important;
  background: linear-gradient(135deg,rgba(255,255,255,.7),rgba(230,230,235,.4))!important;
}

.rhythm-ticket > div:first-of-type > div:first-child::before,
.rhythm-ticket > div:first-of-type > div:first-child::after {
  content: "";
  position: absolute;
  right: -5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--rhythm-bg);
}

.rhythm-ticket > div:first-of-type > div:first-child::before {
  top: -5px;
}

.rhythm-ticket > div:first-of-type > div:first-child::after {
  bottom: -5px;
}

.rhythm-ticket > div:first-of-type > div:first-child span:first-child {
  font-size: 17px!important;
  letter-spacing: -.04em;
}

.rhythm-ticket > div:first-of-type > div:first-child span:last-child {
  color: var(--rhythm-muted)!important;
}

.rhythm-ticket h3 {
  overflow: visible!important;
  color: var(--rhythm-ink)!important;
  font-family: Georgia,"Times New Roman",serif!important;
  font-size: 15px!important;
  font-weight: 600!important;
  letter-spacing: .01em;
}

.rhythm-ticket h3 + span {
  border: 0!important;
  border-radius: 999px!important;
  padding: 4px 8px!important;
  background: rgba(20,20,24,.065)!important;
  color: var(--rhythm-sub)!important;
}

.rhythm-ticket svg {
  color: var(--rhythm-sub);
}

.rhythm-ticket > div:first-of-type > div:nth-child(2) > div:last-child {
  border-color: var(--rhythm-line)!important;
}

.rhythm-ticket > div:first-of-type > div:nth-child(2) button {
  transition: color .3s ease,transform .35s var(--rhythm-elastic)!important;
}

.rhythm-ticket > div:first-of-type > div:nth-child(2) button:hover {
  color: #9a4c4c!important;
  transform: translateX(3px);
}

.rhythm-ticket > div:last-child {
  min-height: 42px;
  border-color: var(--rhythm-line)!important;
  background: rgba(244,244,247,.55)!important;
}

.rhythm-ticket > div:last-child p {
  color: var(--rhythm-ink)!important;
  font-size: 12px!important;
}

.rhythm-ticket > div:last-child span {
  background: rgba(20,20,24,.08)!important;
  color: var(--rhythm-sub)!important;
}

.rhythm-ticket > div:last-child button {
  color: var(--rhythm-sub)!important;
  transition: opacity .3s ease,transform .35s var(--rhythm-elastic)!important;
}

.rhythm-ticket > div:last-child button:hover {
  transform: scale(1.08);
}

.rhythm-empty {
  min-height: 146px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0!important;
  border-top: 1px dashed var(--rhythm-line)!important;
  border-bottom: 1px dashed var(--rhythm-line)!important;
  border-radius: 0!important;
  background: transparent!important;
  color: var(--rhythm-muted)!important;
}

.rhythm-shell > div[class*="border-t"][class*="pt-5"] {
  border-color: var(--rhythm-line)!important;
  padding-top: 26px!important;
}

.rhythm-shell > div[class*="border-t"][class*="pt-5"] > div:first-child,
.rhythm-shell > div[class*="border-t"][class*="pt-5"] details {
  border: 0!important;
  border-radius: 25px!important;
  background: rgba(255,255,255,.48)!important;
  box-shadow: 0 11px 30px rgba(0,0,0,.04);
  transition: background .35s ease,transform .35s var(--rhythm-spring),box-shadow .35s ease!important;
}

.rhythm-shell > div[class*="border-t"][class*="pt-5"] > div:first-child:hover,
.rhythm-shell > div[class*="border-t"][class*="pt-5"] details:hover {
  background: rgba(255,255,255,.8)!important;
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(0,0,0,.075);
}

.rhythm-shell > div[class*="border-t"][class*="pt-5"] details summary {
  min-height: 58px;
  padding: 18px 20px!important;
  color: var(--rhythm-ink);
}

.rhythm-shell > div[class*="border-t"][class*="pt-5"] details form {
  border-color: var(--rhythm-line)!important;
  padding: 20px!important;
}

.rhythm-shell textarea,
.rhythm-shell input,
.rhythm-shell select {
  border: 0!important;
  border-bottom: 1px solid var(--rhythm-line)!important;
  border-radius: 0!important;
  outline: 0!important;
  background: rgba(255,255,255,.42)!important;
  color: var(--rhythm-ink)!important;
  transition: border-color .3s ease,background .3s ease,box-shadow .3s ease!important;
}

.rhythm-shell textarea {
  min-height: 78px;
  border: 1px solid var(--rhythm-line)!important;
  border-radius: 16px!important;
  padding: 13px!important;
}

.rhythm-shell textarea:focus,
.rhythm-shell input:focus,
.rhythm-shell select:focus {
  border-color: var(--rhythm-ink)!important;
  background: rgba(255,255,255,.85)!important;
  box-shadow: 0 5px 18px rgba(0,0,0,.06)!important;
}

.rhythm-shell label {
  color: var(--rhythm-sub)!important;
}

.rhythm-shell form button,
.rhythm-shell > div[class*="border-t"][class*="pt-5"] > div:first-child button {
  border: 0!important;
  border-radius: 999px!important;
  background: var(--rhythm-dark)!important;
  color: #fff!important;
  transition: transform .35s var(--rhythm-elastic),opacity .25s ease,box-shadow .3s ease!important;
}

.rhythm-shell form button:hover,
.rhythm-shell > div[class*="border-t"][class*="pt-5"] > div:first-child button:hover {
  box-shadow: 0 9px 20px rgba(0,0,0,.18);
  transform: translateY(-2px);
}

.rhythm-shell form button:active {
  transform: scale(.96)!important;
}

.rhythm-shell [class*="fixed bottom-20"] {
  border: 0!important;
  border-radius: 999px!important;
  padding: 12px 20px!important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 15px 35px rgba(0,0,0,.16);
  animation: rhythmToast .4s var(--rhythm-spring) both;
}

.rhythm-shell [class*="fixed inset-0"] {
  background: rgba(15,15,18,.38)!important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: rhythmFade .3s ease both;
}

.rhythm-shell [class*="fixed inset-0"] > div {
  border: 0!important;
  border-radius: 29px!important;
  padding: 24px!important;
  background: rgba(250,250,252,.9)!important;
  box-shadow: 0 28px 70px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.9);
  animation: rhythmModal .55s var(--rhythm-spring) both;
}

.rhythm-shell [class*="fixed inset-0"] > div > div:last-child {
  border-color: var(--rhythm-line)!important;
}

.rhythm-shell [class*="fixed inset-0"] > div button:first-child {
  border: 1px solid var(--rhythm-line)!important;
  background: rgba(255,255,255,.5)!important;
  color: var(--rhythm-sub)!important;
}

.rhythm-shell [class*="fixed inset-0"] > div button:last-child {
  border-radius: 999px!important;
  background: #8b5151!important;
  transition: transform .3s var(--rhythm-elastic),box-shadow .3s ease!important;
}

.rhythm-shell [class*="fixed inset-0"] > div button:last-child:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(139,81,81,.28);
}

@keyframes rhythmFloat {
  from { transform: translate3d(-5px,0,0) scale(1); }
  to { transform: translate3d(18px,26px,0) scale(1.08); }
}

@keyframes rhythmReveal {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes rhythmToast {
  from { opacity: 0; transform: translate(-50%,12px) scale(.94); }
  to { opacity: 1; transform: translate(-50%,0) scale(1); }
}

@keyframes rhythmFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes rhythmModal {
  from { opacity: 0; transform: translateY(20px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 520px) {
  .rhythm-shell {
    min-height: 100svh;
    padding-right: 17px;
    padding-left: 17px;
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rhythm-shell *,
  .rhythm-shell *::before,
  .rhythm-shell *::after {
    animation-duration: .01ms!important;
    animation-iteration-count: 1!important;
    scroll-behavior: auto!important;
    transition-duration: .01ms!important;
  }
}
`;

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

    for (let i = 0; i < 7; i += 1) {
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
          category: ['course', 'work', 'life'].includes(item.category) ? item.category : 'life',
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
          for (let i = start; i <= end; i += 1) {
            parsedWeeks.push(i);
          }
        }
      } else {
        parsedWeeks = weeks.split(',').map(Number).filter((n) => !isNaN(n));
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
      ).replace(/["'“”]/g, '').trim();

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
      <style>{rhythmStyles}</style>

      <header className="relative mb-5 px-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHub}
            aria-label="返回主页"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
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
            >
              <Settings className="h-[17px] w-[17px]" strokeWidth={1.7} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em]">
              Rhythm & Ephemera
            </p>

            <h1 className="font-serif text-[26px] font-semibold leading-none tracking-[0.06em]">
              时光作息
            </h1>
          </div>

          <p className="font-mono text-[11px] tracking-wider">
            {activeDayInfo.shortDate} · {activeDayInfo.label}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="h-px w-8" />
          <span className="h-px flex-1 opacity-40" />
        </div>
      </header>

      {showConfig && (
        <div className="mb-5 space-y-2.5 border border-dashed p-3.5 text-xs rounded-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="font-serif font-semibold">开学首周周一锚点</span>

            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] leading-relaxed">
            设定学期第 1 周的周一日期，系统将严密推算任意周次的日程安排，杜绝跨周穿帮。
          </p>

          <div className="flex gap-2 pt-1">
            <input
              type="date"
              value={termStartDate}
              onChange={(e) => setTermStartDate(e.target.value)}
              className="flex-1 border px-2 py-1 font-mono text-xs rounded"
            />

            <button
              type="button"
              onClick={handleSaveTermStart}
              className="px-3 py-1 font-serif text-xs font-medium rounded transition-opacity hover:opacity-85"
            >
              保存锚点
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between px-2 py-1.5 border rounded-sm">
        <button
          type="button"
          onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
          disabled={selectedWeek <= 1}
          className="flex h-7 w-7 items-center justify-center rounded transition-all active:scale-90 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-xs font-semibold tracking-wider">
              第 {selectedWeek} 周
            </span>

            {selectedWeek === realCurrentWeek ? (
              <span className="px-1.5 py-0.2 font-mono text-[9px] rounded">
                本周
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedWeek(realCurrentWeek)}
                className="flex items-center gap-0.5 font-mono text-[9px] opacity-70 hover:opacity-100 underline underline-offset-2"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                回到本周
              </button>
            )}
          </div>

          <span className="font-mono text-[9px] opacity-60">
            {weekDaysInfo[0].shortDate} — {weekDaysInfo[6].shortDate}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedWeek((w) => w + 1)}
          className="flex h-7 w-7 items-center justify-center rounded transition-all active:scale-90"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-5 flex items-end justify-between border-b pb-1.5">
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

              {item.isToday && <span className="mt-0.5 h-1 w-1 rounded-full" />}

              {isActive && (
                <span className="absolute bottom-[-2px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-3.5 mb-8">
        <div className="flex items-center justify-between text-xs px-0.5">
          <span className="flex items-center gap-1.5 font-serif font-medium tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            {activeDayInfo.dateStr} 安排票根
          </span>

          <span className="font-mono text-[10px]">
            共 {currentFilteredSchedules.length} 张
          </span>
        </div>

        {currentFilteredSchedules.length === 0 ? (
          <div className="rhythm-empty py-12 text-center text-xs font-serif italic border border-dashed rounded-sm">
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
                  className={`rhythm-ticket relative flex flex-col overflow-hidden ${
                    isExpired ? 'opacity-55' : ''
                  }`}
                >
                  {isExpired && (
                    <div className="absolute right-3 top-2 rotate-[-8deg] border border-dashed px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest pointer-events-none select-none">
                      EXPIRED / 已过期
                    </div>
                  )}

                  <div className="flex items-stretch">
                    <div className="w-[85px] shrink-0 p-2.5 flex flex-col justify-center items-center text-center select-none border-r border-dashed">
                      <span className="font-mono text-xs font-bold tracking-tight">
                        {item.startTime}
                      </span>

                      <span className="my-0.5 h-2 w-px opacity-30" />

                      <span className="font-mono text-[10px] opacity-60">
                        {item.endTime}
                      </span>
                    </div>

                    <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h3 className="font-serif text-[13px] font-semibold truncate">
                            {item.title}
                          </h3>

                          <span className="font-serif text-[9px] px-1 py-0.2 rounded border shrink-0 opacity-70">
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

                  <div className="border-t border-dashed px-3 py-2 text-left">
                    {currentNote ? (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <span className="font-serif text-[9px] px-1 py-0.2 rounded shrink-0">
                            {character?.name || '角色'} 手迹
                          </span>

                          <p className="font-serif text-[11px] italic leading-relaxed break-words">
                            “{currentNote.content}”
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleGenerateCharacterNote(item, activeDayInfo.dateStr)
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
                        <span className="font-serif text-[10px] italic opacity-50">
                          空白边角尚未留下手写便签
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleGenerateCharacterNote(item, activeDayInfo.dateStr)
                          }
                          disabled={isNoteLoading || !character}
                          className="flex items-center gap-1 font-serif text-[10px] underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Sparkles
                            className={`w-2.5 h-2.5 ${
                              isNoteLoading ? 'animate-spin' : ''
                            }`}
                          />
                          <span>{isNoteLoading ? '题写中...' : '让角色留一笔'}</span>
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
        className="border-t border-dashed pt-5 space-y-4"
      >
        <div className="border rounded-sm p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-serif text-xs font-semibold">
              使用外部 AI 助手批量导入
            </span>

            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 font-serif text-xs opacity-75 hover:opacity-100"
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}

              <span>{isCopied ? '提示词已复制' : '复制解析提示词'}</span>
            </button>
          </div>

          <p className="text-[10px] leading-relaxed">
            将提示词发送给任意大模型，并附带你的原版课表或日程文本。将生成出的纯 JSON 贴在下方导入：
          </p>

          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="粘贴 AI 吐出的纯 JSON 文本..."
            rows={2}
            className="w-full p-2 text-xs font-mono border rounded resize-none focus:outline-none"
          />

          <button
            type="button"
            onClick={handleImportJson}
            disabled={!pasteData.trim()}
            className="w-full py-1.5 font-serif text-xs font-medium rounded transition-opacity disabled:opacity-40"
          >
            解析并夹入日程票根
          </button>
        </div>

        <details className="group border rounded-sm">
          <summary className="flex items-center justify-between p-3 font-serif text-xs font-semibold cursor-pointer select-none">
            <span>手动夹入手写日程纸条</span>
            <Plus className="w-3.5 h-3.5 transition-transform group-open:rotate-45" />
          </summary>

          <form
            onSubmit={handleAddSingle}
            className="p-3.5 pt-0 space-y-3 text-xs border-t border-dashed"
          >
            <div className="space-y-1 pt-2">
              <label className="block text-[10px] font-serif">
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
              <label className="block text-[10px] font-serif mb-1">
                日程 / 课程名称
              </label>

              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="如：高等数学 / 通勤地铁 / 组会"
                className="w-full p-1.5 border rounded font-serif text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {isRepeating ? (
                <div>
                  <label className="block text-[10px] font-serif mb-1">
                    星期几
                  </label>

                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full p-1.5 border rounded font-serif text-xs"
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
                  <label className="block text-[10px] font-serif mb-1">
                    具体日期
                  </label>

                  <input
                    type="date"
                    required
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full p-1.5 border rounded font-mono text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-serif mb-1">
                  类型
                </label>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-1.5 border rounded font-serif text-xs"
                >
                  <option value="course">学生课程</option>
                  <option value="work">工作日程</option>
                  <option value="life">生活日常</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-serif mb-1">
                  开始时间
                </label>

                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-1.5 border rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-serif mb-1">
                  结束时间
                </label>

                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-1.5 border rounded font-mono text-xs"
                />
              </div>
            </div>

            {isRepeating && category === 'course' && (
              <div>
                <label className="block text-[10px] font-serif mb-1">
                  上课周次区间 (如 1-16 或 1,3,5)
                </label>

                <input
                  type="text"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  className="w-full p-1.5 border rounded font-mono text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-serif mb-1">
                  地点 (选填)
                </label>

                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：教三101"
                  className="w-full p-1.5 border rounded font-serif text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-serif mb-1">
                  人物/老师 (选填)
                </label>

                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="如：任课老师"
                  className="w-full p-1.5 border rounded font-serif text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 font-serif text-xs font-medium rounded transition-opacity"
            >
              夹入此时光纸条
            </button>
          </form>
        </details>
      </div>

      {errorMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-xs font-serif border border-red-300 bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-xs font-serif border border-green-300 bg-green-50 text-green-700">
          {successMsg}
        </div>
      )}

      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[320px] rounded border p-4 space-y-3 text-left shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />

              <h4 className="font-serif text-sm font-semibold">
                {deleteConfirmTarget.type === 'cleanup_expired'
                  ? '撕去所有过期纸条'
                  : '撕下此页日程'}
              </h4>
            </div>

            <p className="font-serif text-xs leading-relaxed">
              {deleteConfirmTarget.type === 'cleanup_expired'
                ? `确定要将手帐中所有已过期的 ${deleteConfirmTarget.count} 张单次旧票根统一撕下清理吗？此操作无法撤销。`
                : `确定要将《${deleteConfirmTarget.title}》这一日程纸条从手帐中撕去吗？附带的角色批注也将一并撕毁。`}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-dashed">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-3 py-1 font-serif text-xs rounded border transition-opacity hover:opacity-80"
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
