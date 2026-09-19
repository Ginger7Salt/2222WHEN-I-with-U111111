import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import db from '../../../db';

// 缩小后的"灵动岛"悬浮球。视觉/拖拽手感直接对齐项目里已有的两个
// 悬浮球（KeepAliveIndicator、DesktopPetWidget）：原生 Pointer Events
// 拖拽 + 屏幕边界夹紧 + 位置存进 Dexie，不用 motion/react，纯 CSS 过渡。
const POSITION_KEY = 'call_widget_position';
const DEFAULT_POSITION = { x: 16, y: 140 };
const BALL_SIZE = 56;
const DRAG_THRESHOLD = 5;

const clampPosition = (position) => {
  const maxX = Math.max(12, window.innerWidth - BALL_SIZE - 12);
  const maxY = Math.max(12, window.innerHeight - BALL_SIZE - 12);

  return {
    x: Math.min(Math.max(position.x, 12), maxX),
    y: Math.min(Math.max(position.y, 12), maxY),
  };
};

const CallBubble = ({ character, onExpand }) => {
  const [position, setPosition] = useState(DEFAULT_POSITION);

  const dragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  useEffect(() => {
    let isMounted = true;

    db.settings.get(POSITION_KEY).then((setting) => {
      if (isMounted && setting?.value) {
        setPosition(clampPosition(setting.value));
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const persistPosition = useCallback((next) => {
    void db.settings.put({ key: POSITION_KEY, value: next });
  }, []);

  const handlePointerDown = useCallback((event) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      drag.moved = true;
    }

    if (drag.moved) {
      const next = clampPosition({
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      });

      setPosition(next);
    }
  }, []);

  const handlePointerUp = useCallback((event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 指针已经失效时释放会报错，忽略即可。
    }

    if (drag.moved) {
      persistPosition(position);
    } else {
      onExpand();
    }

    dragRef.current = { ...drag, pointerId: null };
  }, [position, persistPosition, onExpand]);

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="call-bubble fixed z-[58] flex h-14 w-14 items-center justify-center rounded-full border shadow-lg transition-transform active:scale-95"
      style={{
        left: position.x,
        top: position.y,
        background: 'var(--accent-color)',
        borderColor: 'var(--card-border)',
        touchAction: 'none',
      }}
      title={`通话中 · ${character?.name || ''}`}
      aria-label="展开通话"
    >
      <span className="call-bubble__pulse absolute inset-0 rounded-full" aria-hidden="true" />

      {character?.avatar ? (
        <img
          src={character.avatar}
          alt={character.name}
          className="relative h-10 w-10 rounded-full border object-cover"
          style={{ borderColor: 'var(--card-bg)' }}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <Phone className="relative h-5 w-5" style={{ color: 'var(--accent-foreground)' }} />
      )}

      <style>{`
        .call-bubble__pulse {
          background: var(--accent-color);
          opacity: 0.45;
          animation: call-bubble-pulse 1.8s ease-out infinite;
          pointer-events: none;
        }

        @keyframes call-bubble-pulse {
          0% {
            transform: scale(1);
            opacity: 0.45;
          }

          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .call-bubble__pulse {
            animation: none;
          }
        }
      `}</style>
    </button>
  );
};

export default CallBubble;
