// src/apps/hub/AppGrid.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, ArrowUpRight } from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';
import PreloaderSelector from './PreloaderSelector';
import AppSwiper from './AppSwiper';
import buildAppGridItems from './appGridItems';
import useAppNameDisplayMode from './useAppNameDisplayMode';
import db from '../../db';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  const [habitatCount, setHabitatCount] = useState(0);
  const [askCount, setAskCount] = useState(0);
  const [activeWorkflowCount, setActiveWorkflowCount] = useState(0);
  const nameMode = useAppNameDisplayMode();

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const [hCount, unansweredCount, allWorkflows] = await Promise.all([
          db.habitats.count(),
          db.askBoxQuestions
            .filter((question) => !question.reply)
            .count(),
          db.workflows.toArray()
        ]);

        if (!isMounted) return;

        setHabitatCount(hCount);
        setAskCount(unansweredCount);
        setActiveWorkflowCount(
          allWorkflows.filter((workflow) => workflow.enabled).length
        );
      } catch (error) {
        console.error('读取首页应用统计失败：', error);
      }
    };

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const swiperItems = useMemo(
    () =>
      buildAppGridItems({
        onOpenApp,
        nameMode,
        habitatCount,
        askCount,
        activeWorkflowCount,
      }),
    [onOpenApp, nameMode, habitatCount, askCount, activeWorkflowCount]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-40">
            Applications
          </h3>
          <p className="mt-1 text-[10px] opacity-35">
            Things kept close, and places to return to.
          </p>
        </div>

        <span className="font-mono text-[9px] uppercase tracking-widest opacity-30">
          Personal Index
        </span>
      </div>

      {/* 主入口：Messages，固定在滑块上方，不参与翻页 */}
      <GlassCard
        delay={delay}
        tone="ink"
        onClick={() => onOpenApp('messages')}
        className="group flex cursor-pointer items-center justify-between overflow-hidden p-4 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/10 dark:bg-white/10">
            <MessageSquare className="h-5 w-5 text-[var(--text-on-ink)] opacity-90" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-[var(--text-on-ink)]">
              Messages
            </h4>
            <p className="mt-0.5 text-[11px] text-[var(--text-on-ink-muted)]">
              Continue the conversation
            </p>
          </div>
        </div>

        <ArrowUpRight className="h-4 w-4 text-[var(--text-on-ink)] opacity-35 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </GlassCard>

      {/* 其余应用：左右滑动查看的分页滑块 */}
      <AppSwiper items={swiperItems} />

      <KeepAlivePlayer delay={delay + 160} />
      <PreloaderSelector delay={delay + 170} />
    </div>
  );
};

export default AppGrid;
