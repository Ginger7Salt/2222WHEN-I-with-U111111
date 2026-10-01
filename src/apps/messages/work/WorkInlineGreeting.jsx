// src/apps/messages/work/WorkInlineGreeting.jsx
//
// 有消息之后，开场白收缩成消息列表顶端的一行文字（不是卡片），
// 跟着消息一起往上滚动，不常驻。

import React, { useEffect, useState } from 'react';
import { getGreetingLine, getWorkNotebookSummary, buildSummaryParts } from './workGreetingService';

export const WorkInlineGreeting = ({ character }) => {
  const [greetingLine] = useState(() => getGreetingLine());
  const [summaryParts, setSummaryParts] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      const summary = await getWorkNotebookSummary(character?.id);
      if (cancelled) return;
      setSummaryParts(buildSummaryParts(summary));
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [character?.id]);

  return (
    <div className="mb-1 flex flex-col gap-1">
      <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-sub)' }}>
        {greetingLine}
      </p>

      {summaryParts && (
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {summaryParts.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && '，'}
              <span style={part.hot ? { color: 'var(--work-accent, #d98a55)', fontWeight: 600 } : undefined}>
                {part.text}
              </span>
            </React.Fragment>
          ))}
        </p>
      )}
    </div>
  );
};

export default WorkInlineGreeting;