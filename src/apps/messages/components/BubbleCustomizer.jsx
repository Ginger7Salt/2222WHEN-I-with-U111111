import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, Check, Code, Sparkles, Wand2, Gem, 
  Square, Play, RotateCcw, Trash2, SlidersHorizontal 
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

  // 状态定义
  const [customCss, setCustomCss] = useState(currentCss || presets[0]?.code || '');
  const [justAppliedName, setJustAppliedName] = useState('');
  const [decoration, setDecoration] = useState(currentDecoration || 'none');
  const [shape, setShape] = useState(currentShape || 'none');
  const [animation, setAnimation] = useState(currentAnimation || 'none');
  const [previewReplayKey, setPreviewReplayKey] = useState(0);
  const [savedStyles, setSavedStyles] = useState([]);

  // 工艺模块选项卡状态：presets | appearance | motion | code
  const [activeTab, setActiveTab] = useState('presets');

  // 判断各模块是否可用
  const hasAppearanceTab = Boolean(onSaveShape || BUBBLE_DECORATION_LIST.length > 0);
  const hasMotionTab = Boolean(onSaveAnimation);

  // 加载用户保存过的角色样式库
  useEffect(() => {
    if (!onClearCharCss) return undefined;
    let cancelled = false;
    getSavedBubbleStyles().then((list) => {
      if (!cancelled && list) setSavedStyles(list);
    });
    return () => { cancelled = true; };
  }, [onClearCharCss]);

  // 选预设
  const handlePickPreset = (preset) => {
    setCustomCss(preset.code);
    onSave(preset.code);
    if (hasCharCss) onClearCharCss?.();
    triggerToast(preset.name);
  };

  // 选样式库项
  const handlePickSavedStyle = (style) => {
    setCustomCss(style.css);
    onSave(style.css);
    onClearCharCss?.();
    triggerToast(style.name);
  };

  const handleDeleteSavedStyle = async (e, styleId) => {
    e.stopPropagation();
    await deleteSavedBubbleStyle(styleId);
    setSavedStyles((list) => list.filter((item) => item.id !== styleId));
  };

  const triggerToast = (name) => {
    setJustAppliedName(name);
    window.clearTimeout(handlePickPreset._t);
    handlePickPreset._t = window.setTimeout(() => setJustAppliedName(''), 2200);
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
    setPreviewReplayKey((k) => k + 1);
  };

  const handleSave = () => {
    onSave(customCss);
    onClose();
  };

  // 形状和动画 CSS 注入计算
  const shapeCss = useMemo(() => buildBubbleShapeCss(shape, '.preview-scope'), [shape]);
  const animationCss = useMemo(() => buildBubbleAnimationCss(animation, '.preview-scope'), [animation]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
      {/* 极简磨砂遮罩 */}
      <div 
        className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 工坊主结构容器 */}
      <div className="relative w-full max-w-4xl h-[92vh] md:h-[650px] max-h-[820px] bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-zinc-200/80 flex flex-col overflow-hidden text-zinc-900 z-10 transition-all">
        
        {/* 顶部标尺与控制头 */}
        <header className="shrink-0 h-14 px-4 md:px-6 border-b border-zinc-100 flex items-center justify-between bg-white z-20">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-zinc-950"></span>
            <h2 className="text-xs md:text-sm font-semibold tracking-tight uppercase">气泡工坊 / Bubble Atelier</h2>
            <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
              SPEC V2.4
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-transparent hover:border-zinc-200 hover:bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all"
            title="关闭工坊"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 核心工坊：桌面端左右分栏 / 移动端上下堆叠 */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* ================= 左侧 / 移动端顶部：试作观测台 (Workbench Stage) ================= */}
          <section className="relative w-full md:w-[46%] h-[210px] sm:h-[240px] md:h-full shrink-0 border-b md:border-b-0 md:border-r border-zinc-100 bg-[#FAFAFC] flex flex-col justify-between overflow-hidden">
            {/* 精密点阵底纹 */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-45"
              style={{
                backgroundImage: 'radial-gradient(#d4d4d8 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            />

            {/* 试作台状态头 */}
            <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                <span>Live View / 实时试作</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReplayKey((k) => k + 1)}
                className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white border border-zinc-200 hover:border-zinc-950 text-zinc-700 hover:text-zinc-950 shadow-xs active:scale-95 transition-all flex items-center gap-1"
                title="重新播放当前入场动画"
              >
                <Play className="w-2.5 h-2.5" />
                <span>动效试播</span>
              </button>
            </div>

            {/* 动态注入样式作用域 */}
            <style>{`.preview-scope ${customCss}`}</style>
            <style>{`${shapeCss} ${animationCss}`}</style>

            {/* 气泡展示区域 */}
            <div className="preview-scope relative z-10 px-4 sm:px-6 py-2 flex flex-col justify-center gap-3 overflow-hidden">
              {/* AI/伴侣 气泡 */}
              <div
                key={`ai-${previewReplayKey}`}
                className="relative ai-bubble bubble-fresh chat-font max-w-[85%] self-start text-xs p-3 rounded-2xl bg-white border border-zinc-200 shadow-sm"
              >
                <BubbleDecorationOverlay decoration={decoration} isUser={false} />
                <div className="font-mono text-[9px] text-zinc-400 mb-1">PARTNER</div>
                <div>每一套气泡风格，都是工坊中雕琢出的微型器物。</div>
              </div>

              {/* 用户 气泡 */}
              <div
                key={`user-${previewReplayKey}`}
                className="relative user-bubble bubble-fresh chat-font max-w-[85%] self-end text-xs p-3 rounded-2xl bg-zinc-900 text-white shadow-md text-left"
              >
                <BubbleDecorationOverlay decoration={decoration} isUser />
                <div className="font-mono text-[9px] text-zinc-400 mb-1 text-right">YOU</div>
                <div>极简黑白，纯粹优雅。</div>
              </div>
            </div>

            {/* 试作台底部状态栏 (桌面端显示完整，移动端精简) */}
            <div className="relative z-10 px-4 py-2 border-t border-zinc-100/80 bg-white/60 backdrop-blur-xs font-mono text-[9px] text-zinc-400 flex items-center justify-between">
              <span className="truncate max-w-[50%]">SHAPE: {shape}</span>
              <span className="truncate max-w-[50%]">MOTION: {animation}</span>
            </div>
          </section>

          {/* ================= 右侧 / 移动端下方：工艺控制台 (Craft Console) ================= */}
          <section className="flex-1 flex flex-col min-h-0 bg-white">
            
            {/* 控制台导航选项卡 (支持移动端横向划动) */}
            <div className="shrink-0 flex items-center px-3 sm:px-6 border-b border-zinc-100 overflow-x-auto no-scrollbar gap-1 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                  activeTab === 'presets'
                    ? 'border-zinc-950 text-zinc-950 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                01 配色预设
              </button>

              {hasAppearanceTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                    activeTab === 'appearance'
                      ? 'border-zinc-950 text-zinc-950 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  02 轮廓与装饰
                </button>
              )}

              {hasMotionTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab('motion')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                    activeTab === 'motion'
                      ? 'border-zinc-950 text-zinc-950 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  03 进场动效
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                  activeTab === 'code'
                    ? 'border-zinc-950 text-zinc-950 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                04 CSS刻蚀
              </button>
            </div>

            {/* 可滚动的参数配置区 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* TAB 1: 配色预设与样式库 */}
              {activeTab === 'presets' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Wand2 className="w-3 h-3 text-zinc-950" />
                        PRESETS / 官方调配预设
                      </span>
                      <span>点击直接套用</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {presets.map((p, idx) => {
                        const active = customCss === p.code;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handlePickPreset(p)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 flex items-center gap-1.5 border ${
                              active
                                ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200/80 hover:border-zinc-300'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span>{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 角色写的样式库 */}
                  {onClearCharCss && (hasCharCss || savedStyles.length > 0) && (
                    <div className="space-y-2.5 pt-4 border-t border-zinc-100">
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-zinc-950" />
                          CHARACTER RECIPES / 角色样式库
                        </span>
                        {hasCharCss && (
                          <button
                            type="button"
                            onClick={() => onClearCharCss?.()}
                            className="font-sans text-[10px] text-zinc-500 hover:text-zinc-900 border border-zinc-200 px-2 py-0.5 rounded-full"
                          >
                            清除当前{charCssName ? `「${charCssName}」` : '角色样式'}
                          </button>
                        )}
                      </div>

                      {savedStyles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {savedStyles.map((style) => (
                            <div
                              key={style.id}
                              className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 hover:border-zinc-300 text-xs text-zinc-800 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handlePickSavedStyle(style)}
                                className="pl-3 pr-1.5 py-1.5 active:scale-95"
                              >
                                {style.name}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSavedStyle(e, style.id)}
                                className="pr-2.5 py-1.5 text-zinc-400 hover:text-zinc-900"
                                title="删除"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="font-mono text-[11px] text-zinc-400 py-2">暂无收藏的角色配方</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: 几何轮廓与装饰 */}
              {activeTab === 'appearance' && (
                <div className="space-y-6 animate-fade-in">
                  {onSaveShape && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                        <Square className="w-3 h-3 text-zinc-950" />
                        <span>GEOMETRIC SHAPE / 气泡轮廓形状</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {BUBBLE_SHAPES.map((s) => {
                          const active = shape === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handlePickShape(s.id)}
                              className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 flex items-center gap-1.5 border ${
                                active
                                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200/80 hover:border-zinc-300'
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

                  <div className="space-y-2.5 pt-4 border-t border-zinc-100">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                      <Gem className="w-3 h-3 text-zinc-950" />
                      <span>SURFACE DECORATION / 表面材质工艺</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {BUBBLE_DECORATION_LIST.map((d) => {
                        const active = decoration === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handlePickDecoration(d.id)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 flex items-center gap-1.5 border ${
                              active
                                ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200/80 hover:border-zinc-300'
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

              {/* TAB 3: 进场动效 */}
              {activeTab === 'motion' && onSaveAnimation && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Play className="w-3 h-3 text-zinc-950" />
                      <span>ENTRANCE DYNAMICS / 消息抵达动效</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewReplayKey((k) => k + 1)}
                      className="text-zinc-600 hover:text-zinc-950 border border-zinc-200 px-2 py-0.5 rounded-full"
                    >
                      重新播放
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BUBBLE_ANIMATIONS.map((a) => {
                      const active = animation === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handlePickAnimation(a.id)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 flex items-center gap-1.5 border ${
                            active
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200/80 hover:border-zinc-300'
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

              {/* TAB 4: CSS 源码刻蚀 */}
              {activeTab === 'code' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Code className="w-3 h-3 text-zinc-950" />
                      <span>CSS SOURCE / 源码刻蚀</span>
                    </span>
                    <span>支持标准 CSS 注入</span>
                  </div>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50 focus-within:border-zinc-950 transition-colors">
                    <div className="px-3 py-1.5 bg-zinc-100/70 border-b border-zinc-200 font-mono text-[10px] text-zinc-400 flex justify-between">
                      <span>SCOPE: .preview-scope</span>
                      <span>CSS 3.0</span>
                    </div>
                    <textarea
                      rows={7}
                      value={customCss}
                      onChange={(e) => setCustomCss(e.target.value)}
                      placeholder="/* 在此输入或微调气泡 CSS */"
                      className="w-full p-3 font-mono text-xs leading-relaxed bg-transparent outline-none resize-none text-zinc-800"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* 控制台底部行动栏 */}
            <footer className="shrink-0 p-3 sm:p-5 border-t border-zinc-100 bg-white flex items-center justify-between gap-3">
              {/* 状态轻提示 */}
              <div className="min-w-0 flex items-center gap-1.5 font-mono text-[11px] text-zinc-600 truncate">
                {justAppliedName ? (
                  <span className="text-zinc-950 font-medium flex items-center gap-1 animate-fade-in">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    已应用「{justAppliedName}」
                  </span>
                ) : (
                  <span className="text-zinc-400 text-[10px]">工艺已就绪</span>
                )}
              </div>

              {/* 固化配方主按钮 */}
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>保存规则</span>
              </button>
            </footer>

          </section>

        </div>
      </div>
    </div>
  );
};

export default BubbleCustomizer;