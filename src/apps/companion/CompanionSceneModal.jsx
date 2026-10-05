import React, { useState } from 'react';
import { Lock } from 'lucide-react';

import { getAllSceneOptions } from './companionShopData';
import CompanionHeartIcon from './CompanionHeartIcon';

const roundHearts = (value) => Math.round(value * 10) / 10;

// 一块"玻璃"：有场景图就显示图，没有就用兜底的天空
const SceneGlass = ({ scene, className = '' }) => (
  <span
    className={`cp-scene-bg ${scene?.url ? '' : 'is-sky'} ${className}`}
    style={scene?.url ? { backgroundImage: `url(${scene.url})` } : undefined}
  />
);

/*
 * 场景选择："窗外风景"。
 *   - 上面是一扇大窗，显示现在窗外的场景；
 *   - 下面是一排拱形小窗，每个窗户是一个场景：
 *       免费 / 已解锁的 → 点一下立刻切换并关闭；
 *       还没解锁的付费场景 → 窗户蒙着一层毛玻璃 + 价格，点一下先弹出"解锁确认"，
 *       看清场景、价格、解锁前后心心数量，确认之后才会扣心心（onBuy），
 *       买完直接切换成这个场景（onSelect），不用买完再选一次。
 */
const CompanionSceneModal = ({ currentSceneId, ownedSceneIds = [], hearts = 0, onSelect, onBuy, onClose }) => {
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const scenes = getAllSceneOptions();

  const currentScene = scenes.find((scene) => scene.id === currentSceneId) || scenes[0];
  const confirmScene = scenes.find((scene) => scene.id === confirmId) || null;

  const isSceneLocked = (scene) => !scene.free && !ownedSceneIds.includes(scene.id);

  const handlePick = (scene) => {
    if (!isSceneLocked(scene)) {
      onSelect(scene.id);
      return;
    }

    // 没解锁：先弹确认，不直接扣心心
    setError('');
    setConfirmId(scene.id);
  };

  const handleCloseConfirm = () => {
    if (pendingId) return;
    setConfirmId(null);
    setError('');
  };

  const handleConfirmBuy = async (scene) => {
    if (hearts < scene.price) return;

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

  const renderConfirm = () => {
    if (!confirmScene) return null;

    const price = confirmScene.price;
    const canAfford = hearts >= price;
    const isPending = pendingId === confirmScene.id;

    return (
      <div className="cp-confirm" role="dialog" aria-modal="true" aria-label={`解锁${confirmScene.label}`}>
        <div className="cp-confirm-dim" onClick={handleCloseConfirm} />

        <div className="cp-confirm-card">
          <span className="cp-pane-glass cp-confirm-win">
            <SceneGlass scene={confirmScene} />
          </span>

          <h4>解锁「{confirmScene.label}」？</h4>
          <p className="cp-confirm-text">
            解锁之后，这个场景就一直属于你啦，随时可以换回来用。
          </p>

          <div className="cp-balance">
            <div className="row">
              <span>现在有</span>
              <b><CompanionHeartIcon className="cp-heart-ic" />{roundHearts(hearts)}</b>
            </div>
            <div className="row">
              <span>需要</span>
              <b><CompanionHeartIcon className="cp-heart-ic" />{price}</b>
            </div>
            <div className={`row total ${canAfford ? '' : 'short'}`}>
              <span>{canAfford ? '解锁后还剩' : '还差'}</span>
              <b>
                <CompanionHeartIcon className="cp-heart-ic" />
                {canAfford ? roundHearts(hearts - price) : roundHearts(price - hearts)}
              </b>
            </div>
          </div>

          {error && <p className="cp-error">{error}</p>}

          <div className="cp-btn-row">
            <button type="button" className="cp-btn" onClick={handleCloseConfirm} disabled={isPending}>
              再想想
            </button>
            <button
              type="button"
              className="cp-btn main"
              disabled={!canAfford || isPending}
              onClick={() => handleConfirmBuy(confirmScene)}
            >
              {isPending ? '解锁中…' : canAfford ? '解锁并使用' : '心心不够'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="cp-overlay">
      <div className="cp-backdrop" onClick={onClose} />

      <div className="cp-panel bottom">
        <i className="cp-handle" />

        <h3 className="cp-panel-title">
          <span>窗外风景</span>
          <span className="cp-heart-pill">
            <CompanionHeartIcon className="cp-heart-ic" />
            {hearts}
          </span>
        </h3>

        {/* 一扇大窗：现在窗外是什么 */}
        <div className="cp-win" aria-hidden="true">
          <span className="cp-win-view">
            <SceneGlass scene={currentScene} />
            <i className="cp-win-bar v" />
            <i className="cp-win-bar h" />
            <i className="cp-win-glare" />
          </span>
          <i className="cp-curtain l" />
          <i className="cp-curtain r" />
          <i className="cp-sill" />
        </div>
        <p className="cp-win-label">现在的窗外：{currentScene?.label}</p>

        {error && !confirmScene && <p className="cp-error">{error}</p>}

        {/* 一排拱形小窗：每扇窗是一个场景 */}
        <div className="cp-panes">
          {scenes.map((scene) => {
            const isActive = scene.id === currentSceneId;
            const isLocked = isSceneLocked(scene);

            return (
              <button
                key={scene.id}
                type="button"
                disabled={pendingId === scene.id}
                onClick={() => handlePick(scene)}
                className={`cp-pane ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}`}
                aria-label={isLocked ? `${scene.label}（未解锁，${scene.price} 心心）` : scene.label}
              >
                <span className="cp-pane-glass">
                  <SceneGlass scene={scene} />
                  {isLocked && (
                    <span className="cp-pane-frost">
                      <Lock className="cp-ic" />
                    </span>
                  )}
                </span>

                <span className="cp-pane-name">{scene.label}</span>

                {isActive ? (
                  <span className="cp-pane-chip is-active">使用中</span>
                ) : isLocked ? (
                  <span className="cp-pane-chip">
                    {scene.price}
                    <CompanionHeartIcon className="cp-heart-ic" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="cp-note">
          点亮着的窗户就能换风景；蒙着毛玻璃的窗户要用心心解锁，解锁前会先让你确认。
        </p>

        <button type="button" className="cp-close-link" onClick={onClose}>
          关上窗
        </button>
      </div>

      {renderConfirm()}
    </div>
  );
};

export default CompanionSceneModal;