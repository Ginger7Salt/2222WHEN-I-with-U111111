import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, 
  Check, 
  Code, 
  Sparkles, 
  Wand2, 
  Gem, 
  Square, 
  Play, 
  RotateCcw,
  Sliders,
  Palette
} from 'lucide-react';
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
  currentShape = 'none',
  onSaveShape,
  currentAnimation = 'none',
  onSaveAnimation,
  hasCharCss = false,
  charCssName = '',
  onClearCharCss,
}) => {
  const presets = BUBBLE_STYLE_PRESETS;

  const [customCss, setCustomCss] = useState(currentCss || presets[0].code);
  const [justAppliedName, setJustAppliedName] = useState('');
  const [decoration, setDecoration] = useState(currentDecoration || 'none');
  const [shape, setShape] = useState(currentShape || 'none');
  const [animation, setAnimation] = useState(currentAnimation || 'none');
  const [previewReplayKey, setPreviewReplayKey] = useState(0);
  const [savedStyles, setSavedStyles] = useState([]);

  // 工艺台当前选中的选项卡
  const [activeTab, setActiveTab] = useState('preset');

  useEffect(() => {
    if (!onClearCharCss) return undefined;
    let cancelled = false;
    getSavedBubbleStyles().then((list) => {
      if (!cancelled) setSavedStyles(list);
    });
    return () => { cancelled = true; };
  }, [onClearCharCss]);

  // 可用选项卡动态配置（根据是否有回调动态展示）
  const availableTabs = useMemo(() => {
    const list = [
      { id: 'preset', label: '配色配方', icon: Palette },
      { id: 'craft', label: '轮廓与材质', icon: Gem },
    ];
    if (onSaveAnimation) {
      list.push({ id: 'motion', label: '进场动效', icon: Play });
    }
    list.push({ id: 'code', label: 'CSS刻蚀', icon: Code });
    return list;
  }, [onSaveAnimation]);

  const showNotification = (name) => {
    setJustAppliedName(name);
    window.clearTimeout(showNotification._t);
    showNotification._t = window.setTimeout(() => setJustAppliedName(''), 2000);
  };

  const handlePickSavedStyle = (style) => {
    setCustomCss(style.css);
    onSave(style.css);
    onClearCharCss?.();
    showNotification(style.name);
  };

  const handleDeleteSavedStyle = async (styleId) => {
    await deleteSavedBubbleStyle(styleId);
    setSavedStyles((list) => list.filter((item) => item.id !== styleId));
  };

  const handleSave = () => {
    onSave(customCss);
    onClose();
  };

  const handlePickDecoration = (decorationId) => {
    setDecoration(decorationId);
    onSaveDecoration?.(decorationId);
  };

  const handlePickShape = (shapeId) => {
    setShape(shapeId);
    onSaveShape?.(shapeId);
  };

  const handlePickAnimation = (animationId) => {
    setAnimation(animationId);
    onSaveAnimation?.(animationId);
    setPreviewReplayKey((key) => key + 1);
  };

  const handlePickPreset = (preset) => {
    setCustomCss(preset.code);
    onSave(preset.code);
    if (hasCharCss) onClearCharCss?.();
    showNotification(preset.name);
  };

  const isPresetActive = (preset) => customCss === preset.code;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-zinc-950/40 backdrop-blur-sm animate-fade-in">
      {/* 遮罩背景点击关闭 */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* 工坊主面板 */}
      <div className="relative w-full max-w-4xl h-[90vh] md:h-[620px] max-h-[820px] bg-white rounded-3xl border border-zinc-200/80 shadow-2xl flex flex-col md:flex-row overflow-hidden z-10 text-zinc-900">
        
        {/* ================= 左侧：试作观测台（Workbench Stage） ================= */}
        <div className="w-full md:w-5/12 flex flex-col bg-zinc-50/70 border-b md:border-b-0 md:border-r border-zinc-200 relative shrink-0 min-h-[220px] md:min-h-0">
          
          {/* 精密点阵工程背景 */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              backgroundImage: 'radial-gradient(#d4d4d8 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          />

          {/* 观测台顶部状态栏 */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-200/60 bg-white/70 backdrop-blur-sm relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                Workbench / 试作台
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => setPreviewReplayKey((key) => key + 1)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-zinc-200 shadow-2xs font-mono text-[10px] text-zinc-700 hover:text-black hover:border-zinc-400 active:scale-95 transition-all"
              title="重新播放进场动画"
            >
              <RotateCcw className="w-3 h-3" />
              <span>动效重播</span>
            </button>
          </div>

          {/* 注入样式的样式作用域 */}
          <style>{`
            .preview-scope ${customCss}
          `}</style>
          <style>{`
            ${buildBubbleShapeCss(shape, '.preview-scope')}
            ${buildBubbleAnimationCss(animation, '.preview-scope')}
          `}</style>

          {/* 气泡展示观测区（防截断，支持平滑滚动与居中） */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto flex flex-col justify-center gap-5 relative z-10 preview-scope">
            
            {/* AI 消息模块：外置标头 */}
            <div className="flex flex-col items-start gap-1 max-w-[92%] sm:max-w-[85%]">
              <span className="font-mono text-[9px] font-medium text-zinc-400 pl-1 uppercase tracking-wider select-none">
                AI PARTNER · 09:41
              </span>
              <div
                key={`ai-${previewReplayKey}`}
                className="relative ai-bubble bubble-fresh chat-font p-3 text-left break-words shadow-xs select-none transition-all duration-300"
              >
                <BubbleDecorationOverlay decoration={decoration} isUser={false} />
                <span>「气泡工坊」已就绪，所有材质与动效均可在此实时观测。</span>
              </div>
            </div>

            {/* 用户消息模块：外置标头 */}
            <div className="flex flex-col items-end gap-1 max-w-[92%] sm:max-w-[85%] ml-auto">
              <span className="font-mono text-[9px] font-medium text-zinc-400 pr-1 uppercase tracking-wider select-none">
                YOU · 09:42
              </span>
              <div
                key={`user-${previewReplayKey}`}
                className="relative user-bubble bubble-fresh chat-font p-3 text-right break-words shadow-xs select-none transition-all duration-300"
              >
                <BubbleDecorationOverlay decoration={decoration} isUser />
                <span>简约黑白，克制而高级。</span>
              </div>
            </div>

          </div>

          {/* 观测台底部参数微标签（仅桌面端显示） */}
          <div className="hidden md:flex px-4 py-2 border-t border-zinc-200/60 bg-white/60 font-mono text-[9px] text-zinc-400 justify-between relative z-10">
            <span>DECOR: {decoration}</span>
            <span>SHAPE: {shape}</span>
          </div>
        </div>

        {/* ================= 右侧：工艺控制台（Craft Console） ================= */}
        <div className="w-full md:w-7/12 flex flex-col bg-white min-h-0 flex-1">
          
          {/* 控制台顶栏：标题与关闭 */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
              <h2 className="text-xs font-bold tracking-tight text-zinc-900 uppercase">
                Bubble Atelier / 气泡工坊
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 控制台切换标签页（手机端横向滚动） */}
          <div className="flex px-4 border-b border-zinc-100 gap-1 overflow-x-auto no-scrollbar shrink-0 bg-white">
            {availableTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 py-2.5 px-3 font-medium text-xs border-b-2 transition-all whitespace-nowrap ${
                    isActive 
                      ? 'border-black text-black font-semibold' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-700'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 控制台滚动内容面板 */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            
            {/* === 面板 1：配色预设 & 角色库 === */}
            {activeTab === 'preset' && (
              <div className="space-y-5 animate-fade-in">
                {/* 经典预设 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Wand2 className="w-3 h-3 text-zinc-500" /> CLASSIC PRESETS / 点击即刻应用
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p, idx) => {
                      const active = isPresetActive(p);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePickPreset(p)}
                          className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 flex items-center gap-1.5 ${
                            active
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 角色专属样式库 */}
                {onClearCharCss && (hasCharCss || savedStyles.length > 0) && (
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-zinc-500" /> CHARACTER ARCHIVES / 角色配方库
                      </span>
                      {hasCharCss && (
                        <button
                          type="button"
                          onClick={() => onClearCharCss?.()}
                          className="px-2 py-0.5 rounded-full border border-zinc-200 hover:border-zinc-300 text-[10px] text-zinc-600 active:scale-95 transition-all"
                        >
                          清除当前{charCssName ? `「${charCssName}」` : '角色样式'}
                        </button>
                      )}
                    </div>
                    {savedStyles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {savedStyles.map((style) => (
                          <span
                            key={style.id}
                            className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 text-xs text-zinc-700 shadow-2xs"
                          >
                            <button
                              type="button"
                              onClick={() => handlePickSavedStyle(style)}
                              className="pl-3 pr-1.5 py-1 hover:text-black active:scale-95 font-medium"
                            >
                              {style.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedStyle(style.id)}
                              aria-label={`删除样式 ${style.name}`}
                              className="pr-2.5 py-1 text-zinc-400 hover:text-zinc-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === 面板 2：几何轮廓与表面装饰 === */}
            {activeTab === 'craft' && (
              <div className="space-y-5 animate-fade-in">
                {/* 气泡形状 */}
                {onSaveShape && (
                  <div className="space-y-2">
                    <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Square className="w-3 h-3 text-zinc-500" /> GEOMETRY / 几何轮廓
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {BUBBLE_SHAPES.map((s) => {
                        const active = shape === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handlePickShape(s.id)}
                            className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 flex items-center gap-1.5 ${
                              active
                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span>{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 气泡装饰 */}
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Gem className="w-3 h-3 text-zinc-500" /> SURFACE TEXTURE / 表面工艺
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {BUBBLE_DECORATION_LIST.map((d) => {
                      const active = decoration === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handlePickDecoration(d.id)}
                          className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 flex items-center gap-1.5 ${
                            active
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{d.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* === 面板 3：进场动效 === */}
            {activeTab === 'motion' && onSaveAnimation && (
              <div className="space-y-3 animate-fade-in">
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Play className="w-3 h-3 text-zinc-500" /> ENTRANCE MOTION / 进场动力学
                </span>
                <div className="flex flex-wrap gap-2">
                  {BUBBLE_ANIMATIONS.map((a) => {
                    const active = animation === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handlePickAnimation(a.id)}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 flex items-center gap-1.5 ${
                          active
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        <span>{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === 面板 4：CSS 刻蚀编辑器 === */}
            {activeTab === 'code' && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Code className="w-3 h-3 text-zinc-500" /> CSS ETCHING / 规则微调
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">实时编译</span>
                </div>
                <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50/50">
                  <div className="px-3 py-1.5 border-b border-zinc-200 bg-zinc-100/60 font-mono text-[9px] text-zinc-500 flex justify-between">
                    <span>STYLESHEET</span>
                    <span>CSS 3.0</span>
                  </div>
                  <textarea
                    rows={8}
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder="输入或修改 CSS 代码..."
                    className="w-full p-3 font-mono text-[11px] outline-none resize-none bg-transparent text-zinc-900 placeholder:text-zinc-400 leading-relaxed"
                  />
                </div>
              </div>
            )}

          </div>

          {/* 控制台底栏：即时反馈与保存 */}
          <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50/40 flex items-center justify-between gap-3">
            
            {/* 状态徽标 */}
            <div className="min-w-0">
              {justAppliedName ? (
                <div className="inline-flex items-center gap-1.5 text-xs text-zinc-900 font-medium animate-fade-in truncate">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">已应用「{justAppliedName}」</span>
                </div>
              ) : (
                <span className="font-mono text-[10px] text-zinc-400 hidden sm:inline">
                  配方随时就绪
                </span>
              )}
            </div>

            {/* 保存主按钮 */}
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>保存规则</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default BubbleCustomizer;