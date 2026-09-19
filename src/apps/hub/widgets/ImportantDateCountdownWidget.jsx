// src/apps/hub/widgets/ImportantDateCountdownWidget.jsx
//
// "纪念日倒数"小组件：添加时绑定了具体某一条 Almanac 重要日期记录
// （db.almanacImportantDates 里的一条），这里只负责实时读取这条记录、
// 用 Almanac 已有的 getDaysRemaining 算出还剩几天，不重新发明日期
// 计算逻辑。
//
// 绑定的日期如果之后在 Almanac 里被删掉了，会显示提示，用户可以在
// 首页编辑模式里把这个小组件直接移除（不会影响 Almanac 本身的数据，
// 首页这边存的只是一个指向那条记录的引用）。

import React, { useEffect, useState } from 'react';
import { CalendarHeart } from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import db from '../../../db';
import { getDaysRemaining } from '../../almanac/services/almanacImportantDateService';

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 天数级别的信息，每小时刷新一次足够

const formatDaysLabel = (days) => {
  if (days === null || days === undefined) return '';
  if (days === 0) return '就是今天';
  if (days > 0) return `还有 ${days} 天`;
  return `已过去 ${Math.abs(days)} 天`;
};

export const ImportantDateCountdownWidget = ({ config, onOpenApp }) => {
  const [record, setRecord] = useState(null);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      try {
        const found = config?.importantDateId
          ? await db.almanacImportantDates.get(config.importantDateId)
          : null;

        if (!isMounted) return;

        if (found) {
          setRecord(found);
          setIsMissing(false);
        } else {
          setRecord(null);
          setIsMissing(true);
        }
      } catch (error) {
        console.error('刷新纪念日倒数小组件失败：', error);
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [config?.importantDateId]);

  const daysRemaining = record ? getDaysRemaining(record) : null;

  return (
    <GlassCard
      blur={false}
      onClick={() => onOpenApp('almanac')}
      className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--control-soft-bg)' }}
      >
        <CalendarHeart
          className="h-5 w-5 opacity-90"
          style={{ color: 'var(--text-main)' }}
        />
      </div>

      <div>
        <p
          className="truncate text-sm font-bold"
          style={{ color: 'var(--text-main)' }}
        >
          {isMissing ? '纪念日已删除' : record?.title || '纪念日'}
        </p>
        <p className="mt-0.5 text-[11px] opacity-55">
          {isMissing ? '可在编辑模式移除' : formatDaysLabel(daysRemaining)}
        </p>
      </div>
    </GlassCard>
  );
};

export default ImportantDateCountdownWidget;