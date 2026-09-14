import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert } from 'lucide-react';
import { listWorkflowRuns } from './workflowRunService';

const SOURCE_LABEL = { app: 'App 内', server: '离线服务器' };

const formatTime = (timestamp) => {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const RunRow = ({ run }) => {
  const isError = run.status === 'error';
  return (
    <div className="relative flex gap-3 pb-6 pl-1">
      {/* 竖线 + 圆点，构成时间轴 */}
      <div className="flex flex-col items-center">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: isError ? 'transparent' : 'var(--text-main)',
            border: isError ? '1.5px solid var(--text-main)' : 'none'
          }}
        >
          {isError ? (
            <CircleAlert className="h-3.5 w-3.5" style={{ color: 'var(--text-main)' }} />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--bg-main)' }} />
          )}
        </span>
        <span className="mt-1 w-px flex-1" style={{ backgroundColor: 'var(--card-border)' }} />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{isError ? '执行失败' : '已送达'}</p>
          <span className="font-mono text-[10px] uppercase tracking-wider opacity-40">
            {SOURCE_LABEL[run.source] || run.source}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] opacity-50">{formatTime(run.runAt)}</p>
        {isError && run.errorMessage && (
          <p className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[12px] opacity-70" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
            {run.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export const WorkflowRunTimeline = ({ workflow, onBack }) => {
  const [runs, setRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const data = await listWorkflowRuns(workflow.id);
      if (!cancelled) {
        setRuns(data);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workflow.id]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ backgroundColor: 'var(--bg-main)' }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="rounded-full border p-2"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: 'var(--text-main)' }} />
        </button>
        <div className="min-w-0">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
            {workflow.character?.name || '未知角色'}
          </p>
          <h2 className="truncate font-serif text-lg font-semibold">
            {workflow.name || '未命名工作流'} · 运行记录
          </h2>
        </div>
      </header>

      <div className="px-5 pb-16 pt-6">
        {isLoading ? (
          <p className="py-10 text-center text-sm opacity-50">加载中…</p>
        ) : runs.length === 0 ? (
          <p className="py-16 text-center text-sm opacity-50">还没有运行记录</p>
        ) : (
          <div>
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowRunTimeline;