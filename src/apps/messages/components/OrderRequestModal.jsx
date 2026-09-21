import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingBag, X, Send, Check } from 'lucide-react';
import {
  ORDER_BRANDS,
  FULFILLMENT_OPTIONS,
  getBrandById,
} from '../order/orderBrands';
import BrandImage from '../order/BrandImage';
import {
  ORDER_MODES,
  ORDER_REQUEST_LIMITS,
  buildOrderRequestFields,
} from '../order/orderRequestService';
import {
  SAVED_INFO_LIMITS,
  listSavedInfo,
  addSavedInfo,
} from '../../../services/userSavedInfoService';
import { triggerGlobalToast } from '../../../components/NotificationToast';

// 退出动画时长，需要和下面的 duration-200 保持一致
const EXIT_MS = 200;

const DEFAULT_SAVE_TITLE = '收货信息';

// 输入框底色要和弹窗底色（--card-bg）有对比，浅色主题里两者都是白色，
// 所以这里用和胶囊按钮一致的 --control-soft-bg。
const fieldStyle = {
  background: 'var(--control-soft-bg)',
  color: 'var(--text-main)',
};

const sectionLabelClass = 'px-0.5 text-[10px] font-semibold opacity-60';

/**
 * 平滑展开 / 收起一块区域（用 grid 行高过渡，不测量高度，不触发额外重排计算）。
 */
const Reveal = ({ open, children }) => (
  <div
    className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none"
    style={{
      gridTemplateRows: open ? '1fr' : '0fr',
      opacity: open ? 1 : 0,
    }}
    aria-hidden={!open}
  >
    <div className="overflow-hidden">{children}</div>
  </div>
);

const appendLine = (current, addition, maxLength) => {
  if (!addition) return current;
  if (current.includes(addition)) return current;

  const next = current ? `${current}\n${addition}` : addition;

  return next.slice(0, maxLength);
};

export const OrderRequestModal = ({ onClose, onSubmit }) => {
  const [entered, setEntered] = useState(false);
  const closeTimerRef = useRef(null);

  const [brandId, setBrandId] = useState(null);
  const [fulfillment, setFulfillment] = useState(null);
  const [mode, setMode] = useState(ORDER_MODES.FULL);

  const [deliveryInfo, setDeliveryInfo] = useState('');
  const [pickupPlace, setPickupPlace] = useState('');
  const [items, setItems] = useState('');
  const [note, setNote] = useState('');

  const [saveChecked, setSaveChecked] = useState(false);
  const [saveTitle, setSaveTitle] = useState(DEFAULT_SAVE_TITLE);

  const [savedItems, setSavedItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brand = getBrandById(brandId);
  const isDelivery = fulfillment === 'delivery';

  // 进入动画：先以初始状态挂载，下一帧再切换到显示状态
  useEffect(() => {
    const frameId = requestAnimationFrame(() => setEntered(true));

    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // 读取常用信息（只在窗口打开时读一次）
  useEffect(() => {
    let cancelled = false;

    listSavedInfo()
      .then((list) => {
        if (!cancelled) setSavedItems(list);
      })
      .catch((error) => {
        console.warn('[Order] 读取常用信息失败：', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const requestClose = () => {
    setEntered(false);

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = setTimeout(() => onClose?.(), EXIT_MS);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') requestClose();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
    // requestClose 只依赖 ref 和稳定的 setter，这里不需要把它列入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectBrand = (nextBrandId) => {
    const nextBrand = getBrandById(nextBrandId);

    setBrandId(nextBrandId);

    // 当前取餐方式这个品牌不支持时，回到它的第一个选项
    if (nextBrand && !nextBrand.fulfillments.includes(fulfillment)) {
      setFulfillment(nextBrand.fulfillments[0]);
    }
  };

  const fillFromSaved = (content) => {
    if (isDelivery) {
      setDeliveryInfo((current) =>
        appendLine(current, content, ORDER_REQUEST_LIMITS.deliveryInfo),
      );
    } else {
      setPickupPlace(content.slice(0, ORDER_REQUEST_LIMITS.pickupPlace));
    }
  };

  const result = useMemo(
    () =>
      buildOrderRequestFields({
        brandId,
        fulfillment,
        mode,
        deliveryInfo,
        pickupPlace,
        items,
        note,
      }),
    [brandId, fulfillment, mode, deliveryInfo, pickupPlace, items, note],
  );

  const handleSubmit = async () => {
    if (!result.ok || isSubmitting) return;

    setIsSubmitting(true);

    // 勾选了"保存为常用信息"时先保存；保存失败不影响发送
    if (isDelivery && saveChecked) {
      try {
        await addSavedInfo({
          title: saveTitle.trim() || DEFAULT_SAVE_TITLE,
          content: deliveryInfo,
        });
      } catch (error) {
        triggerGlobalToast({
          title: '未能保存到常用信息',
          content: error?.message || '订单请求仍会正常发送。',
        });
      }
    }

    try {
      await onSubmit?.({ content: result.content, metadata: result.metadata });
      requestClose();
    } catch (error) {
      triggerGlobalToast({
        title: '发送失败',
        content: error?.message || '请稍后再试。',
      });
      setIsSubmitting(false);
    }
  };

  const showDetails = Boolean(brand);
  const canSubmit = result.ok && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="帮我点单"
    >
      <div
        className="fixed inset-0 transition-opacity duration-200 motion-reduce:transition-none"
        style={{
          backgroundColor: 'var(--modal-overlay, rgba(0,0,0,0.4))',
          opacity: entered ? 1 : 0,
        }}
        onClick={requestClose}
      />

      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-sm flex-col rounded-t-[2rem] shadow-2xl backdrop-blur-2xl transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none sm:rounded-[2rem]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
          borderStyle: 'solid',
          color: 'var(--text-main)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(24px)',
        }}
      >
        {/* 标题栏 */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 pb-2.5 pt-5"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag
              className="h-4 w-4"
              style={{ color: 'var(--accent-color)' }}
            />
            <h3 className="text-xs font-bold">帮我点单</h3>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="p-1 opacity-60 transition-opacity hover:opacity-100"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容区（可滚动） */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* 品牌 */}
          <div className="space-y-2">
            <div className={sectionLabelClass}>选择品牌</div>

            <div className="grid grid-cols-2 gap-2.5">
              {ORDER_BRANDS.map((item) => {
                const selected = item.id === brandId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectBrand(item.id)}
                    aria-pressed={selected}
                    className="rounded-2xl p-2.5 transition-all duration-200 active:scale-[0.97] motion-reduce:transition-none"
                    style={{
                      backgroundColor: selected
                        ? 'var(--card-bg)'
                        : 'var(--control-soft-bg)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selected
                        ? 'var(--accent-color)'
                        : 'transparent',
                      boxShadow: selected
                        ? '0 8px 24px rgba(0, 0, 0, 0.08)'
                        : 'none',
                    }}
                  >
                    <BrandImage
                      brand={item}
                      className="h-20 w-full rounded-xl"
                    />
                    <div className="mt-2 text-center text-[11px] font-semibold">
                      {item.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Reveal open={showDetails}>
            <div className="space-y-4 pb-1">
              {/* 取餐方式 */}
              <div className="space-y-2">
                <div className={sectionLabelClass}>取餐方式</div>

                <div className="flex flex-wrap gap-2">
                  {(brand?.fulfillments || []).map((fulfillmentId) => {
                    const option = FULFILLMENT_OPTIONS[fulfillmentId];
                    const selected = fulfillmentId === fulfillment;

                    return (
                      <button
                        key={fulfillmentId}
                        type="button"
                        onClick={() => setFulfillment(fulfillmentId)}
                        aria-pressed={selected}
                        className="rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200 active:scale-95 motion-reduce:transition-none"
                        style={{
                          backgroundColor: selected
                            ? 'var(--accent-color)'
                            : 'var(--control-soft-bg)',
                          color: selected
                            ? 'var(--accent-foreground)'
                            : 'var(--text-main)',
                        }}
                      >
                        {option?.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 收货信息 / 取餐地点 */}
              <div className="space-y-2">
                <div className={sectionLabelClass}>
                  {isDelivery ? '收货信息' : '取餐地点'}
                </div>

                {isDelivery ? (
                  <textarea
                    value={deliveryInfo}
                    maxLength={ORDER_REQUEST_LIMITS.deliveryInfo}
                    onChange={(event) => setDeliveryInfo(event.target.value)}
                    rows={3}
                    placeholder="联系人、电话、详细地址（含门牌）"
                    className="w-full resize-none rounded-xl p-2.5 text-xs outline-none"
                    style={fieldStyle}
                  />
                ) : (
                  <input
                    type="text"
                    value={pickupPlace}
                    maxLength={ORDER_REQUEST_LIMITS.pickupPlace}
                    onChange={(event) => setPickupPlace(event.target.value)}
                    placeholder="城市 + 附近的地标或门店名"
                    className="w-full rounded-xl p-2.5 text-xs outline-none"
                    style={fieldStyle}
                  />
                )}

                {savedItems.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[10px] opacity-50">
                      常用信息
                    </span>
                    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                      {savedItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => fillFromSaved(item.content)}
                          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] transition-all active:scale-95"
                          style={{ backgroundColor: 'var(--control-soft-bg)' }}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="px-0.5 text-[10px] opacity-45">
                    在聊天设置的“常用信息”里保存地址，这里就能一键填入。
                  </p>
                )}

                {isDelivery && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSaveChecked((value) => !value)}
                      aria-pressed={saveChecked}
                      className="flex items-center gap-2 px-0.5 text-[11px] active:opacity-70"
                    >
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-md transition-all duration-200 motion-reduce:transition-none"
                        style={{
                          backgroundColor: saveChecked
                            ? 'var(--accent-color)'
                            : 'var(--control-soft-bg)',
                          color: 'var(--accent-foreground)',
                        }}
                      >
                        {saveChecked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="opacity-75">同时保存为常用信息</span>
                    </button>

                    <Reveal open={saveChecked}>
                      <input
                        type="text"
                        value={saveTitle}
                        maxLength={SAVED_INFO_LIMITS.maxTitleLength}
                        onChange={(event) => setSaveTitle(event.target.value)}
                        placeholder="给它起个名字，例如：家庭地址"
                        className="w-full rounded-xl p-2.5 text-xs outline-none"
                        style={fieldStyle}
                      />
                    </Reveal>
                  </div>
                )}
              </div>

              {/* 点单方式 */}
              <div className="space-y-2">
                <div className={sectionLabelClass}>点单方式</div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      id: ORDER_MODES.FULL,
                      title: '我选好了',
                      desc: '填写想要的东西',
                    },
                    {
                      id: ORDER_MODES.MENU,
                      title: '先看看菜单',
                      desc: '让角色查好菜单再问我',
                    },
                  ].map((option) => {
                    const selected = option.id === mode;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setMode(option.id)}
                        aria-pressed={selected}
                        className="rounded-2xl px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.97] motion-reduce:transition-none"
                        style={{
                          backgroundColor: selected
                            ? 'var(--card-bg)'
                            : 'var(--control-soft-bg)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: selected
                            ? 'var(--accent-color)'
                            : 'transparent',
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {option.title}
                        </div>
                        <div className="mt-0.5 text-[10px] opacity-55">
                          {option.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Reveal open={mode === ORDER_MODES.FULL}>
                  <textarea
                    value={items}
                    maxLength={ORDER_REQUEST_LIMITS.items}
                    onChange={(event) => setItems(event.target.value)}
                    rows={3}
                    placeholder={'想要的东西，一行一样，可以写数量\n例如：大杯冰美式 x2'}
                    className="w-full resize-none rounded-xl p-2.5 text-xs outline-none"
                    style={fieldStyle}
                  />
                </Reveal>

                <input
                  type="text"
                  value={note}
                  maxLength={ORDER_REQUEST_LIMITS.note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="备注：口味偏好、几点要等（可不填）"
                  className="w-full rounded-xl p-2.5 text-xs outline-none"
                  style={fieldStyle}
                />
              </div>
            </div>
          </Reveal>
        </div>

        {/* 底部发送区 */}
        <div
          className="shrink-0 space-y-2 border-t px-5 pt-3"
          style={{
            borderColor: 'var(--card-border)',
            paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <p className="px-0.5 text-center text-[10px] opacity-55">
            {result.ok
              ? '价格以门店为准，订单创建后由你自己付款'
              : result.message}
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:active:scale-100 motion-reduce:transition-none"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Send className="h-3.5 w-3.5" />
            <span>发送给角色</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderRequestModal;