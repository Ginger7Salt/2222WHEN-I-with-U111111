import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, PhoneCall, PenTool, Activity, Radio } from 'lucide-react';

// 1. 默认样式 (保持您原有的高审美 Sparkles + 律动三小点设计)
const DefaultTyping = ({ text }) => (
  <div
    className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)',
      boxShadow: 'var(--card-shadow)'
    }}
  >
    <div className="relative flex items-center gap-3 px-4 py-3">
      <div className="relative shrink-0">
        <div
          className="absolute inset-0 rounded-full blur-md opacity-50 animate-pulse"
          style={{ background: 'var(--accent-color)' }}
        />
        <div
          className="relative flex h-8 w-8 items-center justify-center rounded-full border"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--divider)'
          }}
        >
          <Sparkles
            className="w-4 h-4 animate-[pulse_1.8s_ease-in-out_infinite]"
            style={{ color: 'var(--accent-color)' }}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide opacity-90">
            {text}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent-color)', animationDelay: '0s' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent-color)', animationDelay: '0.18s' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent-color)', animationDelay: '0.36s' }}
          />
          <span
            className="ml-1 text-[10px] font-mono uppercase tracking-[0.22em] opacity-45"
            style={{ color: 'var(--text-muted)' }}
          >
            typing
          </span>
        </div>
      </div>
    </div>

    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, var(--accent-color) 50%, transparent 100%)'
      }}
    />
  </div>
);

// 2. 新增：模拟打电话 / 通话呼叫中 (Phone Call Indicator)
const PhoneCallTyping = ({ text }) => (
  <div
    className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)',
      boxShadow: 'var(--card-shadow)'
    }}
  >
    <div className="relative flex items-center gap-3 px-4 py-3">
      <div className="relative shrink-0">
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"
          style={{ background: 'var(--accent-color)' }}
        />
        <div
          className="relative flex h-8 w-8 items-center justify-center rounded-full border animate-[bounce_2s_infinite]"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--divider)'
          }}
        >
          <PhoneCall
            className="w-4 h-4"
            style={{ color: 'var(--accent-color)' }}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide opacity-90">
            {text || '正在拨通电话...'}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] opacity-60">
          <Radio className="w-3 h-3 animate-spin" style={{ color: 'var(--accent-color)' }} />
          <span className="tracking-widest">CALLING...</span>
        </div>
      </div>
    </div>
  </div>
);

// 3. 新增：诗意打字机 (Typewriter)
const TypewriterTyping = ({ text }) => (
  <div
    className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)'
    }}
  >
    <div className="relative flex items-center gap-3 px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
        style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
      >
        <PenTool className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent-color)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium opacity-90">{text || '正在斟酌字句...'}</span>
        <div className="mt-1 flex items-center gap-1">
          <span className="h-0.5 w-3 rounded-full animate-pulse" style={{ background: 'var(--accent-color)' }} />
          <span className="text-[9px] font-mono opacity-50 uppercase">Writing...</span>
        </div>
      </div>
    </div>
  </div>
);

// 4. 新增：柔和音波律动 (Wave Pulse)
const WavePulseTyping = ({ text }) => (
  <div
    className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)'
    }}
  >
    <div className="relative flex items-center gap-3 px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
        style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
      >
        <Activity className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent-color)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium opacity-90">{text}</span>
        <div className="mt-1.5 flex items-end gap-1 h-2">
          <span className="w-1 bg-[var(--accent-color)] rounded-full animate-[wave_1s_ease-in-out_infinite_0s] h-full" />
          <span className="w-1 bg-[var(--accent-color)] rounded-full animate-[wave_1s_ease-in-out_infinite_0.2s] h-2/3" />
          <span className="w-1 bg-[var(--accent-color)] rounded-full animate-[wave_1s_ease-in-out_infinite_0.4s] h-full" />
        </div>
      </div>
    </div>
  </div>
);

// 注册中心：方便后续您无限追加新的动画类型
const INDICATOR_REGISTRY = {
  default: DefaultTyping,
  phone_call: PhoneCallTyping,
  typewriter: TypewriterTyping,
  wave_pulse: WavePulseTyping
};

// 可爱状态文案：当聊天窗没有自定义等待文案时使用的默认文案池，
// 按动画风格各配一组，会自动轮流显示，而不是固定死一句话。
// 用户在"聊天设置"里如果填了自定义文案（支持多行，每行一句），
// 会优先用用户自己那一组来轮流显示；只填了一行就相当于关闭轮换，
// 保留老用户原本"固定一句话"的使用习惯，不强制改变。
const DEFAULT_TEXT_POOL = {
  default: [
    '正在斟酌该怎么回你...',
    '脑子里转了好几个念头...',
    '想着想着又改了主意...',
    '正在想要不要多说一句...'
  ],
  phone_call: [
    '正在拨通电话...',
    '信号连接中...',
    '等ta接起来...'
  ],
  typewriter: [
    '正在斟酌字句...',
    '划掉重写了一遍...',
    '想找个更合适的说法...'
  ],
  wave_pulse: [
    '在认真听你说...',
    '心里有点小波动...',
    '正在消化这句话...'
  ]
};

// 每隔多久切换一次轮换文案。
const TEXT_ROTATE_INTERVAL_MS = 2600;

// 把 customText 拆成候选文案池：按换行拆分，每行一条，
// 过滤空行；如果最终什么都没有，退回对应风格的默认文案池。
const resolveTextPool = (customText, styleType) => {
  const fallbackPool = DEFAULT_TEXT_POOL[styleType] || DEFAULT_TEXT_POOL.default;

  if (!customText) return fallbackPool;

  const lines = String(customText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : fallbackPool;
};

export const TypingIndicator = ({ customText = '', styleType = 'default' }) => {
  const Component = INDICATOR_REGISTRY[styleType] || INDICATOR_REGISTRY.default;

  const textPool = useMemo(
    () => resolveTextPool(customText, styleType),
    [customText, styleType]
  );

  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    setTextIndex(0);

    if (textPool.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setTextIndex((previous) => (previous + 1) % textPool.length);
    }, TEXT_ROTATE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [textPool]);

  const displayText = textPool[textIndex] || textPool[0];

  return (
    <div className="w-fit max-w-[88%]">
      {/* key={textIndex} 让每次切换文案时子组件重新挂载一次，
          顺带借用它自带的 animate-fade-in-up 做一次轻微的淡入过渡 */}
      <Component key={textIndex} text={displayText} />

      <style>{`
        @keyframes typingDot {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          40% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        @keyframes wave {
          0%, 100% { height: 30%; opacity: 0.4; }
          50% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;
