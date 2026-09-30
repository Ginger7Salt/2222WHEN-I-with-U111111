// src/apps/messages/components/cards/ApiFallbackHint.jsx
//
// 【新建文件说明】
// 双 API 备用功能的可见提示：主 API 请求失败、自动切到备用 API 才生成
// 这条回复时，在气泡下面给个不打断对话的小胶囊提示。风格参考
// McpUsageTraceCard，但不需要展开/收起，纯展示，保持轻量。
import React from 'react';
import { Route } from 'lucide-react';

export const ApiFallbackHint = () => (
  <div
    className="mt-1.5 flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[9px] opacity-60"
    style={{
      background: 'var(--control-soft-bg)',
      border: '1px solid var(--divider)',
      color: 'var(--text-main)',
    }}
  >
    <Route className="h-3 w-3" />
    <span>已通过备用线路回复</span>
  </div>
);

export default ApiFallbackHint;