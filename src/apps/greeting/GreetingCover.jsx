// src/apps/greeting/GreetingCover.jsx
//
// 贺卡封面：简约系，只放序号、标题、署名/日期，不透露内页内容。
// 颜色全部来自 app 主题变量（见 greeting.css 里 .gc-cv--* 的写法），所以会跟着
// 主题走；角色在封面上只能选款式（motif）和写标题。
//
// 尺寸由外层容器的 --cw / --ch 决定（书架里是小尺寸，拆封页里是大尺寸）。
// live=true 时弥散光斑会缓慢漂移；书架上只有未拆的卡才 live，其余保持静止，
// 避免同时有很多个带 blur 的动画层拖慢低端手机。

import React from 'react';
import { formatCardDate, formatCardNo, hashId } from './greetingFormat';

const GreetingCover = ({ card, signFallback = '', live = false, showUnreadDot = false }) => {
  const motif = card?.cover?.motif || 'mist';
  const seed = hashId(card?.id);
  const sign = card?.inside?.sign || signFallback;
  const dateText = formatCardDate(card?.revealAt || card?.createdAt);

  return (
    <div
      className={`gc-cv gc-cv--${motif}${live ? ' is-live' : ''}`}
      style={{ '--ox': `${seed % 34}%`, '--oy': `${(seed >> 3) % 34}%` }}
    >
      {(motif === 'mist' || motif === 'ink') && (
        <>
          <i className="gc-orb gc-o1" />
          <i className="gc-orb gc-o2" />
        </>
      )}
      {motif === 'blank' && <i className="gc-ring" />}
      {motif === 'line' && (
        <>
          <i className="gc-lines" />
          <i className="gc-orb gc-o1" />
        </>
      )}

      <span className="gc-idx">{formatCardNo(card?.id)}</span>
      {showUnreadDot && <i className="gc-dot" />}
      <div className="gc-ttl">{card?.cover?.title || ''}</div>
      <div className="gc-sub">
        {sign}
        {sign && dateText ? ' / ' : ''}
        {dateText}
      </div>
    </div>
  );
};

export default GreetingCover;
