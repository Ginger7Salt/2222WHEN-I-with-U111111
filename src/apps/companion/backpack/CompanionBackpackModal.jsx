import React, { useState } from 'react';
import { Droplets, Gamepad2, ShoppingBasket, UtensilsCrossed } from 'lucide-react';

import { COMPANION_STAT_LABELS, FOOD_TIERS } from '../companionShopData';

const TIER_LABELS = {
  [FOOD_TIERS.COMMON]: null,
  [FOOD_TIERS.RARE]: '稀有',
};

const CATEGORY_TABS = [
  { id: 'food', label: '食物', icon: UtensilsCrossed },
  { id: 'clean', label: '清洁', icon: Droplets },
  { id: 'toy', label: '玩具', icon: Gamepad2 },
];

const describeEffects = (effects) => (
  Object.entries(effects || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${COMPANION_STAT_LABELS[key] || key} +${value}`)
    .join(' · ')
);

// 道具图：有 url 就用图，没有就按分类放一个图标占位
const ItemPicture = ({ item }) => {
  if (item.url) return <img src={item.url} alt="" />;
  if (item.category === 'clean') return <Droplets className="cp-ic" />;
  if (item.category === 'toy') return <Gamepad2 className="cp-ic" />;
  return <UtensilsCrossed className="cp-ic" />;
};

/*
 * 背包弹窗：跟商店共用同一套视觉语言（气泡网格 + 底部操作区），
 * 但没有"柜台选中详情"这一层——道具不多，直接在每张卡片上放
 * 数量 + 使用按钮，点一下就用，不需要先选中再确认。
 */
const CompanionBackpackModal = ({ items, onUse, onClose }) => {
  const [tab, setTab] = useState('food');
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const list = items.filter((item) => item.category === tab);

  const handleSwitchTab = (nextTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setError('');
  };

  const handleUse = async (item) => {
    setPendingId(item.id);
    setError('');
    try {
      const result = await onUse(item.id);
      setToast(result?.feedbackText || `用掉了「${item.name}」。`);
      window.setTimeout(() => setToast(''), 2600);
    } catch (useError) {
      setError(useError.message || '使用失败');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="cp-overlay">
      <div className="cp-backdrop" onClick={onClose} />

      <div className="cp-panel bottom cp-stall">
               <div className="cp-awning">
          <span className="cp-heart-pill cp-stall-hearts">
            <ShoppingBasket className="cp-ic" />
            背包
          </span>
        </div>

        <div className="cp-signs">
          {CATEGORY_TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSwitchTab(option.id)}
              className={`cp-sign ${tab === option.id ? 'is-on' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {(toast || error) && (
          <p className={`cp-keeper-say ${error ? 'is-error' : ''}`} style={{ textAlign: 'center' }}>
            <span key={toast || error}>{error || toast}</span>
          </p>
        )}

        <div className="cp-bubbles">
          {list.length === 0 && (
            <p className="cp-counter-hint">这里还空着，去商店买点东西放进来吧。</p>
          )}

          {list.map((item, index) => {
            const tierLabel = TIER_LABELS[item.tier];
            const effectsText = describeEffects(item.effects);

            return (
              <button
                key={item.id}
                type="button"
                className={`cp-orb ${item.tier === FOOD_TIERS.RARE ? 'is-rare' : ''}`}
                style={{ '--i': index }}
                disabled={pendingId === item.id}
                onClick={() => handleUse(item)}
                aria-label={`使用${item.name}`}
                title={effectsText || item.name}
              >
                <span className="cp-orb-ball">
                  <span className="cp-orb-face">
                    <ItemPicture item={item} />
                  </span>
                  <span className="cp-orb-badge stock">×{item.quantity}</span>
                </span>
                <span className="cp-orb-name">
                  {item.name}
                  {tierLabel && <span className="cp-tier">{tierLabel}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" className="cp-close-link" onClick={onClose}>
          先收起来
        </button>
      </div>
    </div>
  );
};

export default CompanionBackpackModal;