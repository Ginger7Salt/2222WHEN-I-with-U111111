// src/apps/messages/interactions/halloween/HalloweenSvgDefs.jsx
//
// 四个万圣节彩蛋共用的 SVG 图形定义（幽灵/南瓜/蝙蝠/蜘蛛），用
// <symbol> + 各处 <use href="#xxx"> 引用，避免同一张图标在页面上重复
// 渲染多份 markup。这个组件本身不显示任何东西，只在 ChatRoom 里挂载
// 一次即可，整个聊天室范围内都能 <use> 它。
//
// 注意：这里每个 <symbol> 的 id 必须在全局唯一，且不能跟任何引用它的
// 外层元素再重名——shell 贝壳渲染那边就因为重名 id 导致 <use> 自引用、
// 图形渲染不出来过一次，这里引以为戒，所有外层 wrapper 一律不叫
// "ghost"/"pumpkin"/"bat"/"spider" 这几个名字。

import React from 'react';

const HalloweenSvgDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <symbol id="hwe-ghost" viewBox="0 0 60 70">
        <g className="hwe-ghost-art">
          <path
            className="hwe-ghost-body"
            d="M9 64V28C9 13 19 4 30 4s21 9 21 24v36l-7-7-7 7-7-7-7 7-7-7z"
          />
          <ellipse className="hwe-ghost-eye" cx="22" cy="28" rx="3.6" ry="4.8" />
          <ellipse className="hwe-ghost-eye" cx="38" cy="28" rx="3.6" ry="4.8" />
          <circle cx="23" cy="26.3" r="1" fill="#ffffff" />
          <circle cx="39" cy="26.3" r="1" fill="#ffffff" />
          <ellipse className="hwe-ghost-cheek" cx="16" cy="36" rx="3.4" ry="2" />
          <ellipse className="hwe-ghost-cheek" cx="44" cy="36" rx="3.4" ry="2" />
          <path
            d="M26 37q4 4 8 0"
            fill="none"
            stroke="#2a1636"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      </symbol>

      <symbol id="hwe-pumpkin" viewBox="0 0 64 60">
        <path d="M31 12c-3-6 1-9 5-10" fill="none" stroke="#5d7a3a" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="18" cy="35" rx="15" ry="20" fill="#e57a28" />
        <ellipse cx="46" cy="35" rx="15" ry="20" fill="#e57a28" />
        <ellipse cx="32" cy="35" rx="14" ry="22" fill="#f08a3c" />
        <path
          d="M32 14v42M22 17q-6 18 0 38M42 17q6 18 0 38"
          fill="none"
          stroke="#c85f17"
          strokeWidth="1.4"
          opacity="0.6"
        />
        <path d="M21 32l5 7h-10z" fill="#3a1d0c" />
        <path d="M43 32l5 7h-10z" fill="#3a1d0c" />
        <path d="M20 45q12 10 24 0l-4-2-3 3-3-3-3 3-3-3z" fill="#3a1d0c" />
      </symbol>

      <symbol id="hwe-bat" viewBox="0 0 64 36">
        <g className="hwe-bat-wl">
          <path
            d="M32 18C26 6 14 4 2 8c5 3 6 8 5 13 4-2 8-1 11 3 2-4 7-6 14-6z"
            fill="var(--hwe-bat-color)"
          />
        </g>
        <g className="hwe-bat-wr">
          <path
            d="M32 18C38 6 50 4 62 8c-5 3-6 8-5 13-4-2-8-1-11 3-2-4-7-6-14-6z"
            fill="var(--hwe-bat-color)"
          />
        </g>
        <ellipse cx="32" cy="20" rx="5" ry="8" fill="var(--hwe-bat-color)" />
        <path d="M28 13l1.5 5-4-2zM36 13l-1.5 5 4-2z" fill="var(--hwe-bat-color)" />
        <circle cx="30" cy="18" r="1.1" fill="#ffd36b" />
        <circle cx="34" cy="18" r="1.1" fill="#ffd36b" />
      </symbol>

      <symbol id="hwe-spider" viewBox="0 0 40 34">
        <g fill="var(--hwe-spider-color)">
          <ellipse cx="20" cy="20" rx="7" ry="8" />
          <circle cx="20" cy="9" r="4.4" />
          <circle cx="17.5" cy="8" r="0.9" fill="#ffd36b" />
          <circle cx="22.5" cy="8" r="0.9" fill="#ffd36b" />
          <g stroke="var(--hwe-spider-color)" strokeWidth="1.3" fill="none" strokeLinecap="round">
            <path d="M14 15 4 10M14 19 2 19M14 23 4 29" />
            <path d="M26 15 36 10M26 19 38 19M26 23 36 29" />
          </g>
        </g>
      </symbol>
    </defs>
  </svg>
);

export default HalloweenSvgDefs;