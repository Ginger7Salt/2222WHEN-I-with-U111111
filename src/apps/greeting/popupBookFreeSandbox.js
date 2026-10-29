// src/apps/greeting/popupBookFreeSandbox.js
//
// 立体书"自由发挥"模式的沙箱：角色写整本书的 three.js 代码，放进隔离的 iframe 里运行。
// 这个文件比较重（里面内联了一份 three 的源码），只在读自由书和试跑时才会被动态 import，
// 不进主包，也不进积木库模式的 three 场景块。
//
// 安全模型和贺卡自由创作一样（见 greetingSandbox.js），两层缺一不可：
//   1. iframe 只开 sandbox="allow-scripts"，不给 allow-same-origin：脚本跑在独立的不透明
//      origin 里，读不到本 app 的 IndexedDB / localStorage / API Key / 聊天数据，也不能
//      操作父页面；
//   2. 文档里加 CSP：default-src 'none'，connect-src 'none'，发不出任何网络请求，也加载
//      不了外部资源（图片/字体/脚本）。three 是由本文件直接内联进去的，不走网络。
// 角色代码做不到的事：联网、读本地数据、开新窗口、跳转父页面。
// 做得到、本文件挡不住的事：把页面卡死（死循环）、吃满 GPU。所以读的时候有"迟迟没出画面"
// 的提示和随时能点的关闭按钮，生成时有试跑；iframe 卸载即停止。
//
// iframe 和父页面之间只有一个单向的小通道：iframe 用 postMessage 报告
// { pb: 1, type: 'ready' | 'error', message }，父页面只认这两种。

import THREE_CJS from '../../../node_modules/three/build/three.cjs?raw';
import { FREE_CSP } from './greetingSandbox';
import { FREE_BOOK_LIMITS } from './popupBookConstants';

// three.cjs 是 CommonJS：包一层造出 module / exports，再挂到全局 THREE 上。
// 源码里如果出现 </script 或 <!--，会提前结束内联脚本，这里转义（字符串里的含义不变）。
const escapeForInlineScript = (source) =>
  String(source).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const THREE_BOOT = escapeForInlineScript(
  `(function(){var module={exports:{}};var exports=module.exports;\n${THREE_CJS}\n;window.THREE=module.exports;})();`,
);

const BASE_CSS = [
  'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#1b1a18}',
  '*{box-sizing:border-box}',
  'body{font-family:"Noto Serif SC","Source Han Serif SC","Songti SC","STSong",Georgia,serif;color:#f1ece0;',
  '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
  '#c{position:fixed;left:0;top:0;width:100%;height:100%;display:block;touch-action:none}',
].join('');

// 在角色代码之前运行：把错误和"已经画出画面"报告给父页面，并保证链接不会把 iframe 导航走。
const BOOTSTRAP_JS = `(function(){
var post=function(t,m){try{parent.postMessage({pb:1,type:t,message:String(m||'').slice(0,300)},'*');}catch(e){}};
var done=false;
var ready=function(){if(done)return;done=true;post('ready');};
window.addEventListener('error',function(e){post('error',(e.message||'error').replace(/^Uncaught\\s+/,''));});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;post('error',(r&&r.message)||r||'promise rejected');});
var raf=window.requestAnimationFrame.bind(window),n=0;
window.requestAnimationFrame=function(f){return raf(function(t){try{f(t);}finally{n++;if(n>=3)ready();}});};
setTimeout(ready,2500);
document.addEventListener('click',function(e){var t=e.target;while(t&&t.nodeType===1){if(t.tagName==='A'){e.preventDefault();return;}t=t.parentNode;}},true);
})();`;

// 把 JSON 安全地塞进内联脚本：< 转成 <，避免 </script 或 <!-- 截断。
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

// 拼出 iframe 的 srcDoc。CSP 的 <meta> 必须放在 <head> 最前面。
export const buildFreeBookDocument = ({ code, book }) => {
  const meta = {
    title: String(book?.cover?.title || book?.title || ''),
    sign: String(book?.sign || ''),
    kind: String(book?.kindLabel || ''),
  };

  return (
    `<!doctype html><html lang="zh-CN"><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${FREE_CSP}">` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">` +
    `<style>${BASE_CSS}</style>` +
    `</head><body><canvas id="c"></canvas>` +
    `<script>window.BOOK=${safeJson(meta)};</script>` +
    `<script>${BOOTSTRAP_JS}</script>` +
    `<script>${THREE_BOOT}</script>` +
    `<script>\n${escapeForInlineScript(code)}\n</script>` +
    `</body></html>`
  );
};

// 判断一条来自 iframe 的消息是不是我们认的那两种。
export const readFrameMessage = (event, frameWindow) => {
  if (!frameWindow || event.source !== frameWindow) return null;
  const data = event.data;
  if (!data || data.pb !== 1) return null;
  if (data.type === 'ready') return { type: 'ready', message: '' };
  if (data.type === 'error') return { type: 'error', message: String(data.message || '').slice(0, 300) };
  return null;
};

// 试跑：在一个看不见的 iframe 里把代码真的跑一下，确认没有报错、画得出画面。
// 返回 { ok, error, skipped, timedOut }：
//   - 报错 -> ok:false，error 是可以直接喂回给角色的原因；
//   - 画出了画面 -> ok:true；
//   - 超时一直没有任何结果 -> ok:true, timedOut:true（说明不了什么，不拿它拒绝一本书）；
//   - 页面在后台（document.hidden）或没有 DOM -> ok:true, skipped:true（后台标签页不跑动画，试不出来）。
// 试跑用的 iframe 放在视口里但几乎透明、压在最底层：放到屏幕外的话浏览器会把跨域 iframe 的动画停掉。
export const dryRunFreeBook = ({ code, book, timeoutMs = FREE_BOOK_LIMITS.dryRunTimeoutMs }) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || document.hidden) {
      resolve({ ok: true, skipped: true });
      return;
    }

    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.tabIndex = -1;
    frame.style.cssText =
      'position:fixed;left:0;top:0;width:360px;height:640px;border:0;opacity:0.01;pointer-events:none;z-index:-1;';

    let finished = false;
    let timer = 0;

    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      try {
        frame.remove();
      } catch (_) {
        /* 已经被移走 */
      }
      resolve(result);
    };

    function onMessage(event) {
      const message = readFrameMessage(event, frame.contentWindow);
      if (!message) return;
      if (message.type === 'error') finish({ ok: false, error: message.message || '运行时报错' });
      else if (message.type === 'ready') finish({ ok: true });
    }

    window.addEventListener('message', onMessage);
    timer = setTimeout(() => finish({ ok: true, timedOut: true }), timeoutMs);
    frame.srcdoc = buildFreeBookDocument({ code, book });
    document.body.appendChild(frame);
  });