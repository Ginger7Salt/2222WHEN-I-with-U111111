import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Palette } from 'lucide-react';

import { getDiyArea } from './diyAreaService';

// 把角色写的 HTML/CSS/JS 片段包成一个完整的小文档，交给 iframe 用
// srcDoc 渲染。iframe 本身用 sandbox="allow-scripts"（不带
// allow-same-origin）隔离：脚本能跑，但这个文档拿到的是一个独立的
// 不透明 origin，读不到父页面的 DOM/storage，也跳不出这个框——
// 内容里的全屏定位、超大字号最多撑满这一个 iframe 的框，不会影响到
// 整个 app，所以不需要再对标签做黑名单过滤。
const buildIframeDocument = (content) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body {
    margin: 0;
    padding: 16px;
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    background: transparent;
    font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
    overflow-x: hidden;
  }
  * { box-sizing: border-box; }
</style>
</head>
<body>
${content}
</body>
</html>`;

const CharacterDiyPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    getDiyArea(chatId).then((area) => {
      if (!mountedRef.current) return;
      setContent(area?.content || '');
      setUpdatedAt(area?.updatedAt || null);
      setIsLoading(false);
    });

    return () => {
      mountedRef.current = false;
    };
  }, [chatId]);

  const formattedUpdatedAt = updatedAt
    ? new Date(updatedAt).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  return (
    <div className="relative flex h-[100dvh] flex-col" style={{ background: 'var(--bg-main)' }}>
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
          style={{ background: 'var(--control-soft-bg)' }}
          title="返回"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Palette className="h-4 w-4" />
        <span className="text-sm font-medium">
          {character?.name ? `${character.name}的DIY` : '角色的DIY'}
        </span>

        {formattedUpdatedAt && (
          <span className="ml-auto text-[10px] opacity-50">
            最近更新 · {formattedUpdatedAt}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading ? null : !content ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] leading-relaxed opacity-60">
            {character?.name || 'TA'} 还没有收拾这个小屋，
            <br />
            说不定过一阵子回来看看，就会不一样了。
          </div>
        ) : (
          <iframe
            key={updatedAt || 'diy-area'}
            title="character-diy-area"
            sandbox="allow-scripts"
            srcDoc={buildIframeDocument(content)}
            className="h-full w-full border-0"
            style={{ background: 'transparent' }}
          />
        )}
      </div>
    </div>
  );
};

export default CharacterDiyPage;