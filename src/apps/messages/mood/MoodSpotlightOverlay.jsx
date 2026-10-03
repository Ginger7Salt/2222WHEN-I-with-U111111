// src/apps/messages/mood/MoodSpotlightOverlay.jsx
//
// 心情更新提示的"聚光灯"出场效果（角色在 [MOOD: ...|SPOTLIGHT] 里自己
// 选的那种，见 moodBubbleDirective.js）：整屏暂时变暗，只在提示条本身
// 的位置留一圈透明的椭圆"洞"，看起来就像被聚光灯照着，洞外的其余内容
// （包括聊天记录里其他消息）都蒙上一层半透明黑。
//
// 不碰 ChatRoom.jsx 的任何结构：挂载点是 document.body（跟
// CallReviewModal.jsx / ArchiveCabinetView.jsx 等一样用 createPortal），
// 所以不管聊天室内部套了多少层 z-50 的 fixed 容器，这层遮罩给个更高的
// z-index（见 moodNotice.css 里的 60）就稳稳盖在最上面——这里特意不去
// 把提示条本身的 z-index 往上抬，因为子元素的 z-index 再高也跳不出
// 父级已经定好的 stacking context，抬不过这层挂在 body 上的遮罩；"挖洞
// 露出提示条"比"硬把提示条提到遮罩上面"更省事也更稳。
//
// 只播一次：mount 时测一次目标元素的位置（getBoundingClientRect），
// 跑完一轮固定时长、非 infinite 的淡入-停留-淡出动画后自己卸载，不会
// 跟着父组件任何重渲染重新播放，也不会常驻占着 DOM。

import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const HOLE_PADDING_X = 18;
const HOLE_PADDING_Y = 14;

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
);

const MoodSpotlightOverlay = ({ targetRef }) => {
  const [rect, setRect] = useState(null);
  const [done, setDone] = useState(false);
  const skipMotion = useRef(prefersReducedMotion());

  useLayoutEffect(() => {
    if (skipMotion.current) {
      // 减弱动画偏好：不播放全屏聚光灯遮罩，提示条留着它自己默认的
      // 淡入就够了。
      setDone(true);
      return;
    }

    const target = targetRef?.current;
    if (!target) {
      setDone(true);
      return;
    }

    setRect(target.getBoundingClientRect());
  }, [targetRef]);

  if (done || !rect) {
    return null;
  }

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx = rect.width / 2 + HOLE_PADDING_X;
  const ry = rect.height / 2 + HOLE_PADDING_Y;

  const style = {
    background: `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, transparent 0%, transparent 55%, rgba(0, 0, 0, 0.26) 75%, rgba(0, 0, 0, 0.74) 100%)`,
  };

  return createPortal(
    <div
      className="mood-spotlight-overlay"
      style={style}
      onAnimationEnd={() => setDone(true)}
    />,
    document.body
  );
};

export default MoodSpotlightOverlay;