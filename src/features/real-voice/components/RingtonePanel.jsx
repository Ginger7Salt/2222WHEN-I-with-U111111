import React, { useRef, useState } from 'react';
import { Music, Pause, Play, Trash2, Upload } from 'lucide-react';

import GlassCard from '../../../components/GlassCard';

// 跟角色头像一模一样的存法：读成 base64 data URI 直接存进角色记录里的
// ringtone 字段，不用 Blob、不用新表，也不用担心 object URL 什么时候
// 该 revoke。没设置就用 ringtoneService.js 里合成的默认电话铃声。
export default function RingtonePanel({ value, onChange }) {
  const fileInputRef = useRef(null);
  const previewAudioRef = useRef(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      onChange(reader.result);
    };

    reader.readAsDataURL(file);

    // 允许连续两次选同一个文件也能触发 onChange。
    event.target.value = '';
  };

  const handleTogglePreview = () => {
    if (!value) return;

    if (isPreviewing) {
      previewAudioRef.current?.pause();
      return;
    }

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(value);
      previewAudioRef.current.addEventListener('ended', () => setIsPreviewing(false));
      previewAudioRef.current.addEventListener('pause', () => setIsPreviewing(false));
    }

    previewAudioRef.current.src = value;
    previewAudioRef.current.play().catch(() => {});
    setIsPreviewing(true);
  };

  const handleRemove = () => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setIsPreviewing(false);
    onChange('');
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 font-medium active:scale-95 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{value ? '更换铃声' : '上传铃声'}</span>
        </button>

        {value && (
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
    </GlassCard>
  );
}