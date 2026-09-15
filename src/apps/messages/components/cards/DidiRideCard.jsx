import React from 'react';

export const DidiRideCard = ({ card }) => {
  if (!card) return null;
  const isEstimate = card.subType === 'estimate';

  return (
    <div className="relative my-3 w-full max-w-sm select-none overflow-hidden rounded-3xl bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent p-4 backdrop-blur-xl transition-all duration-300 dark:from-orange-400/15 dark:via-neutral-900/40 dark:to-neutral-900/10">
      {/* 顶部极简状态栏与起止呼吸点 */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          <span className="text-xs font-medium tracking-wider text-orange-600/90 dark:text-orange-400/90">
            {isEstimate ? '滴滴出行 · 预估方案' : card.statusText}
          </span>
        </div>
        {card.eta && (
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            预计 <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{card.eta}</strong> 分钟到达
          </span>
        )}
      </div>

      {/* 起终点流体指示 */}
      {(card.from || card.to) && (
        <div className="relative mb-3.5 space-y-1.5 pl-3.5 before:absolute before:bottom-1.5 before:left-1 before:top-2 before:w-[1.5px] before:bg-gradient-to-b before:from-emerald-400 before:to-orange-400">
          {card.from && (
            <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {card.from}
            </div>
          )}
          {card.to && (
            <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
              {card.to}
            </div>
          )}
        </div>
      )}

      {/* 模式 A：价格预估比价 */}
      {isEstimate && (
        <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
          {card.items?.map((item, idx) => (
            <div
              key={item.category || idx}
              className="group relative flex-1 min-w-[86px] rounded-2xl bg-white/60 p-2.5 transition duration-300 hover:scale-[1.02] dark:bg-neutral-800/40"
            >
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{item.name}</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-[10px] font-medium text-orange-500">¥</span>
                <span className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {Math.round(item.price)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 模式 B：接单状态与司机车辆浮层 */}
      {!isEstimate && card.driver && (
        <div className="flex items-center justify-between rounded-2xl bg-white/50 px-3.5 py-2.5 backdrop-blur-md dark:bg-neutral-800/30">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{card.driver.name}</span>
              <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-wide text-neutral-700 dark:bg-white/10 dark:text-neutral-300">
                {card.driver.carPlate}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              {card.driver.carModel} {card.distanceKm && `· 距您 ${card.distanceKm}km`}
            </div>
          </div>
          {card.driver.phone && (
            <a
              href={`tel:${card.driver.phone}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 transition hover:bg-orange-500 hover:text-white dark:bg-orange-400/20 dark:text-orange-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default DidiRideCard;
