import React from 'react';

// 心情更新后留在聊天记录里的痕迹：跟 ChatDiyUpdateNotice 是同一个视觉
// 语言——居中的一条小药丸，纯公告，不可点击跳转。
//
// message.metadata.effect 里存着角色当时选的出场效果（FADE / SPOTLIGHT /
// BOUNCE，见 moodBubbleDirective.js），Slice 1 先只保证"消息真的被插入、
// 能在聊天记录里看到"这件事是对的，出场效果本身留给 Slice 2 实现——
// 这里先统一用普通淡入，不读 metadata.effect。
const MoodUpdateNotice = ({ message }) => {
  const text = message?.content || '心情更新了。';

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

export default MoodUpdateNotice;