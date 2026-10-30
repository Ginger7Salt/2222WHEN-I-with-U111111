import { describeMelody } from './harpDescribe';
import {
  HARP_NOTES,
  MAX_MELODY_NOTES,
  MIN_PHRASE_NOTES,
} from './harpNotes';
import { normalizeTimbreId } from './harpTimbres';

// ============================================================
// 星光小竖琴 —— 角色主动弹给用户听的标签解析（纯函数）。
//
// 标签格式（跟 aiService.js 里其它括号标签同一个约定）：
//   [HARP: 旋律名 | 简谱 | 节奏(可选) | 音色(可选)]
//   简谱：用空格隔开的 1 2 3 5 6，高八度前面加 ^，例如 "3 5 5 6 ^1 6 5"
//   节奏：轻快 / 适中 / 舒缓，不写就是适中
//   音色：竖琴 / 八音盒 / 拨弦（见 harpTimbres.js），不写就是经典竖琴
//   节奏和音色是两个可选段，顺序不严格：后面的段落认出是节奏词就当节奏、
//   认出是音色名就当音色，两个都认不出的忽略，所以只写音色不写节奏也行。
//
// 解析失败（不到 3 个有效音）返回 null，调用方直接不产出卡片。
// ============================================================

// 简谱数字 -> 音符编号（5 音阶，低八度 0-4，高八度 5-9）
const JIANPU_TO_INDEX = { 1: 0, 2: 1, 3: 2, 5: 3, 6: 4 };

const TEMPO_GAP_MS = { 轻快: 280, 适中: 520, 舒缓: 900 };

export const parseHarpTagPayload = (rawPayload) => {
  const parts = String(rawPayload || '').split('|');
  const name = (parts[0] || '').trim().slice(0, 14) || '无名旋律';
  const scoreText = (parts[1] || '').trim();
  let gap = TEMPO_GAP_MS.适中;
  let timbre = null;
  parts.slice(2).forEach((rawPart) => {
    const word = String(rawPart || '').trim();
    if (!word) return;
    if (TEMPO_GAP_MS[word]) gap = TEMPO_GAP_MS[word];
    else if (!timbre) timbre = normalizeTimbreId(word);
  });

  const notes = [];
  scoreText
    .replace(/[↑^]\s*/g, ' ^')
    .split(/[\s,，、-]+/)
    .filter(Boolean)
    .forEach((token) => {
      if (notes.length >= MAX_MELODY_NOTES) return;
      const high = token.startsWith('^');
      const digit = high ? token.slice(1) : token;
      const base = JIANPU_TO_INDEX[digit];
      if (base === undefined) return;
      const index = high ? base + 5 : base;
      if (index < HARP_NOTES.length) notes.push(index);
    });

  if (notes.length < MIN_PHRASE_NOTES) return null;

  // 稍微错开一点点，别太机械
  const delays = notes.map((_, k) => (k === 0 ? 0 : gap + ((k * 37) % 60) - 30));

  return {
    name,
    notes,
    delays,
    // 认不出音色（或没写）就是 null，调用方不写这个字段，重听时就是经典竖琴
    timbre,
    content: `弹了一段旋律「${name}」：${describeMelody({ notes, delays, timbre })}`,
  };
};