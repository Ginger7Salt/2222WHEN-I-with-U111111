import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Gift,
  Utensils,
  CreditCard,
  X,
  Smile,
  CircleDot,
  Box,
  Swords,
  ShoppingBag,
  Hand,
} from 'lucide-react';
import {
  ORDER_ENTRY_STATES,
  getOrderEntryState,
} from '../order/orderRequestService';
import { triggerGlobalToast } from '../../../components/NotificationToast';


export const InteractiveMenuPopover = ({ onSelectAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  // "帮我点单"入口的状态：
  // hidden 不显示 / ready 可用 / needs-setup 已同步过点单工具但暂时不能用
  const [orderEntry, setOrderEntry] = useState({
    state: ORDER_ENTRY_STATES.HIDDEN,
  });

  useEffect(() => {
    let cancelled = false;

    getOrderEntryState().then((value) => {
      if (!cancelled) setOrderEntry(value);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const isOrderReady = orderEntry.state === ORDER_ENTRY_STATES.READY;

  // 点击外部自动收起 Popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (type) => {
    setIsOpen(false);
    onSelectAction(type);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* 底部悬浮输入栏上的唯一新入口按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        data-open={isOpen ? 'true' : 'false'}
        className="chat-input-sparkle-btn rounded-full p-2 transition-all active:scale-90 flex items-center justify-center"
        style={{
          background: isOpen ? 'var(--accent-color)' : 'var(--control-soft-bg)',
          color: isOpen ? 'var(--accent-foreground)' : 'var(--text-main)',
        }}
        title="心意互动菜单"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {/* 向上平滑展开的子菜单 */}
      {isOpen && (
        <div
          className="absolute bottom-12 left-0 mb-1 w-48 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: 'var(--text-main)',
          }}
        >
          <div
            className="flex items-center justify-between px-2 py-1 mb-1 border-b text-[10px] font-semibold opacity-60"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <span>心意互动</span>
            <button type="button" onClick={() => setIsOpen(false)}>
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleAction('sticker')}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>表情包</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('gift')}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>赠送礼物</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('food')}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>外卖代点</span>
            </button>

            
            {orderEntry.state !== ORDER_ENTRY_STATES.HIDDEN && (
              <button
                type="button"
                onClick={() => {
                  if (isOrderReady) {
                    handleAction('mcp_order');
                    return;
                  }

                  // 暂时不能用：收起菜单，用提示说明该去哪里开启
                  setIsOpen(false);
                  triggerGlobalToast({
                    title: orderEntry.title,
                    content: orderEntry.message,
                    duration: 6000,
                  });
                }}
                aria-disabled={!isOrderReady}
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  opacity: isOrderReady ? 1 : 0.55,
                }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>帮我点单</span>
                {!isOrderReady && (
                  <span className="ml-auto text-[9px] opacity-70">未就绪</span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAction('kinship')}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>开通亲属卡</span>
            </button>
          </div>
          <div
            className="mt-2 border-t pt-2"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <div className="px-2 pb-1 text-[10px] font-semibold opacity-60">
              轻互动
            </div>

            <button
              type="button"
              onClick={() => handleAction('interaction_poke')}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Hand className="h-3.5 w-3.5" />
              <span>戳一戳</span>
            </button>
          </div>

          <div
  className="mt-2 border-t pt-2"
  style={{ borderColor: 'var(--card-border)' }}
>
  <div className="px-2 pb-1 text-[10px] font-semibold opacity-60">
    桌面游戏
  </div>

  <button
    type="button"
    onClick={() => handleAction('interaction_coin')}
    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-85"
    style={{ backgroundColor: 'var(--control-soft-bg)' }}
  >
    <CircleDot className="h-3.5 w-3.5" />
    <span>抛旧硬币</span>
  </button>

  <button
    type="button"
    onClick={() => handleAction('interaction_dice')}
    className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-85"
    style={{ backgroundColor: 'var(--control-soft-bg)' }}
  >
    <Box className="h-3.5 w-3.5" />
    <span>掷六面骰</span>
  </button>

  <button
    type="button"
    onClick={() => handleAction('interaction_rps')}
    className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-85"
    style={{ backgroundColor: 'var(--control-soft-bg)' }}
  >
    <Swords className="h-3.5 w-3.5" />
    <span>猜拳</span>
  </button>
</div>

        </div>
      )}
    </div>
  );
};

export default InteractiveMenuPopover;