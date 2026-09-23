import React, { useState } from 'react';
import { X } from 'lucide-react';

import { SHOP_CLOTHING_ITEMS, SHOP_FOOD_ITEMS } from './companionShopData';
import CompanionHeartIcon from './CompanionHeartIcon';

/*
 * 简单商店：固定价格，不做稀有度/限时道具（9.2 第 6 条已确认，
 * 第一步只做最简单的版本，复杂度留到以后的阶段）。
 */
const CompanionShopModal = ({ hearts, ownedClothingIds, onBuy, onClose }) => {
  const [tab, setTab] = useState('food');
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');

  const list = tab === 'food' ? SHOP_FOOD_ITEMS : SHOP_CLOTHING_ITEMS;

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

        <div className="relative max-h-[50vh] space-y-2.5 overflow-y-auto">
          {list.map((item) => {
            const owned = tab === 'clothing' && ownedClothingIds.includes(item.id);
            const canAfford = hearts >= item.price;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[1.25rem] px-4 py-3"
                style={{ background: 'var(--control-soft-bg)' }}
              >
                <div>
                  <p className="text-[13px]" style={{ color: 'var(--text-main)' }}>{item.name}</p>
                  {tab === 'food' && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      饱食度 +{item.satiety} · 心情 +{item.mood}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={owned || !canAfford || pendingId === item.id}
                  onClick={() => handleBuy(item)}
                  className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] disabled:opacity-50"
                  style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  {owned ? (
                    '已拥有'
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
      </div>
    </div>
  );
};

export default CompanionShopModal;