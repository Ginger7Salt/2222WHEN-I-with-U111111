// src/apps/hub/widgets/WorkflowCountdownWidget.jsx
//
// "定时消息倒计时"小组件：显示最近一条会主动触发的启用中工作流，
// 距离现在还有多久。数据来自 workflowService.js 里已有的
// getAllWorkflowsWithContext（工作流 + 聊天 + 角色已经拼好了），
// 这里只挑出"下一次最先触发的那一条"、渲染倒计时文案。

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import { getAllWorkflowsWithContext } from '../../../services/workflow/workflowService';
import { getNearestUpcomingWorkflow, formatCountdownLabel } from './nextWorkflowRun';

const REFRESH_INTERVAL_MS = 60 * 1000;

export const WorkflowCountdownWidget = ({ onOpenApp }) => {
  const [nearest, setNearest] = useState(null);
  const [hasEnabledWorkflow, setHasEnabledWorkflow] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      try {
        const workflows = await getAllWorkflowsWithContext();
        const enabledWorkflows = workflows.filter((workflow) => workflow.enabled);

        if (!isMounted) return;

        setHasEnabledWorkflow(enabledWorkflows.length > 0);
        setNearest(getNearestUpcomingWorkflow(enabledWorkflows));
      } catch (error) {
        console.error('刷新定时消息倒计时小组件失败：', error);
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const subtitle = !hasEnabledWorkflow || !nearest
    ? '暂无进行中的例程'
    : `${nearest.workflow.character?.name || '未知角色'} · ${formatCountdownLabel(nearest.occurrence)}`;

  return (
    <GlassCard
      blur={false}
      onClick={() => onOpenApp('workflows')}
      className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--control-soft-bg)' }}
      >
        <Clock className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
      </div>

      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
          定时消息
        </p>
        <p className="mt-0.5 text-[11px] opacity-55">{subtitle}</p>
      </div>
    </GlassCard>
  );
};

export default WorkflowCountdownWidget;