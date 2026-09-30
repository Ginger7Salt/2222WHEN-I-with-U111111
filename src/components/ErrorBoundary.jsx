import React, { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { isChunkLoadError } from '../utils/lazyWithRetry';

// 2026-09：区分"这个模块的代码本身报错了"和"这个模块的代码压根没下载
// 下来"两种情况。后者是懒加载（React.lazy）引入的新故障模式——原来这里
// 的"Retry"按钮只是 setState 重新渲染子树，对 chunk 加载失败完全没用
// （React.lazy 内部会把失败的 promise 永久缓存住，一渲染就立刻再抛同一
// 个错误），点了也没反应，看起来像是随机性 bug。lazyWithRetry.js 已经
// 在再往上一层做了"自动重试 + chunk 类错误自动刷新一次"，能兜住绝大多数
// 情况；这里只处理"自动刷新过一次、依然失败"这种真正兜不住的兜底场景，
// 给用户一个说得清楚、按下去真的有用的按钮。
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary trapped error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error);

      return (
        <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-md text-rose-500 my-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-left text-xs space-y-1.5">
            <h4 className="font-semibold text-sm">
              {chunkError ? '页面版本已更新' : 'Component Sandbox Error'}
            </h4>
            <p className="opacity-80">
              {chunkError
                ? '这个入口需要的新版本文件没能加载成功，需要刷新页面才能继续（点“Retry”没用，是这类问题本身的性质，不是按钮坏了）。'
                : 'This module encountered an issue and was safely isolated.'}
            </p>
            <button
              onClick={() => {
                if (chunkError) {
                  window.location.reload();
                  return;
                }
                this.setState({ hasError: false, error: null });
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-rose-500 text-white rounded-full transition-transform active:scale-95 text-[11px]"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{chunkError ? '刷新页面' : 'Retry'}</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;