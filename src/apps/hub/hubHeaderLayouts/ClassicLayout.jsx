// src/apps/hub/hubHeaderLayouts/ClassicLayout.jsx
//
// 主页头部区域的「经典卡片」版式：完全复用现有的 ProfileHeader（资料卡）
// 和 PinnedGallery（图片墙），只是把它们包成一个整体，交给版式注册表管理。
// 这是版式框架跑通后的第一个（也是目前唯一的）版式，视觉和行为跟切版式
// 框架之前完全一致。

import React from 'react';
import ProfileHeader from '../ProfileHeader';
import PinnedGallery from '../PinnedGallery';

export const ClassicLayout = ({
  delayProfile = 100,
  delayGallery = 200,
}) => (
  <>
    <ProfileHeader delay={delayProfile} />
    <PinnedGallery delay={delayGallery} />
  </>
);

export default ClassicLayout;