import FallingStarsEffect from './effects/FallingStarsEffect';
import FloatingHeartsEffect from './effects/FloatingHeartsEffect';
import ConfettiBurstEffect from './effects/ConfettiBurstEffect';

// 特殊消息效果规则表：按消息内容命中关键词，触发一个一次性的
// 小动效。做成表而不是写死的 if，方便以后继续往里加，只需要新增
// 一条规则，不用改调用方 MessageRow.jsx 的逻辑。
// 排在前面的规则优先命中，目前几条关键词互不重叠，顺序不敏感。
export const SPECIAL_MESSAGE_RULES = [
  {
    id: 'happy-birthday',
    test: (content) => /生日快乐/.test(String(content || '')),
    Effect: ConfettiBurstEffect,
  },
  {
    id: 'love-you',
    test: (content) => /爱你/.test(String(content || '')),
    Effect: FloatingHeartsEffect,
  },
  {
    id: 'miss-you',
    test: (content) => /想你/.test(String(content || '')),
    Effect: FallingStarsEffect,
  },
];

// 消息要多"新"才会播放特效：只对聊天窗打开期间刚刚到达的消息生效，
// 翻旧消息历史不会重播。
export const RECENT_MESSAGE_EFFECT_WINDOW_MS = 8000;

export const matchSpecialMessageEffect = (content) => (
  SPECIAL_MESSAGE_RULES.find((rule) => rule.test(content)) || null
);