// src/apps/hub/hubHeaderLayouts/registry.js
//
// 主页头部区域（资料卡 + 图片墙）的版式注册表。
// 以后新增版式（blog 风、IG 风等）时：
//   1. 在这个目录下新建一个版式组件文件（参考 ClassicLayout.jsx）；
//   2. 在下面的 HUB_HEADER_LAYOUTS 里加一条 { id, label, hint }；
//   3. 在 HUB_HEADER_LAYOUT_COMPONENTS 里把 id 映射到组件。
// 不需要改 HubHeader.jsx 或设置页的接线逻辑，两边都是照着这个注册表渲染的。
//
// 所有版式共用同一份数据（db.profile / db.pinnedGallery），切换版式
// 只是换一种排布和视觉呈现，不会丢内容。

import ClassicLayout from './ClassicLayout';
import IgBlogLayout from './IgBlogLayout';

export const HUB_HEADER_LAYOUT_CLASSIC = 'classic';
export const HUB_HEADER_LAYOUT_IG_BLOG = 'igBlog';

// 版式列表，用于设置页渲染选择器
export const HUB_HEADER_LAYOUTS = [
  {
    id: HUB_HEADER_LAYOUT_CLASSIC,
    label: '经典卡片',
    hint: 'Profile + Pinned',
  },
  {
    id: HUB_HEADER_LAYOUT_IG_BLOG,
    label: '博客 / IG 风',
    hint: 'Bio + Links',
  },
];

// id -> 组件，用于 HubHeader.jsx 实际渲染
export const HUB_HEADER_LAYOUT_COMPONENTS = {
  [HUB_HEADER_LAYOUT_CLASSIC]: ClassicLayout,
  [HUB_HEADER_LAYOUT_IG_BLOG]: IgBlogLayout,
};

export const isKnownHubHeaderLayout = (id) =>
  HUB_HEADER_LAYOUTS.some((layout) => layout.id === id);