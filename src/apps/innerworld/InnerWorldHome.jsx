import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pencil,
  Check,
  X,
  ImagePlus,
  Upload,
  Camera,
  Sparkles,
} from 'lucide-react';
import db from '../../db';
import { updateInnerWorldEntry } from '../../services/innerworld/innerWorldService';

const pageStyle = `
  @keyframes innerWorldReveal {
    from {
      opacity: 0;
      transform: translateY(24px) scale(.98);
      filter: blur(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
  }

  @keyframes ambientPulse {
    0%, 100% {
      opacity: .35;
      transform: translate(-50%, -50%) scale(.9);
    }
    50% {
      opacity: .7;
      transform: translate(-50%, -50%) scale(1.12);
    }
  }

  @keyframes ringSpin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes linePulse {
    0%, 100% {
      opacity: .35;
    }
    50% {
      opacity: .95;
    }
  }

  @keyframes avatarFloat {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-3px);
    }
  }

  @keyframes imageAppear {
    from {
      opacity: 0;
      transform: scale(1.08);
      filter: blur(10px);
    }
    to {
      opacity: 1;
      transform: scale(1);
      filter: blur(0);
    }
  }

  .iw-root {
    isolation: isolate;
    background: #070707;
    color: #ededed;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .iw-root *,
  .iw-root *::before,
  .iw-root *::after {
    box-sizing: border-box;
  }

  .iw-noise {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    opacity: .13;
    mix-blend-mode: overlay;
    background-image:
      radial-gradient(rgba(255,255,255,.3) .6px, transparent .6px),
      radial-gradient(rgba(255,255,255,.18) .5px, transparent .5px);
    background-size: 5px 5px, 8px 8px;
    background-position: 0 0, 3px 4px;
  }

  .iw-ambient {
    position: fixed;
    z-index: -1;
    top: 48%;
    left: 50%;
    width: 460px;
    height: 460px;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle, rgba(255,255,255,.1), transparent 68%);
    animation: ambientPulse 9s ease-in-out infinite;
  }

  .iw-scroll {
    animation: innerWorldReveal .8s cubic-bezier(.2,.8,.2,1) both;
  }

  .iw-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: max(30px, env(safe-area-inset-top)) 20px 22px;
  }

  .iw-author {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
  }

  .iw-avatar {
    position: relative;
    width: 46px;
    height: 46px;
    flex: 0 0 46px;
    overflow: hidden;
    border-radius: 50%;
    background: linear-gradient(145deg, #29292c, #09090a);
    box-shadow:
      inset 1px 1px 2px rgba(255,255,255,.2),
      0 8px 24px rgba(0,0,0,.55);
    animation: avatarFloat 5s ease-in-out infinite;
  }

  .iw-avatar img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    animation: imageAppear .7s ease both;
  }

  .iw-avatar::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.16);
  }

  .iw-avatar-fallback {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: rgba(255,255,255,.7);
    font-family: Georgia, serif;
    font-size: 20px;
    font-style: italic;
  }

  .iw-user-avatar {
    position: absolute;
    right: -3px;
    bottom: -2px;
    width: 19px;
    height: 19px;
    border: 2px solid #09090a;
    border-radius: 50%;
    background: #202023;
    overflow: hidden;
  }

  .iw-user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .iw-user-avatar span {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: white;
    font-size: 9px;
  }

  .iw-author-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 15px;
  }

  .iw-author-sub {
    margin-top: 3px;
    color: rgba(255,255,255,.38);
    font-family: monospace;
    font-size: 9px;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  .iw-edition {
    color: rgba(255,255,255,.42);
    font-family: Georgia, serif;
    font-size: 12px;
    font-style: italic;
  }

  .iw-close {
    position: absolute;
    top: max(26px, env(safe-area-inset-top));
    right: 18px;
    display: grid;
    width: 31px;
    height: 31px;
    place-items: center;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 50%;
    background: rgba(0,0,0,.28);
    color: rgba(255,255,255,.65);
    backdrop-filter: blur(16px);
    transition: .35s cubic-bezier(.2,.8,.2,1);
  }

  .iw-close:hover {
    transform: rotate(90deg) scale(1.08);
    color: white;
    background: rgba(255,255,255,.1);
  }

  .iw-cover {
    position: relative;
    min-height: 265px;
    overflow: hidden;
    margin: 0 13px;
    border-radius: 0 0 28px 28px;
  }

  .iw-cover-image,
  .iw-cover-fallback {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .iw-cover-image {
    object-fit: cover;
    opacity: .58;
    filter: saturate(.65) contrast(1.05);
    animation: imageAppear 1s ease both;
    transition: transform 1.2s cubic-bezier(.2,.8,.2,1), filter .8s ease;
  }

  .iw-cover:hover .iw-cover-image {
    transform: scale(1.06);
    filter: saturate(.9) contrast(1.08);
  }

  .iw-cover-fallback {
    background:
      radial-gradient(circle at 72% 18%, rgba(255,255,255,.15), transparent 25%),
      linear-gradient(145deg, #242427, #09090a 72%);
  }

  .iw-cover-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to bottom, rgba(0,0,0,.12), rgba(0,0,0,.55) 62%, #070707 100%),
      linear-gradient(90deg, rgba(0,0,0,.3), transparent 55%);
  }

  .iw-cover-content {
    position: absolute;
    right: 20px;
    bottom: 22px;
    left: 20px;
  }

  .iw-cover-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 30px;
    font-weight: 400;
    letter-spacing: .01em;
  }

  .iw-cover-subtitle {
    margin-top: 7px;
    color: rgba(255,255,255,.48);
    font-family: monospace;
    font-size: 9px;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .iw-cover-actions {
    position: absolute;
    right: 18px;
    bottom: 18px;
    display: flex;
    gap: 7px;
  }

  .iw-icon-button,
  .iw-action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 999px;
    background: rgba(8,8,8,.44);
    color: rgba(255,255,255,.68);
    backdrop-filter: blur(18px);
    transition: .35s cubic-bezier(.2,.8,.2,1);
  }

  .iw-icon-button {
    width: 33px;
    height: 33px;
  }

  .iw-action-button {
    padding: 8px 11px;
    font-size: 10px;
  }

  .iw-icon-button:hover,
  .iw-action-button:hover {
    border-color: rgba(255,255,255,.35);
    background: rgba(255,255,255,.12);
    color: white;
    transform: translateY(-2px);
  }

  .iw-meta-row {
    display: flex;
    gap: 8px;
    padding: 19px 20px 5px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .iw-meta-row::-webkit-scrollbar,
  .iw-carousel::-webkit-scrollbar {
    display: none;
  }

  .iw-tag {
    flex: 0 0 auto;
    padding: 7px 11px;
    border-bottom: 1px solid rgba(255,255,255,.2);
    color: rgba(255,255,255,.6);
    font-family: monospace;
    font-size: 10px;
    letter-spacing: .05em;
    white-space: nowrap;
  }

  .iw-section {
    padding: 27px 20px 0;
  }

  .iw-section-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 13px;
  }

  .iw-section-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    font-style: italic;
    font-weight: 400;
  }

  .iw-section-label {
    color: rgba(255,255,255,.35);
    font-family: monospace;
    font-size: 9px;
    letter-spacing: .17em;
    text-transform: uppercase;
  }

  .iw-carousel {
    display: flex;
    gap: 16px;
    margin: 0 -20px;
    padding: 10px 20px 30px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }

  .iw-leaf {
    position: relative;
    display: flex;
    flex: 0 0 278px;
    min-height: 215px;
    flex-direction: column;
    justify-content: space-between;
    scroll-snap-align: center;
    overflow: hidden;
    padding: 22px 20px;
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255,255,255,.08), transparent 30%),
      linear-gradient(145deg, #202023, #111113);
    box-shadow:
      0 0 0 1px rgba(255,255,255,.07),
      0 16px 38px rgba(0,0,0,.55);
    transition: transform .45s cubic-bezier(.2,.8,.2,1), box-shadow .45s ease;
  }

  .iw-leaf::before {
    content: "";
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,.8), transparent);
    box-shadow: 0 1px rgba(255,255,255,.06);
  }

  .iw-leaf:hover {
    transform: translateY(-7px) scale(1.015);
    box-shadow:
      0 0 0 1px rgba(255,255,255,.13),
      0 25px 48px rgba(0,0,0,.7);
  }

  .iw-leaf-meta {
    display: flex;
    justify-content: space-between;
    color: rgba(255,255,255,.33);
    font-family: monospace;
    font-size: 9px;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .iw-leaf-text {
    position: relative;
    z-index: 1;
    margin: 22px 0 auto;
    color: rgba(255,255,255,.68);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13px;
    line-height: 1.8;
  }

  .iw-leaf-metric {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px dashed rgba(255,255,255,.13);
  }

  .iw-leaf-value {
    font-family: Georgia, serif;
    font-size: 26px;
    font-style: italic;
  }

  .iw-leaf-caption {
    color: rgba(255,255,255,.38);
    font-family: monospace;
    font-size: 9px;
    letter-spacing: .09em;
    text-transform: uppercase;
  }

  .iw-chart-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 8px 0 25px;
  }

  .iw-chart-ring {
    transform-origin: center;
    animation: ringSpin 60s linear infinite;
  }

  .iw-chart-data {
    fill: rgba(255,255,255,.08);
    stroke: white;
    stroke-width: 1.3;
    filter: drop-shadow(0 0 6px rgba(255,255,255,.45));
    animation: linePulse 4s ease-in-out infinite;
  }

  .iw-chart-line {
    animation: linePulse 3s ease-in-out infinite;
  }

  .iw-chart-label {
    fill: rgba(255,255,255,.42);
    font-family: monospace;
    font-size: 8px;
    letter-spacing: 1px;
    text-anchor: middle;
  }

  .iw-edit-block {
    padding: 21px 0;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }

  .iw-edit-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 9px;
  }

  .iw-edit-label {
    color: rgba(255,255,255,.36);
    font-family: monospace;
    font-size: 9px;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .iw-edit-content {
    color: rgba(255,255,255,.76);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 14px;
    font-style: italic;
    line-height: 1.75;
  }

  .iw-input {
    width: 100%;
    resize: none;
    outline: none;
    padding: 11px 0;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,.2);
    background: transparent;
    color: white;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 14px;
    line-height: 1.7;
    transition: border-color .3s ease;
  }

  .iw-input:focus {
    border-color: rgba(255,255,255,.7);
  }

  .iw-todo {
    padding: 11px 0;
    color: rgba(255,255,255,.67);
    font-family: Georgia, serif;
    font-size: 13px;
    line-height: 1.6;
  }

  .iw-photo-row {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 10px 20px 4px;
    scrollbar-width: none;
  }

  .iw-photo {
    position: relative;
    flex: 0 0 78px;
    height: 94px;
    overflow: hidden;
    border-radius: 10px;
    background: #161618;
    box-shadow: 0 8px 18px rgba(0,0,0,.35);
  }

  .iw-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(.2);
    transition: transform .5s ease, filter .5s ease;
  }

  .iw-photo:hover img {
    transform: scale(1.08);
    filter: grayscale(0);
  }

  .iw-photo-remove {
    position: absolute;
    top: 5px;
    right: 5px;
    display: grid;
    width: 21px;
    height: 21px;
    place-items: center;
    border: none;
    border-radius: 50%;
    background: rgba(0,0,0,.65);
    color: white;
  }

  .iw-photo-add {
    display: flex;
    flex: 0 0 78px;
    height: 94px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 6px;
    border: 1px dashed rgba(255,255,255,.22);
    border-radius: 10px;
    background: transparent;
    color: rgba(255,255,255,.4);
    font-size: 9px;
    transition: .35s ease;
  }

  .iw-photo-add:hover {
    border-color: rgba(255,255,255,.6);
    color: white;
    background: rgba(255,255,255,.06);
  }
`;

const Avatar = ({ src, fallback, className = '' }) => (
  <div className={`iw-avatar ${className}`}>
    {src ? (
      <img src={src} alt="" loading="lazy" decoding="async" />
    ) : (
      <div className="iw-avatar-fallback">{fallback}</div>
    )}
  </div>
);

const EditableBlock = ({
  label,
  value,
  placeholder,
  multiline,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const save = () => {
    onSave(draft);
    setIsEditing(false);
  };

  return (
    <div className="iw-edit-block">
      <div className="iw-edit-head">
        <span className="iw-edit-label">{label}</span>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="iw-icon-button"
            aria-label={`编辑${label}`}
          >
            <Pencil size={13} />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={save}
              className="iw-icon-button"
              aria-label="保存"
            >
              <Check size={14} />
            </button>

            <button
              type="button"
              onClick={() => {
                setDraft(value || '');
                setIsEditing(false);
              }}
              className="iw-icon-button"
              aria-label="取消"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        multiline ? (
          <textarea
            autoFocus
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="iw-input"
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="iw-input"
          />
        )
      ) : (
        <div className="iw-edit-content">
          {value || placeholder}
        </div>
      )}
    </div>
  );
};

const MoodTrajectoryChart = ({ history }) => {
  if (!history || history.length < 2) {
    return (
      <p className="iw-edit-content" style={{ color: 'rgba(255,255,255,.35)' }}>
        还没有足够的历史记录来画出曲线。
      </p>
    );
  }

  const width = 320;
  const height = 90;
  const padding = 8;
  const scores = history.map((item) => Number(item.moodScore) || 50);
  const max = Math.max(...scores, 100);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;

  const points = scores.map((score, index) => {
    const x = padding + (index / (scores.length - 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((score - min) / range) * (height - padding * 2);

    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', overflow: 'visible' }}>
      <line
        x1="0"
        y1={height - padding}
        x2={width}
        y2={height - padding}
        stroke="rgba(255,255,255,.08)"
      />

      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="rgba(255,255,255,.82)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="iw-chart-line"
      />

      {points.map((point, index) => {
        const [x, y] = point.split(',');

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={index === points.length - 1 ? 3.5 : 1.8}
            fill={index === points.length - 1 ? '#fff' : 'rgba(255,255,255,.48)'}
          />
        );
      })}
    </svg>
  );
};

const PersonalityRadarChart = ({ dimensions }) => {
  const entries = Object.entries(dimensions || {});

  if (entries.length < 3) {
    return (
      <p className="iw-edit-content" style={{ color: 'rgba(255,255,255,.35)' }}>
        维度数量不足，暂时无法画出雷达图。
      </p>
    );
  }

  const size = 260;
  const center = size / 2;
  const radius = 92;
  const angleStep = (Math.PI * 2) / entries.length;

  const getPoint = (ratio, index) => {
    const angle = angleStep * index - Math.PI / 2;

    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    };
  };

  const outerPoints = entries
    .map((_, index) => {
      const point = getPoint(1, index);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  const dataPoints = entries
    .map(([, value], index) => {
      const ratio = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
      const point = getPoint(ratio, index);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: '100%', maxWidth: 280, overflow: 'visible' }}
    >
      <g className="iw-chart-ring">
        <circle
          cx={center}
          cy={center}
          r="112"
          fill="none"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="1"
          strokeDasharray="2 7"
        />
        <circle
          cx={center}
          cy={center - 112}
          r="2"
          fill="white"
          opacity=".7"
        />
      </g>

      {[0.33, 0.66, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={entries
            .map((_, index) => {
              const point = getPoint(ratio, index);
              return `${point.x},${point.y}`;
            })
            .join(' ')}
          fill="none"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="1"
        />
      ))}

      {entries.map((_, index) => {
        const point = getPoint(1, index);

        return (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="rgba(255,255,255,.1)"
          />
        );
      })}

      <polygon points={outerPoints} fill="none" stroke="rgba(255,255,255,.06)" />
      <polygon points={dataPoints} className="iw-chart-data" />

      {entries.map(([label], index) => {
        const angle = angleStep * index - Math.PI / 2;
        const x = center + Math.cos(angle) * 116;
        const y = center + Math.sin(angle) * 116;

        return (
          <text key={label} x={x} y={y} className="iw-chart-label">
            {label}
          </text>
        );
      })}

      <circle cx={center} cy={center} r="2.5" fill="white" opacity=".75" />
    </svg>
  );
};

export const InnerWorldHome = ({
  chatId,
  characterId,
  character,
  chat,
  entry: initialEntry,
  onClose,
}) => {
  const [entry, setEntry] = useState(initialEntry);
  const [history, setHistory] = useState([]);
  const [banner, setBanner] = useState(chat?.bgImage || chat?.innerWorldBanner || '');
  const [photos, setPhotos] = useState(chat?.innerWorldPhotos || []);
  const [userAvatar, setUserAvatar] = useState(chat?.userAvatar || '');
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  const bannerInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const userAvatarInputRef = useRef(null);

  const characterAvatar = character?.avatar || character?.image || '';
  const characterName =
    character?.handle ||
    character?.name ||
    'Unknown Character';

  const userName =
    chat?.userName ||
    'You';

  useEffect(() => {
    setEntry(initialEntry);
  }, [initialEntry]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rows = await db.innerWorldEntries
        .where('chatId')
        .equals(chatId)
        .sortBy('date');

      if (!cancelled) setHistory(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, entry?.id]);

  const patchEntry = useCallback(
    async (field, value) => {
      if (!entry?.id) return;

      setEntry((previous) => ({
        ...previous,
        [field]: value,
      }));

      await updateInnerWorldEntry(entry.id, {
        [field]: value,
      });
    },
    [entry]
  );

  const patchDimensionNote = useCallback(
    async (dimensionName, value) => {
      if (!entry?.id) return;

      const nextNotes = {
        ...(entry.dimensionNotes || {}),
        [dimensionName]: value,
      };

      setEntry((previous) => ({
        ...previous,
        dimensionNotes: nextNotes,
      }));

      await updateInnerWorldEntry(entry.id, {
        dimensionNotes: nextNotes,
      });
    },
    [entry]
  );

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleBannerFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await readFileAsDataUrl(file);

    setBanner(base64);

    await db.chats.update(chatId, {
      bgImage: base64,
      innerWorldBanner: base64,
    });

    event.target.value = '';
  };

  const handleUserAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await readFileAsDataUrl(file);

    setUserAvatar(base64);

    await db.chats.update(chatId, {
      userAvatar: base64,
    });

    setIsAvatarMenuOpen(false);
    event.target.value = '';
  };

  const handlePhotoFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await readFileAsDataUrl(file);
    const nextPhotos = [...photos, base64].slice(-8);

    setPhotos(nextPhotos);

    await db.chats.update(chatId, {
      innerWorldPhotos: nextPhotos,
    });

    event.target.value = '';
  };

  const removePhoto = async (index) => {
    const nextPhotos = photos.filter((_, photoIndex) => photoIndex !== index);

    setPhotos(nextPhotos);

    await db.chats.update(chatId, {
      innerWorldPhotos: nextPhotos,
    });
  };

  if (!entry) return null;

  return (
    <>
      <style>{pageStyle}</style>

      <div
        className="iw-root fixed inset-0 z-[60] overflow-y-auto"
        style={{
          backgroundImage: banner
            ? `linear-gradient(rgba(7,7,7,.78), rgba(7,7,7,.97)), url(${banner})`
            : undefined,
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
          backgroundPosition: 'center',
        }}
      >
        <div className="iw-noise" />
        <div className="iw-ambient" />

        <div className="iw-scroll mx-auto min-h-full w-full max-w-[480px] pb-16">
          <header className="iw-header">
            <div className="iw-author">
              <div style={{ position: 'relative' }}>
                <Avatar
                  src={characterAvatar}
                  fallback={characterName.slice(0, 1)}
                />

                <button
                  type="button"
                  className="iw-user-avatar"
                  title="更换用户头像"
                  onClick={() => setIsAvatarMenuOpen((value) => !value)}
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span>{userName.slice(0, 1)}</span>
                  )}
                </button>

                {isAvatarMenuOpen && (
                  <button
                    type="button"
                    className="iw-action-button"
                    onClick={() => userAvatarInputRef.current?.click()}
                    style={{
                      position: 'absolute',
                      top: 53,
                      left: 0,
                      zIndex: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Camera size={12} />
                    上传我的头像
                  </button>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="iw-author-title">
                  {characterName}’s Inner Codex
                </div>
                <div className="iw-author-sub">
                  Private Psychological Archive
                </div>
              </div>
            </div>

            <div className="iw-edition">Vol. 01</div>

            <button
              type="button"
              onClick={onClose}
              className="iw-close"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          </header>

          <input
            ref={userAvatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUserAvatarFile}
          />

          <section className="iw-cover">
            {banner ? (
              <img src={banner} alt="" className="iw-cover-image" loading="lazy" decoding="async" />
            ) : (
              <div className="iw-cover-fallback" />
            )}

            <div className="iw-cover-shade" />

            <div className="iw-cover-content">
              <div className="iw-cover-title">Inner Landscape</div>
              <div className="iw-cover-subtitle">
                A private record of subconscious dynamics
              </div>
            </div>

            <div className="iw-cover-actions">
              <button
                type="button"
                className="iw-action-button"
                onClick={() => bannerInputRef.current?.click()}
              >
                <ImagePlus size={12} />
                更换背景
              </button>

              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleBannerFile}
              />
            </div>
          </section>

          <div className="iw-meta-row">
            {[
              ['天气', entry.weather],
              ['温度', entry.temperature],
              ['心情', entry.mood],
            ]
              .filter((item) => item[1])
              .map(([label, value]) => (
                <span className="iw-tag" key={label}>
                  {label} · {value}
                </span>
              ))}
          </div>

          {photos.length > 0 && (
            <div className="iw-photo-row">
              {photos.map((photo, index) => (
                <div className="iw-photo" key={`${photo}-${index}`}>
                  <img src={photo} alt="" loading="lazy" decoding="async" />

                  <button
                    type="button"
                    className="iw-photo-remove"
                    onClick={() => removePhoto(index)}
                    aria-label="删除照片"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="iw-photo-add"
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload size={15} />
                添加照片
              </button>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoFile}
              />
            </div>
          )}

          <section className="iw-section">
            <div className="iw-section-heading">
              <h2 className="iw-section-title">Emotional Trace</h2>
              <span className="iw-section-label">Mood History</span>
            </div>

            <MoodTrajectoryChart history={history} />
          </section>

          <section className="iw-section">
            <div className="iw-section-heading">
              <h2 className="iw-section-title">Psychological Orbit</h2>
              <span className="iw-section-label">Swipe The Leaves</span>
            </div>

            <div className="iw-chart-wrap">
              <PersonalityRadarChart dimensions={entry.dimensions} />
            </div>
          </section>

          <section className="iw-section">
            <div className="iw-section-heading">
              <h2 className="iw-section-title">Browse Leaves</h2>
              <span className="iw-section-label">Private Notes</span>
            </div>

            <div className="iw-carousel">
              <article className="iw-leaf">
                <div className="iw-leaf-meta">
                  <span>Leaf · 01</span>
                  <span>Unspoken</span>
                </div>

                <div className="iw-leaf-text">
                  {entry.musings || 'TA今天什么都没留下……'}
                </div>

                <div className="iw-leaf-metric">
                  <span className="iw-leaf-value">01</span>
                  <span className="iw-leaf-caption">Daily Fragment</span>
                </div>
              </article>

              <article className="iw-leaf">
                <div className="iw-leaf-meta">
                  <span>Leaf · 02</span>
                  <span>Inner Voice</span>
                </div>

                <div className="iw-leaf-text">
                  {entry.innerMonologue || 'TA藏起了这段心事。'}
                </div>

                <div className="iw-leaf-metric">
                  <span className="iw-leaf-value">02</span>
                  <span className="iw-leaf-caption">Hidden Thought</span>
                </div>
              </article>

              <article className="iw-leaf">
                <div className="iw-leaf-meta">
                  <span>Leaf · 03</span>
                  <span>Intentions</span>
                </div>

                <div className="iw-leaf-text">
                  {Array.isArray(entry.todos) && entry.todos.length > 0
                    ? entry.todos.join(' · ')
                    : '今天暂时没有记录下来的计划。'}
                </div>

                <div className="iw-leaf-metric">
                  <span className="iw-leaf-value">
                    {entry.todos?.length || 0}
                  </span>
                  <span className="iw-leaf-caption">Next Moves</span>
                </div>
              </article>
            </div>
          </section>

          <section className="iw-section">
            <EditableBlock
              label="碎碎念 / Daily Fragment"
              value={entry.musings}
              placeholder="TA今天什么都没留下……"
              multiline
              onSave={(value) => patchEntry('musings', value)}
            />

            <EditableBlock
              label="没说出口的话 / Inner Voice"
              value={entry.innerMonologue}
              placeholder="TA藏起了这段心事。"
              multiline
              onSave={(value) => patchEntry('innerMonologue', value)}
            />

            {entry.dimensionNotes &&
              Object.keys(entry.dimensionNotes).length > 0 &&
              Object.entries(entry.dimensionNotes).map(([name, note]) => (
                <EditableBlock
                  key={name}
                  label={name}
                  value={note}
                  placeholder="暂无说明"
                  multiline
                  onSave={(value) => patchDimensionNote(name, value)}
                />
              ))}
          </section>

          <section
            className="iw-section"
            style={{ paddingBottom: 50 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'rgba(255,255,255,.32)',
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: '.16em',
              }}
            >
              <Sparkles size={13} />
              END OF TODAY'S INNER RECORD
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default InnerWorldHome;
