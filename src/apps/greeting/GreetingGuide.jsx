// src/apps/greeting/GreetingGuide.jsx
//
// 收藏夹的使用说明：第一次打开时自动弹出，之后点标题旁边的"?"随时再看。
// 样式复用抽屉的 .gc-sheet* 系列，只有几处说明专用的样式在 greetingGuide.css。
//
// "看过了"记在浏览器本地（localStorage）：换设备或清掉站点数据后会再弹一次，不影响任何功能。

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import './greetingGuide.css';

const STORAGE_KEY = 'when-i-with-u:greeting-guide-seen:v1';

export const hasSeenGreetingGuide = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // 读不了本地存储（隐私模式等）时当作没看过；写不进去的话每次打开都会弹，可以接受。
    return false;
  }
};

export const markGreetingGuideSeen = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* 写不进去就算了 */
  }
};

const SECTIONS = [
  {
    no: '01',
    title: '这里放什么',
    lines: [
      '贺卡：一张写给你的卡，拆开之后有光、有字，是角色亲手写的。',
      '立体书：一本摊开的双页书，翻开后有东西从纸面上立起来，是角色亲手做的。',
    ],
  },
  {
    no: '02',
    title: '可以点名请 TA 做',
    lines: [
      '右上角的「请 TA 做一张 / 一本」：选角色、选类型，也可以留一句想对 TA 说的话。',
      '点下去之后 TA 会花一点时间去做，做好了会提示你，到收藏夹里拆开或翻开就行。',
    ],
  },
  {
    no: '03',
    title: '聊天时 TA 也会主动送',
    lines: [
      '聊着聊着，TA 想起你、想哄你、想和你回忆点什么，就可能自己动手做一份送来。',
      '不用你开口，也不是定时发的；同一个角色一天最多主动送一次。主动送的会标上「TA 主动送」。',
    ],
  },
  {
    no: '04',
    title: '「自由发挥」是什么意思',
    lines: [
      '做立体书时可以选「自由发挥」：不用现成的积木，TA 自己写整本书的画面，想怎么做就怎么做。',
      '它更费时间，偶尔会没做成，没做成可以重试；打开之后整个画面都是 TA 的，右上角的叉号随时能关。',
    ],
  },
];

const GreetingGuide = ({ open, onClose }) => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const layer = (
    <div className={`gc-sheet-layer${shown ? ' is-shown' : ''}`}>
      <div className="gc-sheet-bg" onClick={onClose} />
      <div className="gc-sheet gc-guide" role="dialog" aria-modal="true" aria-label="收藏夹使用说明">
        <div className="gc-sheet__grab" />
        <h2>收藏夹怎么用</h2>
        <p className="gc-sheet__sub">四件事，读完就会了。之后想再看，点标题旁边的「?」。</p>

        {SECTIONS.map((section) => (
          <section key={section.no} className="gc-guide__item">
            <span className="gc-guide__no">{section.no}</span>
            <div>
              <h3>{section.title}</h3>
              {section.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        ))}

        <button type="button" className="gc-primary" onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );

  return createPortal(layer, document.body);
};

export default GreetingGuide;