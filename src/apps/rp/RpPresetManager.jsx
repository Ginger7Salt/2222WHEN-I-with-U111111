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

import React, { useEffect, useState } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Download, Upload, Check,
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

const RpPresetManager = ({ currentPresetId, onClose, onSelectPreset }) => {
  const [presets, setPresets] = useState([]);
  const [editingPreset, setEditingPreset] = useState(null);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadPresets();
  }, []);

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

  const handleDelete = async (e, presetId) => {
    e.stopPropagation();
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-xs font-bold">选择预设</h3>
        <div className="w-4" />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            onClick={handleCreate}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <Plus className="h-3.5 w-3.5" /> 新建预设
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1 rounded-xl border px-3 text-xs font-semibold"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <Upload className="h-3.5 w-3.5" /> 导入
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
        </div>

        {presets.length === 0 ? (
          <p className="py-10 text-center text-xs opacity-50">还没有预设，先新建一个</p>
        ) : (
          presets.map((preset) => {
            const isCurrent = currentPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"
                style={{
                  borderColor: isCurrent ? 'var(--accent-color)' : 'var(--card-border)',
                  backgroundColor: 'var(--card-bg)',
                }}
              >
                {isCurrent && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-color)' }} />}
                <span className="flex-1 truncate text-xs font-semibold">{preset.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingPreset(preset); }}
                  className="text-[11px] opacity-60 hover:opacity-100"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, preset.id)}
                  className="text-red-500 opacity-60 hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RpPresetManager;