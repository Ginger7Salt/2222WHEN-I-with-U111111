import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

import { getAllSceneOptions } from './companionShopData';
import CompanionHeartIcon from './CompanionHeartIcon';

/*
 * 场景选择：免费的四个 + 已解锁的付费场景，点哪个立刻生效并关闭；
 * 还没解锁的付费场景显示价格，点一下走 onBuy（心心购买，买完直接
 * 切换成这个场景，不用买完再选一次）。
 * 结构照抄 CompanionShopModal.jsx 的底部弹层样式，保持视觉一致。
 */
const CompanionSceneModal = ({ currentSceneId, ownedSceneIds = [], hearts = 0, onSelect, onBuy, onClose }) => {
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const scenes = getAllSceneOptions();

  const handlePick = async (scene) => {
    const isLocked = !scene.free && !ownedSceneIds.includes(scene.id);
    if (!isLocked) {
      onSelect(scene.id);
      return;
    }

    if (hearts < scene.price) {
      setError('心心不够啦');
      return;
    }

    setPendingId(scene.id);
    setError('');
    try {
      await onBuy(scene.id);
      onSelect(scene.id);
    } catch (buyError) {
      setError(buyError.message || '解锁失败');
    } finally {
      setPendingId(null);
    }
  };

  return (
  <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
    <div
      className="absolute inset-0"
      style={{ background: 'var(--modal-overlay)' }}
      onClick={onClose}
    />

    <div
      className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-t-[2rem] p-5 sm:rounded-[2rem]"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-base font-medium">换个场景</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--control-soft-bg)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mb-2 text-[11px]" style={{ color: '#e0685a' }}>{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {scenes.map((scene) => {
          const isActive = scene.id === currentSceneId;
          const isLocked = !scene.free && !ownedSceneIds.includes(scene.id);

          return (
            <button
              key={scene.id}
              type="button"
              disabled={pendingId === scene.id}
              onClick={() => handlePick(scene)}
              className="cp-scene-bg relative flex h-28 flex-col items-center justify-end overflow-hidden rounded-[1.5rem] p-2 transition-transform active:scale-95 disabled:opacity-60"
              style={{
                backgroundImage: `url(${scene.url})`,
                border: `2px solid ${isActive ? 'var(--accent-color)' : 'var(--card-border)'}`,
              }}
            >
              {isLocked && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.35)' }}
                >
                  <Lock className="h-5 w-5" style={{ color: '#ffffff' }} />
                </div>
              )}
              <span
                className="relative flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: isActive ? 'var(--accent-color)' : 'rgba(0,0,0,0.35)',
                  color: isActive ? 'var(--accent-foreground)' : '#ffffff',
                }}
              >
                {isActive ? (
                  '使用中'
                ) : isLocked ? (
                  <>
                    {scene.price}
                    <CompanionHeartIcon className="h-3 w-3" />
                  </>
                ) : (
                  scene.label
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        选好之后会一直用这个场景做背景，随时可以回来换；上锁的场景点一下就能用心心解锁。
      </p>
    </div>
  </div>
  );
};

export default CompanionSceneModal;