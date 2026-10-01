// src/apps/messages/work/WorkEmptyStage.jsx
//
// work 聊天窗刚进入、还没有消息时的空状态：大面积留白居中，头像放大+
// 问候语标题+工作本本摘要（淡色小字）。
//
// 跟参考稿的一个差异：参考稿里空状态的输入框是居中出现在这个区域里的，
// 真实应用的输入框（含引用回复、地点横幅等一大堆联动逻辑）在
// ChatRoom.jsx 自己的 <footer> 里，为了不重复实现一份输入框、不引入
// 两处输入框行为不一致的风险，这里不复刻"输入框也居中"这部分，只做
// 问候语居中；输入框仍然固定在底部的 footer，这个取舍已经在后续沟通里
// 跟你对过。

import React, { useEffect, useState } from 'react';
import WorkMiniAvatar from './WorkMiniAvatar';
import { getGreetingLine, getWorkNotebookSummary, buildSummaryParts } from './workGreetingService';

export const WorkEmptyStage = ({ chat, character }) => {
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
    <div className="flex h-full flex-col items-center justify-center gap-4 px-7 text-center">
      <WorkMiniAvatar chat={chat} character={character} size="lg" />

      <p
        className="max-w-[260px] text-[17px] font-semibold leading-relaxed"
        style={{ color: 'var(--text-main)' }}
      >
        {greetingLine}
      </p>

      {summaryParts && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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

export default WorkEmptyStage;