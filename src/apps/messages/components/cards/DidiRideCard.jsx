import React from 'react';

export const DidiRideCard = ({ card }) => {
  if (!card) return null;
  const isEstimate = card.subType === 'estimate';

  return (
    <div className="my-3 w-full max-w-sm select-none overflow-hidden bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            {!isEstimate && <span className="absolute inset-0 animate-ping rounded-full bg-orange-400 opacity-50" />}
            <span className="relative h-2 w-2 rounded-full bg-orange-500" />
          </span>
          {card.statusText && (
            <span className="truncate text-[15px] font-semibold tracking-tight">
              {card.statusText}
            </span>
          )}
        </div>
        {card.eta && (
          <span className="ml-3 shrink-0 text-[12px] text-neutral-500 dark:text-neutral-400">
            预计 <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{card.eta}</strong> 分钟到达
          </span>
        )}
      </div>

      {(card.from || card.to) && (
        <div className="relative mx-4 border-y border-neutral-100 py-1 pl-5 dark:border-neutral-800">
          <span className="absolute bottom-5 left-[5px] top-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          {card.from && (
            <div className="relative truncate py-2.5 text-[13px] text-neutral-700 dark:text-neutral-300">
              <span className="absolute -left-5 top-[15px] h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
              {card.from}
            </div>
          )}
          {card.to && (
            <div className="relative truncate py-2.5 text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
              <span className="absolute -left-5 top-[15px] h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-neutral-900" />
              {card.to}
            </div>
          )}
        </div>
      )}

      {isEstimate && (
        <div className="flex overflow-x-auto px-4 no-scrollbar">
          {card.items?.map((item, idx) => (
            <div
              key={item.category || idx}
              className="min-w-[104px] flex-1 py-3.5 pr-3 last:pr-0 [&+&]:border-l [&+&]:border-neutral-100 [&+&]:pl-3 dark:[&+&]:border-neutral-800"
            >
              <div className="truncate text-[12px] text-neutral-500 dark:text-neutral-400">
                {item.name}
              </div>
              <div className="mt-1.5 flex items-baseline">
                <span className="text-[11px] font-medium text-orange-500">¥</span>
                <span className="ml-0.5 text-[21px] font-semibold leading-none tracking-tight text-neutral-900 dark:text-white">
                  {Math.round(item.price)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isEstimate && card.driver && (
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold">
                {card.driver.name}
              </span>
              {card.driver.carPlate && (
                <span className="shrink-0 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {card.driver.carPlate}
                </span>
              )}
            </div>
            {(card.driver.carModel || card.distanceKm) && (
              <div className="mt-1 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {card.driver.carModel}
                {card.driver.carModel && card.distanceKm && ' · '}
                {card.distanceKm && `距您 ${card.distanceKm}km`}
              </div>
            )}
          </div>

          {card.driver.phone && (
            <a
              href={`tel:${card.driver.phone}`}
              aria-label="联系司机"
              className="ml-4 grid h-8 w-8 shrink-0 place-items-center text-neutral-600 transition-colors hover:text-orange-500 dark:text-neutral-300 dark:hover:text-orange-400"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default DidiRideCard;
