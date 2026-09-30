// src/utils/lazyWithRetry.js
//
// 懒加载模块（React.lazy）配套的重试封装。
//
// 背景：App.jsx 里三十多个子应用全部走 React.lazy(() => import(...))，
// 只在用户第一次点开对应入口时才去请求那个 chunk 文件。这个 import()
// 一旦失败一次——网络抖动、PWA 的 service worker 还缓存着旧版本的
// index.html（里面写的 chunk 文件名是旧 hash，服务器上早被新部署覆盖掉
// 了）、iOS Safari 偶发的模块加载 bug——React.lazy 内部会把这次失败的
// promise 永久缓存下来，之后同一个入口只要一渲染就会立刻重新抛出同一个
// 错误。ErrorBoundary 原来的"Retry"按钮只是 setState 重新渲染子树，并
// 不会让 React.lazy 重新发起 import()，所以表现出来就是"点一次没进去，
// 之后永远进不去，除非用户自己手动刷新页面"——这正是"没有 bug 也点不进
// 去"这个现象的根因。
//
// 这个封装做两件事：
// 1. 网络抖动：import() 失败后自动重试几次（间隔递增），大多数偶发失败
//    在这一步就能自愈，用户完全无感，根本走不到下面的第 2 步。
// 2. 版本更新导致的 chunk 找不到（重试也没用的那种）：识别出这类报错的
//    特征后，用 sessionStorage 做"这个入口这次会话已经自动刷新过一次"的
//    标记，自动 location.reload() 一次去拿新版本的 index.html/chunk 列表；
//    如果刷新过一次还是失败（说明不是版本问题），就正常把错误抛给
//    ErrorBoundary，避免刷新死循环。

import React from 'react';

const RELOAD_FLAG_PREFIX = 'lazyChunkReloaded:';
const RETRY_COUNT = 2; // 网络抖动重试次数（不含首次尝试）
const RETRY_BASE_DELAY_MS = 600; // 重试间隔基数，逐次递增（600ms / 1200ms）

// 不同浏览器对"动态 import 的模块脚本加载失败"这件事的报错文案不统一，
// 这里尽量把已知的几种都覆盖到。命中任意一条就认为是"chunk 找不到/加载
// 失败"类错误，而不是代码本身的逻辑 bug。
const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Loading chunk .* failed/i,
  /Unable to preload CSS/i,
  /dynamically imported module/i,
];

export function isChunkLoadError(error) {
  const message = (error && error.message) || String(error || '');
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// chunkName 只用来拼 sessionStorage 的 key（同时方便调试时在报错里认出
// 是哪个入口），跟具体子应用一一对应，这样"A 应用触发了自动刷新"不会
// 影响"B 应用是否已经自动刷新过"的判断。
export function lazyWithRetry(importFn, chunkName) {
  return React.lazy(async () => {
    let lastError;

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await importFn();
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_COUNT) {
          // eslint-disable-next-line no-await-in-loop
          await wait(RETRY_BASE_DELAY_MS * (attempt + 1));
        }
      }
    }

    // 重试用尽仍失败。如果特征像是"版本更新导致的 chunk 找不到"，且这次
    // 会话还没为这个入口自动刷新过，就刷新一次去拿新版本；已经刷新过还是
    // 不行，说明不是版本问题（比如这个用户本来就没网），就不再刷，正常
    // 把错误抛给 ErrorBoundary 展示出来。
    if (isChunkLoadError(lastError) && typeof window !== 'undefined' && window.sessionStorage) {
      const flagKey = `${RELOAD_FLAG_PREFIX}${chunkName || 'unknown'}`;
      let alreadyReloaded = null;
      try {
        alreadyReloaded = window.sessionStorage.getItem(flagKey);
      } catch (storageError) {
        // 隐私模式等场景下 sessionStorage 可能不可用，读取失败就当作
        // "还没刷新过"处理，不因为这个额外抛错。
        alreadyReloaded = null;
      }

      if (!alreadyReloaded) {
        try {
          window.sessionStorage.setItem(flagKey, '1');
        } catch (storageError) {
          // 写入失败也不影响继续刷新，顶多下次再判断失误一次。
        }
        window.location.reload();
        // reload() 是异步的，返回一个永远不 resolve 的 promise，避免
        // React 在页面真正刷新之前先把这次失败渲染成一次错误状态。
        return new Promise(() => {});
      }
    }

    throw lastError;
  });
}

export default lazyWithRetry;