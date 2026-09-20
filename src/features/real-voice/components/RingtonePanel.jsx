import React, { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, Trash2, Upload } from 'lucide-react';

import GlassCard from '../../../components/GlassCard';

// 铃声存的是 Blob（{ audioBlob, mimeType, name }），不是 base64 字符串
// ——跟通话真人语音走的是同一个存法。角色记录在聊天列表、悬浮球等
// 好多地方都会整条被读出来，存 base64 会让这些用不到铃声的地方也
// 跟着搬一份几百 KB～几 MB 的字符串；存 Blob 之后，只有真正要播放
// （这里试听、或者来电时 ringtoneService.js 里）才用
// URL.createObjectURL 现读出来，读完就 revoke 掉。
export default function RingtonePanel({ value, onChange }) {
  const fileInputRef = useRef(null);
  const audioElRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // 换了一段新铃声，或者离开这个页面时，把上一段试听用的 object URL
  // 释放掉，不然每换一次铃声就泄漏一个 URL。
  useEffect(() => releaseObjectUrl, [value]);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onChange({
      audioBlob: file,
      mimeType: file.type || 'audio/mpeg',
      name: file.name || '',
    });

    // 允许连续两次选同一个文件也能触发 onChange。
    event.target.value = '';
  };

  const handleTogglePreview = () => {
    if (!value?.audioBlob) return;

    if (isPreviewing) {
      audioElRef.current?.pause();
      return;
    }

    releaseObjectUrl();
    objectUrlRef.current = URL.createObjectURL(value.audioBlob);

    if (!audioElRef.current) {
      audioElRef.current = new Audio();
      audioElRef.current.addEventListener('ended', () => setIsPreviewing(false));
      audioElRef.current.addEventListener('pause', () => setIsPreviewing(false));
    }

    audioElRef.current.src = objectUrlRef.current;
    audioElRef.current.play().catch(() => {});
    setIsPreviewing(true);
  };

  const handleRemove = () => {
    audioElRef.current?.pause();
    releaseObjectUrl();
    setIsPreviewing(false);
    onChange(null);
  };

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center gap-2 font-bold text-sm">
        <Music className="w-4 h-4" />
        <span>来电铃声 (Ringtone)</span>
      </div>

      <p className="opacity-60 text-[10px]">
        角色主动打电话过来时用这段铃声循环播放；不设置就用 App 自带的默认电话铃声。
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 font-medium active:scale-95 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{value ? '更换铃声' : '上传铃声'}</span>
        </button>

        {value?.audioBlob && (
          <>
            <button
              type="button"
              onClick={handleTogglePreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 font-medium active:scale-95 transition-all"
            >
              {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPreviewing ? '暂停' : '试听'}</span>
            </button>

            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 font-medium text-red-500 active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>恢复默认</span>
            </button>
          </>
        )}
      </div>

      {value?.name && (
        <p className="opacity-50 text-[10px] truncate">当前文件：{value.name}</p>
      )}
    </GlassCard>
  );
}