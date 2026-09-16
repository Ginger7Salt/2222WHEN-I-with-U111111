import React from 'react';

const getDisplayPrice = (item) => {
  const rawPrice = [
    item?.priceText,
    item?.price,
    item?.estimatePrice,
  ].find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
  ) ?? '';


  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) {
    return Math.round(rawPrice);
  }

  // 兼容：`18元`、`¥18.5`、`18-25元` 等文本格式。
  // 对于区间价格，优先展示第一个数字。
  const matched = String(rawPrice).match(/-?\d+(?:\.\d+)?/);

  return matched ? Math.round(Number(matched[0])) : null;
};

export const DidiRideCard = ({ card }) => {
  if (!card) return null;

  // 兼容解析器生成的 phase 和旧版本 subType
  const isEstimate =
    card.subType === 'estimate' ||
    card.phase === 'estimate';

  const statusCode = Number(card.statusCode);

  // 滴滴官方终态：
  // 5 行程完成
  // 6、7、8、9、10、11、12 均属于订单终止或服务未完成
 const isCancelled =
  card.phase === 'cancelled' ||
  card.subType === 'cancelled' ||
  [3, 6, 7, 8, 9, 10, 11, 12].includes(statusCode);


  const isCompleted =
    card.phase === 'completed' ||
    card.subType === 'completed' ||
    statusCode === 5;

  // 兼容官方 map 节点以及解析器已经提取到根节点的字段
  const eta = card.eta || card.map?.eta || '';

  const distanceKm =
    card.distanceKm ||
    card.map?.distanceKm ||
    card.distance ||
    '';

const driver =
  card.driver &&
  typeof card.driver === 'object' &&
  Object.values(card.driver).some(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
  )
    ? card.driver
    : null;


  const isWaitingForDriver =
  !isEstimate &&
  !isCancelled &&
  !isCompleted &&
  !driver &&
  (statusCode === 0 || card.phase === 'matching');


  const statusText =
    card.statusText ||
    (isEstimate
      ? '预估费用'
      : isCancelled
        ? '订单已取消'
        : isCompleted
          ? '行程已结束'
          : driver
            ? '司机正在赶来'
            : '正在为您寻找司机');

  const statusDotClass = isCancelled || isCompleted
    ? 'bg-neutral-400 dark:bg-neutral-500'
    : isEstimate
      ? 'bg-emerald-500'
      : 'bg-orange-500';

  const normalizedItems = Array.isArray(card.items)
    ? card.items
    : [];

  return (
    <div className="my-3 w-full max-w-sm select-none overflow-hidden rounded-2xl border border-neutral-100 bg-white text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
      {/* 卡片头部：订单状态与预计到达时间 */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            {!isEstimate && !isCancelled && !isCompleted && (
              <span className="absolute inset-0 animate-ping rounded-full bg-orange-400 opacity-50" />
            )}

            <span className={`relative h-2 w-2 rounded-full ${statusDotClass}`} />
          </span>

          <span className="truncate text-[15px] font-semibold tracking-tight">
            {statusText}
          </span>
        </div>

        {!isEstimate && eta && (
          <span className="ml-3 shrink-0 text-[12px] text-neutral-500 dark:text-neutral-400">
            预计{' '}
            <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
              {eta}
            </strong>{' '}
            分钟到达
          </span>
        )}
      </div>

      {/* 起终点 */}
      {(card.from || card.to) && (
        <div className="relative mx-4 border-y border-neutral-100 py-1 pl-5 dark:border-neutral-800">
          {card.from && card.to && (
            <span className="absolute bottom-5 left-[5px] top-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          )}

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

      {/* 预估费用：兼容官方 productName / productCategory / priceText */}
      {isEstimate && normalizedItems.length > 0 && (
        <div className="flex overflow-x-auto px-4 no-scrollbar">
          {normalizedItems.map((item, index) => {
            const price = getDisplayPrice(item);

            const itemName =
              item?.productName ||
              item?.name ||
              '可选车型';

            return (
              <div
                key={
                  item?.productCategory ||
                  item?.category ||
                  index
                }
                className="min-w-[104px] flex-1 py-3.5 pr-3 last:pr-0 [&+&]:border-l [&+&]:border-neutral-100 [&+&]:pl-3 dark:[&+&]:border-neutral-800"
              >
                <div className="truncate text-[12px] text-neutral-500 dark:text-neutral-400">
                  {itemName}
                </div>

                <div className="mt-1.5 flex items-baseline">
                  {price !== null ? (
                    <>
                      <span className="text-[11px] font-medium text-orange-500">
                        ¥
                      </span>

                      <span className="ml-0.5 text-[21px] font-semibold leading-none tracking-tight text-neutral-900 dark:text-white">
                        {price}
                      </span>
                    </>
                  ) : (
                    <span className="text-[14px] font-medium text-neutral-500 dark:text-neutral-400">
                      暂无报价
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 呼叫中：没有司机资料时，避免卡片下方完全空白 */}
      {isWaitingForDriver && (
        <div className="px-4 py-3.5 text-[12px] text-neutral-500 dark:text-neutral-400">
          正在全力呼叫周边车辆，请稍候…
        </div>
      )}

      {/* 已取消 / 已结束：展示终态提示，且不显示错误的“呼叫中”动画 */}
      {!isEstimate && (isCancelled || isCompleted) && (
        <div className="px-4 py-3.5 text-[12px] text-neutral-500 dark:text-neutral-400">
          {isCancelled
            ? '该行程已终止。'
            : '感谢使用滴滴出行。'}
        </div>
      )}

      {/* 已匹配司机 / 行程中 */}
      {!isEstimate && !isCancelled && !isCompleted && driver && (
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold">
                {driver.name || '司机师傅'}
              </span>

              {(driver.carPlate || driver.plateNumber) && (
                <span className="shrink-0 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {driver.carPlate || driver.plateNumber}
                </span>
              )}
            </div>

            {(driver.carModel || distanceKm) && (
              <div className="mt-1 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {driver.carModel || ''}

                {driver.carModel &&
                  distanceKm &&
                  ' · '}

                {distanceKm &&
                  `距您 ${distanceKm}km`}
              </div>
            )}
          </div>

          {driver.phone && (
            <a
              href={`tel:${driver.phone}`}
              aria-label="联系司机"
              className="ml-4 grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-orange-50 hover:text-orange-500 dark:text-neutral-300 dark:hover:bg-orange-950/40 dark:hover:text-orange-400"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a2 2 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default DidiRideCard;
