import React, { useState } from 'react';
import { Heart, X } from 'lucide-react';

import { SHOP_CLOTHING_ITEMS, SHOP_FOOD_ITEMS } from './companionShopData';

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
        className="relative z-10 w-full max-w-[420px] rounded-t-2xl p-4 sm:rounded-2xl"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm font-medium">
            <span>商店</span>
            <span className="ml-2 flex items-center gap-1 text-xs" style={{ color: 'var(--text-sub)' }}>
              <Heart className="h-3 w-3" style={{ color: 'var(--accent-color)' }} />
              {hearts}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          {[{ id: 'food', label: '食物' }, { id: 'clothing', label: '衣服' }].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className="rounded-full px-3 py-1 text-xs"
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
          <p className="mb-2 text-[11px]" style={{ color: '#e0685a' }}>{error}</p>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {list.map((item) => {
            const owned = tab === 'clothing' && ownedClothingIds.includes(item.id);
            const canAfford = hearts >= item.price;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: 'var(--control-soft-bg)' }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-main)' }}>{item.name}</p>
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
                  className="rounded-full px-3 py-1 text-[11px] disabled:opacity-50"
                  style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  {owned ? '已拥有' : `${item.price} ❤️`}
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