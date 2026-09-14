import React, { useEffect, useState } from 'react';

/**
 * AnimatedSheet —— 给底部弹出的 Sheet 加一层"跟手"的进出场动效。
 *
 * 不依赖任何动画库：挂载时先渲染在屏幕外（translateY(100%) + 透明），
 * 下一帧再切换到目标位置，靠 CSS transition 过渡；关闭时反过来，
 * 等过渡动画放完再真正卸载，避免"啪"一下消失。
 *
 * 用法：
 *   <AnimatedSheet open={!!formTarget} onExited={() => setFormTarget(null)}>
 *     {(closeWithAnimation) => (
 *        ...原来 Sheet 内容，把"关闭"按钮的 onClick 换成 closeWithAnimation
 *     )}
 *   </AnimatedSheet>
 */
export const AnimatedSheet = ({ open, onExited, children }) => {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const timer = setTimeout(() => {
      setMounted(false);
      onExited?.();
    }, 260);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  const closeWithAnimation = () => setEntered(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-[260ms] ease-out"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', opacity: entered ? 1 : 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWithAnimation();
      }}
    >
      <div
        className="w-full max-w-[420px] transition-transform duration-[280ms] ease-out"
        style={{ transform: entered ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {typeof children === 'function' ? children(closeWithAnimation) : children}
      </div>
    </div>
  );
};

export default AnimatedSheet;