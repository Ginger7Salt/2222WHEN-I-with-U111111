import React from 'react';
import { Package, ChevronRight } from 'lucide-react';

// 快递到了之后弹的那一条提示卡片：跟 ChatDiyUpdateNotice 不一样，这条
// 是可以点的——拆快递本身就是个值得点进去看一眼的动作，不是纯旁白。
// 视觉上参照 OfflineInviteCard 里 status==='active' 的那张卡（强调色
// 描边 + 右侧箭头），保持跟项目里其它"点我进去看"的卡片同一个语言。
const ChatParcelArrivedNotice = ({ message, onOpenParcel }) => {
  const text = message?.content || '有一个快递到了。';

  return (
    <div
      className="mx-auto my-3 w-[calc(100%-1rem)] max-w-[340px] overflow-hidden rounded-[1.75rem] p-4 backdrop-blur-xl transition-all duration-200"
      style={{
        background: 'var(--card-bg-gradient)',
        color: 'var(--text-main)',
        border: '1px solid var(--accent-color)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpenParcel?.()}
        className="flex w-full items-center justify-between gap-3 text-left transition-opacity active:opacity-70"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--accent-color)',
            }}
          >
            <Package className="h-[18px] w-[18px]" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[13px] leading-relaxed">
              {text}
            </div>

            <div
              className="mt-0.5 flex items-center gap-1.5 text-[12px]"
              style={{ color: 'var(--accent-color)' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: 'var(--accent-color)' }}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--accent-color)' }}
                />
              </span>
              点这里拆开看看
            </div>
          </div>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
      </button>
    </div>
  );
};

export default ChatParcelArrivedNotice;