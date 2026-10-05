import React, { useState } from 'react';
import { Lock } from 'lucide-react';

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
    <div className="cp-overlay">
      <div className="cp-backdrop" onClick={onClose} />

      <div className="cp-panel bottom">
        <i className="cp-handle" />

        <h3 className="cp-panel-title">
          <span>换个场景</span>
          <span className="cp-heart-pill">
            <CompanionHeartIcon className="cp-heart-ic" />
            {hearts}
          </span>
        </h3>

        {error && <p className="cp-error">{error}</p>}

        <div className="cp-scene-grid">
          {scenes.map((scene) => {
            const isActive = scene.id === currentSceneId;
            const isLocked = !scene.free && !ownedSceneIds.includes(scene.id);

            return (
              <button
                key={scene.id}
                type="button"
                disabled={pendingId === scene.id}
                onClick={() => handlePick(scene)}
                className={`cp-scene-card cp-scene-bg ${isActive ? 'is-active' : ''}`}
                style={scene.url ? { backgroundImage: `url(${scene.url})` } : undefined}
              >
                {isLocked && (
                  <span className="cp-scene-lock">
                    <Lock className="cp-ic" />
                  </span>
                )}
                <span className={`cp-scene-chip ${isActive ? 'is-active' : ''}`}>
                  {isActive ? (
                    '使用中'
                  ) : isLocked ? (
                    <>
                      {scene.price}
                      <CompanionHeartIcon className="cp-heart-ic" />
                    </>
                  ) : (
                    scene.label
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="cp-note">
          选好之后会一直用这个场景做背景，随时可以回来换；上锁的场景点一下就能用心心解锁。
        </p>

        <button type="button" className="cp-close-link" onClick={onClose}>
          关上
        </button>
      </div>
    </div>
  );
};

export default CompanionSceneModal;