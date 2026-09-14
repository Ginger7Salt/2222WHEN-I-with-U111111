import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  Calendar,
  Settings,
  X,
  ExternalLink
} from 'lucide-react';

import db from '../../db';

const styles = `
.rhythm-app {
  --rhythm-bg: #f4f4f5;
  --rhythm-app-bg: #fff;
  --rhythm-main: #111;
  --rhythm-sub: #71717a;
  --rhythm-border: #e4e4e7;
  --rhythm-dark-border: #27272a;
  --rhythm-soft: #fafafa;
  --rhythm-muted: #a1a1aa;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
  background: var(--rhythm-bg);
  color: var(--rhythm-main);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.rhythm-app *,
.rhythm-app *::before,
.rhythm-app *::after {
  box-sizing: border-box;
}

.rhythm-shell {
  width: 100%;
  max-width: 420px;
  min-height: calc(100vh - 40px);
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  background: var(--rhythm-app-bg);
  border: 1px solid var(--rhythm-border);
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(0,0,0,.08);
}

.rhythm-window-header {
  height: 48px;
  display: flex;
  align-items: center;
  position: relative;
  padding: 12px 20px;
  border-bottom: 1px solid var(--rhythm-border);
}

.rhythm-window-dots {
  display: flex;
  gap: 6px;
}

.rhythm-window-dots span {
  width: 12px;
  height: 12px;
  display: block;
  border: 1px solid var(--rhythm-border);
  border-radius: 50%;
  background: #fff;
}

.rhythm-window-dots span:first-child {
  border-color: var(--rhythm-dark-border);
  background: var(--rhythm-dark-border);
}

.rhythm-window-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  color: var(--rhythm-sub);
  font-size: 14px;
  letter-spacing: .5px;
  white-space: nowrap;
}


.rhythm-profile {
  display: flex;
  gap: 15px;
  padding: 20px;
  border-bottom: 1px solid var(--rhythm-border);
}

.rhythm-avatar {
  width: 88px;
  height: 88px;
  flex: 0 0 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  color: var(--rhythm-main);
  border: 1px solid var(--rhythm-dark-border);
  border-radius: 16px;
  background:
    radial-gradient(circle at center, #eee 0 39%, transparent 40%),
    linear-gradient(45deg, transparent 40%, #ddd 41%, #ddd 60%, transparent 61%),
    #fafafa;
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
}

.rhythm-avatar::after {
  content: "01";
  position: absolute;
  right: 7px;
  bottom: 5px;
  color: var(--rhythm-sub);
  font-size: 9px;
  letter-spacing: 1px;
}

.rhythm-profile-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rhythm-banner {
  height: 32px;
  border: 1px solid var(--rhythm-border);
  border-radius: 8px;
  background: repeating-linear-gradient(
    -45deg,
    #f0f0f0,
    #f0f0f0 10px,
    #fff 10px,
    #fff 20px
  );
}

.rhythm-field label {
  display: block;
  margin-bottom: 2px;
  color: var(--rhythm-sub);
  font-size: 10px;
  line-height: 1.2;
}

.rhythm-field-value {
  width: 100%;
  min-height: 25px;
  overflow: hidden;
  padding: 5px 9px;
  color: var(--rhythm-main);
  border: 1px solid var(--rhythm-border);
  border-radius: 8px;
  background: var(--rhythm-soft);
  font-size: 12px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rhythm-info-row {
  display: flex;
  gap: 8px;
}

.rhythm-tabs {
  display: flex;
  align-items: flex-end;
  padding: 0 10px;
  border-bottom: 1px solid var(--rhythm-border);
  background: var(--rhythm-soft);
}

.rhythm-tab {
  min-height: 42px;
  padding: 12px 13px 11px;
  color: var(--rhythm-sub);
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.rhythm-tab:hover {
  color: var(--rhythm-main);
}

.rhythm-tab.active {
  z-index: 1;
  color: var(--rhythm-main);
  border-color: var(--rhythm-border);
  margin-bottom: -1px;
  background: #fff;
  font-weight: 600;
}

.rhythm-tab.external {
  margin-left: auto;
  padding-right: 10px;
  padding-left: 10px;
  font-size: 16px;
}

.rhythm-content {
  padding: 20px;
  background: #fff;
}

.rhythm-config {
  position: relative;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px dashed var(--rhythm-dark-border);
  background: var(--rhythm-soft);
}

.rhythm-config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
}

.rhythm-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--rhythm-main);
  border: 0;
  background: transparent;
  cursor: pointer;
}

.rhythm-config p {
  margin: 0 0 12px;
  color: var(--rhythm-sub);
  font-size: 10px;
  line-height: 1.6;
}

.rhythm-config-row {
  display: flex;
  gap: 8px;
}

.rhythm-app input,
.rhythm-app select,
.rhythm-app textarea {
  font-family: inherit;
}

.rhythm-config input,
.rhythm-form input,
.rhythm-form select,
.rhythm-import textarea {
  min-width: 0;
  color: var(--rhythm-main);
  border: 1px solid var(--rhythm-border);
  border-radius: 8px;
  outline: none;
  background: #fff;
}

.rhythm-config input:focus,
.rhythm-form input:focus,
.rhythm-form select:focus,
.rhythm-import textarea:focus {
  border-color: var(--rhythm-dark-border);
}

.rhythm-config input {
  flex: 1;
  padding: 7px 9px;
  font-size: 12px;
}

.rhythm-primary-button {
  padding: 7px 13px;
  color: #fff;
  border: 1px solid var(--rhythm-dark-border);
  border-radius: 8px;
  background: var(--rhythm-dark-border);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.rhythm-primary-button:hover {
  opacity: .8;
}

.rhythm-week-badge {
  margin: 0 0 14px;
  color: var(--rhythm-sub);
  font-family: "Courier New", Courier, monospace;
  font-size: 10px;
  letter-spacing: 1.3px;
  text-align: center;
}

.rhythm-week-badge span {
  display: inline-block;
  padding: 5px 10px;
  border: 1px solid var(--rhythm-border);
  border-radius: 999px;
  background: var(--rhythm-soft);
}

.rhythm-day-tabs {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  margin-bottom: 22px;
  padding: 0 0 7px;
  border-bottom: 1px solid var(--rhythm-border);
}

.rhythm-day-tab {
  flex: 1;
  position: relative;
  padding: 5px 1px 6px;
  color: var(--rhythm-sub);
  border: 0;
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}

.rhythm-day-tab.active {
  color: var(--rhythm-main);
  font-weight: 700;
}

.rhythm-day-tab.active::after {
  content: "";
  width: 5px;
  height: 5px;
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--rhythm-dark-border);
}

.rhythm-section-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 14px;
  color: var(--rhythm-sub);
  font-family: "Courier New", Courier, monospace;
  font-size: 12px;
  letter-spacing: .4px;
}

.rhythm-empty {
  padding: 34px 12px;
  color: var(--rhythm-sub);
  border: 1px dashed var(--rhythm-border);
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
  font-style: italic;
  text-align: center;
}

.rhythm-schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rhythm-schedule {
  display: flex;
  min-width: 0;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--rhythm-border);
  border-radius: 14px;
  background: #fff;
  transition: border-color .2s ease, transform .2s ease;
}

.rhythm-schedule:hover {
  border-color: var(--rhythm-dark-border);
  transform: translateY(-1px);
}

.rhythm-time {
  width: 82px;
  flex: 0 0 82px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  border-right: 1px dashed var(--rhythm-border);
  background: var(--rhythm-soft);
  text-align: center;
}

.rhythm-time strong {
  font-family: "Courier New", Courier, monospace;
  font-size: 13px;
}

.rhythm-time i {
  width: 1px;
  height: 8px;
  display: block;
  margin: 4px 0;
  background: var(--rhythm-border);
}

.rhythm-time small {
  color: var(--rhythm-sub);
  font-family: "Courier New", Courier, monospace;
  font-size: 10px;
}

.rhythm-schedule-body {
  min-width: 0;
  flex: 1;
  padding: 12px 13px;
}

.rhythm-schedule-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.rhythm-schedule-title {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  padding-right: 8px;
  color: var(--rhythm-main);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rhythm-category {
  flex: 0 0 auto;
  color: var(--rhythm-sub);
  font-family: "Courier New", Courier, monospace;
  font-size: 9px;
  letter-spacing: .5px;
  text-transform: uppercase;
}

.rhythm-meta {
  min-height: 20px;
  color: var(--rhythm-sub);
  font-family: "Courier New", Courier, monospace;
  font-size: 10px;
  line-height: 1.65;
}

.rhythm-cycle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 9px;
  padding-top: 7px;
  color: var(--rhythm-sub);
  border-top: 1px solid var(--rhythm-border);
  font-family: "Courier New", Courier, monospace;
  font-size: 9px;
}

.rhythm-delete {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: inline-flex;
  padding: 4px;
  color: var(--rhythm-sub);
  border: 0;
  background: transparent;
  cursor: pointer;
  opacity: 0;
  transition: opacity .2s ease, color .2s ease;
}

.rhythm-schedule:hover .rhythm-delete,
.rhythm-delete:focus {
  opacity: 1;
}

.rhythm-delete:hover {
  color: #dc2626;
}

.rhythm-memo {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--rhythm-dark-border);
}

.rhythm-memo-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 12px;
  color: var(--rhythm-main);
  font-family: "Courier New", Courier, monospace;
  font-size: 16px;
  font-weight: 700;
}

.rhythm-memo-title::after {
  content: "";
  height: 1px;
  flex: 1;
  background: var(--rhythm-border);
}

.rhythm-memo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 10px;
  color: var(--rhythm-main);
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
  line-height: 1.45;
}

.rhythm-memo-item:nth-child(odd) {
  background: var(--rhythm-soft);
}

.rhythm-memo-item input {
  appearance: none;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  margin: 1px 0 0;
  border: 1px solid var(--rhythm-dark-border);
  border-radius: 2px;
  background: #fff;
  cursor: pointer;
}

.rhythm-memo-item input:checked {
  background:
    linear-gradient(135deg, transparent 42%, #fff 42% 52%, transparent 52%),
    var(--rhythm-dark-border);
}

.rhythm-divider {
  height: 1px;
  margin: 26px 0 20px;
  border-top: 1px dashed var(--rhythm-border);
}

.rhythm-import {
  padding: 15px;
  border: 1px solid var(--rhythm-border);
  border-radius: 14px;
  background: var(--rhythm-soft);
}

.rhythm-import-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.rhythm-import-title {
  color: var(--rhythm-main);
  font-size: 12px;
  font-weight: 700;
}

.rhythm-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: var(--rhythm-sub);
  border: 0;
  background: transparent;
  font-size: 10px;
  cursor: pointer;
}

.rhythm-copy:hover {
  color: var(--rhythm-main);
}

.rhythm-import-description {
  margin: 0 0 11px;
  color: var(--rhythm-sub);
  font-size: 10px;
  line-height: 1.65;
}

.rhythm-import textarea {
  width: 100%;
  height: 78px;
  display: block;
  resize: vertical;
  padding: 9px;
  margin-bottom: 10px;
  font-family: "Courier New", Courier, monospace;
  font-size: 10px;
}

.rhythm-import-submit {
  width: 100%;
  padding: 9px;
  color: #fff;
  border: 0;
  border-radius: 8px;
  background: var(--rhythm-dark-border);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.rhythm-import-submit:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.rhythm-manual {
  margin-top: 14px;
  border: 1px solid var(--rhythm-border);
  border-radius: 14px;
  background: #fff;
}

.rhythm-manual summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px;
  color: var(--rhythm-main);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.rhythm-manual summary::-webkit-details-marker {
  display: none;
}

.rhythm-manual[open] summary {
  border-bottom: 1px solid var(--rhythm-border);
}

.rhythm-manual summary svg {
  transition: transform .2s ease;
}

.rhythm-manual[open] summary svg {
  transform: rotate(45deg);
}

.rhythm-form {
  padding: 14px;
}

.rhythm-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rhythm-form-field {
  min-width: 0;
}

.rhythm-form-field.full {
  grid-column: 1 / -1;
}

.rhythm-form-field label {
  display: block;
  margin-bottom: 5px;
  color: var(--rhythm-sub);
  font-size: 10px;
  font-weight: 700;
}

.rhythm-form input,
.rhythm-form select {
  width: 100%;
  padding: 8px 9px;
  font-size: 11px;
}

.rhythm-mode {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.rhythm-mode label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: var(--rhythm-main);
  font-size: 10px;
  font-weight: 400;
  cursor: pointer;
}

.rhythm-form-submit {
  width: 100%;
  margin-top: 14px;
  padding: 10px;
  color: #fff;
  border: 0;
  border-radius: 8px;
  background: var(--rhythm-dark-border);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.rhythm-message {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 1.5;
}

.rhythm-message.error {
  color: #991b1b;
  border: 1px solid #fecaca;
  background: #fef2f2;
}

.rhythm-message.success {
  color: #166534;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
}

.rhythm-fab {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 3;
  color: var(--rhythm-main);
  border: 2px solid var(--rhythm-dark-border);
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 4px 10px rgba(0,0,0,.1);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: .2s ease;
}

.rhythm-fab:hover {
  color: #fff;
  background: var(--rhythm-dark-border);
}

@media (max-width: 480px) {
  .rhythm-app {
    padding: 0;
  }

  .rhythm-shell {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
    .rhythm-header-button {
  width: 25px;
  height: 25px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  padding: 0;
  color: var(--rhythm-main);
  border: 1px solid var(--rhythm-border);
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  transition: .2s ease;
}

.rhythm-header-button:hover {
  color: #fff;
  border-color: var(--rhythm-dark-border);
  background: var(--rhythm-dark-border);
}

.rhythm-back-button {
  margin-right: 10px;
}

.rhythm-settings-button {
  margin-left: auto;
}

}
`;

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [schedules, setSchedules] = useState([]);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7);
  const [activePromptTab, setActivePromptTab] = useState('student');

  const [termStartDate, setTermStartDate] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);

  const [isRepeating, setIsRepeating] = useState(true);
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);

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

  const weekDays = [
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
    { label: '周日', value: 7 }
  ];

  const calculateCurrentWeek = (startDateStr) => {
    if (!startDateStr) return 1;

    try {
      const now = new Date();
      const start = new Date(startDateStr);

      start.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);

      const diffTime = now - start;

      if (diffTime < 0) return 1;

      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const week = Math.floor(diffDays / 7) + 1;

      return week <= 25 ? week : 1;
    } catch {
      return 1;
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      const saved = await db.settings.get('term_start_date');

      if (saved?.value) {
        setTermStartDate(saved.value);
        setCurrentWeek(calculateCurrentWeek(saved.value));
      }
    };

    loadConfig();
  }, []);

  const handleSaveTermStart = async () => {
    if (!termStartDate) return;

    await db.settings.put({
      key: 'term_start_date',
      value: termStartDate
    });

    setCurrentWeek(calculateCurrentWeek(termStartDate));
    setShowConfig(false);
    setSuccessMsg('学期开学日期设定已更新。');

    setTimeout(() => setSuccessMsg(''), 3000);
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
  - "isRepeating": 布尔值。如果是每周重复的日程/课表填 true；如果是某一天发生的单次事件填 false
  - "date": 字符串，格式 "YYYY-MM-DD"。如果是单次事件(isRepeating为false)填具体日期；如果是每周重复事件，填空字串 ""
  - "dayOfWeek": 星期几，数字 1-7。如果 isRepeating 为 true，根据星期几填写（1代表周一，7代表周日）；若 isRepeating 为 false 填 0
  - "weeks": 数组格式，表示课表进行的周次。
    * 如果是课程(category为"course")，按照实际周次填写（如 1 到 16 周写 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]）
    * 如果是非课程的日程，默认为空数组 []
  - "location": 教室或会议室地点（字符串，没有填 ""）
  - "teacher": 授课老师或对接人（字符串，没有填 ""）

我的日程文本如下：
------------------------
[在此替换粘贴你的日程文本，例如：
周一早八教三101高数，周四下午两点综合楼302大学英语。
或者：
周一至周五 09:00-10:00 地铁通勤。8月30日上午10点在2楼会议室召开项目启动会。
]
------------------------`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(getPromptText());
    setIsCopied(true);

    setTimeout(() => setIsCopied(false), 2000);
  };

  const loadSchedules = async () => {
    try {
      const data = await db.schedules
        .where('characterId')
        .equals(currentCharacterId || 0)
        .toArray();

      data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setSchedules(data);
    } catch (err) {
      console.error('读取作息数据失败:', err);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [currentCharacterId]);

  const handleImportJson = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let cleanData = pasteData.trim();

      if (cleanData.startsWith('```json')) {
        cleanData = cleanData
          .replace(/^```json/, '')
          .replace(/```$/, '')
          .trim();
      } else if (cleanData.startsWith('```')) {
        cleanData = cleanData
          .replace(/^```/, '')
          .replace(/```$/, '')
          .trim();
      }

      const parsed = JSON.parse(cleanData);

      if (!Array.isArray(parsed)) {
        throw new Error('导入的日程格式必须为数组列表');
      }

      const validated = parsed.map((item, index) => {
        if (!item.title || !item.startTime || !item.endTime) {
          throw new Error(
            `第 ${index + 1} 个日程信息不完整(必填: title, startTime, endTime)`
          );
        }

        const rep = item.isRepeating !== false;

        let parsedWeeks = [];

        if (Array.isArray(item.weeks) && item.weeks.length > 0) {
          parsedWeeks = item.weeks.map(Number);
        } else if (item.category === 'course' && rep) {
          parsedWeeks = [
            1, 2, 3, 4, 5, 6, 7, 8,
            9, 10, 11, 12, 13, 14, 15, 16
          ];
        }

        let dow = Number(item.dayOfWeek || 1);

        if (!rep && item.date) {
          const dObj = new Date(item.date);
          dow = dObj.getDay() || 7;
        }

        return {
          characterId: currentCharacterId || 0,
          title: String(item.title).trim(),
          dayOfWeek: dow,
          startTime: String(item.startTime).trim(),
          endTime: String(item.endTime).trim(),
          isRepeating: rep,
          date: rep ? '' : String(item.date || ''),
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

      setSuccessMsg(`成功同步了 ${validated.length} 项生活日程。`);
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

    let targetDayOfWeek = Number(dayOfWeek);

    if (!isRepeating && singleDate) {
      const dObj = new Date(singleDate);
      targetDayOfWeek = dObj.getDay() || 7;
    }

    try {
      await db.schedules.add({
        characterId: currentCharacterId || 0,
        title: title.trim(),
        dayOfWeek: targetDayOfWeek,
        startTime,
        endTime,
        isRepeating,
        date: isRepeating ? '' : singleDate,
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
      setSuccessMsg('日程添加成功。');

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(`添加失败: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.schedules.delete(id);
      loadSchedules();
    } catch (err) {
      console.error('删除日程失败:', err);
    }
  };

  const getTodaySchedules = () => {
    return schedules.filter((schedule) => {
      if (schedule.isRepeating) {
        return schedule.dayOfWeek === activeDay;
      }

      if (schedule.date) {
        const dateObject = new Date(schedule.date);
        const day = dateObject.getDay() || 7;
        return day === activeDay;
      }

      return false;
    });
  };

  const filteredSchedules = getTodaySchedules();

  const categoryLabels = {
    course: 'Course',
    work: 'Work',
    life: 'Life'
  };

  const openManualForm = () => {
    const manualForm = document.getElementById('rhythm-manual-form');

    if (manualForm) {
      manualForm.open = true;
      manualForm.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  return (
    <div className="rhythm-app">
      <style>{styles}</style>

      <div className="rhythm-window-header">
  <button
    type="button"
    className="rhythm-header-button rhythm-back-button"
    onClick={onBackHub}
    aria-label="返回主页"
    title="返回主页"
  >
    <ArrowLeft size={15} strokeWidth={1.8} />
  </button>

  <div className="rhythm-window-dots">
    <span />
    <span />
    <span />
  </div>

  <div className="rhythm-window-title">
    Rhythm.exe
  </div>

  <button
    type="button"
    className="rhythm-header-button rhythm-settings-button"
    onClick={() => setShowConfig((value) => !value)}
    aria-label="打开日程设置"
    title="日程设置"
  >
    <Settings size={15} strokeWidth={1.8} />
  </button>
</div>


        <section className="rhythm-profile">
          <div className="rhythm-avatar">
            Rhythm
          </div>

          <div className="rhythm-profile-info">
            <div className="rhythm-banner" />

            <div className="rhythm-field">
              <label>Personal Rhythm</label>
              <div className="rhythm-field-value">
                时光作息
              </div>
            </div>

            <div className="rhythm-info-row">
              <div
                className="rhythm-field"
                style={{ flex: 1 }}
              >
                <label>Week</label>
                <div className="rhythm-field-value">
                  {termStartDate ? currentWeek : '--'}
                </div>
              </div>

              <div
                className="rhythm-field"
                style={{ flex: 1.5 }}
              >
                <label>Today</label>
                <div className="rhythm-field-value">
                  {new Date().toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="rhythm-tabs">
          <button
            type="button"
            className={`rhythm-tab ${
              activePromptTab === 'student' ? 'active' : ''
            }`}
            onClick={() => setActivePromptTab('student')}
          >
            Tasks
          </button>

          <button
            type="button"
            className={`rhythm-tab ${
              activePromptTab === 'events' ? 'active' : ''
            }`}
            onClick={() => setActivePromptTab('events')}
          >
            Events
          </button>

          <button
            type="button"
            className={`rhythm-tab ${
              activePromptTab === 'memo' ? 'active' : ''
            }`}
            onClick={() => setActivePromptTab('memo')}
          >
            Memo
          </button>

          <button
            type="button"
            className="rhythm-tab external"
            title="返回主页"
            onClick={onBackHub}
          >
            <ExternalLink size={15} strokeWidth={1.8} />
          </button>
        </nav>

        <main className="rhythm-content">
          {showConfig && (
            <section className="rhythm-config">
              <div className="rhythm-config-head">
                <span>设定开学周一 / 计算当前学周</span>

                <button
                  type="button"
                  className="rhythm-icon-button"
                  onClick={() => setShowConfig(false)}
                  aria-label="关闭设置"
                >
                  <X size={15} />
                </button>
              </div>

              <p>
                仅学生党需要配置。配置后系统会根据此日期自动计算当前学周次。
              </p>

              <div className="rhythm-config-row">
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(e) => setTermStartDate(e.target.value)}
                />

                <button
                  type="button"
                  className="rhythm-primary-button"
                  onClick={handleSaveTermStart}
                >
                  确定
                </button>
              </div>
            </section>
          )}

          <div className="rhythm-profile-info" style={{ display: 'none' }}>
            {activePromptTab}
          </div>

          {termStartDate && (
            <div className="rhythm-week-badge">
              <span>
                School Calendar / Week {currentWeek}
              </span>
            </div>
          )}

          <div className="rhythm-day-tabs">
            {weekDays.map((day) => {
              const isActive = activeDay === day.value;

              return (
                <button
                  type="button"
                  key={day.value}
                  className={`rhythm-day-tab ${
                    isActive ? 'active' : ''
                  }`}
                  onClick={() => setActiveDay(day.value)}
                >
                  {day.label}
                </button>
              );
            })}
          </div>

          <section>
            <h2 className="rhythm-section-heading">
              <Calendar size={14} strokeWidth={1.8} />
              今日日程票根
            </h2>

            {filteredSchedules.length === 0 ? (
              <div className="rhythm-empty">
                此页尚未夹入任何日程纸条。
              </div>
            ) : (
              <div className="rhythm-schedule-list">
                {filteredSchedules.map((item) => {
                  const typeLabel =
                    categoryLabels[item.category] || 'Life';

                  return (
                    <article
                      key={item.id}
                      className="rhythm-schedule"
                    >
                      <div className="rhythm-time">
                        <strong>{item.startTime}</strong>
                        <i />
                        <small>{item.endTime}</small>
                      </div>

                      <div className="rhythm-schedule-body">
                        <div className="rhythm-schedule-title-row">
                          <h3 className="rhythm-schedule-title">
                            {item.title}
                          </h3>

                          <span className="rhythm-category">
                            [{typeLabel}]
                          </span>
                        </div>

                        <div className="rhythm-meta">
                          {item.location && (
                            <div>At: {item.location}</div>
                          )}

                          {item.teacher && (
                            <div>With: {item.teacher}</div>
                          )}

                          {!item.location && !item.teacher && (
                            <div>Keep this time for yourself.</div>
                          )}
                        </div>

                        <div className="rhythm-cycle">
                          <span>
                            {!item.isRepeating && item.date
                              ? `Once: ${item.date}`
                              : item.category === 'course' &&
                                item.weeks?.length > 0
                              ? `Weeks: ${item.weeks[0]}-${
                                  item.weeks[item.weeks.length - 1]
                                }`
                              : 'Every week repeat'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="rhythm-delete"
                        onClick={() => handleDelete(item.id)}
                        title="删除此日程"
                        aria-label="删除此日程"
                      >
                        <Trash2 size={14} />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rhythm-memo">
            <h2 className="rhythm-memo-title">
              daily to do list
            </h2>

            <label className="rhythm-memo-item">
              <input type="checkbox" />
              <span>drink water</span>
            </label>

            <label className="rhythm-memo-item">
              <input type="checkbox" />
              <span>read a book</span>
            </label>

            <label className="rhythm-memo-item">
              <input type="checkbox" />
              <span>add info to the notion</span>
            </label>

            <label className="rhythm-memo-item">
              <input type="checkbox" />
              <span>watch something interesting (no matter what)</span>
            </label>
          </section>

          <div className="rhythm-divider" />

          <section className="rhythm-import">
            <div className="rhythm-import-head">
              <span className="rhythm-import-title">
                使用外部 AI 助理导入
              </span>

              <button
                type="button"
                className="rhythm-copy"
                onClick={handleCopyPrompt}
              >
                {isCopied ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}
                {isCopied ? '已复制' : '复制解析提示词'}
              </button>
            </div>

            <p className="rhythm-import-description">
              将提示词发送给 Claude、ChatGPT 等外部 AI，并把生成的 JSON
              粘贴到下方导入。
            </p>

            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder="粘贴 AI 吐出的 JSON 文本..."
            />

            <button
              type="button"
              className="rhythm-import-submit"
              onClick={handleImportJson}
              disabled={!pasteData.trim()}
            >
              导入日程票根
            </button>
          </section>

          <details
            id="rhythm-manual-form"
            className="rhythm-manual"
          >
            <summary>
              <span>手动填写日程纸条</span>
              <Plus size={16} strokeWidth={1.8} />
            </summary>

            <form
              onSubmit={handleAddSingle}
              className="rhythm-form"
            >
              <div className="rhythm-form-grid">
                <div className="rhythm-form-field full">
                  <label>日程模式</label>

                  <div className="rhythm-mode">
                    <label>
                      <input
                        type="radio"
                        checked={isRepeating}
                        onChange={() => setIsRepeating(true)}
                      />
                      每周重复安排
                    </label>

                    <label>
                      <input
                        type="radio"
                        checked={!isRepeating}
                        onChange={() => setIsRepeating(false)}
                      />
                      仅限单次事件
                    </label>
                  </div>
                </div>

                <div className="rhythm-form-field full">
                  <label>日程 / 课程名称</label>

                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：高数 / 通勤 / 团队站会"
                  />
                </div>

                {isRepeating ? (
                  <div className="rhythm-form-field">
                    <label>星期几</label>

                    <select
                      value={dayOfWeek}
                      onChange={(e) =>
                        setDayOfWeek(Number(e.target.value))
                      }
                    >
                      {weekDays.map((day) => (
                        <option
                          key={day.value}
                          value={day.value}
                        >
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rhythm-form-field">
                    <label>选择日期</label>

                    <input
                      type="date"
                      required
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                    />
                  </div>
                )}

                <div className="rhythm-form-field">
                  <label>类别</label>

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="course">学生课表</option>
                    <option value="work">工作日程</option>
                    <option value="life">生活日常</option>
                  </select>
                </div>

                <div className="rhythm-form-field">
                  <label>开始时间</label>

                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div className="rhythm-form-field">
                  <label>结束时间</label>

                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                {isRepeating && category === 'course' && (
                  <div className="rhythm-form-field full">
                    <label>上课周次，如 1-16</label>

                    <input
                      type="text"
                      value={weeks}
                      onChange={(e) => setWeeks(e.target.value)}
                    />
                  </div>
                )}

                <div className="rhythm-form-field">
                  <label>地点 / 选填</label>

                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="如：教一302"
                  />
                </div>

                <div className="rhythm-form-field">
                  <label>人物 / 选填</label>

                  <input
                    type="text"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="如：王老师"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="rhythm-form-submit"
              >
                保存此日程票根
              </button>
            </form>
          </details>

          {errorMsg && (
            <div className="rhythm-message error">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rhythm-message success">
              {successMsg}
            </div>
          )}
        </main>

        <button
          type="button"
          className="rhythm-fab"
          onClick={openManualForm}
          aria-label="添加日程"
          title="添加日程"
        >
          +
        </button>
      </div>
    </div>
  );
}

