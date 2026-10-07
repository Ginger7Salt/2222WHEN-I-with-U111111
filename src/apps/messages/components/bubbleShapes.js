// src/apps/messages/components/bubbleShapes.js
//
// 气泡"形状"：跟"配色"（bubbleStylePresets.js）和"装饰"（bubbleDecorations.jsx）
// 是第三个互相独立的开关，存在 chats 表的 bubbleShape 字段（不建索引，不需要
// 升级数据库版本）。设置页（BubbleCustomizer.jsx）和角色自主换风格
// （bubbleStyleDirective.js）都从这里读同一份名单，不各自维护。
//
// 为什么这一版只用 border-radius / border / box-shadow、不用 clip-path：
// 气泡角上的装饰图标是伸出气泡边缘的（bubbleDecorations.jsx 里 top:-9px /
// left:-4px），clip-path 会把伸出去的部分和阴影一起裁掉。所以斜切八角、
// 六边形这类必须靠 clip-path 的形状先不做。
//
// 选择器写成 `.user-bubble.chat-font`（三个类叠加）是为了盖过配色预设里的
// `.user-bubble { border-radius: ... }` 和 Tailwind 的 p-3，不依赖样式标签的
// 渲染先后顺序，也不需要 !important。

export const BUBBLE_SHAPES = [
  { id: 'none', name: '跟随配色' },
  { id: 'pill', name: '药丸胶囊' },
  { id: 'blob', name: '不规则水滴' },
  { id: 'panel', name: '像素直角' },
  { id: 'leaf', name: '对角叶片' },
  { id: 'rect', name: '方正便签' },
];

export const DEFAULT_BUBBLE_SHAPE_ID = 'none';

export const findBubbleShapeById = (shapeId) => (
  BUBBLE_SHAPES.find((shape) => shape.id === shapeId) || null
);

const buildShapeRules = (shapeId, scope) => {
  const both = `${scope} .user-bubble.chat-font, ${scope} .ai-bubble.chat-font`;
  const ai = `${scope} .ai-bubble.chat-font`;
  const user = `${scope} .user-bubble.chat-font`;

  switch (shapeId) {
    case 'pill':
      // 1.6rem 而不是 999px：单行时是胶囊，多行长消息时是大圆角矩形，
      // 不会因为半径随高度变大把文字挤出圆角外面。
      return [
        `${both} { border-radius: 1.6rem; padding-left: 1.1rem; padding-right: 1.1rem; }`,
      ];
    case 'blob':
      return [
        `${ai} { border-radius: 30px 38px 42px 16px / 34px 24px 40px 28px; }`,
        `${user} { border-radius: 38px 30px 16px 42px / 24px 34px 28px 40px; }`,
      ];
    case 'panel':
      return [
        `${both} { border-radius: 0; border: 1.5px solid currentColor; box-shadow: 3px 3px 0 currentColor; }`,
      ];
    case 'leaf':
      return [
        `${both} { border-radius: 1.6rem 0.3rem 1.6rem 0.3rem; }`,
      ];
    case 'rect':
      return [
        `${both} { border-radius: 0.45rem; }`,
      ];
    default:
      return [];
  }
};

// scope：聊天窗传 '.chat-room-container'，设置页预览传 '.preview-scope'。
// 'none'（跟随配色）和未知 id 返回空字符串，等于完全不覆盖配色预设自带的形状。
export const buildBubbleShapeCss = (shapeId, scope = '.chat-room-container') => (
  buildShapeRules(shapeId, scope).join('\n')
);