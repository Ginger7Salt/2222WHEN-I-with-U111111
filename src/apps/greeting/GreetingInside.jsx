// src/apps/greeting/GreetingInside.jsx
//
// 贺卡内页。内页完全由角色定义，不跟随 app 主题：
//   - 积木库模式：BlocksScene（上半页的光与线）+ BlocksText（下半页的文字），
//     颜色/场景/字体都来自角色返回的 inside.palette / scene / font。
//   - 自由创作模式：FreeFrame，把角色写的整张内页 HTML 放进沙箱 iframe。
//
// 这里所有颜色都通过 CSS 自定义属性（--gc-*）注入，并且已经在
// greetingAiService.normalizeInsideStyle 里校验过格式和对比度；渲染层不再信任
// 任何字符串，只按枚举挑选 SVG 变体。

import React, { useMemo } from 'react';
import { FONT_STACKS } from './greetingConstants';
import { buildSandboxDocument } from './greetingSandbox';
import { formatCardDate } from './greetingFormat';

// 正文页的底色/文字色/字体，写成内联样式（只含白名单里的值）。
export const getInsidePageStyle = (inside) => {
  const palette = inside?.palette || {};
  return {
    '--gc-paper': palette.paper,
    '--gc-ink': palette.ink,
    '--gc-mute': palette.mute,
    fontFamily: FONT_STACKS[inside?.font] || FONT_STACKS.serif,
  };
};

const SceneArt = ({ scene }) => {
  if (scene === 'ripple') {
    return (
      <svg viewBox="0 0 270 300" aria-hidden="true">
        <circle cx="135" cy="150" r="30" />
        <circle cx="135" cy="150" r="30" />
        <circle cx="135" cy="150" r="30" />
        <circle cx="135" cy="150" r="30" />
      </svg>
    );
  }
  if (scene === 'horizon') {
    return (
      <svg viewBox="0 0 270 300" aria-hidden="true">
        <path className="gc-hz" pathLength="1" d="M0 214 H270" />
        <circle className="gc-st" style={{ '--d': '0s' }} cx="60" cy="64" r="1.6" />
        <circle className="gc-st" style={{ '--d': '1.1s' }} cx="104" cy="112" r="1.2" />
        <circle className="gc-st" style={{ '--d': '2.2s' }} cx="214" cy="52" r="1.6" />
        <circle className="gc-st" style={{ '--d': '.6s' }} cx="236" cy="128" r="1.2" />
        <circle className="gc-st" style={{ '--d': '1.7s' }} cx="34" cy="150" r="1.2" />
      </svg>
    );
  }
  if (scene === 'orbit') {
    return (
      <svg viewBox="0 0 270 300" aria-hidden="true">
        <circle className="gc-c1" pathLength="1" cx="135" cy="150" r="70" />
        <g className="gc-orbit">
          <circle cx="135" cy="80" r="3.4" />
        </g>
      </svg>
    );
  }
  if (scene === 'waves') {
    return (
      <svg viewBox="0 0 270 300" aria-hidden="true">
        <g className="gc-wv">
          <path className="gc-w" d="M-30 110 C30 94 90 126 150 110 S270 96 330 110" />
          <path className="gc-w" d="M-30 140 C30 124 90 156 150 140 S270 126 330 140" />
        </g>
        <g className="gc-wv">
          <path className="gc-w" d="M-30 170 C30 154 90 186 150 170 S270 156 330 170" />
          <path className="gc-w" d="M-30 200 C30 184 90 216 150 200 S270 186 330 200" />
        </g>
        <g className="gc-wv">
          <path className="gc-w" d="M-30 230 C30 214 90 246 150 230 S270 216 330 230" />
        </g>
      </svg>
    );
  }
  return null;
};

// 上半页（封面翻开后的背面）。
export const BlocksScene = ({ inside }) => {
  const palette = inside?.palette || {};
  const scene = inside?.scene || 'glow';

  return (
    <div
      className={`gc-scene gc-scene--${scene}`}
      style={{
        '--gc-scene-bg': palette.sceneBg,
        '--gc-scene-ink': palette.sceneInk,
        '--gc-glow-a': palette.glowA,
        '--gc-glow-b': palette.glowB,
      }}
    >
      <div className="gc-scene__layer">
        {scene !== 'none' && (
          <>
            <i className="gc-sorb gc-so1" />
            <i className="gc-sorb gc-so2" />
          </>
        )}
        <SceneArt scene={scene} />
      </div>
    </div>
  );
};

// 下半页：称呼、正文、署名。文字逐行出现的延迟由 --i 控制。
export const BlocksText = ({ card }) => {
  const inside = card?.inside || {};
  const body = Array.isArray(inside.body) ? inside.body : [];
  const total = body.length;

  return (
    <div className="gc-txt">
      <div className="gc-lab gc-ln" style={{ '--i': 0 }}>
        To / {inside.to || '给你'}
      </div>
      {body.map((line, index) => (
        <p key={index} className="gc-ln" style={{ '--i': index + 1 }}>
          {line}
        </p>
      ))}
      <div className="gc-foot gc-ln" style={{ '--i': total + 1, '--hd': `${(total + 1) * 0.55 + 1}s` }}>
        <small>{formatCardDate(card?.revealAt || card?.createdAt)}</small>
        <span>{inside.sign}</span>
      </div>
    </div>
  );
};

// 自由创作模式的沙箱 iframe。
// 只有 mounted=true（贺卡翻开之后）才真正创建 iframe，这样角色写的动画是从
// 用户翻开的那一刻开始播放，而不是在合着的时候就已经演完了。
// sandbox 只给 allow-scripts，故意不给 allow-same-origin：见 greetingSandbox.js。
export const FreeFrame = ({ html, mounted }) => {
  const srcDoc = useMemo(() => buildSandboxDocument(html), [html]);

  return (
    <div className={`gc-free${mounted ? ' is-on' : ''}`}>
      {mounted && (
        <iframe
          title="贺卡内页"
          className="gc-free__frame"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          allow=""
          scrolling="no"
          srcDoc={srcDoc}
        />
      )}
      <i className="gc-free__fold" aria-hidden="true" />
    </div>
  );
};
