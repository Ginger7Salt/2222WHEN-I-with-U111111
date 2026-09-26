import React, { useState } from 'react';
import { X, Check, Code, Sparkles, Wand2, Gem } from 'lucide-react';
import { BUBBLE_DECORATION_LIST, BubbleDecorationOverlay } from './bubbleDecorations';

export const BubbleCustomizer = ({
  currentCss = '',
  onSave,
  onClose,
  currentDecoration = 'none',
  onSaveDecoration,
}) => {
  // 精致预设：保留原有 5 套，并新增毛玻璃 / 液态玻璃系列的美观预设
  const presets = [
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
    }
  ];

  const [customCss, setCustomCss] = useState(currentCss || presets[0].code);
  const [justAppliedName, setJustAppliedName] = useState('');
  const [decoration, setDecoration] = useState(currentDecoration || 'none');

  const handleSave = () => {
    onSave(customCss);
    onClose();
  };

  // 装饰和配色是两个独立开关：点击装饰选项立即生效并保存，
  // 不需要再点"保存规则"（配色那边点预设也是这个手感，保持一致）。
  const handlePickDecoration = (decorationId) => {
    setDecoration(decorationId);
    onSaveDecoration?.(decorationId);
  };

  // 点击预设：直接选中并立即保存生效，不需要再点"保存规则"。
  // 下方文本框仍然会同步显示这套预设的代码，方便在此基础上继续做自定义微调，
  // 微调后仍然需要点"保存规则"才会把改动保存下去。
  const handlePickPreset = (preset) => {
    setCustomCss(preset.code);
    onSave(preset.code);
    setJustAppliedName(preset.name);
    window.clearTimeout(handlePickPreset._t);
    handlePickPreset._t = window.setTimeout(() => setJustAppliedName(''), 1600);
  };

  const isPresetActive = (preset) => customCss === preset.code;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div 
        className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-3.5 shadow-2xl text-xs text-left z-10 overflow-hidden"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-1.5 font-bold">
            <Code className="w-4 h-4" />
            <span>自定义气泡 CSS</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 预设快速点击选择栏：点击即选中并立即保存生效 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
            <div className="flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-purple-400" />
              <span>QUICK PRESETS / 点击立即应用</span>
            </div>
            {justAppliedName && (
              <span className="flex items-center gap-1 opacity-90 normal-case" style={{ color: 'var(--accent-color)' }}>
                <Check className="w-3 h-3" />
                已应用「{justAppliedName}」
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, idx) => {
              const active = isPresetActive(p);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePickPreset(p)}
                  className="px-2.5 py-1 rounded-full border text-[10px] transition-all active:scale-95 hover:opacity-100 flex items-center gap-1"
                  style={{
                    background: active ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                    borderColor: active ? 'var(--accent-color)' : 'var(--card-border)',
                    color: active ? 'var(--accent-foreground)' : 'var(--text-main)'
                  }}
                >
                  {active && <Check className="w-3 h-3" />}
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 装饰选择栏：和上面的配色预设完全独立，任意配色都能搭任意装饰 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 font-mono text-[10px] opacity-60">
            <Gem className="w-3 h-3 text-purple-400" />
            <span>BUBBLE DECORATION / 气泡装饰（与配色独立）</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BUBBLE_DECORATION_LIST.map((d) => {
              const active = decoration === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handlePickDecoration(d.id)}
                  className="px-2.5 py-1 rounded-full border text-[10px] transition-all active:scale-95 hover:opacity-100 flex items-center gap-1"
                  style={{
                    background: active ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                    borderColor: active ? 'var(--accent-color)' : 'var(--card-border)',
                    color: active ? 'var(--accent-foreground)' : 'var(--text-main)'
                  }}
                >
                  {active && <Check className="w-3 h-3" />}
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* CSS 编辑框 */}
        <div className="space-y-1">
          <textarea
            rows={6}
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            placeholder="输入或修改 CSS 代码..."
            className="w-full rounded-xl p-2.5 font-mono text-[10.5px] outline-none resize-none transition-colors border"
            style={{
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              borderColor: 'var(--divider)'
            }}
          />
        </div>

        {/* 实时作用域注入预览 */}
        <div className="p-2.5 rounded-2xl space-y-1.5 border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}>
          <span className="block font-mono text-[9px] opacity-50 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> LIVE PREVIEW / 效果预览
          </span>
          <style>{`
            .preview-scope ${customCss}
          `}</style>
          <div className="preview-scope space-y-1.5 pt-0.5">
            <div className="relative user-bubble chat-font p-2 max-w-[85%] ml-auto text-right">
              <BubbleDecorationOverlay decoration={decoration} isUser />
              User 消息气泡预览
            </div>
            <div className="relative ai-bubble chat-font p-2 max-w-[85%] text-left">
              <BubbleDecorationOverlay decoration={decoration} isUser={false} />
              伴侣 消息气泡预览
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl font-semibold active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm"
          style={{
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)'
          }}
        >
          <Check className="w-4 h-4" />
          <span>保存规则</span>
        </button>
      </div>
    </div>
  );
};

export default BubbleCustomizer;