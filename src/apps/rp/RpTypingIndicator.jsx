// src/apps/rp/RpTypingIndicator.jsx
//
// RP模式专属的"正在生成回复"指示器——跟用户确认过要换掉之前复用的
// src/apps/messages/components/TypingIndicator.jsx（那是给主聊天室做的
// 通用组件，风格照着"手机聊天软件"那一路设计，跟RP这边"小说卡片+衬线
// 正文+故事感"的调性不搭）。
//
// 先做了两版HTML内联CSS预览给用户挑（羽毛笔墨迹弥散 / 吃豆人），用户选了
// 羽毛笔这版，这个文件就是把那版预览原样搬成真实React组件：
// - 卡片背后一团柔光在缓慢呼吸漂移（不是单一个发光点，参照用户反馈"不要
//   只是有一个发光的东西"）；
// - 前景一支轻轻晃动的羽毛笔图标（lucide-react 的 Feather），旁边几个墨点
//   依次"从模糊中聚焦、又晕开消散"，模拟墨迹弥散的感觉；
// - 配文用衬线斜体，跟"衬线古典"卡片预设（rpCardStylePresets.js）的故事感
//   保持一路，不是随预设切换的（这个指示器本身的字体是固定的斜体装饰文字，
//   不是正文，不需要跟着用户选的卡片预设变）。
//
// 颜色全部走主题CSS变量（--accent-color/--bg-blob-1/--card-bg等），不是
// 预览稿里写死的十六进制色值，这样才能跟着用户当前选的主题走。
// 保留 customText 这个可选prop（RpRoom.jsx 传"XX 正在书写这一段..."），
// 没传时退回一句通用文案。

import React from 'react';
import { Feather } from 'lucide-react';

const RpTypingIndicator = ({ customText = '' }) => {
  const text = customText || '正在书写这一段...';

  return (
    <div className="rp-typing-wrap">
      <div className="rp-typing-halo" />

      <div className="rp-typing-card">
        <Feather className="rp-typing-quill" />

        <div className="rp-typing-ink">
          <span className="rp-typing-ink-dot" />
          <span className="rp-typing-ink-dot" />
          <span className="rp-typing-ink-dot" />
          <span className="rp-typing-ink-dot" />
          <span className="rp-typing-ink-dot" />
        </div>
      </div>

      <p className="rp-typing-caption">{text}</p>

      <style>{`
        .rp-typing-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 200px;
          padding-top: 28px;
        }

        .rp-typing-halo {
          position: absolute;
          top: 0;
          left: 50%;
          width: 180px;
          height: 80px;
          transform: translateX(-50%);
          border-radius: 999px;
          background:
            radial-gradient(circle at 32% 40%, color-mix(in srgb, var(--accent-color) 55%, transparent) 0%, transparent 60%),
            radial-gradient(circle at 68% 60%, color-mix(in srgb, var(--bg-blob-2, var(--accent-color)) 45%, transparent) 0%, transparent 55%);
          filter: blur(20px);
          opacity: 0.7;
          animation: rpTypingHaloDrift 5s ease-in-out infinite;
          pointer-events: none;
        }

        .rp-typing-card {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 18px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--card-bg) 80%, transparent);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid var(--card-border);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
        }

        .rp-typing-quill {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          color: var(--text-main);
          opacity: 0.75;
          transform-origin: 80% 80%;
          animation: rpTypingQuillWrite 1.8s ease-in-out infinite;
        }

        .rp-typing-ink {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 14px;
        }

        .rp-typing-ink-dot {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: var(--text-main);
          opacity: 0;
          animation: rpTypingInkDiffuse 1.8s ease-in-out infinite;
        }

        .rp-typing-ink-dot:nth-child(1) { animation-delay: 0s; }
        .rp-typing-ink-dot:nth-child(2) { animation-delay: 0.2s; }
        .rp-typing-ink-dot:nth-child(3) { animation-delay: 0.4s; }
        .rp-typing-ink-dot:nth-child(4) { animation-delay: 0.6s; }
        .rp-typing-ink-dot:nth-child(5) { animation-delay: 0.8s; }

        .rp-typing-caption {
          position: relative;
          z-index: 1;
          margin: 10px 0 0;
          font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
          font-style: italic;
          font-size: 10.5px;
          color: var(--text-sub);
          text-align: center;
        }

        @keyframes rpTypingHaloDrift {
          0%, 100% { transform: translateX(-50%) scale(1) translateY(0); opacity: 0.55; }
          50% { transform: translateX(-50%) scale(1.18) translateY(-4px); opacity: 0.85; }
        }

        @keyframes rpTypingQuillWrite {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50% { transform: rotate(4deg) translateY(-1px); }
        }

        @keyframes rpTypingInkDiffuse {
          0% { opacity: 0; filter: blur(3px); transform: scale(0.4); }
          35% { opacity: 0.85; filter: blur(0px); transform: scale(1); }
          70% { opacity: 0.5; filter: blur(1px); transform: scale(1.15); }
          100% { opacity: 0; filter: blur(4px); transform: scale(0.6); }
        }

        @media (prefers-reduced-motion: reduce) {
          .rp-typing-halo,
          .rp-typing-quill,
          .rp-typing-ink-dot {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RpTypingIndicator;