import React, { useState } from 'react';
import { Ticket, Check } from 'lucide-react';
import { redeemCoupon } from '../../coupon/couponService';

// 角色在在线回复里自己带上 [COUPON: 标题 | 内容] 时，会被解析成一条
// type: 'coupon' 的普通消息，这个卡片就是它在聊天气泡里的样子。
// 兑现状态直接持久化在这条消息自己的 metadata 里（跟 PhotoCard 一样，
// 拿 messageId 自己读写，不用再往 ChatRoom/MessageList 多穿一层回调）。
export const CouponCard = ({ metadata, messageId, isUser = false }) => {
  const [status, setStatus] = useState(metadata?.status || 'pending');
  const [isStamping, setIsStamping] = useState(false);

  const title = metadata?.title || '和好券';
  const note = metadata?.note || '';

  const handleRedeem = () => {
    if (status !== 'pending' || !messageId) return;

    setIsStamping(true);

    window.setTimeout(async () => {
      await redeemCoupon({ source: 'message', id: messageId });
      setStatus('redeemed');
      setIsStamping(false);
    }, 480);
  };

  return (
    <div className="w-full max-w-sm my-2 select-none">
      <div
        className="relative overflow-hidden rounded-[1.5rem] p-4 transition-all duration-300 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.75))',
          borderColor: 'var(--card-border, rgba(0, 0, 0, 0.08))',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
          color: 'var(--text-main, #1a1a1a)',
          opacity: status === 'redeemed' ? 0.6 : 1,
        }}
      >
        <div
          className="flex items-center justify-between pb-3 border-b border-dashed"
          style={{ borderColor: 'var(--card-border, rgba(0, 0, 0, 0.1))' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full p-2"
              style={{
                backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.05))',
                color: 'var(--accent-color, #7c3aed)',
              }}
            >
              <Ticket className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
              {isUser ? '你发出的和好券' : 'TA 给你发了一张券'}
            </span>
          </div>

          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: status === 'redeemed'
                ? 'var(--control-soft-bg, rgba(0,0,0,0.06))'
                : 'var(--accent-color, #7c3aed)',
              color: status === 'redeemed' ? 'var(--text-muted, #888)' : '#fff',
            }}
          >
            {status === 'redeemed' ? '已兑现' : '待兑现'}
          </span>
        </div>

        <div className="py-3">
          <h4 className="mb-1 text-base font-bold tracking-tight">{title}</h4>
          <p className="text-xs leading-relaxed opacity-80">{note}</p>
        </div>

        {!isUser && status === 'pending' && (
          <button
            type="button"
            onClick={handleRedeem}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all"
            style={{
              backgroundColor: 'var(--accent-color, #7c3aed)',
              color: '#ffffff',
            }}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{isStamping ? '盖章中…' : '兑现这张券'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default CouponCard;