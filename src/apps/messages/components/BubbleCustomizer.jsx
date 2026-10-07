import React, { useEffect, useState } from 'react';
import { X, Check, Code, Sparkles, Wand2, Gem, Square, Play } from 'lucide-react';
import { getSavedBubbleStyles, deleteSavedBubbleStyle } from '../bubbleCustomStyleService';
import { BUBBLE_DECORATION_LIST, BubbleDecorationOverlay } from './bubbleDecorations';
import { BUBBLE_STYLE_PRESETS } from './bubbleStylePresets';
import { BUBBLE_SHAPES, buildBubbleShapeCss } from './bubbleShapes';
import { BUBBLE_ANIMATIONS, buildBubbleAnimationCss } from './bubbleAnimations';

export const BubbleCustomizer = ({
  currentCss = '',
  onSave,
  onClose,
  currentDecoration = 'none',
  onSaveDecoration,
  // 形状 / 进场动画：不传对应的 onSave 回调时（比如泡泡模式的房间设置
  // 也在用这个弹窗）整块选择栏直接不显示，行为跟以前完全一样。
  currentShape = 'none',
  onSaveShape,
  currentAnimation = 'none',
  onSaveAnimation,
  // 角色自己写的样式：不传 onClearCharCss 时（泡泡模式的房间设置）整块
  // "我的样式库"不显示，行为跟以前完全一样。
  hasCharCss = false,
  charCssName = '',
  onClearCharCss,
}) => {
  // 预设数据源已经搬到 bubbleStylePresets.js（跟 AI 自主换气泡风格的
  // bubbleStyleDirective.js 共用同一份，避免两边各自维护一份列表）。
  const presets = BUBBLE_STYLE_PRESETS;

  const [customCss, setCustomCss] = useState(currentCss || presets[0].code);
  const [justAppliedName, setJustAppliedName] = useState('');
  const [decoration, setDecoration] = useState(currentDecoration || 'none');
  const [shape, setShape] = useState(currentShape || 'none');
  const [animation, setAnimation] = useState(currentAnimation || 'none');
  // 预览区的两个气泡靠换 key 重新挂载来"重播"进场动画。
  const [previewReplayKey, setPreviewReplayKey] = useState(0);
  // 用户在聊天卡片上点过"保存"的角色样式库（全局，所有聊天窗共用）。
  const [savedStyles, setSavedStyles] = useState([]);

  useEffect(() => {
    if (!onClearCharCss) return undefined;

    let cancelled = false;
    getSavedBubbleStyles().then((list) => {
      if (!cancelled) setSavedStyles(list);
    });

    return () => { cancelled = true; };
  }, [onClearCharCss]);

  // 点样式库里的一项：跟点配色预设一样直接当配色用，同时撤掉当前角色
  // 临时试用的那一层，免得盖在上面。
  const handlePickSavedStyle = (style) => {
    setCustomCss(style.css);
    onSave(style.css);
    onClearCharCss?.();
    setJustAppliedName(style.name);
    window.clearTimeout(handlePickPreset._t);
    handlePickPreset._t = window.setTimeout(() => setJustAppliedName(''), 1600);
  };

  const handleDeleteSavedStyle = async (styleId) => {
    await deleteSavedBubbleStyle(styleId);
    setSavedStyles((list) => list.filter((item) => item.id !== styleId));
  };

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

  // 形状、进场动画跟装饰一样：点击立即生效并保存，互相独立。
  const handlePickShape = (shapeId) => {
    setShape(shapeId);
    onSaveShape?.(shapeId);
  };

  const handlePickAnimation = (animationId) => {
    setAnimation(animationId);
    onSaveAnimation?.(animationId);
    setPreviewReplayKey((key) => key + 1);
  };

  // 点击预设：直接选中并立即保存生效，不需要再点"保存规则"。
  // 下方文本框仍然会同步显示这套预设的代码，方便在此基础上继续做自定义微调，
  // 微调后仍然需要点"保存规则"才会把改动保存下去。
  const handlePickPreset = (preset) => {
    setCustomCss(preset.code);
    onSave(preset.code);
    // 换了配色预设，角色自己写的那一层试用样式一起撤掉。
    if (hasCharCss) onClearCharCss?.();
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

        {/* 角色写的样式：当前试用中的一层 + 用户保存过的样式库 */}
        {onClearCharCss && (hasCharCss || savedStyles.length > 0) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>CHARACTER STYLES / 角色写的样式</span>
              </div>
              {hasCharCss && (
                <button
                  type="button"
                  onClick={() => onClearCharCss?.()}
                  className="px-2 py-0.5 rounded-full border text-[10px] normal-case opacity-100 active:scale-95"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                >
                  清除当前{charCssName ? `「${charCssName}」` : '角色样式'}
                </button>
              )}
            </div>
            {savedStyles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {savedStyles.map((style) => (
                  <span
                    key={style.id}
                    className="inline-flex items-center rounded-full border text-[10px]"
                    style={{
                      background: 'var(--control-soft-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handlePickSavedStyle(style)}
                      className="pl-2.5 pr-1.5 py-1 active:scale-95"
                    >
                      {style.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedStyle(style.id)}
                      aria-label={`删除样式 ${style.name}`}
                      className="pr-2 py-1 opacity-50 hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* 气泡形状：跟配色、装饰互相独立，选"跟随配色"就不覆盖配色自带的形状 */}
        {onSaveShape && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 font-mono text-[10px] opacity-60">
              <Square className="w-3 h-3 text-purple-400" />
              <span>BUBBLE SHAPE / 气泡形状（与配色独立）</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUBBLE_SHAPES.map((s) => {
                const active = shape === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handlePickShape(s.id)}
                    className="px-2.5 py-1 rounded-full border text-[10px] transition-all active:scale-95 hover:opacity-100 flex items-center gap-1"
                    style={{
                      background: active ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                      borderColor: active ? 'var(--accent-color)' : 'var(--card-border)',
                      color: active ? 'var(--accent-foreground)' : 'var(--text-main)'
                    }}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 进场动画：只有刚到达的新消息会播，翻旧消息不会重播 */}
        {onSaveAnimation && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
              <div className="flex items-center gap-1">
                <Play className="w-3 h-3 text-purple-400" />
                <span>ENTRANCE / 进场动画（新消息到达时播放）</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReplayKey((key) => key + 1)}
                className="px-2 py-0.5 rounded-full border text-[10px] normal-case opacity-100 active:scale-95"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              >
                试播
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUBBLE_ANIMATIONS.map((a) => {
                const active = animation === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handlePickAnimation(a.id)}
                    className="px-2.5 py-1 rounded-full border text-[10px] transition-all active:scale-95 hover:opacity-100 flex items-center gap-1"
                    style={{
                      background: active ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                      borderColor: active ? 'var(--accent-color)' : 'var(--card-border)',
                      color: active ? 'var(--accent-foreground)' : 'var(--text-main)'
                    }}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
          <style>{`
            ${buildBubbleShapeCss(shape, '.preview-scope')}
            ${buildBubbleAnimationCss(animation, '.preview-scope')}
          `}</style>
          <div className="preview-scope space-y-1.5 pt-0.5">
            <div key={`user-${previewReplayKey}`} className="relative user-bubble bubble-fresh chat-font p-2 max-w-[85%] ml-auto text-right">
              <BubbleDecorationOverlay decoration={decoration} isUser />
              User 消息气泡预览
            </div>
            <div key={`ai-${previewReplayKey}`} className="relative ai-bubble bubble-fresh chat-font p-2 max-w-[85%] text-left">
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