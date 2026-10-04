import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Palette, Sparkles, Loader2 } from 'lucide-react';

import { getDiyArea, requestDiyAreaUpdate } from './diyAreaService';
import './diyRequest.css';

// 把角色写的 HTML/CSS/JS 片段包成一个完整的小文档，交给 iframe 用
// srcDoc 渲染。iframe 本身用 sandbox="allow-scripts"（不带
// allow-same-origin）隔离：脚本能跑，但这个文档拿到的是一个独立的
// 不透明 origin，读不到父页面的 DOM/storage，也跳不出这个框——
// 内容里的全屏定位、超大字号最多撑满这一个 iframe 的框，不会影响到
// 整个 app，所以不需要再对标签做黑名单过滤。
//
// 这里故意不给 body 加默认内边距——DIY小屋的范围是整个版面，角色的
// 生成内容应该能填满整个 iframe（包括贴边、铺满背景），需要留白的话
// 交给角色自己的 CSS 决定，这层壳子不替它预留。
const buildIframeDocument = (content) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    background: transparent;
    font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
    overflow-x: hidden;
    overflow-y: auto;
  }
  * { box-sizing: border-box; }
</style>
</head>
<body>
${content}
</body>
</html>`;

// 把毫秒数格式化成"约 X 小时 Y 分钟"这种粗粒度的倒计时文案——这里
// 故意不做到秒级精确，省得每秒重渲染一次，用户也不需要那么精确。
const formatRemaining = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '';

  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `约 ${hours} 小时 ${minutes} 分钟`;
  if (hours > 0) return `约 ${hours} 小时`;
  return `约 ${minutes} 分钟`;
};

const CharacterDiyPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [requestPhase, setRequestPhase] = useState('idle'); // idle | loading
  const [banner, setBanner] = useState(null); // { tone: 'reject' | 'error', text }
  const mountedRef = useRef(true);
  const bannerTimeoutRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    getDiyArea(chatId).then((area) => {
      if (!mountedRef.current) return;
      setContent(area?.content || '');
      setUpdatedAt(area?.updatedAt || null);
      setCooldownUntil(area?.requestCooldownUntil || null);
      setIsLoading(false);
    });

    return () => {
      mountedRef.current = false;
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, [chatId]);

  // 冷却倒计时只需要粗粒度地刷新一下文案，每 30 秒 tick 一次足够。
  useEffect(() => {
    if (!cooldownUntil) return undefined;

    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownRemainingMs = cooldownUntil
    ? new Date(cooldownUntil).getTime() - nowTick
    : 0;
  const isOnCooldown = cooldownRemainingMs > 0;

  const showBanner = (tone, text) => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }

    setBanner({ tone, text });

    bannerTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setBanner(null);
    }, 5000);
  };

  const handleRequestUpdate = async () => {
    if (requestPhase === 'loading' || isOnCooldown || !character) return;

    setBanner(null);
    setRequestPhase('loading');

    const result = await requestDiyAreaUpdate({ chatId, character });

    if (!mountedRef.current) return;
    setRequestPhase('idle');

    if (result.status === 'success') {
      setContent(result.content || '');
      setUpdatedAt(new Date().toISOString());
      setCooldownUntil(result.cooldownUntil || null);
      setNowTick(Date.now());
    } else if (result.status === 'rejected') {
      showBanner('reject', result.reason || `${character?.name || 'TA'} 这次不太想换。`);
    } else if (result.status === 'cooldown') {
      setCooldownUntil(result.cooldownUntil || null);
      setNowTick(Date.now());
    } else {
      showBanner('error', '这次没弄成，要不等会儿再试试？');
    }
  };

  const formattedUpdatedAt = updatedAt
    ? new Date(updatedAt).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  const isButtonDisabled = requestPhase === 'loading' || isOnCooldown;

  let buttonLabel = '请TA重新布置';
  if (requestPhase === 'loading') {
    buttonLabel = '正在布置中…';
  } else if (isOnCooldown) {
    buttonLabel = `${formatRemaining(cooldownRemainingMs)}后可以再请求`;
  }

  return (
        <div
      className="character-diy-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up"
      style={{ background: 'var(--bg-main)' }}
    >
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

      <div className="flex-1 overflow-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
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

      {!isLoading && (
        <div
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: 'var(--card-border)' }}
        >
          {banner && (
            <div
              className="diy-request-banner mb-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
              style={{
                background: 'var(--control-soft-bg)',
                color: banner.tone === 'reject' ? 'var(--text-sub)' : 'var(--text-muted)',
              }}
            >
              {banner.text}
            </div>
          )}

          {requestPhase === 'loading' && (
            <div className="diy-request-progress mb-2">
              <div className="diy-request-progress-bar" />
            </div>
          )}

          <button
            type="button"
            onClick={handleRequestUpdate}
            disabled={isButtonDisabled}
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-medium transition-opacity disabled:cursor-not-allowed"
            style={{
              background: isButtonDisabled ? 'var(--control-soft-bg)' : 'var(--accent-color)',
              color: isButtonDisabled ? 'var(--text-muted)' : 'var(--accent-foreground)',
              opacity: isButtonDisabled && requestPhase !== 'loading' ? 0.7 : 1,
            }}
          >
            {requestPhase === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>{buttonLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CharacterDiyPage;