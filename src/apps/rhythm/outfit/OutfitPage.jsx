import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import db from '../../../db';
import {
  OUTFIT_PARTS,
  WEATHER_OPTIONS,
  RETENTION_OPTIONS,
  MAX_PART_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TEMP_LENGTH,
  cleanupOldOutfits,
  deleteOutfitDay,
  getOutfit,
  getRecentPartValues,
  getRetentionDays,
  getTodayDateStr,
  listOutfitDays,
  saveUserOutfit,
  setRetentionDays,
  summarizeParts,
} from '../../../services/outfitService';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const EMPTY_FORM = {
  top: '',
  bottom: '',
  outer: '',
  shoes: '',
  accessory: '',
  note: '',
  weatherLabel: '',
  weatherTemp: '',
};

const formatDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  return `${m}月${d}日 ${WEEKDAY_LABELS[dateObj.getDay()]}`;
};

const formFromRecord = (record) => ({
  ...EMPTY_FORM,
  ...(record?.parts || {}),
  note: record?.note || '',
  weatherLabel: record?.weather?.label || '',
  weatherTemp: record?.weather?.temp || '',
});

const formatWeather = (weather) =>
  [weather?.label, weather?.temp].filter(Boolean).join(' · ');

/**
 * "今日穿搭"完整页面。
 * 通过 portal 渲染在 body 上：不受 Rhythm 外壳里强制字号规则的影响，
 * 颜色全部使用主题变量，四个主题下都能正常显示。
 * 打开时先清理超过保留天数的旧记录，再读取数据。
 */
export default function OutfitPage({ chatId, onClose }) {
  const todayStr = useMemo(() => getTodayDateStr(), []);

  const [tab, setTab] = useState('today');
  const [ready, setReady] = useState(false);
  const [chatTitle, setChatTitle] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedRecord, setSavedRecord] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [recent, setRecent] = useState({});
  const [days, setDays] = useState([]);
  const [retention, setRetention] = useState(7);
  const [pendingDeleteKey, setPendingDeleteKey] = useState(null);

  const deleteTimerRef = useRef(null);

  const refreshLists = useCallback(async () => {
    const [recentValues, dayList] = await Promise.all([
      getRecentPartValues(chatId),
      listOutfitDays(chatId),
    ]);

    setRecent(recentValues);
    setDays(dayList);
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await cleanupOldOutfits();

      const [chat, today, retentionDays] = await Promise.all([
        db.chats.get(chatId),
        getOutfit(chatId, todayStr, 'user'),
        getRetentionDays(),
      ]);

      if (cancelled) return;

      setChatTitle(chat?.title || '');
      setSavedRecord(today);
      setForm(formFromRecord(today));
      setRetention(retentionDays);

      await refreshLists();

      if (!cancelled) {
        setReady(true);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId, todayStr, refreshLists]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(
    () => () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    },
    [],
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveState((prev) => (prev === 'saving' ? prev : 'idle'));
  };

  const hasContent =
    OUTFIT_PARTS.some(({ key }) => form[key].trim()) || form.note.trim();

  const handleSave = async () => {
    if (!hasContent || saveState === 'saving') return;

    setSaveState('saving');

    try {
      const result = await saveUserOutfit({
        chatId,
        dateStr: todayStr,
        parts: form,
        note: form.note,
        weather: { label: form.weatherLabel, temp: form.weatherTemp },
      });

      if (result.status !== 'success') {
        setSaveState('error');
        return;
      }

      setSavedRecord(result.record);
      setDirty(false);
      setSaveState('saved');

      await refreshLists();
    } catch (err) {
      console.error('[OutfitPage] 保存穿搭失败：', err);
      setSaveState('error');
    }
  };

  const handleDeleteDay = async (dateStr) => {
    if (pendingDeleteKey !== dateStr) {
      setPendingDeleteKey(dateStr);

      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }

      deleteTimerRef.current = setTimeout(() => {
        setPendingDeleteKey(null);
      }, 3000);

      return;
    }

    setPendingDeleteKey(null);

    await deleteOutfitDay(chatId, dateStr, 'user');

    if (dateStr === todayStr) {
      setSavedRecord(null);
      setForm(EMPTY_FORM);
      setDirty(false);
      setSaveState('idle');
    }

    await refreshLists();
  };

  const handleRetentionChange = async (nextDays) => {
    if (nextDays === retention) return;

    const value = await setRetentionDays(nextDays);

    setRetention(value);
    await cleanupOldOutfits();
    await refreshLists();
  };

  const saveButtonLabel = (() => {
    if (saveState === 'saving') return '保存中……';
    if (saveState === 'saved' && !dirty) return '已保存';
    return savedRecord ? '更新今天的穿搭' : '保存今天的穿搭';
  })();

  const renderToday = () => (
    <div className="otf-panel" key="today">
      <section className="otf-card">
        <p className="otf-label">天气</p>

        <div className="otf-chip-row">
          {WEATHER_OPTIONS.map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={form.weatherLabel === label}
              className={`otf-chip ${
                form.weatherLabel === label ? 'otf-chip--on' : ''
              }`}
              onClick={() =>
                updateField('weatherLabel', form.weatherLabel === label ? '' : label)
              }
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="otf-input otf-input--temp"
          value={form.weatherTemp}
          maxLength={MAX_TEMP_LENGTH}
          placeholder="温度，例如 18°C"
          aria-label="温度"
          onChange={(event) => updateField('weatherTemp', event.target.value)}
        />
      </section>

      <section className="otf-card">
        <p className="otf-label">我的穿搭</p>

        {OUTFIT_PARTS.map(({ key, label }) => {
          const suggestions = (recent[key] || []).filter(
            (value) => value !== form[key],
          );

          return (
            <div className="otf-field" key={key}>
              <label className="otf-field__label" htmlFor={`otf-${key}`}>
                {label}
              </label>

              <input
                id={`otf-${key}`}
                type="text"
                className="otf-input"
                value={form[key]}
                maxLength={MAX_PART_LENGTH}
                onChange={(event) => updateField(key, event.target.value)}
              />

              {suggestions.length > 0 && (
                <div className="otf-chip-row otf-chip-row--tight">
                  {suggestions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="otf-chip otf-chip--small"
                      onClick={() => updateField(key, value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="otf-field">
          <label className="otf-field__label" htmlFor="otf-note">
            备注
          </label>

          <textarea
            id="otf-note"
            rows={2}
            className="otf-input otf-input--area"
            value={form.note}
            maxLength={MAX_NOTE_LENGTH}
            placeholder="今天的心情、场合……"
            onChange={(event) => updateField('note', event.target.value)}
          />
        </div>
      </section>

      <button
        type="button"
        className={`otf-primary ${
          saveState === 'saved' && !dirty ? 'otf-primary--done' : ''
        }`}
        disabled={!hasContent || saveState === 'saving' || (saveState === 'saved' && !dirty)}
        onClick={handleSave}
      >
        {saveButtonLabel}
      </button>

      {saveState === 'saved' && !dirty && (
        <p className="otf-hint">已保存，之后可以随时修改。</p>
      )}

      {saveState === 'error' && (
        <p className="otf-hint otf-hint--error">保存失败，请再试一次。</p>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="otf-panel" key="history">
      {days.length === 0 ? (
        <p className="otf-empty">还没有穿搭记录。</p>
      ) : (
        days.map((day, index) => {
          const record = day.user;
          const summary = record ? summarizeParts(record.parts) : '';
          const weatherText = formatWeather(record?.weather);

          return (
            <article
              className="otf-card otf-day"
              key={day.dateStr}
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <div className="otf-day__head">
                <p className="otf-day__date">
                  {formatDateLabel(day.dateStr)}
                  {day.dateStr === todayStr && (
                    <span className="otf-day__tag">今天</span>
                  )}
                </p>

                {weatherText && <p className="otf-day__weather">{weatherText}</p>}
              </div>

              {summary && <p className="otf-day__summary">{summary}</p>}

              {record?.note && <p className="otf-day__note">{record.note}</p>}

              {record && (
                <button
                  type="button"
                  className={`otf-link ${
                    pendingDeleteKey === day.dateStr ? 'otf-link--danger' : ''
                  }`}
                  onClick={() => handleDeleteDay(day.dateStr)}
                >
                  {pendingDeleteKey === day.dateStr ? '再点一次确认删除' : '删除'}
                </button>
              )}
            </article>
          );
        })
      )}

      <section className="otf-card">
        <p className="otf-label">保留时长</p>

        <div className="otf-segment" role="group" aria-label="保留天数">
          {RETENTION_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={retention === value}
              className={`otf-segment__btn ${
                retention === value ? 'otf-segment__btn--on' : ''
              }`}
              onClick={() => handleRetentionChange(value)}
            >
              {value} 天
            </button>
          ))}
        </div>

        <p className="otf-hint otf-hint--left">
          只保留最近 {retention} 天（含今天）。更早的记录会在打开这个页面时自动清除。
        </p>
      </section>
    </div>
  );

  return createPortal(
    <div
      className="otf-root"
      role="dialog"
      aria-modal="true"
      aria-label="今日穿搭"
    >
      <style>{`
        .otf-root {
          --otf-serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif;
          --otf-sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
          --otf-mono: "SFMono-Regular", "Cascadia Mono", "Roboto Mono", Menlo, Monaco, monospace;
          --otf-spring: cubic-bezier(.16, 1, .3, 1);

          position: fixed;
          inset: 0;
          z-index: 10000;
          color: var(--text-main);
          font-family: var(--otf-sans);
          background-color: var(--bg-main);
          background-image: radial-gradient(circle at 12% 0%, var(--control-soft-bg), transparent 46%);
          animation: otf-sheet-in .34s var(--otf-spring) both;
        }

        .otf-root *,
        .otf-root *::before,
        .otf-root *::after {
          box-sizing: border-box;
        }

        .otf-scroll {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .otf-inner {
          max-width: 480px;
          margin: 0 auto;
          padding:
            calc(env(safe-area-inset-top, 0px) + 18px)
            20px
            calc(env(safe-area-inset-bottom, 0px) + 48px);
        }

        .otf-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
        }

        .otf-back {
          display: flex;
          flex: none;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          color: var(--text-main);
          background: var(--control-soft-bg);
          border: 1px solid var(--card-border);
          border-radius: 999px;
          transition: transform .2s var(--otf-spring);
        }

        .otf-back:active {
          transform: scale(.9);
        }

        .otf-eyebrow {
          margin: 0 0 3px;
          font-family: var(--otf-mono);
          font-size: 9px;
          letter-spacing: .24em;
          text-transform: uppercase;
          color: var(--text-sub);
        }

        .otf-title {
          margin: 0;
          font-family: var(--otf-serif);
          font-size: 24px;
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: .06em;
        }

        .otf-sub {
          margin: 5px 0 0;
          overflow: hidden;
          font-family: var(--otf-mono);
          font-size: 10px;
          color: var(--text-sub);
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .otf-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          margin-bottom: 18px;
          background: var(--control-soft-bg);
          border-radius: 999px;
        }

        .otf-tab {
          flex: 1;
          height: 34px;
          font-size: 13px;
          letter-spacing: .08em;
          color: var(--text-sub);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 999px;
          transition: background-color .25s, color .25s, border-color .25s;
        }

        .otf-tab--on {
          color: var(--text-main);
          background: var(--card-bg);
          border-color: var(--card-border);
        }

        .otf-panel {
          animation: otf-fade-up .4s var(--otf-spring) both;
        }

        .otf-card {
          padding: 16px;
          margin-bottom: 14px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
        }

        .otf-label {
          margin: 0 0 12px;
          font-family: var(--otf-mono);
          font-size: 10px;
          letter-spacing: .2em;
          color: var(--text-sub);
        }

        .otf-field {
          margin-bottom: 14px;
        }

        .otf-field:last-child {
          margin-bottom: 0;
        }

        .otf-field__label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          color: var(--text-sub);
        }

        .otf-input {
          display: block;
          width: 100%;
          height: 44px;
          padding: 0 12px;
          font-family: inherit;
          font-size: 16px;
          color: var(--text-main);
          background: var(--control-soft-bg);
          border: 1px solid transparent;
          border-radius: 12px;
          outline: none;
          transition: border-color .2s;
        }

        .otf-input::placeholder {
          color: var(--text-muted);
        }

        .otf-input:focus {
          border-color: var(--accent-color);
        }

        .otf-input--temp {
          margin-top: 12px;
        }

        .otf-input--area {
          height: auto;
          padding: 10px 12px;
          line-height: 1.5;
          resize: none;
        }

        .otf-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .otf-chip-row--tight {
          margin-top: 8px;
          gap: 6px;
        }

        .otf-chip {
          height: 32px;
          padding: 0 11px;
          font-size: 13px;
          color: var(--text-sub);
          background: var(--control-soft-bg);
          border: 1px solid var(--card-border);
          border-radius: 999px;
          transition: transform .2s var(--otf-spring), background-color .2s, color .2s;
        }

        .otf-chip:active {
          transform: scale(.94);
        }

        .otf-chip--on {
          color: var(--accent-foreground);
          background: var(--accent-color);
          border-color: var(--accent-color);
        }

        .otf-chip--small {
          height: 26px;
          padding: 0 10px;
          font-size: 12px;
        }

        .otf-primary {
          width: 100%;
          height: 48px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: .08em;
          color: var(--accent-foreground);
          background: var(--accent-color);
          border: 0;
          border-radius: 14px;
          transition: transform .2s var(--otf-spring), opacity .2s;
        }

        .otf-primary:active:not(:disabled) {
          transform: scale(.98);
        }

        .otf-primary:disabled {
          opacity: .38;
        }

        .otf-primary--done:disabled {
          opacity: 1;
          color: var(--text-sub);
          background: var(--control-soft-bg);
          border: 1px solid var(--card-border);
        }

        .otf-hint {
          margin: 12px 0 0;
          font-size: 12px;
          line-height: 1.6;
          text-align: center;
          color: var(--text-sub);
        }

        .otf-hint--left {
          margin-top: 12px;
          text-align: left;
        }

        .otf-hint--error {
          color: #c0392b;
        }

        .otf-empty {
          padding: 36px 0;
          font-size: 13px;
          text-align: center;
          color: var(--text-muted);
        }

        .otf-day {
          animation: otf-fade-up .4s var(--otf-spring) both;
        }

        .otf-day__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }

        .otf-day__date {
          margin: 0;
          font-family: var(--otf-serif);
          font-size: 14px;
          font-weight: 600;
        }

        .otf-day__tag {
          margin-left: 8px;
          padding: 1px 7px;
          font-family: var(--otf-mono);
          font-size: 9px;
          font-weight: 400;
          letter-spacing: .1em;
          color: var(--text-sub);
          border: 1px solid var(--card-border);
          border-radius: 999px;
        }

        .otf-day__weather {
          margin: 0;
          font-size: 12px;
          color: var(--text-sub);
        }

        .otf-day__summary {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.6;
        }

        .otf-day__note {
          margin: 6px 0 0;
          font-family: var(--otf-serif);
          font-size: 12px;
          font-style: italic;
          line-height: 1.6;
          color: var(--text-sub);
        }

        .otf-link {
          margin-top: 10px;
          padding: 4px 0;
          font-size: 12px;
          color: var(--text-muted);
          background: transparent;
          border: 0;
        }

        .otf-link--danger {
          color: #c0392b;
        }

        .otf-segment {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--control-soft-bg);
          border-radius: 999px;
        }

        .otf-segment__btn {
          flex: 1;
          height: 32px;
          font-size: 13px;
          color: var(--text-sub);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 999px;
          transition: background-color .25s, color .25s, border-color .25s;
        }

        .otf-segment__btn--on {
          color: var(--text-main);
          background: var(--card-bg);
          border-color: var(--card-border);
        }

        @keyframes otf-sheet-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes otf-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .otf-root,
          .otf-panel,
          .otf-day {
            animation: none;
          }

          .otf-back,
          .otf-chip,
          .otf-primary,
          .otf-tab,
          .otf-segment__btn {
            transition: none;
          }
        }
      `}</style>

      <div className="otf-scroll">
        <div className="otf-inner">
          <header className="otf-header">
            <button
              type="button"
              className="otf-back"
              aria-label="返回"
              onClick={onClose}
            >
              <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </button>

            <div style={{ minWidth: 0 }}>
              <p className="otf-eyebrow">Wardrobe</p>
              <h1 className="otf-title">今日穿搭</h1>
              <p className="otf-sub">
                {formatDateLabel(todayStr)}
                {chatTitle ? ` · ${chatTitle}` : ''}
              </p>
            </div>
          </header>

          <div className="otf-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'today'}
              className={`otf-tab ${tab === 'today' ? 'otf-tab--on' : ''}`}
              onClick={() => setTab('today')}
            >
              今天
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              className={`otf-tab ${tab === 'history' ? 'otf-tab--on' : ''}`}
              onClick={() => setTab('history')}
            >
              往期
            </button>
          </div>

          {ready ? (tab === 'today' ? renderToday() : renderHistory()) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}