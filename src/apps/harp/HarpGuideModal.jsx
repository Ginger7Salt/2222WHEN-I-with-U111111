import React, { useEffect } from 'react';
import { X } from 'lucide-react';

import './harpGuide.css';

// 星光小竖琴 —— 玩法说明弹窗（第一次进竖琴弹一次，右上角问号随时重开）。
// 颜色用 harp.css 里 .harp-page 上的 --hp-* 别名，所以必须渲染在
// .harp-page 里面（HarpPage 里就是这么放的）。
const HarpGuideModal = ({ characterName = 'TA', onClose }) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="hg-backdrop" onClick={onClose} role="presentation">
      <div
        className="hg-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="harp-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="hg-close" onClick={onClose} aria-label="关闭">
          <X className="h-4 w-4" />
        </button>

        <p className="hg-eyebrow">How to play</p>
        <h2 id="harp-guide-title" className="hg-title">
          小竖琴怎么玩
        </h2>

        <ul className="hg-list">
          <li>
            <strong>弹奏</strong>
            轻触琴弦弹一个音，也可以从弦上滑过。电脑上按键盘 1 到 9、0 也行。
          </li>
          <li>
            <strong>收藏</strong>
            停手两秒多算一段，至少三个音。起个名字收藏，之后在收藏列表里重听。
          </li>
          <li>
            <strong>弹给 {characterName} 听</strong>
            把刚弹的一段，或收藏里的旋律，作为一张卡片发到聊天里，{characterName} 会马上回应。
            {characterName} 听不到声音，能读到的只有音的个数、节奏、音域和简谱。
          </li>
          <li>
            <strong>{characterName} 弹给你听</strong>
            {characterName} 想弹琴时，会在聊天里发来一张旋律卡片，点一下就能听，喜欢的可以收藏。
          </li>
        </ul>

        <p className="hg-note">
          关于 {characterName} 什么时候会主动弹琴：为了不给每一次对话都增加负担，只有你在这个聊天里
          第一次把旋律弹给 {characterName} 听之后，{characterName} 才会知道自己也可以弹琴。
          在那之前，{characterName} 不会主动弹；之后什么时候弹、弹什么，都由 {characterName} 自己决定。
        </p>

        <button type="button" className="hp-btn hp-btn-primary hg-ok" onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );
};

export default HarpGuideModal;
