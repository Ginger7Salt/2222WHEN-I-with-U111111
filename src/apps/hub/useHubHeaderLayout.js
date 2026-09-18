// src/apps/hub/useHubHeaderLayout.js
//
// 读取「主页版式」设置：决定首页头部（资料卡 + 图片墙）用哪一种版式渲染。
// 通过 Dexie liveQuery 订阅 db.settings 里的 hubHeaderLayout 字段，
// 这样在设置页保存之后，首页会自动刷新，不需要额外的状态转发。
// 写法完全对照 useAppNameDisplayMode.js。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';
import {
  HUB_HEADER_LAYOUT_CLASSIC,
  isKnownHubHeaderLayout,
} from './hubHeaderLayouts/registry';

export const HUB_HEADER_LAYOUT_SETTING_KEY = 'hubHeaderLayout';

export const useHubHeaderLayout = () => {
  const [layout, setLayout] = useState(HUB_HEADER_LAYOUT_CLASSIC);

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.settings.get(HUB_HEADER_LAYOUT_SETTING_KEY)
    ).subscribe({
      next: (setting) => {
        setLayout(
          isKnownHubHeaderLayout(setting?.value)
            ? setting.value
            : HUB_HEADER_LAYOUT_CLASSIC
        );
      },
      error: (error) => {
        console.warn('[HubHeader] 读取主页版式设置失败：', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return layout;
};

export default useHubHeaderLayout;