import React, { useEffect, useState } from 'react';

import CompanionHeartIcon from '../../../companion/CompanionHeartIcon';
import { hasCompanionForChat } from '../../../companion/companionService';

/*
 * 角色主动提议"要不要一起养小伙伴"的邀请卡片（9.2 补充需求：
 * 仪式感版，而不是只在普通文字里问一句）。
 *
 * 只读 metadata 里没有的东西——是否已经养了——需要实时查一下
 * companions 表，因为这条消息可能是很久之前发的，用户当时没理，
 * 后来自己在别处领养了小伙伴，这时候卡片要显示"已经在照顾啦"。
 */
const CompanionOfferCard = ({ message, chatId, onAccept }) => {
  const [status, setStatus] = useState('checking'); // checking | pending | adopted
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hasCompanionForChat(chatId).then((has) => {
      if (!cancelled) setStatus(has ? 'adopted' : 'pending');
    });

    return () => { cancelled = true; };
  }, [chatId]);

  if (dismissed) return null;

  return (
    <div className="my-1 w-full max-w-sm select-none">
      <div
        className="relative overflow-hidden rounded-[1.75rem] p-4"
        style={{
          background: 'var(--card-bg-gradient, var(--card-bg))',
          border: '1px solid var(--card-border)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20"
          style={{ background: 'var(--accent-color)' }}
        />

        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <CompanionHeartIcon className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>
            想养一只小伙伴
          </span>
        </div>

        <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-main)' }}>
          {message?.content}
        </p>

        {status === 'adopted' ? (
          <div
            className="rounded-full px-3 py-1.5 text-center text-[11px]"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
          >
            已经在一起照顾小伙伴啦
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 rounded-full py-1.5 text-[11px] font-medium"
              style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              一起养
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-full px-3 py-1.5 text-[11px]"
              style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
            >
              先不用
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanionOfferCard;