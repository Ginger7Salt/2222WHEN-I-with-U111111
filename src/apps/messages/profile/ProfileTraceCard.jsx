import React from 'react';

import './profileCard.css';

// 资料卡每次更新后，在聊天流里留下的那一张痕迹——字段跟 ProfileCard
// 完全对得上（昵称/标签/签名/版本号），但故意做成纯静态快照：没有
// 翻面、没有3D、没有blur，只有一层很浅的box-shadow。聊天记录里可能
// 堆好几条这种痕迹，渲染成本必须压到最低，所以这里不做任何交互。
const ProfileTraceCard = ({ message }) => {
  const { nickname, tag, signature, edition } = message?.metadata || {};

  const dateLabel = new Date(
    message?.timestamp || message?.createdAt || Date.now()
  ).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });

  const editionLabel = edition ? `EDITION ${String(edition).padStart(2, '0')}` : '';

  return (
    <div className="my-2 flex justify-center">
      <div className="profile-trace-card">
        <div className="profile-trace-band">
          <span>Companion ID · Updated</span>
        </div>
        <div className="profile-trace-body">
          <div>
            <div className="name">{nickname || '—'}</div>
            <div className="tag">{tag || ''}</div>
          </div>
          <div className="profile-trace-sig">
            <div className="sig">{signature || ''}</div>
            <div className="meta">
              {[editionLabel, dateLabel].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTraceCard;