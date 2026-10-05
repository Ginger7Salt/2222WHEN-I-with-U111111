import React, { useState } from 'react';
import { Lock, Shirt, UtensilsCrossed } from 'lucide-react';

import { COMPANION_STAT_LABELS, FOOD_TIERS, SHOP_CLOTHING_ITEMS, SHOP_FOOD_ITEMS } from './companionShopData';
import CompanionHeartIcon from './CompanionHeartIcon';

const TIER_LABELS = {
  [FOOD_TIERS.COMMON]: null,
  [FOOD_TIERS.RARE]: '稀有',
  [FOOD_TIERS.LEGENDARY]: '传说',
};

const describeEffects = (effects) => (
  Object.entries(effects || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${COMPANION_STAT_LABELS[key] || key} +${value}`)
    .join(' · ')
);

// 商品缩略图：有 url 就用图，没有就先放一个图标占位
const ItemThumb = ({ item, kind }) => (
  <span className="cp-thumb">
    {item.url ? (
      <img src={item.url} alt="" />
    ) : kind === 'clothing' ? (
      <Shirt className="cp-ic" />
    ) : (
      <UtensilsCrossed className="cp-ic" />
    )}
  </span>
);

/*
 * 商店：食物分三档（普通/稀有/传说），衣服还是老样子。
 *   - 稀有：没解锁就显示锁图标+"先触发事件解锁"，不能点。
 *   - 传说：不在这个 tab 里卖，单独列在下面"传说食物"区域，
 *     只能用已有库存"吃掉"（onUseLegendary），库存为 0 就不显示。
 */
const CompanionShopModal = ({
  hearts,
  ownedClothingIds,
  unlockedRareFoodIds = [],
  legendaryStock = {},
  onBuy,
  onUseLegendary,
  onClose,
}) => {
  const [tab, setTab] = useState('food');
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');

  const list = tab === 'food'
    ? SHOP_FOOD_ITEMS.filter((item) => item.tier !== FOOD_TIERS.LEGENDARY)
    : SHOP_CLOTHING_ITEMS;

  const legendaryOwned = SHOP_FOOD_ITEMS.filter(
    (item) => item.tier === FOOD_TIERS.LEGENDARY && (legendaryStock[item.id] || 0) > 0
  );

  const handleBuy = async (item) => {
    setPendingId(item.id);
    setError('');
    try {
      await onBuy(item.id);
    } catch (buyError) {
      setError(buyError.message || '购买失败');
    } finally {
      setPendingId(null);
    }
  };

  const handleUseLegendary = async (item) => {
    setPendingId(item.id);
    setError('');
    try {
      await onUseLegendary(item.id);
    } catch (useError) {
      setError(useError.message || '使用失败');
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
          <span>商店</span>
          <span className="cp-heart-pill">
            <CompanionHeartIcon className="cp-heart-ic" />
            {hearts}
          </span>
        </h3>

        <div className="cp-seg">
          <i className="ind" style={{ transform: tab === 'food' ? 'translateX(0)' : 'translateX(100%)' }} />
          {[{ id: 'food', label: '食物' }, { id: 'clothing', label: '衣服' }].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={tab === option.id ? 'is-on' : ''}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p className="cp-error">{error}</p>}

        <div className="cp-shop-list">
          {list.map((item) => {
            const owned = tab === 'clothing' && ownedClothingIds.includes(item.id);
            const isRareLocked = tab === 'food' && item.tier === FOOD_TIERS.RARE && !unlockedRareFoodIds.includes(item.id);
            const canAfford = hearts >= item.price;
            const tierLabel = tab === 'food' ? TIER_LABELS[item.tier] : null;

            return (
              <div key={item.id} className="cp-shop-row">
                <ItemThumb item={item} kind={tab} />

                <div className="cp-shop-info">
                  <p className="cp-shop-name">
                    {item.name}
                    {tierLabel && <span className="cp-tier">{tierLabel}</span>}
                  </p>
                  {tab === 'food' && (
                    <p className="cp-shop-fx">
                      {isRareLocked ? '先触发特殊事件解锁' : describeEffects(item.effects)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={owned || isRareLocked || !canAfford || pendingId === item.id}
                  onClick={() => handleBuy(item)}
                  className="cp-buy"
                >
                  {owned ? (
                    '已拥有'
                  ) : isRareLocked ? (
                    <Lock className="cp-ic" />
                  ) : (
                    <>
                      {item.price}
                      <CompanionHeartIcon className="cp-heart-ic" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {tab === 'food' && legendaryOwned.length > 0 && (
          <div className="cp-legendary">
            <p>传说食物（库存，只能靠事件获得）</p>
            <div className="cp-shop-list">
              {legendaryOwned.map((item) => (
                <div key={item.id} className="cp-shop-row">
                  <ItemThumb item={item} kind="food" />

                  <div className="cp-shop-info">
                    <p className="cp-shop-name">
                      {item.name} × {legendaryStock[item.id]}
                    </p>
                    <p className="cp-shop-fx">{describeEffects(item.effects)}</p>
                  </div>

                  <button
                    type="button"
                    disabled={pendingId === item.id}
                    onClick={() => handleUseLegendary(item)}
                    className="cp-buy"
                  >
                    吃掉
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="button" className="cp-close-link" onClick={onClose}>
          先逛到这里
        </button>
      </div>
    </div>
  );
};

export default CompanionShopModal;