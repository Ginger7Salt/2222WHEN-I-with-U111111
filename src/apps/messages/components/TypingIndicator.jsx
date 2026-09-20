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

// ================= 新增：玻璃胶囊美化基础容器 =================
const TypingBeautyFrame = ({ children }) => (
  <div
    className="typing-beauty-card animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)',
      boxShadow: 'var(--card-shadow)'
    }}
  >
    <div className="typing-beauty-content">
      {children}
    </div>

    <div
      className="typing-beauty-top-glow"
      style={{ background: 'var(--accent-color)' }}
    />
  </div>
);

// ================= 新增：小票打印机指示器 =================
const PrinterTyping = ({ text }) => (
  <TypingBeautyFrame>
    <div className="typing-beauty-printer">
      <div className="typing-beauty-printer-slot" />
      <div className="typing-beauty-paper-slip" />
    </div>

    <div className="typing-beauty-copy">
      <div className="typing-beauty-main-text">
        {text || '正在吐出灵感清单...'}
        <span className="typing-beauty-caret" />
      </div>

      <div className="typing-beauty-status">
        <span
          className="typing-beauty-status-dot"
          style={{ background: 'var(--accent-color)' }}
        />
        PRINTING...
      </div>
    </div>
  </TypingBeautyFrame>
);

// ================= 新增：复古收音机调频指示器 =================
const RadioTunerTyping = ({ text }) => (
  <TypingBeautyFrame>
    <div className="typing-beauty-radio">
      <div className="typing-beauty-radio-antenna" />

      <div className="typing-beauty-tuner-track">
        <div
          className="typing-beauty-tuner-pointer"
          style={{ background: 'var(--accent-color)' }}
        />
      </div>
    </div>

    <div className="typing-beauty-copy">
      <div className="typing-beauty-main-text">
        {text || '正在搜寻灵感频段...'}
        <span className="typing-beauty-caret" />
      </div>

      <div className="typing-beauty-status">
        <span className="typing-beauty-frequency">102.4 MHz</span>
        SCANNING...
      </div>
    </div>
  </TypingBeautyFrame>
);

// ================= 新增：思维炼金烧瓶指示器 =================
const PotionTyping = ({ text }) => (
  <TypingBeautyFrame>
    <div className="typing-beauty-flask">
      <div className="typing-beauty-bubble" />
      <div className="typing-beauty-bubble" />
      <div className="typing-beauty-flask-neck" />

      <div className="typing-beauty-flask-body">
        <div
          className="typing-beauty-liquid"
          style={{ background: 'var(--accent-color)' }}
        />
      </div>
    </div>

    <div className="typing-beauty-copy">
      <div className="typing-beauty-main-text">
        {text || '正在混合创意试剂...'}
        <span className="typing-beauty-caret" />
      </div>

      <div className="typing-beauty-status">
        <span
          className="typing-beauty-status-dot"
          style={{ background: 'var(--accent-color)' }}
        />
        BREWING IDEAS...
      </div>
    </div>
  </TypingBeautyFrame>
);

// ================= 新增：扑翼玻璃信差指示器 =================
const MessengerTyping = ({ text }) => (
  <TypingBeautyFrame>
    <div className="typing-beauty-messenger">
      <div className="typing-beauty-wing typing-beauty-wing-left" />
      <div className="typing-beauty-envelope" />
      <div className="typing-beauty-wing typing-beauty-wing-right" />
    </div>

    <div className="typing-beauty-copy">
      <div className="typing-beauty-main-text">
        {text || '信差正在穿越云层投递...'}
        <span className="typing-beauty-caret" />
      </div>

      <div className="typing-beauty-status">
        <span
          className="typing-beauty-status-dot"
          style={{ background: 'var(--accent-color)' }}
        />
        DELIVERING...
      </div>
    </div>
  </TypingBeautyFrame>
);

// ================= 新增：街机手柄连击指示器 =================
const ArcadeComboTyping = ({ text }) => (
  <TypingBeautyFrame>
    <div className="typing-beauty-gamepad">
      <div className="typing-beauty-dpad" />

      <div className="typing-beauty-action-keys">
        <span
          className="typing-beauty-action-key"
          style={{ background: 'var(--accent-color)' }}
        />
        <span
          className="typing-beauty-action-key"
          style={{ background: 'var(--accent-color)' }}
        />
      </div>
    </div>

    <div className="typing-beauty-copy">
      <div className="typing-beauty-main-text">
        {text || '正在神速搓招中...'}
        <span className="typing-beauty-caret" />
      </div>

      <div className="typing-beauty-status">
        <span
          className="typing-beauty-status-dot"
          style={{ background: 'var(--accent-color)' }}
        />
        COMBO x99
      </div>
    </div>
  </TypingBeautyFrame>
);

// 注册中心：方便后续您无限追加新的动画类型
const INDICATOR_REGISTRY = {
  default: DefaultTyping,
  phone_call: PhoneCallTyping,
  typewriter: TypewriterTyping,
  wave_pulse: WavePulseTyping,

  // 新增美化样式
  printer: PrinterTyping,
  radio_tuner: RadioTunerTyping,
  potion: PotionTyping,
  messenger: MessengerTyping,
  arcade_combo: ArcadeComboTyping
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
  ],

  // 新增美化样式的默认文案
  printer: [
    '正在吐出灵感清单...',
    '正在打印新的想法...',
    '灵感正在一条条生成...'
  ],
  radio_tuner: [
    '正在搜寻灵感频段...',
    '正在调节思绪信号...',
    '正在锁定最佳表达...'
  ],
  potion: [
    '正在混合创意试剂...',
    '思维炼金术进行中...',
    '正在酿造一个好答案...'
  ],
  messenger: [
    '信差正在穿越云层投递...',
    '正在把答案送到你身边...',
    '消息马上就要抵达...'
  ],
  arcade_combo: [
    '正在神速搓招中...',
    '思路连击即将完成...',
    '正在释放最终答案...'
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

        /* ================= 新增美化样式 ================= */

        .typing-beauty-card {
          position: relative;
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          overflow: hidden;
          border: 1px solid;
          border-radius: 1.6rem;
          backdrop-filter: blur(20px) saturate(150%);
          -webkit-backdrop-filter: blur(20px) saturate(150%);
          transition:
            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            border-color 0.3s ease,
            box-shadow 0.3s ease;
        }

        .typing-beauty-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent-color);
          box-shadow:
            var(--card-shadow),
            0 0 24px color-mix(in srgb, var(--accent-color) 18%, transparent);
        }

        .typing-beauty-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 9px 16px 9px 12px;
        }

        .typing-beauty-top-glow {
          position: absolute;
          top: 0;
          left: 8%;
          right: 8%;
          height: 1px;
          opacity: 0.75;
          filter: blur(0.4px);
          box-shadow: 0 0 8px var(--accent-color);
        }

        .typing-beauty-copy {
          min-width: 0;
          flex: 1;
        }

        .typing-beauty-main-text {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          overflow-wrap: anywhere;
          color: var(--text-main);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.45;
          letter-spacing: 0.03em;
          opacity: 0.92;
        }

        .typing-beauty-caret {
          display: inline-block;
          width: 2px;
          height: 13px;
          flex-shrink: 0;
          margin-left: 6px;
          border-radius: 2px;
          background: var(--accent-color);
          box-shadow: 0 0 7px var(--accent-color);
          animation: typingBeautyCaret 0.8s ease-in-out infinite alternate;
        }

        .typing-beauty-status {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          color: var(--text-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          line-height: 1;
          letter-spacing: 0.16em;
          opacity: 0.58;
        }

        .typing-beauty-status-dot {
          display: inline-block;
          width: 4px;
          height: 4px;
          flex-shrink: 0;
          border-radius: 999px;
          box-shadow: 0 0 7px var(--accent-color);
          animation: typingBeautyDot 1.2s ease-in-out infinite;
        }

        .typing-beauty-frequency {
          color: var(--accent-color);
          letter-spacing: 0.08em;
        }

        /* 小票打印机 */
        .typing-beauty-printer {
          position: relative;
          display: flex;
          width: 32px;
          height: 28px;
          flex-shrink: 0;
          align-items: flex-start;
          justify-content: center;
          padding-top: 4px;
          border: 1px solid var(--divider);
          border-radius: 8px;
          background: var(--control-soft-bg);
          animation: typingBeautyPrinterJolt 0.5s ease-in-out infinite alternate;
        }

        .typing-beauty-printer-slot {
          position: relative;
          z-index: 2;
          width: 22px;
          height: 3px;
          border-radius: 3px;
          background: var(--text-main);
          opacity: 0.72;
        }

        .typing-beauty-paper-slip {
          position: absolute;
          z-index: 1;
          top: 5px;
          width: 16px;
          height: 16px;
          border-radius: 2px 2px 0 0;
          background: linear-gradient(
            180deg,
            var(--text-main) 0%,
            var(--control-soft-bg) 100%
          );
          clip-path: polygon(
            0% 0%,
            100% 0%,
            100% 85%,
            75% 100%,
            50% 85%,
            25% 100%,
            0% 85%
          );
          opacity: 0.82;
          animation: typingBeautyPaperOut 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }

        /* 复古收音机 */
        .typing-beauty-radio {
          position: relative;
          display: flex;
          width: 38px;
          height: 26px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 1px solid var(--divider);
          border-radius: 7px;
          background: var(--control-soft-bg);
        }

        .typing-beauty-tuner-track {
          position: relative;
          display: flex;
          width: 100%;
          height: 8px;
          align-items: center;
          overflow: hidden;
          border-radius: 3px;
          background: color-mix(in srgb, var(--text-main) 18%, transparent);
        }

        .typing-beauty-tuner-track::before,
        .typing-beauty-tuner-track::after {
          position: absolute;
          top: 2px;
          bottom: 2px;
          width: 1px;
          content: '';
          background: var(--text-main);
          opacity: 0.25;
        }

        .typing-beauty-tuner-track::before {
          left: 25%;
        }

        .typing-beauty-tuner-track::after {
          left: 70%;
        }

        .typing-beauty-tuner-pointer {
          position: absolute;
          width: 3px;
          height: 100%;
          border-radius: 4px;
          box-shadow: 0 0 7px var(--accent-color);
          animation: typingBeautyTunerScan 2.4s ease-in-out infinite alternate;
        }

        .typing-beauty-radio-antenna {
          position: absolute;
          top: -10px;
          right: 5px;
          width: 1.5px;
          height: 10px;
          transform: rotate(20deg);
          transform-origin: bottom center;
          background: var(--text-main);
          opacity: 0.6;
        }

        .typing-beauty-radio-antenna::before {
          position: absolute;
          top: -3px;
          left: -2px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-color);
          box-shadow: 0 0 7px var(--accent-color);
          content: '';
        }

        /* 思维炼金烧瓶 */
        .typing-beauty-flask {
          position: relative;
          display: flex;
          width: 30px;
          height: 32px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          animation: typingBeautyFlaskTilt 2s ease-in-out infinite;
        }

        .typing-beauty-flask-body {
          position: absolute;
          bottom: 0;
          width: 24px;
          height: 24px;
          overflow: hidden;
          border: 1.5px solid var(--divider);
          border-radius: 50%;
          background: var(--control-soft-bg);
          box-shadow: inset 0 0 7px color-mix(in srgb, var(--accent-color) 20%, transparent);
        }

        .typing-beauty-flask-neck {
          position: absolute;
          top: 2px;
          z-index: 2;
          width: 8px;
          height: 8px;
          border: 1.5px solid var(--divider);
          border-bottom: none;
          border-radius: 2px 2px 0 0;
          background: var(--control-soft-bg);
        }

        .typing-beauty-liquid {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 12px;
          border-radius: 0 0 50% 50%;
          opacity: 0.75;
          animation: typingBeautyBoilingLiquid 1.4s ease-in-out infinite alternate;
        }

        .typing-beauty-bubble {
          position: absolute;
          bottom: 8px;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--accent-color);
          box-shadow: 0 0 5px var(--accent-color);
          opacity: 0;
          animation: typingBeautyBubbleRise 1.6s ease-in infinite;
        }

        .typing-beauty-bubble:nth-child(1) {
          left: 7px;
          animation-delay: 0.25s;
        }

        .typing-beauty-bubble:nth-child(2) {
          right: 7px;
          animation-delay: 0.85s;
        }

        /* 扑翼玻璃信差 */
        .typing-beauty-messenger {
          position: relative;
          display: flex;
          width: 34px;
          height: 28px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          animation: typingBeautyEnvelopeHover 2s ease-in-out infinite;
        }

        .typing-beauty-envelope {
          position: relative;
          z-index: 2;
          width: 22px;
          height: 15px;
          border: 1px solid var(--divider);
          border-radius: 4px;
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--text-main) 25%, transparent) 0%,
            color-mix(in srgb, var(--text-main) 6%, transparent) 100%
          );
          box-shadow: 0 0 9px color-mix(in srgb, var(--accent-color) 22%, transparent);
        }

        .typing-beauty-envelope::after {
          position: absolute;
          top: 0;
          right: 2px;
          left: 2px;
          height: 7px;
          border-bottom: 1px solid var(--divider);
          clip-path: polygon(0% 0%, 50% 100%, 100% 0%);
          content: '';
        }

        .typing-beauty-wing {
          position: absolute;
          top: 4px;
          z-index: 1;
          width: 8px;
          height: 12px;
          border: 1px solid var(--accent-color);
          background: color-mix(in srgb, var(--accent-color) 18%, transparent);
          opacity: 0.76;
        }

        .typing-beauty-wing-left {
          left: -2px;
          border-radius: 50% 50% 10% 50%;
          transform-origin: right center;
          animation: typingBeautyFlapLeft 0.5s ease-in-out infinite alternate;
        }

        .typing-beauty-wing-right {
          right: -2px;
          border-radius: 50% 50% 50% 10%;
          transform-origin: left center;
          animation: typingBeautyFlapRight 0.5s ease-in-out infinite alternate;
        }

        /* 街机手柄 */
        .typing-beauty-gamepad {
          position: relative;
          display: flex;
          width: 36px;
          height: 24px;
          flex-shrink: 0;
          align-items: center;
          justify-content: space-between;
          padding: 0 5px;
          border: 1.2px solid var(--divider);
          border-radius: 12px;
          background: var(--control-soft-bg);
          animation: typingBeautyPadRumble 0.3s ease-in-out infinite;
        }

        .typing-beauty-dpad {
          position: relative;
          width: 8px;
          height: 8px;
        }

        .typing-beauty-dpad::before,
        .typing-beauty-dpad::after {
          position: absolute;
          border-radius: 2px;
          background: var(--accent-color);
          box-shadow: 0 0 4px color-mix(in srgb, var(--accent-color) 65%, transparent);
          content: '';
        }

        .typing-beauty-dpad::before {
          top: 0;
          left: 3px;
          width: 2px;
          height: 8px;
        }

        .typing-beauty-dpad::after {
          top: 3px;
          left: 0;
          width: 8px;
          height: 2px;
        }

        .typing-beauty-action-keys {
          display: flex;
          gap: 3px;
        }

        .typing-beauty-action-key {
          display: block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          box-shadow: 0 0 5px var(--accent-color);
        }

        .typing-beauty-action-key:nth-child(1) {
          animation: typingBeautyButtonHit 0.4s ease-in-out infinite alternate;
        }

        .typing-beauty-action-key:nth-child(2) {
          animation: typingBeautyButtonHit 0.4s ease-in-out infinite alternate 0.2s;
        }

        /* 新增动画 */
        @keyframes typingBeautyCaret {
          0% {
            opacity: 0.2;
            transform: scaleY(0.65);
          }
          100% {
            opacity: 1;
            transform: scaleY(1);
          }
        }

        @keyframes typingBeautyDot {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.75);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        @keyframes typingBeautyPrinterJolt {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-2px);
          }
        }

        @keyframes typingBeautyPaperOut {
          0% {
            height: 4px;
            opacity: 0.3;
          }
          60% {
            height: 18px;
            opacity: 1;
          }
          100% {
            height: 18px;
            opacity: 0.8;
          }
        }

        @keyframes typingBeautyTunerScan {
          0% {
            left: 10%;
          }
          30% {
            left: 45%;
          }
          70% {
            left: 30%;
          }
          100% {
            left: 80%;
          }
        }

        @keyframes typingBeautyFlaskTilt {
          0%, 100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(8deg) translateY(-2px);
          }
        }

        @keyframes typingBeautyBoilingLiquid {
          0% {
            height: 10px;
            transform: skewX(-4deg);
          }
          100% {
            height: 14px;
            transform: skewX(4deg);
          }
        }

        @keyframes typingBeautyBubbleRise {
          0% {
            bottom: 8px;
            opacity: 1;
            transform: scale(0.6);
          }
          80% {
            opacity: 0.8;
          }
          100% {
            bottom: 28px;
            opacity: 0;
            transform: scale(1.3);
          }
        }

        @keyframes typingBeautyEnvelopeHover {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes typingBeautyFlapLeft {
          0% {
            transform: rotate(15deg) scaleX(0.7);
          }
          100% {
            transform: rotate(-35deg) scaleX(1.2);
          }
        }

        @keyframes typingBeautyFlapRight {
          0% {
            transform: rotate(-15deg) scaleX(0.7);
          }
          100% {
            transform: rotate(35deg) scaleX(1.2);
          }
        }

        @keyframes typingBeautyPadRumble {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-1.5px) rotate(-2deg);
          }
          100% {
            transform: translateY(1px) rotate(2deg);
          }
        }

        @keyframes typingBeautyButtonHit {
          0% {
            opacity: 0.3;
            transform: scale(0.7);
          }
          100% {
            opacity: 1;
            transform: scale(1.4);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .typing-beauty-card,
          .typing-beauty-printer,
          .typing-beauty-paper-slip,
          .typing-beauty-tuner-pointer,
          .typing-beauty-flask,
          .typing-beauty-liquid,
          .typing-beauty-bubble,
          .typing-beauty-messenger,
          .typing-beauty-wing,
          .typing-beauty-gamepad,
          .typing-beauty-action-key,
          .typing-beauty-caret,
          .typing-beauty-status-dot {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;
