import React, { useState } from 'react';
import { X, Check, Code, Sparkles, Wand2, Gem } from 'lucide-react';
import { BUBBLE_DECORATION_LIST, BubbleDecorationOverlay } from './bubbleDecorations';
import { BUBBLE_STYLE_PRESETS } from './bubbleStylePresets';

export const BubbleCustomizer = ({
  currentCss = '',
  onSave,
  onClose,
  currentDecoration = 'none',
  onSaveDecoration,
}) => {
  // 预设数据源已经搬到 bubbleStylePresets.js（跟 AI 自主换气泡风格的
  // bubbleStyleDirective.js 共用同一份，避免两边各自维护一份列表）。
  const presets = BUBBLE_STYLE_PRESETS;

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