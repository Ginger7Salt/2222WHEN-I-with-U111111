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
  },
  // 2026-10 补充：用户反馈"装饰很多但气泡样式很少"，这批是纯新增
  // 预设，照抄上面每一项的既有写法（.user-bubble / .ai-bubble /
  // .chat-font 三选择器，尽量用主题变量兜底文字色），不改动任何
  // 既有预设、不碰 BubbleCustomizer.jsx / bubbleStyleDirective.js ——
  // 两边都是从这个数组动态读的，纯加数据就能让 AI 自主换风格的名单
  // 和设置页的快选栏同时变多。
  {
    name: '柠檬气泡水',
    code: `/* 柠檬气泡水 */
.user-bubble {
  background: linear-gradient(135deg, #fff066 0%, #c8f06b 100%);
  color: #3a3608;
  border-radius: 1.3rem 1.3rem 0.25rem 1.3rem;
  font-weight: 500;
}
.ai-bubble {
  background: rgba(255, 240, 102, 0.12);
  color: var(--text-main);
  border: 1px solid rgba(200, 240, 107, 0.4);
  border-radius: 1.3rem 1.3rem 1.3rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '雨后石板',
    code: `/* 雨后石板 */
.user-bubble {
  background: #4a5560;
  color: #eef3f6;
  border-radius: 0.6rem 0.6rem 0.15rem 0.6rem;
}
.ai-bubble {
  background: #e7ebee;
  color: #333c44;
  border: 1px solid rgba(74, 85, 96, 0.2);
  border-radius: 0.6rem 0.6rem 0.6rem 0.15rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '珊瑚浪尖',
    code: `/* 珊瑚浪尖 */
.user-bubble {
  background: linear-gradient(135deg, #ff7e6b 0%, #ffb199 100%);
  color: #3a1208;
  border-radius: 1.6rem 1.6rem 0.3rem 1.6rem;
  font-weight: 500;
}
.ai-bubble {
  background: rgba(255, 126, 107, 0.1);
  color: var(--text-main);
  border: 1px solid rgba(255, 177, 153, 0.35);
  border-radius: 1.6rem 1.6rem 1.6rem 0.3rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '深海夜潜',
    code: `/* 深海夜潜 */
.user-bubble {
  background: linear-gradient(135deg, #0d2b45 0%, #1a4a6e 100%);
  color: #bfe6ff;
  border-radius: 1rem 1rem 0.2rem 1rem;
}
.ai-bubble {
  background: rgba(26, 74, 110, 0.1);
  color: var(--text-main);
  border: 1px solid rgba(26, 74, 110, 0.35);
  border-radius: 1rem 1rem 1rem 0.2rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '手账便签',
    code: `/* 手账便签 */
.user-bubble {
  background: #fff9e6;
  color: #4a3f1f;
  border: 1px dashed #d9c27a;
  border-radius: 0.3rem;
  box-shadow: 2px 2px 0 rgba(217, 194, 122, 0.4);
  font-family: Georgia, serif;
}
.ai-bubble {
  background: #ffffff;
  color: #4a3f1f;
  border: 1px dashed #c9c0a8;
  border-radius: 0.3rem;
  box-shadow: 2px 2px 0 rgba(201, 192, 168, 0.35);
  font-family: Georgia, serif;
}
.chat-font { font-size: 0.78rem; line-height: 1.6; }`
  },
  {
    name: '荧光糖果',
    code: `/* 荧光糖果 */
.user-bubble {
  background: #ff2e9f;
  color: #fff;
  border-radius: 1.5rem 1.5rem 0.25rem 1.5rem;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(255, 46, 159, 0.45);
}
.ai-bubble {
  background: #141021;
  color: #7cffcb;
  border: 1px solid rgba(124, 255, 203, 0.4);
  border-radius: 1.5rem 1.5rem 1.5rem 0.25rem;
  box-shadow: 0 0 10px rgba(124, 255, 203, 0.25);
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '纸莎草米',
    code: `/* 纸莎草米 */
.user-bubble {
  background: #d8c7a1;
  color: #3e2f1c;
  border-radius: 0.4rem 0.4rem 0.1rem 0.4rem;
  font-family: Georgia, serif;
}
.ai-bubble {
  background: #f3ead8;
  color: #3e2f1c;
  border: 1px solid rgba(216, 199, 161, 0.6);
  border-radius: 0.4rem 0.4rem 0.4rem 0.1rem;
  font-family: Georgia, serif;
}
.chat-font { font-size: 0.78rem; line-height: 1.6; }`
  },
  {
    name: '极简线框',
    code: `/* 极简线框 */
.user-bubble {
  background: transparent;
  color: var(--text-main);
  border: 1.5px solid var(--text-main);
  border-radius: 0.5rem;
}
.ai-bubble {
  background: transparent;
  color: var(--text-main);
  border: 1.5px dashed var(--divider);
  border-radius: 0.5rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '熔岩暗夜',
    code: `/* 熔岩暗夜 */
.user-bubble {
  background: linear-gradient(135deg, #ff4e00 0%, #8e0e00 100%);
  color: #fff3e6;
  border-radius: 0.8rem 0.8rem 0.15rem 0.8rem;
  font-weight: 500;
}
.ai-bubble {
  background: #1a1a1a;
  color: #ffb088;
  border: 1px solid rgba(255, 78, 0, 0.3);
  border-radius: 0.8rem 0.8rem 0.8rem 0.15rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '薄荷冰沙',
    code: `/* 薄荷冰沙 */
.user-bubble {
  background: #a8e6cf;
  color: #1c4a37;
  border-radius: 1.3rem 1.3rem 0.25rem 1.3rem;
}
.ai-bubble {
  background: #eafaf4;
  color: #1c4a37;
  border: 1px solid rgba(168, 230, 207, 0.9);
  border-radius: 1.3rem 1.3rem 1.3rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '皇家丝绒',
    code: `/* 皇家丝绒 */
.user-bubble {
  background: linear-gradient(135deg, #3d1e6d 0%, #6a2c91 100%);
  color: #f3e6ff;
  border-radius: 1.2rem 1.2rem 0.2rem 1.2rem;
  font-weight: 500;
}
.ai-bubble {
  background: rgba(106, 44, 145, 0.08);
  color: var(--text-main);
  border: 1px solid rgba(106, 44, 145, 0.3);
  border-radius: 1.2rem 1.2rem 1.2rem 0.2rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '便利贴黄',
    code: `/* 便利贴黄 */
.user-bubble {
  background: #ffe066;
  color: #4a3b00;
  border-radius: 0.2rem;
  box-shadow: 3px 3px 6px rgba(0, 0, 0, 0.12);
  transform: rotate(-0.5deg);
}
.ai-bubble {
  background: #fff8d6;
  color: #4a3b00;
  border-radius: 0.2rem;
  box-shadow: 3px 3px 6px rgba(0, 0, 0, 0.08);
  transform: rotate(0.5deg);
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  },
  {
    name: '星海蓝调',
    code: `/* 星海蓝调 */
.user-bubble {
  background: radial-gradient(circle at 30% 20%, #4361ee 0%, #1b1f3b 70%);
  color: #e6ecff;
  border-radius: 1.3rem 1.3rem 0.25rem 1.3rem;
}
.ai-bubble {
  background: rgba(67, 97, 238, 0.08);
  color: var(--text-main);
  border: 1px solid rgba(67, 97, 238, 0.3);
  border-radius: 1.3rem 1.3rem 1.3rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
  }
];

export default BUBBLE_STYLE_PRESETS;