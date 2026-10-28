// src/apps/greeting/greetingSandbox.js
//
// 自由创作模式：角色直接写一整张内页的 HTML/CSS/JS，放进一个隔离的 iframe 里运行。
//
// 安全模型（两层，缺一不可）：
//   1. iframe 只开 sandbox="allow-scripts"，不给 allow-same-origin——页面里的脚本
//      跑在一个不透明的独立 origin 里，读不到本 app 的 IndexedDB / localStorage /
//      API Key / 聊天数据，也不能操作父页面。
//   2. 文档里加 CSP：default-src 'none'，只放行内联脚本/样式和 data:/blob: 资源，
//      connect-src 'none'，所以脚本发不出任何网络请求，也加载不了外部资源。
// 另外 sanitizeFreeHtml 会在存库前把明显越界的标签剥掉，作为纵深防御；真正的
// 安全边界是上面两层，不是这个清洗函数。

import { LIMITS } from './greetingConstants';

export const FREE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

// 把角色给的片段清洗成"只剩 body 内部内容"的字符串。清洗后为空，或者超长，
// 都返回空字符串，调用方应当把这张卡降级成积木库模式，而不是直接丢掉。
export const sanitizeFreeHtml = (raw) => {
  let html = String(raw || '').trim();
  if (!html) return '';

  // 模型有时会把代码包在 ``` 围栏里。
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // 去掉文档级标签，只保留里面的内容（外壳由 buildSandboxDocument 统一提供）。
  html = html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '');

  // 成对出现的、不该出现在内页里的元素：整段删掉。
  html = html.replace(/<(iframe|object|embed|form|frameset)\b[\s\S]*?<\/\1\s*>/gi, '');

  // 单个出现的标签：meta/link/base/frame 会改变文档行为或试图加载外部资源。
  html = html.replace(/<(?:meta|link|base|frame)\b[^>]*>/gi, '');

  // 带 src 的外部脚本。
  html = html.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script\s*>/gi, '');

  html = html.trim();
  if (!html || html.length > LIMITS.freeHtmlChars) return '';
  return html;
};

const FRAME_BASE_CSS = [
  'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}',
  '*{box-sizing:border-box}',
  // 兜底底色和文字色，优先级最低；角色自己写的样式会覆盖它。
  'html{background:#fbfbf9;color:#1a1a1a;font-family:"Noto Serif SC","Songti SC",serif}',
].join('');

// 阻止页面里的链接把 iframe 自己导航走。
const FRAME_GUARD_JS =
  "document.addEventListener('click',function(e){var t=e.target;" +
  "while(t&&t.nodeType===1){if(t.tagName==='A'){e.preventDefault();return;}t=t.parentNode;}},true);";

// 拼出 iframe 的 srcDoc。注意 CSP 的 <meta> 必须放在 <head> 最前面。
export const buildSandboxDocument = (fragment) =>
  `<!doctype html><html lang="zh-CN"><head>` +
  `<meta http-equiv="Content-Security-Policy" content="${FREE_CSP}">` +
  `<meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>${FRAME_BASE_CSS}</style>` +
  `<script>${FRAME_GUARD_JS}</script>` +
  `</head><body>${fragment}</body></html>`;
