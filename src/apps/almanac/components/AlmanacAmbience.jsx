import React from 'react';

/*
 * 页面背景氛围：两团弥散光和几粒缓缓上飘的光点。
 * 固定在屏幕上、不参与布局。光点的位置写死，不会每次渲染都变。
 * 动画在 prefers-reduced-motion 下会自动停掉（见 almanacMonument.css）。
 */

const MOTES = [
  { left: '8%', top: '78%', delay: -1.2, duration: 6.5 },
  { left: '19%', top: '64%', delay: -3.4, duration: 7.5 },
  { left: '31%', top: '86%', delay: -0.6, duration: 5.5 },
  { left: '44%', top: '70%', delay: -4.6, duration: 8 },
  { left: '57%', top: '88%', delay: -2.2, duration: 6 },
  { left: '68%', top: '60%', delay: -5.1, duration: 7 },
  { left: '79%', top: '82%', delay: -1.8, duration: 5 },
  { left: '90%', top: '68%', delay: -3.9, duration: 6.8 },
];

export const AlmanacAmbience = () => (
  <div className="aam-root" aria-hidden="true">
    <span className="aam-blob aam-blob-a" />
    <span className="aam-blob aam-blob-b" />
    {MOTES.map((mote, index) => (
      <span
        key={index}
        className="aam-mote"
        style={{
          left: mote.left,
          top: mote.top,
          animationDelay: `${mote.delay}s`,
          animationDuration: `${mote.duration}s`,
        }}
      />
    ))}
  </div>
);

export default AlmanacAmbience;