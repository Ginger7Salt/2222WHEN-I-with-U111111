import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

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
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-15"
          style={{ background: 'var(--accent-color)' }}
        />

        <div className="relative mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-medium">
            <span>商店</span>
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: 'var(--control-soft-bg)' }}>
              <CompanionHeartIcon className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
              {hearts}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-4 flex gap-2">
          {[{ id: 'food', label: '食物' }, { id: 'clothing', label: '衣服' }].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className="rounded-full px-4 py-1.5 text-xs"
              style={{
                background: tab === option.id ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                color: tab === option.id ? 'var(--accent-foreground)' : 'var(--text-main)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="relative mb-2 text-[11px]" style={{ color: '#e0685a' }}>{error}</p>
        )}

        <div className="relative max-h-[40vh] space-y-2.5 overflow-y-auto">
          {list.map((item) => {
            const owned = tab === 'clothing' && ownedClothingIds.includes(item.id);
            const isRareLocked = tab === 'food' && item.tier === FOOD_TIERS.RARE && !unlockedRareFoodIds.includes(item.id);
            const canAfford = hearts >= item.price;
            const tierLabel = tab === 'food' ? TIER_LABELS[item.tier] : null;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[1.25rem] px-4 py-3"
                style={{ background: 'var(--control-soft-bg)' }}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--text-main)' }}>
                    {item.name}
                    {tierLabel && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px]"
                        style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                      >
                        {tierLabel}
                      </span>
                    )}
                  </p>
                  {tab === 'food' && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {isRareLocked ? '先触发特殊事件解锁' : describeEffects(item.effects)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={owned || isRareLocked || !canAfford || pendingId === item.id}
                  onClick={() => handleBuy(item)}
                  className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] disabled:opacity-50"
                  style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  {owned ? (
                    '已拥有'
                  ) : isRareLocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <>
                      {item.price}
                      <CompanionHeartIcon className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {tab === 'food' && legendaryOwned.length > 0 && (
          <div className="relative mt-4 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
            <p className="mb-2 text-[11px]" style={{ color: 'var(--text-sub)' }}>
              传说食物（库存，只能靠事件获得）
            </p>
            <div className="space-y-2.5">
              {legendaryOwned.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-[1.25rem] px-4 py-3"
                  style={{ background: 'var(--control-soft-bg)' }}
                >
                  <div>
                    <p className="text-[13px]" style={{ color: 'var(--text-main)' }}>
                      {item.name} × {legendaryStock[item.id]}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {describeEffects(item.effects)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pendingId === item.id}
                    onClick={() => handleUseLegendary(item)}
                    className="rounded-full px-3.5 py-1.5 text-[11px] disabled:opacity-50"
                    style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  >
                    吃掉
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanionShopModal;