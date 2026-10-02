import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import { compressImageFile } from '../../../utils/imageHelper';
import { upsertBackgroundImageDeclaration } from '../chatButtonDecorations';

const COMMIT_DELAY_MS = 600;

/*
 * 一行「名称 + 上传贴图小助手 + 自由 CSS 文本框」。
 *
 * 跟 ColorSettingRow 是同一套"本地先改，停手/离焦才真正保存"的节流
 * 思路：打字时只改本地 draft，停手 600ms 或失焦才调用 onCommit；
 * 上传图片是一次性动作，压缩完立刻提交，不用等节流。
 *
 * value 是一段纯 CSS 声明文字（不带 selector），具体包进哪个按钮的
 * selector 由 ChatRoom.jsx 的 decorationStyle 负责，这里完全不关心。
 */
export const ButtonDecorationRow = ({ label, value, onCommit }) => {
  const [draft, setDraft] = useState(value || '');
  const [isUploading, setIsUploading] = useState(false);
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const onCommitRef = useRef(onCommit);
  const fileInputRef = useRef(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // 外部值变化时同步显示；但用户正在打字、还没保存时不覆盖
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

  // 关闭设置框时，把还没来得及保存的文字补存
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

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);

    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 200,
        maxHeight: 200,
        quality: 0.85,
      });

      const next = upsertBackgroundImageDeclaration(draft, compressed);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;

      setDraft(next);
      onCommitRef.current?.(next);
    } catch (error) {
      console.error('[ButtonDecorationRow] 贴图压缩失败：', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px]">{label}</span>

        <button
          type="button"
          onClick={handlePickImage}
          disabled={isUploading}
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] opacity-80 transition-opacity hover:opacity-100 disabled:opacity-40"
          style={{ background: 'var(--control-soft-bg)' }}
        >
          <Upload className="h-3 w-3" />
          {isUploading ? '压缩中…' : '上传贴图'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
      </div>

      <textarea
        value={draft}
        onChange={handleChange}
        onBlur={flush}
        placeholder="写 CSS 声明，比如：background: pink; border-radius: 999px; 也可以点上面「上传贴图」直接生成 background-image。"
        rows={3}
        className="w-full resize-none rounded-xl border px-2.5 py-2 text-[10.5px] font-mono leading-relaxed"
        style={{
          borderColor: 'var(--card-border)',
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
        }}
      />
    </div>
  );
};

export default ButtonDecorationRow;