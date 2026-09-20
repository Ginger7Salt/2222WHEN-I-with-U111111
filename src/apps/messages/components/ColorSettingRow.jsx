import React, { useEffect, useRef, useState } from 'react';

const COMMIT_DELAY_MS = 500;

/*
 * 一行"名称 + 取色器 + 恢复默认"。
 * 拖动取色器时只改本地显示，停手 500ms 后才调用 onCommit 保存，
 * 避免每一下都写数据库、刷新整个聊天页。
 * value 为空字符串表示"使用默认颜色"。
 */
export const ColorSettingRow = ({ label, value, onCommit }) => {
  const [draft, setDraft] = useState(value || '');
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // 外部值变化时同步显示；但用户正在拖动、还没保存时不覆盖
  useEffect(() => {
    if (pendingRef.current === null) {
      setDraft(value || '');
    }
  }, [value]);

  const flush = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pendingRef.current === null) return;

    const next = pendingRef.current;
    pendingRef.current = null;
    onCommitRef.current?.(next);
  };

  // 关闭设置框时，把还没来得及保存的颜色补存
  useEffect(() => () => flush(), []);

  const handleChange = (event) => {
    const next = event.target.value;

    setDraft(next);
    pendingRef.current = next;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(flush, COMMIT_DELAY_MS);
  };

  const handleReset = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    pendingRef.current = null;
    setDraft('');
    onCommitRef.current?.('');
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px]">{label}</span>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] opacity-55">
          {draft ? draft.toUpperCase() : '默认'}
        </span>

        <input
          type="color"
          value={draft || '#ffffff'}
          onChange={handleChange}
          aria-label={label}
          className="h-6 w-8 cursor-pointer rounded-md border p-0"
          style={{
            borderColor: 'var(--divider)',
            background: 'transparent',
          }}
        />

        {draft && (
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 text-[10px] text-red-500 hover:underline"
          >
            恢复默认
          </button>
        )}
      </div>
    </div>
  );
};

export default ColorSettingRow;