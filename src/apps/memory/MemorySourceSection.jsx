import React, { useEffect, useState } from 'react';

import {
  DEFAULT_MEMORY_NOTE,
  MEMORY_SOURCE,
  getMemoryExternalNote,
  getMemorySource,
  resetMemoryExternalNote,
  setMemoryExternalNote,
  setMemorySource,
} from '../../services/memorySettingsService';

/**
 * 「记忆」App 顶部的记忆来源开关（#1 拆分记忆系统 阶段 2）。
 *
 * 全局一个开关，三选一：
 *   内置（默认）——由这个 App 整理和检索；
 *   外部（MCP）——角色自己调用你在 MCP 设置里接好并启用的记忆工具，
 *                本 App 不主动查询，只在提示词里给一段使用说明；
 *   关闭 ——两样都不做。
 *
 * 切走内置模式后，已有的内置记忆不会被删除，只是暂停整理和检索；
 * 随时可以切回来。
 */
export const MemorySourceSection = () => {
  const [source, setSourceState] = useState(MEMORY_SOURCE.BUILTIN);
  const [noteDraft, setNoteDraft] = useState(DEFAULT_MEMORY_NOTE);
  const [savedNote, setSavedNote] = useState(DEFAULT_MEMORY_NOTE);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [currentSource, currentNote] = await Promise.all([
        getMemorySource(),
        getMemoryExternalNote(),
      ]);

      if (cancelled) return;

      setSourceState(currentSource);
      setNoteDraft(currentNote);
      setSavedNote(currentNote);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (value) => {
    if (value === source || isBusy) return;

    setIsBusy(true);

    try {
      await setMemorySource(value);
      setSourceState(value);
    } finally {
      setIsBusy(false);
    }
  };

  const noteDirty = noteDraft !== savedNote;

  const handleSaveNote = async () => {
    if (isBusy || !noteDirty) return;

    setIsBusy(true);

    try {
      const saved = await setMemoryExternalNote(noteDraft);
      setNoteDraft(saved);
      setSavedNote(saved);
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetNote = async () => {
    if (isBusy) return;

    setIsBusy(true);

    try {
      const defaultText = await resetMemoryExternalNote();
      setNoteDraft(defaultText);
      setSavedNote(defaultText);
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const hint = {
    [MEMORY_SOURCE.BUILTIN]:
      '角色的记忆由这个 App 内置整理和检索，默认使用这个模式。',
    [MEMORY_SOURCE.EXTERNAL]:
      '当前使用外部记忆，内置记忆已暂停（已有记忆仍会保留，可在下面查看）。角色会自己调用你在 MCP 设置里接好并启用的记忆工具。',
    [MEMORY_SOURCE.OFF]:
      '记忆功能已关闭：角色不会再整理或查阅任何记忆（已有记忆仍会保留，可在下面查看）。',
  }[source];

  return (
    <section className="memory-chat-section">
      <div className="memory-section-label">
        <span>记忆来源</span>
        <span className="memory-section-line" />
      </div>

      <div className="flex gap-2 mt-3">
        {[
          { value: MEMORY_SOURCE.BUILTIN, label: '内置' },
          { value: MEMORY_SOURCE.EXTERNAL, label: '外部（MCP）' },
          { value: MEMORY_SOURCE.OFF, label: '关闭' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={isBusy}
            onClick={() => handleSelect(option.value)}
            className="flex-1 rounded-full border px-2 py-1.5 text-[11px] transition-colors"
            style={{
              borderColor:
                source === option.value
                  ? 'var(--accent-color)'
                  : 'var(--card-border)',
              background:
                source === option.value
                  ? 'var(--accent-color)'
                  : 'var(--card-bg)',
              color:
                source === option.value
                  ? 'var(--accent-foreground)'
                  : 'var(--text-main)',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p
        className="mt-2 text-[11px] leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {hint}
      </p>

      {source === MEMORY_SOURCE.EXTERNAL && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px]" style={{ color: 'var(--text-sub)' }}>
            记忆使用说明（会加进提示词，告诉角色怎么用你接好的记忆工具；
            只有确实启用了相关 MCP 工具时才会真正发送给角色）
          </p>

          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            rows={5}
            className="w-full rounded-xl border p-2 leading-relaxed"
            style={{
              background: 'var(--bg-main)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)',
              fontSize: '16px',
            }}
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleResetNote}
              className="rounded-full border px-3 py-1.5 text-[11px]"
              style={{
                borderColor: 'var(--card-border)',
                color: 'var(--text-sub)',
                background: 'var(--card-bg)',
              }}
            >
              恢复默认
            </button>

            <button
              type="button"
              disabled={isBusy || !noteDirty}
              onClick={handleSaveNote}
              className="rounded-full border px-3 py-1.5 text-[11px]"
              style={{
                borderColor: 'var(--card-border)',
                color: noteDirty
                  ? 'var(--accent-foreground)'
                  : 'var(--text-muted)',
                background: noteDirty
                  ? 'var(--accent-color)'
                  : 'var(--card-bg)',
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default MemorySourceSection;