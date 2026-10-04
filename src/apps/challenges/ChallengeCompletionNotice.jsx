import React from 'react';

// 异地任务挑战——用户完成"TA发起的任务"之后留在聊天记录里的痕迹，
// 跟DIY换装/戳一戳同一个视觉语言：居中一条小药丸，纯公告，不可点击
// 跳转（具体进度还是去"异地任务挑战"面板里看）。
const ChallengeCompletionNotice = ({ message }) => {
  const taskContent = message?.metadata?.taskContent || '';
  const note = message?.content || '';

  return (
    <div className="my-2 flex justify-center">
      <div
        className="rounded-full px-3 py-1 text-center text-[11px]"
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          opacity: 0.75,
        }}
      >
        <span>
          完成了挑战「{taskContent}」{note ? ` · ${note}` : ''}
        </span>
      </div>
    </div>
  );
};

export default ChallengeCompletionNotice;