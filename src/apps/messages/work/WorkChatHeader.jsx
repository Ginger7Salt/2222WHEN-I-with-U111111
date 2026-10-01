// src/apps/messages/work/WorkChatHeader.jsx
//
// work 聊天窗的"浮动身份标"：不是一整条 header bar，左上角只浮一个
// 小小的头像+名字+在线绿点，没有背景条、没有分割线、没有一排图标按钮；
// 右上角只留一个极简的"工作本本"入口。参考设计见对话里确认过的
// HTML 参考稿（mini-identity / mini-notebook）。
//
// 返回按钮是功能必需品（参考稿的纯视觉 mock 里没画，但真实应用需要），
// 放在身份标最左侧，同样做成无背景的幽灵按钮，尽量不抢视觉重量。

import React from 'react';
import { ArrowLeft, NotebookText, Settings } from 'lucide-react';
import WorkMiniAvatar from './WorkMiniAvatar';

export const WorkChatHeader = ({
  chat,
  character,
  onBack,
  onOpenNotebook,
  onOpenSettings,
}) => {
  return (
    <>
      <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-full p-1.5 opacity-70 transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
          title="返回列表"
          aria-label="返回列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <WorkMiniAvatar chat={chat} character={character} size="sm" />

        <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-main)' }}>
          {character?.name || '助理'}
        </span>

        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: '#3ecf6b' }}
        />
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center justify-center rounded-full p-1.5 opacity-55 transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
          title="对话空间设置"
          aria-label="对话空间设置"
        >
          <Settings className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenNotebook}
          className="flex items-center justify-center rounded-full p-1.5 opacity-55 transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
          title="工作本本（待办与提醒）"
          aria-label="工作本本"
        >
          <NotebookText className="h-4 w-4" />
        </button>
      </div>
    </>
  );
};

export default WorkChatHeader;