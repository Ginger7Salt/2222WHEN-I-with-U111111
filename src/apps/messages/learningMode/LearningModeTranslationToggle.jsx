// src/apps/messages/learningMode/LearningModeTranslationToggle.jsx
//
// 语言学习模式开启时，文字气泡下面的"译文"折叠条：默认折叠，点一下
// 展开/收起翻译文字。纯展示组件，展开状态是本地 useState，不写回 DB、
// 也不跨渲染/刷新记忆——跟 RP 子应用 ThinkingFoldBlock 的"只影响这一次
// 怎么显示"是同一个思路，不需要额外的字段。
import React, { useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';

export const LearningModeTranslationToggle = ({ translationText }) => {
  const [expanded, setExpanded] = useState(false);

  if (!translationText) {
    return null;
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1 text-[10px] opacity-55 active:opacity-90"
      >
        <Languages className="w-3 h-3" />
        <span>译文</span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {expanded && (
        <p className="mt-1 text-[12px] leading-relaxed opacity-80 whitespace-pre-wrap">
          {translationText}
        </p>
      )}
    </div>
  );
};

export default LearningModeTranslationToggle;