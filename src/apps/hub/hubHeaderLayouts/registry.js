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
import IdentityCardLayout from './IdentityCardLayout';
import WindowBrowserLayout from './WindowBrowserLayout';

import FrameManualLayout from './FrameManualLayout';
import PendantCardLayout from './PendantCardLayout';
import GothicGrungeLayout from './GothicGrungeLayout';

export const HUB_HEADER_LAYOUT_CLASSIC = 'classic';

export const HUB_HEADER_LAYOUT_IG_BLOG = 'igBlog';
export const HUB_HEADER_LAYOUT_IDENTITY_CARD = 'identityCard';
export const HUB_HEADER_LAYOUT_WINDOW_BROWSER = 'windowBrowser';
export const HUB_HEADER_LAYOUT_FRAME_MANUAL = 'frameManual';

export const HUB_HEADER_LAYOUT_PENDANT_CARD = 'pendantCard';
export const HUB_HEADER_LAYOUT_GOTHIC_GRUNGE = 'gothicGrunge';

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
  {
    id: HUB_HEADER_LAYOUT_IDENTITY_CARD,
    label: '社群卡片风',
    hint: 'Notes + Activity',
  },
  {
    id: HUB_HEADER_LAYOUT_WINDOW_BROWSER,
    label: '窗口卡片风',
    hint: 'Banner + Nav List',
  },
  {
    id: HUB_HEADER_LAYOUT_FRAME_MANUAL,
    label: '取景框说明书风',
    hint: 'Banner + Icon Links',
  },
  {
    id: HUB_HEADER_LAYOUT_PENDANT_CARD,
    label: '挂坠卡片风',
    hint: 'Banner + Progress',
  },
  {
    id: HUB_HEADER_LAYOUT_GOTHIC_GRUNGE,
    label: '哥特暗黑风',
    hint: 'Grunge + Poster Bar',
  },
];

// id -> 组件，用于 HubHeader.jsx 实际渲染
export const HUB_HEADER_LAYOUT_COMPONENTS = {
  [HUB_HEADER_LAYOUT_CLASSIC]: ClassicLayout,
  [HUB_HEADER_LAYOUT_IG_BLOG]: IgBlogLayout,
  [HUB_HEADER_LAYOUT_IDENTITY_CARD]: IdentityCardLayout,
  [HUB_HEADER_LAYOUT_WINDOW_BROWSER]: WindowBrowserLayout,
  [HUB_HEADER_LAYOUT_FRAME_MANUAL]: FrameManualLayout,
  [HUB_HEADER_LAYOUT_PENDANT_CARD]: PendantCardLayout,
  [HUB_HEADER_LAYOUT_GOTHIC_GRUNGE]: GothicGrungeLayout,
};

export const isKnownHubHeaderLayout = (id) =>
  HUB_HEADER_LAYOUTS.some((layout) => layout.id === id);