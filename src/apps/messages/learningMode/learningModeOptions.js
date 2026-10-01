// src/apps/messages/learningMode/learningModeOptions.js
//
// 语言学习模式的预设下拉选项：语言列表（角色回应语言 / 翻译目标语言
// 共用同一份，设置面板里各自独立选）和三档难度。纯数据，没有任何
// DB 访问或副作用，设置面板组件和 prompt 组装函数都从这里读。

export const LEARNING_MODE_LANGUAGES = [
  { id: 'zh-Hans', label: '中文（简体）' },
  { id: 'zh-Hant', label: '中文（繁体）' },
  { id: 'en', label: '英语' },
  { id: 'ja', label: '日语' },
  { id: 'ko', label: '韩语' },
  { id: 'fr', label: '法语' },
  { id: 'de', label: '德语' },
  { id: 'es', label: '西班牙语' },
  { id: 'it', label: '意大利语' },
  { id: 'ru', label: '俄语' },
  { id: 'pt', label: '葡萄牙语' },
  { id: 'th', label: '泰语' },
  { id: 'vi', label: '越南语' },
];

// 难度只控制用词难度（更基础 / 更丰富的词汇选择），不要求 AI 调整
// 句长或语法结构的复杂度——这是跟用户确认过的范围。
export const LEARNING_MODE_LEVELS = [
  {
    id: 'beginner',
    label: '初级',
    promptHint:
      '只使用最基础、最常见的词汇和最简单的说法，像是刚学这门语言几个月的人也能看懂，避免生僻词、俚语、成语和书面语。',
  },
  {
    id: 'intermediate',
    label: '中级',
    promptHint:
      '可以使用日常生活里常见但不算基础的词汇，偶尔出现不算生僻的表达，但依然避免过于书面、学术或罕见的词。',
  },
  {
    id: 'advanced',
    label: '高级',
    promptHint:
      '可以自由使用更丰富、地道的词汇，包括成语、俚语、书面语或专业词汇，不必刻意简化用词。',
  },
];

export const DEFAULT_LEARNING_LEVEL = 'beginner';