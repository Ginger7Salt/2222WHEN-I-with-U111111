import React, { useCallback, useEffect, useState } from 'react';

import AlmanacMonumentPath from './AlmanacMonumentPath';
import AlmanacMilestoneSheet from './AlmanacMilestoneSheet';

import { loadMilestones, markMilestonesSeen } from '../services/almanacAchievementService';

const EFFECTS_KEY = 'almanac-monument-effects';

const readEffectsPreference = () => {
  try {
    const saved = window.localStorage.getItem(EFFECTS_KEY);
    if (saved === 'off') return false;
    if (saved === 'on') return true;
  } catch {
    // 读不到就用默认值
  }

  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};

export const AlmanacMilestoneJourney = ({ chatId, onConfigSaved }) => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [effects, setEffects] = useState(readEffectsPreference);

  const load = useCallback(async () => {
    if (!chatId) return;

    try {
      const result = await loadMilestones(chatId);

      if (!result) {
        setFailed(true);
        return;
      }

      setFailed(false);
      setData(result);

      if (onConfigSaved && result.config) onConfigSaved(result.config);
    } catch (error) {
      console.error('[Almanac] 读取里程碑失败：', error);
      setFailed(true);
    }
    // onConfigSaved 由父组件传入，不参与重新读取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEffects = () => {
    const next = !effects;
    setEffects(next);

    try {
      window.localStorage.setItem(EFFECTS_KEY, next ? 'on' : 'off');
    } catch {
      // 存不了也不影响使用
    }
  };

  const dismissNew = async (ids) => {
    if (!ids.length) return;

    try {
      const saved = await markMilestonesSeen(chatId, ids);
      if (saved && onConfigSaved) onConfigSaved(saved);
    } catch (error) {
      console.warn('[Almanac] 记录已读失败：', error);
    }

    setData((current) => (current ? { ...current, newIds: current.newIds.filter((id) => !ids.includes(id)) } : current));
  };

  const openNode = (node) => {
    setSelected(node);

    if (data?.newIds?.includes(node.id)) {
      void dismissNew([node.id]);
    }
  };

  if (failed) {
    return <p className="amj-empty">这一页暂时读不出来，可以稍后刷新再试。</p>;
  }

  if (!data) {
    return <p className="amj-empty">正在铺开这条路</p>;
  }

  if (!data.hasData) {
    return <p className="amj-empty">还没有聊天记录。聊上几句，这条路就会从脚下亮起来。</p>;
  }

  const total = data.nodes.length;
  const lit = data.nodes.filter((node) => node.lit).length;
  const newNodes = data.nodes.filter((node) => data.newIds.includes(node.id));

  return (
    <div className="amj-root">
      <div className="amj-summary">
        <p className="amj-line">
          相识的第 <strong>{data.daysTogether}</strong> 天，已点亮 <strong>{lit}</strong> / {total} 个节点。
        </p>

        <div
          className="amj-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={lit}
          aria-label="已点亮的节点"
        >
          <span style={{ width: `${total ? (lit / total) * 100 : 0}%` }} />
        </div>

        <div className="amj-counts">
          <span>{lit} 已点亮</span>
          <span>{total - lit} 待点亮</span>
        </div>

        <button type="button" className="amj-effects" onClick={toggleEffects} aria-pressed={effects}>
          {effects ? '关闭光效与动画' : '开启光效与动画'}
        </button>
      </div>

      {newNodes.length > 0 && (
        <div className="amj-banner" role="status">
          <span className="amj-banner-dot" aria-hidden="true" />
          <button type="button" className="amj-banner-main" onClick={() => openNode(newNodes[0])}>
            <strong>新的节点点亮了</strong>
            <span>{newNodes.map((node) => node.title).join('、')}</span>
          </button>
          <button
            type="button"
            className="amj-banner-close"
            onClick={() => void dismissNew(newNodes.map((node) => node.id))}
          >
            知道了
          </button>
        </div>
      )}

      <AlmanacMonumentPath nodes={data.nodes} effects={effects} onSelect={openNode} scrollSignal={chatId} />

      <AlmanacMilestoneSheet
        node={selected}
        timeZone={data.timeZone}
        effects={effects}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

export default AlmanacMilestoneJourney;