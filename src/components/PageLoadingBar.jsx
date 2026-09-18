import React, { useEffect, useRef, useState } from 'react';

/**
 * 顶部页面加载条。
 *
 * 项目里各个 App 切换是同步的状态切换（没有真正的懒加载/路由异步过程），
 * 所以这里不追踪"真实加载进度"，而是在 activeKey（当前打开的页面标识）
 * 变化的瞬间，跑一段模拟进度 + 光泽扫光的动画，给用户"页面正在打开"的
 * 及时反馈。每次切换页面都会用一个新的 key 重新挂载内部条，从而重新
 * 触发一遍完整动画，互不干扰、也不会因为快速连续切页而卡在中间状态。
 */
const PageLoadingBar = ({ activeKey }) => {
  const [runId, setRunId] = useState(0);
  const previousKeyRef = useRef(activeKey);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      // 首次挂载（开屏）不显示，避免和 Preloader 抢戏。
      hasMountedRef.current = true;
      previousKeyRef.current = activeKey;
      return;
    }

    if (previousKeyRef.current === activeKey) {
      return;
    }

    previousKeyRef.current = activeKey;
    setRunId((id) => id + 1);
  }, [activeKey]);

  if (runId === 0) {
    return null;
  }

  return (
    <div className="page-loading-bar" aria-hidden="true">
      <div key={runId} className="page-loading-bar__track">
        <span className="page-loading-bar__shimmer" />
      </div>
    </div>
  );
};

export default PageLoadingBar;