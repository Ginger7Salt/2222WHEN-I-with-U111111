import React, { useEffect, useRef, useState } from 'react';

// 发送成功后，在输入框上方短促地闪一下"心电图"波形，纯装饰性效果，
// 不承载任何状态、不影响发送流程；开关在聊天设置里，默认关闭。
//
// pulseKey 每次自增都要重新播放一次动画：内部把它当 <svg> 的 key，
// 强制重新挂载，否则同一段 CSS 动画不会因为 prop 变化而重新触发。
const PULSE_VISIBLE_MS = 900;

const HeartbeatPulse = ({ pulseKey }) => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (!pulseKey) return undefined;

    setVisible(true);

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, PULSE_VISIBLE_MS);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [pulseKey]);

  if (!visible) return null;

  return (
    <div className="heartbeat-pulse-wrap" aria-hidden="true">
      <style>{`
        .heartbeat-pulse-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 18px;
          margin-bottom: 2px;
          pointer-events: none;
          overflow: hidden;
        }

        .heartbeat-pulse-svg {
          width: 130px;
          height: 18px;
        }

        .heartbeat-pulse-path {
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          animation: heartbeat-pulse-draw ${PULSE_VISIBLE_MS}ms ease-out forwards;
        }

        @keyframes heartbeat-pulse-draw {
          0% { stroke-dashoffset: 260; opacity: 1; }
          60% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
      `}</style>

      <svg
        key={pulseKey}
        viewBox="0 0 200 40"
        className="heartbeat-pulse-svg"
      >
        <path
          d="M0 20 L44 20 L54 4 L64 36 L74 8 L82 20 L96 20 L106 12 L114 20 L200 20"
          fill="none"
          stroke="var(--accent-color)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="heartbeat-pulse-path"
        />
      </svg>
    </div>
  );
};

export default HeartbeatPulse;