// src/apps/hub/useLongPress.js
//
// 长按手势：按住不动超过 delayMs 才触发 onLongPress；期间如果指针
// 移动超过 moveCancelPx（比如在横向滑动翻页），就当作是普通滑动/
// 滚动，取消长按判定，不影响原本的翻页体验。
//
// 额外处理了一个边界情况：长按阈值刚好触发的那一刻，松手时浏览器
// 会在同一个元素上合成一次 click 事件——这里会把紧跟着长按之后的
// 那一次 click 吞掉，避免"长按进入编辑模式"的同时手指一抬又顺带
// 点开了应用。
//
// 只在组件里调用一次（不要在 map 循环里逐项调用，违反 Hooks 规则），
// 把返回的同一组事件处理函数绑定到每一张卡片上即可——首页任一时刻
// 只会有一根手指在拖动，不需要按每一项单独维护状态。

import { useCallback, useRef } from 'react';

const DEFAULT_DELAY_MS = 500;
const DEFAULT_MOVE_CANCEL_PX = 10;

export const useLongPress = (
  onLongPress,
  { delayMs = DEFAULT_DELAY_MS, moveCancelPx = DEFAULT_MOVE_CANCEL_PX } = {}
) => {
  const timerRef = useRef(null);
  const startPointRef = useRef({ x: 0, y: 0 });
  const suppressNextClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      startPointRef.current = { x: event.clientX, y: event.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        suppressNextClickRef.current = true;
        onLongPress(event);
      }, delayMs);
    },
    [clearTimer, delayMs, onLongPress]
  );

  const onPointerMove = useCallback(
    (event) => {
      if (!timerRef.current) return;
      const dx = event.clientX - startPointRef.current.x;
      const dy = event.clientY - startPointRef.current.y;
      if (Math.hypot(dx, dy) > moveCancelPx) {
        clearTimer();
      }
    },
    [clearTimer, moveCancelPx]
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onClickCapture = useCallback((event) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: onPointerUp,
    onPointerCancel: onPointerUp,
    onClickCapture,
  };
};

export default useLongPress;