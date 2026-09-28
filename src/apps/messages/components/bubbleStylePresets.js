// src/apps/messages/components/bubbleStylePresets.js
//
// 气泡配色预设的唯一数据源，2026-09 从 BubbleCustomizer.jsx 里抽出来。
//
// 背景（对应待办 3）：AI 要能"自主决定"切换气泡配色 + 装饰，判断标签里
// 写的预设名是否合法时，需要跟设置页 UI 读同一份预设列表，不能两份
// 数据各自维护、改一个忘了改另一个。所以把原来写死在 BubbleCustomizer
// 组件里的 `presets` 数组原样搬到这里，BubbleCustomizer.jsx 和
// bubbleStyleDirective.js 都从这里 import。
//
// 每一项 { name, code } 的 code 是一段作用域 CSS（会被套进
// `.preview-scope ${code}` 或聊天窗的自定义样式容器里），分别定义
// `.user-bubble` / `.ai-bubble` / `.chat-font` 三个选择器。

export const BUBBLE_STYLE_PRESETS = [
  {
    name: '白雾极简',
    code: `/* 白雾极简 */
.user-bubble {
  background: var(--accent-color);
  color: var(--accent-foreground);
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
}
.ai-bubble {
  background: var(--control-soft-bg);
  color: var(--text-main);
  border: 1px solid var(--divider);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '暮色甜梦',
    code: `/* 暮色甜梦 */
.user-bubble {
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  color: #2a1b40;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  font-weight: 500;
}
.ai-bubble {
  background: rgba(251, 194, 235, 0.15);
  color: var(--text-main);
  border: 1px solid rgba(161, 140, 209, 0.3);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '奶油拿铁',
    code: `/* 奶油拿铁 */
.user-bubble {
  background: #4c352a;
  color: #fffaf5;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
}
.ai-bubble {
  background: #f7f0e7;
  color: #2d211c;
  border: 1px solid rgba(76, 54, 39, 0.15);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '赛博夜色',
    code: `/* 赛博夜色 */
.user-bubble {
  background: #00f2fe;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #051329;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  font-weight: 600;
}
.ai-bubble {
  background: rgba(79, 172, 254, 0.1);
  color: var(--text-main);
  border: 1px solid rgba(0, 242, 254, 0.3);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '复古衬线',
    code: `/* 复古衬线 */
.user-bubble {
  background: var(--text-main);
  color: var(--bg-main);
  border-radius: 1rem 1rem 0.2rem 1rem;
  font-family: Georgia, serif;
}
.ai-bubble {
  background: var(--control-soft-bg);
  color: var(--text-main);
  border: 1px italic var(--divider);
  border-radius: 1rem 1rem 1rem 0.2rem;
  font-family: Georgia, serif;
}
.chat-font { font-size: 0.8rem; line-height: 1.6; }`
  },
  {
    name: '毛玻璃质感',
    code: `/* 毛玻璃质感 */
.user-bubble {
  background: rgba(255, 255, 255, 0.18);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.ai-bubble {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '液态玻璃',
    code: `/* 液态玻璃 Liquid Glass */
.user-bubble {
  background: linear-gradient(135deg, rgba(120, 190, 255, 0.35), rgba(200, 160, 255, 0.28));
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 1.5rem 1.5rem 0.3rem 1.5rem;
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 8px 24px rgba(80, 120, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.6), inset 0 -6px 12px rgba(255, 255, 255, 0.08);
}
.ai-bubble {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08));
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 1.5rem 1.5rem 1.5rem 0.3rem;
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.45);
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '极光波光',
    code: `/* 极光波光 */
.user-bubble {
  background: linear-gradient(120deg, rgba(0, 255, 200, 0.3), rgba(120, 100, 255, 0.35), rgba(255, 100, 200, 0.25));
  background-size: 220% 220%;
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 1.4rem 1.4rem 0.25rem 1.4rem;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 6px 20px rgba(80, 60, 200, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.ai-bubble {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 1.4rem 1.4rem 1.4rem 0.25rem;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '薰衣草雾',
    code: `/* 薰衣草雾 */
.user-bubble {
  background: linear-gradient(135deg, #c9b6e4 0%, #9d8ec9 100%);
  color: #2c2140;
  border-radius: 1.3rem 1.3rem 0.3rem 1.3rem;
}
.ai-bubble {
  background: #f3effa;
  color: #453a5c;
  border: 1px solid rgba(157, 142, 201, 0.35);
  border-radius: 1.3rem 1.3rem 1.3rem 0.3rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '森野绿洲',
    code: `/* 森野绿洲 */
.user-bubble {
  background: #2f5c46;
  color: #eafff0;
  border-radius: 1.1rem 1.1rem 0.25rem 1.1rem;
}
.ai-bubble {
  background: #eef7ef;
  color: #24402f;
  border: 1px solid rgba(47, 92, 70, 0.25);
  border-radius: 1.1rem 1.1rem 1.1rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '落日橘暮',
    code: `/* 落日橘暮 */
.user-bubble {
  background: linear-gradient(135deg, #ff9a5a 0%, #ff5e7e 100%);
  color: #3a0f0f;
  border-radius: 1.4rem 1.4rem 0.25rem 1.4rem;
  font-weight: 500;
}
.ai-bubble {
  background: rgba(255, 154, 90, 0.12);
  color: var(--text-main);
  border: 1px solid rgba(255, 94, 126, 0.3);
  border-radius: 1.4rem 1.4rem 1.4rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '墨黑高对比',
    code: `/* 墨黑高对比 */
.user-bubble {
  background: #0a0a0a;
  color: #ffffff;
  border-radius: 0.5rem 0.5rem 0.1rem 0.5rem;
  font-weight: 500;
}
.ai-bubble {
  background: #ffffff;
  color: #0a0a0a;
  border: 1.5px solid #0a0a0a;
  border-radius: 0.5rem 0.5rem 0.5rem 0.1rem;
  font-weight: 500;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '樱语粉调',
    code: `/* 樱语粉调 */
.user-bubble {
  background: #ffd6e7;
  color: #7a2e4d;
  border-radius: 1.5rem 1.5rem 0.3rem 1.5rem;
}
.ai-bubble {
  background: #fff6f9;
  color: #7a2e4d;
  border: 1px solid rgba(255, 214, 231, 0.9);
  border-radius: 1.5rem 1.5rem 1.5rem 0.3rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  }
];

export default BUBBLE_STYLE_PRESETS;