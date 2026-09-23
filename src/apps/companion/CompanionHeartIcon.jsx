import React from 'react';

/*
 * 小伙伴专用的"❤️ 好感度"图标——不用 emoji（全站规矩），
 * 也不用 lucide 默认 Heart 那种偏细线条、偏"医疗/收藏"感的样子，
 * 换成更圆润饱满一点的实心心形，看起来更软一点、更配"小伙伴"的调性。
 *
 * 用法跟其他 lucide 图标一样：<CompanionHeartIcon className="h-4 w-4" />，
 * 颜色跟随 currentColor，方便用 style={{ color: 'var(--accent-color)' }} 控制。
 */
const CompanionHeartIcon = ({ className = '', style }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={style}
    aria-hidden="true"
  >
    <path d="M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5 C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09 C13.09,3.81,14.76,3,16.5,3 C19.58,3,22,5.42,22,8.5 c0,3.78-3.4,6.86-8.55,11.54L12,21.35z" />
  </svg>
);

export default CompanionHeartIcon;