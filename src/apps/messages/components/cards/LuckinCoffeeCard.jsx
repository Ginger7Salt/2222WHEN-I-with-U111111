import React from 'react';

// ==================== 精巧 SVG 矢量微标 (无任何 Emoji) ====================
const LuckinLogo = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
    {/* 极简经典鹿角流线型剪影 */}
    <path d="M12 2C9.5 2 7.5 3.5 7.5 5.5c0 1.2.7 2.2 1.7 2.8C6.8 9.5 5 12 5 15c0 3.9 3.1 7 7 7s7-3.1 7-7c0-3-1.8-5.5-4.2-6.7 1-.6 1.7-1.6 1.7-2.8 0-2-2-3.5-4.5-3.5zm-3.2 4c0-.7 1.4-1.5 3.2-1.5s3.2.8 3.2 1.5c0 .6-.8 1.2-2.1 1.4-.4-.5-.9-.9-1.1-.9-.2 0-.7.4-1.1.9-1.3-.2-2.1-.8-2.1-1.4zm3.2 14c-2.8 0-5-2.2-5-5 0-2.3 1.5-4.3 3.6-4.8.4.6 1 1 1.4 1s1-.4 1.4-1c2.1.5 3.6 2.5 3.6 4.8 0 2.8-2.2 5-5 5z" opacity="0.9"/>
  </svg>
);

const CupIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/>
    <line x1="10" y1="1" x2="10" y2="4"/>
    <line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
);

const PinIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CheckShieldIcon = () => (
  <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

// 拟真条形码生成图案
const BarcodePattern = () => (
  <div className="flex items-center justify-center gap-[2px] h-9 w-full px-4 opacity-75 dark:opacity-85">
    {[3, 1, 4, 1, 2, 5, 2, 1, 3, 2, 4, 1, 2, 3, 5, 1, 2, 4, 1, 3, 2, 1, 4, 2].map((w, idx) => (
      <span
        key={idx}
        className="h-full bg-slate-900 dark:bg-slate-100 rounded-[0.5px]"
        style={{ width: `${w}px` }}
      />
    ))}
  </div>
);

// ==================== 子卡片 1：门店卡片 ====================
function ShopCard({ card }) {
  const primaryShop = card.shops?.[0];
  if (!primaryShop) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-slate-800 dark:text-slate-100 tracking-tight">
              {primaryShop.deptName}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tracking-wide ${
              primaryShop.isOpen
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
            }`}>
              {primaryShop.workStatus}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <PinIcon />
            <span className="truncate max-w-[210px]">{primaryShop.address}</span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span className="font-medium text-slate-600 dark:text-slate-300">{primaryShop.distance}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
          <ClockIcon />
          <span>营业中 {primaryShop.hours}</span>
        </div>
        <button className="px-3 py-1 rounded-full text-xs font-medium text-[#0022AB] dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
          去下单
        </button>
      </div>
    </div>
  );
}

// ==================== 子卡片 2：商品定制卡片 ====================
function ProductCard({ card }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            {card.productName}
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
            {card.skuCode || 'HIGH-PRESSURE EXTRACT'}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-1 text-[#0022AB] dark:text-blue-400">
            <span className="text-xs font-semibold">¥</span>
            <span className="text-xl font-black tracking-tight">{card.estimatePrice}</span>
          </div>
          {card.initialPrice > card.estimatePrice && (
            <span className="text-[11px] text-slate-400 line-through">¥{card.initialPrice}</span>
          )}
        </div>
      </div>

      {/* 选定属性流 */}
      <div className="space-y-2 pt-1">
        {card.attrs?.slice(0, 2).map((attr, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="w-12 text-slate-400 dark:text-slate-500 shrink-0">{attr.name}</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {attr.options.map((opt, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                    opt.selected
                      ? 'bg-[#0022AB] text-white font-medium shadow-sm shadow-blue-500/20'
                      : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60'
                  }`}
                >
                  {opt.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 子卡片 3：结算支付卡片 ====================
function PayCard({ card }) {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800/60">
        <div>
          <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">ORDER SUMMARY</span>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{card.shopName}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[11px] text-[#0022AB] dark:text-blue-400 font-medium">
          <CheckShieldIcon />
          <span>立减券生效</span>
        </div>
      </div>

      {/* 单品清单 */}
      <div className="space-y-1.5">
        {card.products?.map((prod, idx) => (
          <div key={idx} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-200">{prod.name}</span>
              <span className="text-slate-400">×{prod.amount}</span>
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">¥{prod.price}</span>
          </div>
        ))}
      </div>

      {/* 底部价格与支付操作 */}
      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400 block">应付总额</span>
          <div className="flex items-baseline gap-0.5 text-slate-900 dark:text-white">
            <span className="text-xs font-bold text-[#0022AB] dark:text-blue-400">¥</span>
            <span className="text-xl font-black">{card.discountPrice}</span>
          </div>
        </div>

        <button
          onClick={() => card.payUrl && window.open(card.payUrl, '_blank')}
          className="relative group overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-r from-[#0022AB] to-[#0A3BD0] text-white text-xs font-semibold shadow-md shadow-blue-900/20 active:scale-95 transition-all"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            <span>立即支付</span>
            <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
          <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
        </button>
      </div>
    </div>
  );
}

// ==================== 子卡片 4：取餐码 / 制作流水 / 取消状态卡片 ====================
function OrderCard({ card }) {
  const isCanceled = card.orderStatus === 100;
  const isReady = card.orderStatus === 60;
  const isMaking = card.orderStatus === 30 || card.orderStatus === 20;

  return (
    <div className="space-y-3.5">
      {/* 顶部进度与状态 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 状态呼吸指示灯 */}
          <span className="relative flex h-2.5 w-2.5">
            {!isCanceled && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isReady ? 'bg-emerald-400' : 'bg-blue-400'
              }`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isCanceled ? 'bg-slate-400' : isReady ? 'bg-emerald-500' : 'bg-[#0022AB]'
            }`} />
          </span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {card.orderStatusName}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">预计 {card.aboutTime}</span>
      </div>

      {/* 核心拟真取餐号码票据区 */}
      {!isCanceled ? (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-blue-50/70 to-indigo-50/30 dark:from-blue-950/30 dark:to-slate-900/40 p-4 border border-blue-100/50 dark:border-blue-900/30 text-center">
          <span className="text-[11px] font-semibold text-[#0022AB] dark:text-blue-400 tracking-wider uppercase">
            TAKE-OUT CODE
          </span>

          {/* 大字号取餐码 */}
          <div className="my-2">
            <span className="text-4xl font-black tracking-widest text-slate-900 dark:text-white font-mono drop-shadow-sm">
              {card.takeMealCode || 'C-08'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            {card.shopName} · 请留意吧台叫号
          </p>

          {/* 拟真条形码扫描区 */}
          <div className="relative pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
            <BarcodePattern />
            {/* 激光微扫微动效 */}
            <div className="absolute top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse opacity-60" />
            <span className="block mt-1 font-mono text-[9px] text-slate-400 tracking-widest">
              {card.takeOrderId || card.orderId}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-center text-xs text-slate-400">
          该订单已取消，未扣减费用或已原路退回。
        </div>
      )}

      {/* 订单编号 */}
      <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-1">
        <span>订单号 #{card.orderId?.slice(-8) || '2440401'}</span>
        <span>实付 ¥{card.payAmount}</span>
      </div>
    </div>
  );
}

// ==================== 主入口容器 (去卡片化、毛玻璃、环境漫反射) ====================
export default function LuckinCoffeeCard({ card }) {
  if (!card || !card.kind) return null;

  return (
    <div className="w-full max-w-[340px] my-2 transition-all duration-300">
      {/* 极弱环境漫反射与毛玻璃微容器 */}
      <div className="relative overflow-hidden rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-4">
        {/* 顶部 Brand Bar：瑞幸标志性湛蓝光标 */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0022AB] flex items-center justify-center shadow-sm shadow-blue-800/30">
              <LuckinLogo />
            </div>
            <div>
              <span className="text-xs font-black tracking-wide text-[#0022AB] dark:text-blue-400">
                luckin coffee
              </span>
              <span className="block text-[9px] font-medium text-slate-400 uppercase tracking-wider -mt-0.5">
                Professional Coffee
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 px-2 py-0.5 rounded-full">
            <CupIcon />
            <span>瑞幸精选</span>
          </div>
        </div>

        {/* 分步卡片按 kind 渲染 */}
        {card.kind === 'luckin_shop' && <ShopCard card={card} />}
        {card.kind === 'luckin_product' && <ProductCard card={card} />}
        {card.kind === 'luckin_pay' && <PayCard card={card} />}
        {card.kind === 'luckin_order' && <OrderCard card={card} />}
      </div>
    </div>
  );
}
