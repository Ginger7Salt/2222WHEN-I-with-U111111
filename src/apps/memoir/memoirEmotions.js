// src/apps/memoir/memoirEmotions.js
//
// 回忆录的 7 种基础情绪标签 + 卡片配色。
// 颜色用半透明色叠在卡片背景上（不依赖某一套主题变量），保证 4 套主题下
// 都能看清、且互相之间足够区分。

export const MEMOIR_EMOTIONS = [
  {
    id: 'warm',
    label: '温暖',
    bg: 'rgba(244, 162, 97, 0.16)',
    border: 'rgba(244, 162, 97, 0.45)',
    dot: '#f4a261',
  },
  {
    id: 'touched',
    label: '感动',
    bg: 'rgba(231, 111, 81, 0.16)',
    border: 'rgba(231, 111, 81, 0.45)',
    dot: '#e76f51',
  },
  {
    id: 'happy',
    label: '开心',
    bg: 'rgba(233, 196, 106, 0.18)',
    border: 'rgba(233, 196, 106, 0.5)',
    dot: '#e9c46a',
  },
  {
    id: 'shy',
    label: '害羞',
    bg: 'rgba(244, 180, 196, 0.18)',
    border: 'rgba(244, 180, 196, 0.5)',
    dot: '#f4b4c4',
  },
  {
    id: 'sorry',
    label: '抱歉',
    bg: 'rgba(148, 163, 184, 0.18)',
    border: 'rgba(148, 163, 184, 0.45)',
    dot: '#94a3b8',
  },
  {
    id: 'worried',
    label: '担心',
    bg: 'rgba(129, 178, 154, 0.18)',
    border: 'rgba(129, 178, 154, 0.45)',
    dot: '#81b29a',
  },
  {
    id: 'excited',
    label: '雀跃',
    bg: 'rgba(106, 176, 224, 0.18)',
    border: 'rgba(106, 176, 224, 0.5)',
    dot: '#6ab0e0',
  },
];

const EMOTION_BY_ID = new Map(MEMOIR_EMOTIONS.map((item) => [item.id, item]));

// 供隐藏 tag 解析用：AI 直接写中文标签名（"温暖"/"感动"/...），
// 这里负责把标签名换回内部 id。
export const MEMOIR_EMOTION_LABEL_TO_ID = new Map(
  MEMOIR_EMOTIONS.map((item) => [item.label, item.id]),
);

export const isValidMemoirEmotion = (id) => EMOTION_BY_ID.has(id);

export const getMemoirEmotion = (id) => EMOTION_BY_ID.get(id) || null;