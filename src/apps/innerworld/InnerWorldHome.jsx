import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Check, X, ImagePlus } from 'lucide-react';
import db from '../../db';
import { updateInnerWorldEntry } from '../../services/innerworld/innerWorldService';

const MoodTrajectoryChart = ({ history }) => {
  if (!history || history.length < 2) {
    return (
      <p className="text-[11px] italic text-white/40">
        还没有足够的历史记录来画出曲线。
      </p>
    );
  }

  const width = 280;
  const height = 70;
  const padding = 6;

  const scores = history.map((h) => Number(h.moodScore) || 50);
  const max = Math.max(...scores, 100);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;

  const points = scores.map((score, index) => {
    const x = padding + (index / (scores.length - 1)) * (width - padding * 2);
    const y = height - padding - ((score - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => {
        const [x, y] = point.split(',');
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={index === points.length - 1 ? 3 : 1.5}
            fill={index === points.length - 1 ? '#fff' : 'rgba(255,255,255,0.5)'}
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
      <p className="text-[11px] italic text-white/40">
        维度数量不足，暂时无法画出雷达图。
      </p>
    );
  }

  const size = 220;
  const center = size / 2;
  const radius = size / 2 - 24;
  const angleStep = (Math.PI * 2) / entries.length;

  const points = entries.map(([, value], index) => {
    const angle = angleStep * index - Math.PI / 2;
    const ratio = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
    const x = center + Math.cos(angle) * radius * ratio;
    const y = center + Math.sin(angle) * radius * ratio;
    return `${x},${y}`;
  });

  const axisLines = entries.map((_, index) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  });

  const labelPoints = entries.map(([label], index) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      label,
      x: center + Math.cos(angle) * (radius + 16),
      y: center + Math.sin(angle) * (radius + 16),
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px]">
      {[0.33, 0.66, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={axisLines
            .map(({ x, y }) => (
              `${center + (x - center) * ratio},${center + (y - center) * ratio}`
            ))
            .join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      ))}

      {axisLines.map(({ x, y }, index) => (
        <line
          key={index}
          x1={center}
          y1={center}
          x2={x}
          y2={y}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      ))}

      <polygon
        points={points.join(' ')}
        fill="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.5"
      />

      {labelPoints.map(({ label, x, y }, index) => (
        <text
          key={index}
          x={x}
          y={y}
          fontSize="8"
          fill="rgba(255,255,255,0.55)"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
      ))}
    </svg>
  );
};

const EditableBlock = ({ label, value, placeholder, multiline, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(draft);
    setIsEditing(false);
  };

  return (
    <div className="border-b border-white/10 pb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
          {label}
        </span>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-white/30 transition hover:text-white/70"
            aria-label={`编辑${label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave} className="text-white/70 hover:text-white">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(value || '');
                setIsEditing(false);
              }}
              className="text-white/30 hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        multiline ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-xl border border-white/15 bg-white/5 p-2 font-serif text-[13px] leading-relaxed text-white/90 outline-none"
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            className="w-full rounded-xl border border-white/15 bg-white/5 p-2 font-serif text-[13px] text-white/90 outline-none"
          />
        )
      ) : (
        <p className="font-serif text-[13px] italic leading-relaxed text-white/80">
          {value || placeholder}
        </p>
      )}
    </div>
  );
};

export const InnerWorldHome = ({ chatId, characterId, character, chat, entry: initialEntry, onClose }) => {
  const [entry, setEntry] = useState(initialEntry);
  const [history, setHistory] = useState([]);
  const [banner, setBanner] = useState(chat?.innerWorldBanner || '');
  const [photos, setPhotos] = useState(chat?.innerWorldPhotos || []);
  const bannerInputRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const rows = await db.innerWorldEntries.where('chatId').equals(chatId).sortBy('date');
      setHistory(rows);
    })();
  }, [chatId, entry?.id]);

  const patchEntry = useCallback(async (field, value) => {
    if (!entry?.id) return;
    setEntry((previous) => ({ ...previous, [field]: value }));
    await updateInnerWorldEntry(entry.id, { [field]: value });
  }, [entry]);

  const patchDimensionNote = useCallback(async (dimensionName, value) => {
    if (!entry?.id) return;
    const nextNotes = { ...(entry.dimensionNotes || {}), [dimensionName]: value };
    setEntry((previous) => ({ ...previous, dimensionNotes: nextNotes }));
    await updateInnerWorldEntry(entry.id, { dimensionNotes: nextNotes });
  }, [entry]);

  const handleBannerFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setBanner(base64);
      await db.chats.update(chatId, { innerWorldBanner: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      const next = [...photos, base64].slice(-8);
      setPhotos(next);
      await db.chats.update(chatId, { innerWorldPhotos: next });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = async (index) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    await db.chats.update(chatId, { innerWorldPhotos: next });
  };

  if (!entry) return null;

  return (
    <div className="inner-world-home fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-black text-white">
      <div className="relative h-48 w-full shrink-0 overflow-hidden">
        {banner ? (
          <img src={banner} alt="banner" className="h-full w-full object-cover opacity-70" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-white/10 to-black" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] rounded-full border border-white/20 bg-black/30 p-2 text-white/70 backdrop-blur-md"
        >
          <X className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur-md"
        >
          <ImagePlus className="h-3 w-3" />
          更换封面
        </button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerFile}
        />

        <div className="absolute bottom-3 left-4 right-24">
          <p className="font-serif text-xl font-semibold tracking-tight">
            {character?.handle || character?.name}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
            Inner World · 只有你能看到
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {[
          { label: '天气', value: entry.weather },
          { label: '温度', value: entry.temperature },
          { label: '心情', value: entry.mood },
        ].filter((item) => item.value).map((item) => (
          <span
            key={item.label}
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-wide text-white/70"
          >
            {item.label} · {item.value}
          </span>
        ))}
      </div>

      <div className="flex shrink-0 gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {photos.map((photo, index) => (
          <div key={index} className="group relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10">
            <img src={photo} alt="" className="h-full w-full object-cover grayscale" />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 group-hover:block"
            >
              <X className="h-2.5 w-2.5 text-white" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-white/40"
        >
          <ImagePlus className="h-4 w-4" />
          <span className="text-[9px]">添加</span>
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoFile}
        />
      </div>

      <div className="flex-1 space-y-5 px-5 pb-12 pt-4">
        <EditableBlock
          label="碎碎念"
          value={entry.musings}
          placeholder="TA今天什么都没留下..."
          multiline
          onSave={(value) => patchEntry('musings', value)}
        />

        <EditableBlock
          label="没说出口的话"
          value={entry.innerMonologue}
          placeholder="TA藏起了这段心事。"
          multiline
          onSave={(value) => patchEntry('innerMonologue', value)}
        />

        {Array.isArray(entry.todos) && entry.todos.length > 0 && (
          <div className="border-b border-white/10 pb-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
              接下来想做的事
            </span>
            <div className="mt-2 space-y-2">
              {entry.todos.map((todo, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-serif text-[12px] text-white/75"
                >
                  {todo}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-b border-white/10 pb-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
            情绪轨迹
          </span>
          <div className="mt-3">
            <MoodTrajectoryChart history={history} />
          </div>
        </div>

        <div className="pb-6">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
            性格维度
          </span>
          <div className="mt-3 flex justify-center">
            <PersonalityRadarChart dimensions={entry.dimensions} />
          </div>

          {entry.dimensionNotes && Object.keys(entry.dimensionNotes).length > 0 && (
            <div className="mt-4 space-y-3">
              {Object.entries(entry.dimensionNotes).map(([name, note]) => (
                <EditableBlock
                  key={name}
                  label={name}
                  value={note}
                  placeholder="暂无说明"
                  multiline
                  onSave={(value) => patchDimensionNote(name, value)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InnerWorldHome;