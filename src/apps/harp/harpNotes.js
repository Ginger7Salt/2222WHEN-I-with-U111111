// ============================================================
// 星光小竖琴 —— 音符与"一段旋律"的纯数据/纯函数（不碰数据库、不碰DOM）。
//
// 十根弦，C 大调五声音阶（1 2 3 5 6），上下两个八度：怎么划都不容易
// 弹出难听的音。index 0 是最长的低音弦（画面最左），index 9 是最短的
// 高音弦（画面最右）。弹奏记录、收藏、以后写回聊天的文字，都只存音符
// 编号和相邻音符的间隔，不存任何音频。
// ============================================================

export const HARP_NOTES = [
  { index: 0, freq: 523.25, label: '1', high: false },
  { index: 1, freq: 587.33, label: '2', high: false },
  { index: 2, freq: 659.25, label: '3', high: false },
  { index: 3, freq: 783.99, label: '5', high: false },
  { index: 4, freq: 880.0, label: '6', high: false },
  { index: 5, freq: 1046.5, label: '1', high: true },
  { index: 6, freq: 1174.66, label: '2', high: true },
  { index: 7, freq: 1318.51, label: '3', high: true },
  { index: 8, freq: 1567.98, label: '5', high: true },
  { index: 9, freq: 1760.0, label: '6', high: true },
];

export const HARP_STRING_COUNT = HARP_NOTES.length;

// 一段旋律最多记多少个音（防止有人一直划，存下来的数组无限长）。
export const MAX_MELODY_NOTES = 64;

// 停手多久算"一段弹完了"。
export const PHRASE_CLOSE_MS = 2600;

// 至少几个音才算一段（才能收藏）。
export const MIN_PHRASE_NOTES = 3;

// 相邻两个音之间的间隔，存库和重放时都限制在这个范围里，
// 太短听起来糊成一团，太长重放要等太久。
export const MIN_NOTE_GAP_MS = 160;
export const MAX_NOTE_GAP_MS = 1500;

export const clampNoteGap = (ms) =>
  Math.max(MIN_NOTE_GAP_MS, Math.min(MAX_NOTE_GAP_MS, Math.round(Number(ms) || 0)));

export const isValidNoteIndex = (value) =>
  Number.isInteger(value) && value >= 0 && value < HARP_STRING_COUNT;

// 简谱文字，高八度的音前面加 "↑"，例如 "3 5 5 6 ↑1 6 5"。
export const formatMelodyText = (notes) =>
  (Array.isArray(notes) ? notes : [])
    .filter(isValidNoteIndex)
    .map((index) => `${HARP_NOTES[index].high ? '↑' : ''}${HARP_NOTES[index].label}`)
    .join(' ');

// 把弹奏时记下的 [{ i, t }]（t 是毫秒时间戳）整理成存库用的
// { notes, delays }：delays[k] 是第 k 个音距离上一个音的间隔，第一个是 0。
export const buildMelodyFromPhrase = (phrase) => {
  const events = (Array.isArray(phrase) ? phrase : [])
    .filter((event) => event && isValidNoteIndex(event.i))
    .slice(0, MAX_MELODY_NOTES);

  return {
    notes: events.map((event) => event.i),
    delays: events.map((event, k) =>
      k === 0 ? 0 : clampNoteGap(event.t - events[k - 1].t)
    ),
  };
};
