import React from 'react';

// DIY小屋换了样子之后弹的那一条小卡片：纯旁白文字公告，居中一条小
// 药丸，跟 ChatPokeNotice 是同一个视觉语言，但不需要震动/全屏抖动
// 那些触感效果，也不可点击跳转——纯提示，用户自己去"爪印更多入口"
// 菜单里的"角色的DIY"看。
const ChatDiyUpdateNotice = ({ message }) => {
  const text = message?.content || '小屋换了个样子。';

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
        <span>{text}</span>
      </div>
    </div>
  );
};

export default ChatDiyUpdateNotice;