// src/apps/hub/widgets/MusicCardConfigStep.jsx
//
// "装饰音乐卡片"小组件的编辑表单：纯展示用途，用户自己填标题、
// 艺人、封面图和时间文案，不接真实的音乐播放。新增和之后重新编辑
// 复用同一份表单，靠 initialConfig 预填当前内容。
//
// 封面图上传复用项目里现成的 ImageUploader（内部已经做好压缩），
// 不重新写一遍 FileReader 样板代码。

import React, { useState } from 'react';
import ImageUploader from '../../../components/ImageUploader';

const inputStyle = {
  backgroundColor: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const DEFAULT_CONFIG = {
  coverImage: '',
  title: '',
  artist: '',
  elapsedLabel: '0:01',
  remainingLabel: '-2:56',
};

export const MusicCardConfigStep = ({ initialConfig, onConfirm, onCancel }) => {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, ...initialConfig });

  const updateField = (field) => (event) =>
    setConfig((current) => ({ ...current, [field]: event.target.value }));

  const canConfirm = Boolean(config.title.trim());

  return (
    <div className="space-y-3 text-left text-xs">
      <ImageUploader
        label={config.coverImage ? '重新选择封面图' : '选择封面图'}
        compressOptions={{
          maxWidth: 400,
          maxHeight: 400,
          quality: 0.75,
          outputType: 'base64',
        }}
        onCompressedImage={(data) =>
          setConfig((current) => ({ ...current, coverImage: data }))
        }
      />

      {config.coverImage && (
        <img
          src={config.coverImage}
          alt="封面预览"
          className="h-16 w-16 rounded-xl object-cover"
        />
      )}

      <label className="block space-y-1.5">
        <span className="opacity-60">歌曲标题</span>
        <input
          type="text"
          value={config.title}
          onChange={updateField('title')}
          placeholder="比如：Fame"
          className="w-full rounded-lg border px-3 py-2 text-xs"
          style={inputStyle}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="opacity-60">艺人/描述</span>
        <input
          type="text"
          value={config.artist}
          onChange={updateField('artist')}
          placeholder="比如：RIIZE · Video display"
          className="w-full rounded-lg border px-3 py-2 text-xs"
          style={inputStyle}
        />
      </label>

      <div className="flex gap-2">
        <label className="block flex-1 space-y-1.5">
          <span className="opacity-60">已播放时长文案</span>
          <input
            type="text"
            value={config.elapsedLabel}
            onChange={updateField('elapsedLabel')}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={inputStyle}
          />
        </label>
        <label className="block flex-1 space-y-1.5">
          <span className="opacity-60">剩余时长文案</span>
          <input
            type="text"
            value={config.remainingLabel}
            onChange={updateField('remainingLabel')}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={inputStyle}
          />
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border py-2 text-center opacity-80"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)',
          }}
        >
          取消
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm(config)}
          className="flex-1 rounded-xl py-2 text-center font-semibold disabled:opacity-40"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
};

export default MusicCardConfigStep;