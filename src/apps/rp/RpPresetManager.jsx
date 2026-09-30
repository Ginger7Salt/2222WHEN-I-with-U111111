// src/apps/rp/RpPresetManager.jsx
//
// 长RP子应用切片B：预设管理入口，从 RpRoom 头部的"预设"按钮打开。
//
// 两层结构：
//   - 列表层：这个会话当前用哪个预设、其它预设有哪些、新建/删除/
//     选用某个预设
//   - 编辑层：点某个预设的"编辑"，展开成 prompts 列表 + regex脚本
//     列表的完整编辑器（照抄 CharacterEditor.jsx 世界书条目那种
//     展开/折叠+增删的UI形态，世界书那段代码本身没被AI管线读取，
//     但UI形态是好的，这里复用形态不复用逻辑）
//
// 保存都是整段覆盖式（见 rpPresetService.updateRpPreset 的注释），
// 编辑器内部维护自己的 prompts/regexScripts 本地状态，点"保存"才
// 一次性写回数据库。

import React, { useEffect, useRef, useState } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Download, Upload, Check, ArrowLeftRight,
} from 'lucide-react';

import {
  getAllRpPresets,
  createRpPreset,
  updateRpPreset,
  deleteRpPreset,
  exportRpPresetToJson,
  importRpPresetFromJson,
} from './rpPresetService';

const emptyPrompt = () => ({
  identifier: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '新条目',
  content: '',
  role: 'system',
  enabled: true,
  isMarker: false,
});

const emptyRegexScript = () => ({
  id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '新规则',
  enabled: true,
  findRegex: '',
  flags: 'g',
  replaceString: '',
  affects: 'ai_output',
  applyToDisplay: true,
  applyToPrompt: false,
});

function PresetEditor({ preset, onClose, onSaved }) {
  const [name, setName] = useState(preset.name);
  const [prompts, setPrompts] = useState(preset.prompts || []);
  const [regexScripts, setRegexScripts] = useState(preset.regexScripts || []);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedRegexId, setExpandedRegexId] = useState(null);

  const movePrompt = (index, dir) => {
    setPrompts((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updatePromptField = (identifier, field, value) => {
    setPrompts((prev) => prev.map((p) => (p.identifier === identifier ? { ...p, [field]: value } : p)));
  };

  const removePrompt = (identifier) => {
    setPrompts((prev) => prev.filter((p) => p.identifier !== identifier));
  };

  const addPrompt = () => {
    const p = emptyPrompt();
    setPrompts((prev) => [...prev, p]);
    setExpandedId(p.identifier);
  };

  const updateRegexField = (id, field, value) => {
    setRegexScripts((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const removeRegex = (id) => {
    setRegexScripts((prev) => prev.filter((r) => r.id !== id));
  };

  const addRegex = () => {
    const r = emptyRegexScript();
    setRegexScripts((prev) => [...prev, r]);
    setExpandedRegexId(r.id);
  };

  const handleSave = async () => {
    await updateRpPreset(preset.id, {
      name: name.trim() || preset.name,
      prompts,
      promptOrder: prompts.map((p) => p.identifier),
      regexScripts,
    });
    onSaved();
  };

  const handleExport = () => {
    const json = exportRpPresetToJson({ name, prompts, promptOrder: prompts.map((p) => p.identifier), regexScripts });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'rp-preset'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mx-2 flex-1 rounded-lg border bg-transparent px-2 py-1 text-center text-xs font-semibold outline-none"
          style={{ borderColor: 'var(--card-border)' }}
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          保存
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* Prompts 列表 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold opacity-70">Prompts</h4>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleExport} className="opacity-60 hover:opacity-100" title="导出JSON">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={addPrompt} className="flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100">
                <Plus className="h-3 w-3" /> 添加
              </button>
            </div>
          </div>

          {prompts.map((p, index) => {
            const isExpanded = expandedId === p.identifier;
            return (
              <div
                key={p.identifier}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
              >
                <div className="flex items-center gap-2 p-2.5">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => updatePromptField(p.identifier, 'enabled', e.target.checked)}
                    className="h-3.5 w-3.5 accent-current shrink-0"
                  />
                  <span
                    className="flex-1 truncate text-xs font-semibold cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : p.identifier)}
                  >
                    {p.name} {p.isMarker && <em className="opacity-50">(占位符)</em>}
                  </span>
                  <button type="button" onClick={() => movePrompt(index, -1)} disabled={index === 0} className="opacity-50 hover:opacity-100 disabled:opacity-20">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => movePrompt(index, 1)} disabled={index === prompts.length - 1} className="opacity-50 hover:opacity-100 disabled:opacity-20">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removePrompt(p.identifier)} className="text-red-500 opacity-60 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-2 border-t p-2.5" style={{ borderColor: 'var(--divider)' }}>
                    <input
                      value={p.name}
                      onChange={(e) => updatePromptField(p.identifier, 'name', e.target.value)}
                      placeholder="这一条的名字"
                      className="w-full rounded-lg border px-2 py-1 text-xs outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    />
                    {!p.isMarker && (
                      <textarea
                        value={p.content}
                        onChange={(e) => updatePromptField(p.identifier, 'content', e.target.value)}
                        placeholder="内容，支持 {{char}} {{user}} {{time}} {{charBio}} {{userPersona}}"
                        rows={4}
                        className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Regex 脚本列表 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold opacity-70">正则脚本</h4>
            <button type="button" onClick={addRegex} className="flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100">
              <Plus className="h-3 w-3" /> 添加
            </button>
          </div>

          {regexScripts.map((r) => {
            const isExpanded = expandedRegexId === r.id;
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
              >
                <div className="flex items-center gap-2 p-2.5">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => updateRegexField(r.id, 'enabled', e.target.checked)}
                    className="h-3.5 w-3.5 accent-current shrink-0"
                  />
                  <span
                    className="flex-1 truncate text-xs font-semibold cursor-pointer"
                    onClick={() => setExpandedRegexId(isExpanded ? null : r.id)}
                  >
                    {r.name}
                  </span>
                  <button type="button" onClick={() => removeRegex(r.id)} className="text-red-500 opacity-60 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-2 border-t p-2.5 text-xs" style={{ borderColor: 'var(--divider)' }}>
                    <input
                      value={r.name}
                      onChange={(e) => updateRegexField(r.id, 'name', e.target.value)}
                      placeholder="规则名字"
                      className="w-full rounded-lg border px-2 py-1 outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    />
                    <input
                      value={r.findRegex}
                      onChange={(e) => updateRegexField(r.id, 'findRegex', e.target.value)}
                      placeholder="查找（正则表达式）"
                      className="w-full rounded-lg border px-2 py-1 font-mono outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    />
                    <input
                      value={r.replaceString}
                      onChange={(e) => updateRegexField(r.id, 'replaceString', e.target.value)}
                      placeholder="替换为"
                      className="w-full rounded-lg border px-2 py-1 font-mono outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    />
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">作用对象:</span>
                      <select
                        value={r.affects}
                        onChange={(e) => updateRegexField(r.id, 'affects', e.target.value)}
                        className="rounded-lg border px-1.5 py-1 outline-none"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                      >
                        <option value="ai_output">AI回复</option>
                        <option value="user_input">User输入</option>
                        <option value="both">两者都</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={r.applyToDisplay}
                        onChange={(e) => updateRegexField(r.id, 'applyToDisplay', e.target.checked)}
                        className="h-3 w-3 accent-current"
                      />
                      影响界面显示
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={r.applyToPrompt}
                        onChange={(e) => updateRegexField(r.id, 'applyToPrompt', e.target.checked)}
                        className="h-3 w-3 accent-current"
                      />
                      也写入历史（影响AI下一轮看到的内容）
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 电台卡片的封面渐变——循环取三种主题色块，跟 RpApp 学生卡头部同一路
// 复用主题变量的思路，不是写死的固定颜色。
const STATION_GRADIENT_VARS = ['--bg-blob-2', '--bg-blob-1', '--bg-blob-3'];

const presetMeta = (preset) => {
  const promptCount = Array.isArray(preset.prompts) ? preset.prompts.length : 0;
  const regexCount = Array.isArray(preset.regexScripts) ? preset.regexScripts.length : 0;
  return regexCount > 0
    ? `${promptCount} 条提示词 · ${regexCount} 条正则`
    : `${promptCount} 条提示词`;
};

const RpPresetManager = ({ currentPresetId, onClose, onSelectPreset }) => {
  const [presets, setPresets] = useState([]);
  const [editingPreset, setEditingPreset] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragPct, setDragPct] = useState(null);
  const fileInputRef = useRef(null);
  const railRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    loadPresets();
  }, []);

  // 会话当前用的预设变了（或者预设列表变了），把电台指针跟着对上去；
  // 找不到就停在第一个台。
  useEffect(() => {
    if (presets.length === 0) return;
    const idx = presets.findIndex((p) => p.id === currentPresetId);
    setFocusIndex(idx >= 0 ? idx : 0);
  }, [presets, currentPresetId]);

  useEffect(() => {
    const rail = railRef.current;
    const card = rail?.children?.[focusIndex];
    if (rail && card) {
      rail.scrollTo({
        left: card.offsetLeft - (rail.clientWidth - card.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [focusIndex, presets.length]);

  const loadPresets = async () => {
    setPresets(await getAllRpPresets());
  };

  const handleCreate = async () => {
    const newId = await createRpPreset({ name: `新预设 ${presets.length + 1}` });
    await loadPresets();
    const fresh = await getAllRpPresets();
    const created = fresh.find((p) => p.id === newId);
    if (created) setEditingPreset(created);
  };

  const handleDelete = async (presetId) => {
    await deleteRpPreset(presetId);
    loadPresets();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importRpPresetFromJson(text);
    await loadPresets();
    e.target.value = '';
  };

  // 调台指针停在某个台：既更新界面焦点，也当场选用这个预设——跟原来
  // "点这一行=选中这个预设"是同一个语义，只是触发方式从点行换成了
  // 拖旋钮/点电台卡片。
  const focusStation = (idx) => {
    if (idx < 0 || idx >= presets.length) return;
    setFocusIndex(idx);
    onSelectPreset(presets[idx].id);
  };

  const stopCount = presets.length;
  const stops = stopCount > 1
    ? presets.map((_, i) => (i / (stopCount - 1)) * 100)
    : [50];

  const pctFromClientX = (clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 0;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  };

  const nearestIndex = (pct) => {
    let best = 0;
    let bestDist = Infinity;
    stops.forEach((s, i) => {
      const d = Math.abs(s - pct);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  const handleKnobPointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setDragPct(stops[focusIndex] ?? 50);
  };

  // 拖动只在真的按住旋钮时挂 window 级别的移动/松手监听——磁吸效果只
  // 属于这一个"能拖动"的旋钮，跟其它纯点击按钮无关。
  useEffect(() => {
    if (!dragging) return undefined;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setDragPct(pctFromClientX(clientX));
    };
    const handleUp = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const idx = nearestIndex(pctFromClientX(clientX));
      setDragging(false);
      setDragPct(null);
      focusStation(idx);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  if (editingPreset) {
    return (
      <PresetEditor
        preset={editingPreset}
        onClose={() => setEditingPreset(null)}
        onSaved={async () => {
          setEditingPreset(null);
          await loadPresets();
        }}
      />
    );
  }

  const knobLeft = dragging && dragPct !== null ? dragPct : (stops[focusIndex] ?? 50);
  const focusedPreset = presets[focusIndex] || null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-50">Prompt Presets</p>
          <h3 className="text-xs font-bold">调台 · 预设</h3>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="opacity-70 hover:opacity-100"
          title="导入预设"
        >
          <Upload className="h-4 w-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      </div>

      {presets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          <p className="text-xs opacity-50">还没有预设，先新建一个</p>
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="h-3.5 w-3.5" /> 新建预设
          </button>
        </div>
      ) : (
        <>
          {/* 电台卡片横向滑轨 */}
          <div
            ref={railRef}
            className="flex gap-4 overflow-x-auto px-8 pb-2 pt-4"
            style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
          >
            {presets.map((preset, idx) => {
              const gradientVar = STATION_GRADIENT_VARS[idx % STATION_GRADIENT_VARS.length];
              const isFocus = idx === focusIndex;
              const isCurrent = preset.id === currentPresetId;
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => focusStation(idx)}
                  className="shrink-0 text-left transition-all duration-200"
                  style={{
                    width: '148px',
                    scrollSnapAlign: 'center',
                    opacity: isFocus ? 1 : 0.42,
                    transform: isFocus ? 'scale(1)' : 'scale(0.88)',
                  }}
                >
                  <div
                    className="relative flex items-center justify-center overflow-hidden rounded-[20px]"
                    style={{
                      width: '148px',
                      height: '148px',
                      boxShadow: 'var(--card-shadow)',
                      background: `linear-gradient(150deg, color-mix(in srgb, var(${gradientVar}) 92%, var(--card-bg)), var(--card-bg))`,
                    }}
                  >
                    <span className="text-4xl font-bold" style={{ color: 'var(--text-main)', opacity: 0.85 }}>
                      {preset.name?.[0] || '?'}
                    </span>
                    {isCurrent ? (
                      <span
                        className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-1 text-[8.5px] font-bold text-white"
                        style={{ backgroundColor: 'rgba(0,0,0,.35)' }}
                      >
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        使用中
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 truncate text-center text-[13px] font-bold">{preset.name}</p>
                  <p className="text-center text-[10px] opacity-50">{presetMeta(preset)}</p>
                </button>
              );
            })}
          </div>

          {/* 调频旋钮 */}
          <div className="px-8 pb-1 pt-3.5">
            <div
              ref={trackRef}
              className="relative rounded-full"
              style={{ height: '34px', backgroundColor: 'var(--control-soft-bg)' }}
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
                <span className="h-2.5 w-0.5 rounded-full" style={{ backgroundColor: 'var(--divider)' }} />
                <span className="h-2.5 w-0.5 rounded-full" style={{ backgroundColor: 'var(--divider)' }} />
                <span className="h-2.5 w-0.5 rounded-full" style={{ backgroundColor: 'var(--divider)' }} />
              </div>
              <div
                onMouseDown={handleKnobPointerDown}
                onTouchStart={handleKnobPointerDown}
                className="absolute top-1/2 flex items-center justify-center rounded-full"
                style={{
                  left: `${knobLeft}%`,
                  width: '34px',
                  height: '34px',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                  boxShadow: '0 6px 16px rgba(0,0,0,.25)',
                  cursor: dragging ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  transition: dragging ? 'none' : 'left .28s cubic-bezier(.2,.9,.3,1.2)',
                }}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] opacity-50">拖动旋钮切台 · 松手自动吸附</p>
          </div>

          {/* 当前台详情 */}
          {focusedPreset ? (
            <div
              className="flex-1 overflow-y-auto px-5 pb-4 pt-2.5"
              style={{ borderTop: '1px solid var(--divider)', marginTop: '10px' }}
            >
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-bold">{focusedPreset.name}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingPreset(focusedPreset)}
                    className="text-[11px] opacity-60 hover:opacity-100"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(focusedPreset.id)}
                    className="text-red-500 opacity-60 hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {Array.isArray(focusedPreset.prompts) && focusedPreset.prompts.length > 0 ? (
                <>
                  <p className="mb-1.5 mt-2 text-[9.5px] font-bold uppercase tracking-[0.08em] opacity-50">提示词</p>
                  {focusedPreset.prompts.map((p) => (
                    <div
                      key={p.identifier}
                      className="flex items-center gap-2 py-1.5 text-xs"
                      style={{ borderBottom: '1px solid var(--divider)' }}
                    >
                      <span
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded"
                        style={{
                          border: '1.4px solid var(--text-muted)',
                          borderColor: p.enabled ? 'var(--accent-color)' : 'var(--text-muted)',
                          backgroundColor: p.enabled ? 'var(--accent-color)' : 'transparent',
                          color: 'var(--accent-foreground)',
                        }}
                      >
                        {p.enabled ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className={p.enabled ? '' : 'opacity-40'}>{p.name}</span>
                    </div>
                  ))}
                </>
              ) : null}

              {Array.isArray(focusedPreset.regexScripts) && focusedPreset.regexScripts.length > 0 ? (
                <>
                  <p className="mb-1.5 mt-3 text-[9.5px] font-bold uppercase tracking-[0.08em] opacity-50">正则脚本</p>
                  {focusedPreset.regexScripts.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 py-1.5 text-xs"
                      style={{ borderBottom: '1px solid var(--divider)' }}
                    >
                      <span
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded"
                        style={{
                          border: '1.4px solid var(--text-muted)',
                          borderColor: r.enabled ? 'var(--accent-color)' : 'var(--text-muted)',
                          backgroundColor: r.enabled ? 'var(--accent-color)' : 'transparent',
                          color: 'var(--accent-foreground)',
                        }}
                      >
                        {r.enabled ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className={r.enabled ? '' : 'opacity-40'}>{r.name}</span>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}

          <div className="px-5 pb-4 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              className="w-full rounded-full py-3 text-xs font-bold"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              + 新建预设
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RpPresetManager;