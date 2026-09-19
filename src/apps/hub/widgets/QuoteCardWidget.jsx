// src/apps/hub/widgets/QuoteCardWidget.jsx
//
// 纯装饰性的"心语卡片"小组件：一个心形图标 + 两行用户自己填的文字，
// 没有任何数据来源，纯粹用来在首页放一句想说的话。
//
// 正常浏览模式下点这张卡片会弹出编辑框改文字（onOpenEdit）。

import React from 'react';
import { Heart } from 'lucide-react';
import GlassCard from '../../../components/GlassCard';

export const QuoteCardWidget = ({ config, onOpenEdit }) => {
  const { mainText = '', subText = '' } = config || {};

  return (
    <GlassCard
      blur={false}
      onClick={onOpenEdit}
      className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
    >
      <Heart className="h-6 w-6 text-rose-400" fill="currentColor" />

      <div>
        <p
          className="text-[13px] font-bold leading-snug"
          style={{ color: 'var(--text-main)' }}
        >
          {mainText || '点击填写这句话'}
        </p>
        {subText && (
          <p className="mt-0.5 text-[11px] leading-snug opacity-50">
            {subText}
          </p>
        )}
      </div>
    </GlassCard>
  );
};

export default QuoteCardWidget;