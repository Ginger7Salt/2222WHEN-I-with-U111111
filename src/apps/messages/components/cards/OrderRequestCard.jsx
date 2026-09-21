import React from 'react';
import { MapPin, StickyNote } from 'lucide-react';
import {
  getBrandById,
  getFulfillmentLabel,
} from '../../order/orderBrands';
import BrandImage from '../../order/BrandImage';

const MAX_VISIBLE_ITEMS = 5;

/**
 * 聊天里的"点单请求"卡片：品牌、取餐方式、地址、想要的东西、备注。
 * 只是把用户发出的请求整理成一张摘要，不含价格。
 */
export const OrderRequestCard = ({ metadata }) => {
  const brand = getBrandById(metadata?.brandId);
  const brandName = metadata?.brandName || brand?.name || '点单';
  const fulfillmentLabel = getFulfillmentLabel(metadata?.fulfillment);
  const isDelivery = metadata?.fulfillment === 'delivery';
  const isMenuMode = metadata?.mode !== 'full';

  const placeLabel = isDelivery ? '收货信息' : '取餐地点';
  const placeText = isDelivery ? metadata?.deliveryInfo : metadata?.pickupPlace;

  const itemLines = isMenuMode
    ? []
    : String(metadata?.items || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

  const visibleItems = itemLines.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = itemLines.length - visibleItems.length;

  return (
    <div className="my-1 w-full max-w-sm select-none">
      <div
        className="relative rounded-[1.5rem] p-4 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.75))',
          borderColor: 'var(--card-border, rgba(0, 0, 0, 0.08))',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
          color: 'var(--text-main, #1a1a1a)',
        }}
      >
        {/* 头部：品牌与取餐方式 */}
        <div
          className="flex items-center justify-between gap-3 border-b border-dashed pb-2.5"
          style={{ borderColor: 'var(--card-border, rgba(0, 0, 0, 0.1))' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandImage
              brand={brand}
              name={brandName}
              fit="cover"
              className="h-11 w-11 shrink-0 rounded-2xl"
            />
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold">{brandName}</span>
              <span className="block text-[10px] opacity-60">点单请求</span>
            </div>
          </div>

          {fulfillmentLabel && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.06))' }}
            >
              {fulfillmentLabel}
            </span>
          )}
        </div>

        {/* 内容区 */}
        <div className="space-y-2.5 pt-3">
          {placeText && (
            <div className="flex items-start gap-1.5 text-xs leading-relaxed">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold opacity-55">
                  {placeLabel}
                </span>
                <span className="block whitespace-pre-wrap break-words">{placeText}</span>
              </div>
            </div>
          )}

          <div
            className="rounded-xl p-2.5 text-xs leading-relaxed"
            style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.04))' }}
          >
            {isMenuMode ? (
              <span className="opacity-80">先看看菜单，选定后再下单</span>
            ) : (
              <ul className="space-y-1">
                {visibleItems.map((line, index) => (
                  <li key={`${index}-${line}`} className="flex items-start gap-1.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                    <span className="min-w-0 break-words">{line}</span>
                  </li>
                ))}
                {hiddenCount > 0 && (
                  <li className="pl-2.5 text-[10px] opacity-55">
                    另有 {hiddenCount} 项
                  </li>
                )}
              </ul>
            )}
          </div>

          {metadata?.note && (
            <div className="flex items-start gap-1.5 text-[11px] leading-relaxed opacity-75">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 whitespace-pre-wrap break-words">
                {metadata.note}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderRequestCard;