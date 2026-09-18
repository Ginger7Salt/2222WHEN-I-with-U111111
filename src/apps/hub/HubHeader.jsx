// src/apps/hub/HubHeader.jsx
//
// 主页头部区域的统一入口：根据「主页版式」设置，从版式注册表里挑一个
// 版式组件渲染出来。App.jsx 只需要引用这一个组件，不用关心具体是
// 哪种版式、内部有几张卡片。

import React from 'react';
import useHubHeaderLayout from './useHubHeaderLayout';
import {
  HUB_HEADER_LAYOUT_CLASSIC,
  HUB_HEADER_LAYOUT_COMPONENTS,
} from './hubHeaderLayouts/registry';

export const HubHeader = () => {
  const layoutId = useHubHeaderLayout();

  const LayoutComponent =
    HUB_HEADER_LAYOUT_COMPONENTS[layoutId] ||
    HUB_HEADER_LAYOUT_COMPONENTS[HUB_HEADER_LAYOUT_CLASSIC];

  return <LayoutComponent />;
};

export default HubHeader;