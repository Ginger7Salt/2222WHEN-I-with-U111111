// src/apps/messages/components/bubbleAnimations.js
//
// 气泡"进场动画"：存在 chats 表的 bubbleAnimation 字段（不建索引，不需要升级
// 数据库版本）。设置页（BubbleCustomizer.jsx）和角色自主换风格
// （bubbleStyleDirective.js）都从这里读同一份名单。
//
// 触发方式沿用 specialMessageEffects.js 的"刚到的消息才播"约定：MessageRow.jsx
// 只负责在刚到达（RECENT_MESSAGE_EFFECT_WINDOW_MS 内）的气泡上加一个
// `bubble-fresh` 类，这里生成的 CSS 只作用在带这个类的气泡上；翻旧消息历史
// 的气泡没有这个类，不会播。选了"无动画"时 buildBubbleAnimationCss 返回空
// 字符串，聊天窗里完全没有任何动画规则。
//
// 动画全部用 animation-fill-mode: backwards：只在开始前把气泡摆在 0% 状态，
// 播完之后立刻释放，不会把 transform/max-height 永久钉在气泡上。

export const BUBBLE_ANIMATIONS = [
  { id: 'none', name: '无动画' },
  { id: 'slide', name: '滑入' },
  { id: 'typing', name: '打字展开' },
  { id: 'jelly', name: '果冻回弹' },
];

export const DEFAULT_BUBBLE_ANIMATION_ID = 'none';

export const findBubbleAnimationById = (animationId) => (
  BUBBLE_ANIMATIONS.find((animation) => animation.id === animationId) || null
);

const buildAnimationRules = (animationId, scope) => {
  const ai = `${scope} .ai-bubble.bubble-fresh`;
  const user = `${scope} .user-bubble.bubble-fresh`;

  switch (animationId) {
    case 'slide':
      return [
        '@keyframes chatBubbleSlideInAi { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: translateX(0); } }',
        '@keyframes chatBubbleSlideInUser { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: translateX(0); } }',
        `${ai} { animation: chatBubbleSlideInAi 0.45s ease-out backwards; }`,
        `${user} { animation: chatBubbleSlideInUser 0.45s ease-out backwards; }`,
      ];

    case 'jelly':
      return [
        '@keyframes chatBubbleJelly { 0% { opacity: 0; transform: scale(0.4); } 40% { opacity: 1; transform: scale(1.16, 0.84); } 62% { transform: scale(0.94, 1.08); } 82% { transform: scale(1.04, 0.97); } 100% { transform: scale(1); } }',
        `${ai} { transform-origin: bottom left; animation: chatBubbleJelly 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) backwards; }`,
        `${user} { transform-origin: bottom right; animation: chatBubbleJelly 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) backwards; }`,
      ];

    case 'typing':
      // 打字展开只对角色（.ai-bubble）有意义：先是一个压扁的小气泡里三个点在
      // 跳，约 0.65 秒后展开成完整气泡，文字再淡入。用户自己发的气泡退回成
      // 轻弹（chatBubblePop），避免自己发的消息也要等一下。
      // 压扁靠 max-height + overflow:hidden，只在动画期间生效（fill-mode 是
      // backwards，播完恢复原样），所以不会永久裁掉装饰图标。
      return [
        '@keyframes chatBubbleTypingGrow { 0% { opacity: 0; transform: scale(0.92); max-height: 2.6rem; overflow: hidden; } 12% { opacity: 1; transform: scale(1); max-height: 2.6rem; overflow: hidden; } 62% { max-height: 2.6rem; overflow: hidden; } 100% { max-height: 120rem; overflow: hidden; } }',
        '@keyframes chatBubbleTypingContent { 0%, 62% { opacity: 0; } 100% { opacity: 1; } }',
        '@keyframes chatBubbleTypingDots { 0% { opacity: 0; } 10%, 56% { opacity: 1; } 62%, 100% { opacity: 0; } }',
        '@keyframes chatBubbleTypingDotsBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }',
        '@keyframes chatBubblePop { 0% { opacity: 0; transform: scale(0.35); } 62% { opacity: 1; transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }',
        `${ai} { animation: chatBubbleTypingGrow 1.05s ease backwards; }`,
        `${ai} > *:not(.bubble-decoration-overlay) { animation: chatBubbleTypingContent 1.05s linear backwards; }`,
        `${ai}::after { content: ''; position: absolute; left: 50%; top: 50%; width: 30px; height: 6px; margin: -3px 0 0 -15px; background: radial-gradient(circle, currentColor 0, currentColor 2.4px, transparent 2.6px) 0 50% / 10px 6px repeat-x; opacity: 0; pointer-events: none; animation: chatBubbleTypingDots 1.05s linear, chatBubbleTypingDotsBob 0.35s ease-in-out 3; }`,
        `${user} { transform-origin: bottom right; animation: chatBubblePop 0.5s cubic-bezier(0.33, 1.4, 0.6, 1) backwards; }`,
      ];

    default:
      return [];
  }
};

// scope：聊天窗传 '.chat-room-container'，设置页预览传 '.preview-scope'。
// 'none' 和未知 id 返回空字符串。
export const buildBubbleAnimationCss = (animationId, scope = '.chat-room-container') => {
  const rules = buildAnimationRules(animationId, scope);
  if (rules.length === 0) return '';

  return [
    ...rules,
    // 系统开了"减少动态效果"时全部关掉；打字展开的点点本来默认 opacity:0，
    // 关掉动画后自然不可见，文字也直接是完整显示的。
    `@media (prefers-reduced-motion: reduce) { ${scope} .bubble-fresh, ${scope} .bubble-fresh::after, ${scope} .bubble-fresh > * { animation: none !important; } }`,
  ].join('\n');
};