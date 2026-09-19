// src/apps/hub/AppGrid.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, ArrowUpRight } from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';
import PreloaderSelector from './PreloaderSelector';
import AppSwiper from './AppSwiper';
import EditableAppGrid from './EditableAppGrid';
import buildAppGridItems from './appGridItems';
import useAppNameDisplayMode from './useAppNameDisplayMode';
import { applySavedOrder, loadAppGridOrder, saveAppGridOrder } from './appGridOrderStore';
import {
  listHomeWidgets,
  addHomeWidget,
  removeHomeWidget,
  updateHomeWidgetConfig,
} from './widgets/homeWidgetsStore';
import { buildHomeWidgetItems, parseWidgetRecordId } from './widgets/buildHomeWidgetItems';
import AddWidgetModal from './widgets/AddWidgetModal';
import EditWidgetModal from './widgets/EditWidgetModal';
import db from '../../db';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  const [habitatCount, setHabitatCount] = useState(0);
  const [askCount, setAskCount] = useState(0);
  const [activeWorkflowCount, setActiveWorkflowCount] = useState(0);
  const [savedOrder, setSavedOrder] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const nameMode = useAppNameDisplayMode();

  const reloadWidgets = useCallback(async () => {
    const list = await listHomeWidgets();
    setWidgets(list);
  }, []);

  useEffect(() => {
    void reloadWidgets();
  }, [reloadWidgets]);

  // 首页应用区自定义顺序：只在挂载时读一次，编辑模式里的实时排序
  // 变化走 setSavedOrder，不需要重复去读数据库。
  useEffect(() => {
    let isMounted = true;

    loadAppGridOrder().then((order) => {
      if (isMounted) setSavedOrder(order);
    });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleOpenEditWidget = useCallback((widget) => {
    setEditingWidget(widget);
  }, []);

  const widgetItems = useMemo(
    () =>
      buildHomeWidgetItems(widgets, {
        onOpenApp,
        onEditWidget: handleOpenEditWidget,
      }),
    [widgets, onOpenApp, handleOpenEditWidget]
  );

  // 应用图标 + 用户自己添加的小组件，混在同一个数组里参与排序
  const combinedItems = useMemo(
    () => [...swiperItems, ...widgetItems],
    [swiperItems, widgetItems]
  );

  // 把保存过的自定义顺序套用到当前这一版的卡片定义上
  const orderedItems = useMemo(
    () => applySavedOrder(combinedItems, savedOrder),
    [combinedItems, savedOrder]
  );

  const handleEnterEditMode = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const handleExitEditMode = useCallback(() => {
    setIsEditMode(false);
  }, []);

  const handleReorder = useCallback((reorderedItems) => {
    const newOrderIds = reorderedItems.map((item) => item.id);
    setSavedOrder(newOrderIds);
    void saveAppGridOrder(newOrderIds);
  }, []);

  const handleAddWidget = useCallback(
    async ({ type, config }) => {
      await addHomeWidget({ type, config });
      await reloadWidgets();
      setIsAddWidgetModalOpen(false);
    },
    [reloadWidgets]
  );

  const handleSaveWidgetConfig = useCallback(
    async (widgetId, config) => {
      await updateHomeWidgetConfig(widgetId, config);
      await reloadWidgets();
      setEditingWidget(null);
    },
    [reloadWidgets]
  );

  const handleRemoveItem = useCallback(
    async (itemId) => {
      // 应用图标不能被移除，这里只处理小组件；parseWidgetRecordId
      // 认不出的 id（也就是应用图标）会返回 null，安静忽略。
      const widgetRecordId = parseWidgetRecordId(itemId);
      if (widgetRecordId === null) return;

      await removeHomeWidget(widgetRecordId);
      await reloadWidgets();
    },
    [reloadWidgets]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-40">
            Applications
          </h3>
          <p className="mt-1 text-[10px] opacity-35">
            {isEditMode
              ? '长按并拖动，调整应用的顺序'
              : 'Things kept close, and places to return to.'}
          </p>
        </div>

        {isEditMode ? (
          <button
            type="button"
            onClick={handleExitEditMode}
            className="rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            完成
          </button>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-30">
            Personal Index
          </span>
        )}
      </div>

      {/* 主入口：Messages，固定在滑块上方，不参与翻页、也不参与排序 */}
      <GlassCard
        delay={delay}
        tone="ink"
        onClick={() => {
          if (!isEditMode) onOpenApp('messages');
        }}
        className={`group flex items-center justify-between overflow-hidden p-4 text-left ${
          isEditMode ? 'pointer-events-none opacity-50' : 'cursor-pointer'
        }`}
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

      {/* 其余应用：正常态是左右滑动的分页滑块；长按任意卡片进入编辑
          模式后，换成不分页的连续网格，可以自由拖拽调整顺序。 */}
      {isEditMode ? (
        <EditableAppGrid
          items={orderedItems}
          onReorder={handleReorder}
          onExit={handleExitEditMode}
          onRemoveItem={handleRemoveItem}
          onRequestAddWidget={() => setIsAddWidgetModalOpen(true)}
        />
      ) : (
        <AppSwiper items={orderedItems} onLongPressApp={handleEnterEditMode} />
      )}

      <KeepAlivePlayer delay={delay + 160} />
      <PreloaderSelector delay={delay + 170} />

      {isAddWidgetModalOpen && (
        <AddWidgetModal
          onAdd={handleAddWidget}
          onClose={() => setIsAddWidgetModalOpen(false)}
        />
      )}

      {editingWidget && (
        <EditWidgetModal
          widget={editingWidget}
          onSave={handleSaveWidgetConfig}
          onClose={() => setEditingWidget(null)}
        />
      )}
    </div>
  );
};

export default AppGrid;
