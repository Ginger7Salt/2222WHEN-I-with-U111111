// src/apps/hub/useAppNameDisplayMode.js
//
// 读取「应用名称显示模式」设置：只显示英文名，还是中英文结合展示。
// 通过 Dexie liveQuery 订阅 db.settings 里的 appNameDisplayMode 字段，
// 这样在设置页保存之后，首页应用区会自动刷新，不需要额外的状态转发。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';

export const APP_NAME_DISPLAY_SETTING_KEY = 'appNameDisplayMode';
export const APP_NAME_DISPLAY_EN = 'en';
export const APP_NAME_DISPLAY_BILINGUAL = 'bilingual';

export const useAppNameDisplayMode = () => {
  const [mode, setMode] = useState(APP_NAME_DISPLAY_EN);

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.settings.get(APP_NAME_DISPLAY_SETTING_KEY)
    ).subscribe({
      next: (setting) => {
        setMode(
          setting?.value === APP_NAME_DISPLAY_BILINGUAL
            ? APP_NAME_DISPLAY_BILINGUAL
            : APP_NAME_DISPLAY_EN
        );
      },
      error: (error) => {
        console.warn(
          '[AppGrid] 读取应用名称显示模式失败：',
          error
        );
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return mode;
};

export default useAppNameDisplayMode;