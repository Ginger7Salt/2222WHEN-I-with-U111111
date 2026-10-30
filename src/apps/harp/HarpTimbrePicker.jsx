import React, { useEffect, useRef } from 'react';

import { ensureHarpAudio, playHarpNote } from './harpAudio';
import { HARP_TIMBRES } from './harpTimbres';
import './harpTimbrePicker.css';

// ============================================================
// 星光小竖琴 —— 音色选择条（竖琴下面的一排小药丸）。
//
// 选中一个音色就立刻弹三个音试听（跟图像工作室"完成提醒"的音色选择同一个做法），
// 试听时直接把音色 id 传给 playHarpNote，不依赖"当前音色"有没有刚好更新。
// 选择本身存在哪里由父组件决定（HarpPage 存进 chat.harpTimbre）。
// 颜色全部取自 harp.css 里 .harp-page 上的 --hp-* 主题别名。
// ============================================================

const PREVIEW_NOTES = [2, 4, 7];
const PREVIEW_GAP_MS = 190;

const HarpTimbrePicker = ({ value, onChange, disabled = false }) => {
  const timersRef = useRef([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    },
    []
  );

  const preview = (id) => {
    if (!ensureHarpAudio()) return;
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = PREVIEW_NOTES.map((note, k) =>
      setTimeout(() => playHarpNote(note, id), k * PREVIEW_GAP_MS)
    );
  };

  const handleSelect = (id) => {
    if (disabled) return;
    preview(id);
    if (id !== value && onChange) onChange(id);
  };

  return (
    <div className="hp-timbre" role="radiogroup" aria-label="音色">
      <span className="hp-timbre-label">音色</span>
      <div className="hp-timbre-options">
        {HARP_TIMBRES.map((timbre) => {
          const active = timbre.id === value;
          return (
            <button
              key={timbre.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={timbre.hint}
              disabled={disabled}
              onClick={() => handleSelect(timbre.id)}
              className={`hp-timbre-option${active ? ' hp-timbre-option-active' : ''}`}
            >
              {timbre.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HarpTimbrePicker;