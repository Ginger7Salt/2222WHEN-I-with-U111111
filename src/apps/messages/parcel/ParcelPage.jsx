import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Package, Gift, Sparkles } from 'lucide-react';

import { getParcelState, acknowledgeParcel } from './parcelService';

// 快递页面：'idle'（没有快递在等/角色可能正在悄悄准备但不会露出任何
// 痕迹，两种情况在这个页面上必须长得一模一样，否则就不是真正的
// 惊喜了）→ 'wrapped'（有一份快递到了，还没拆）→ 'opened'（拆开看到
// 物品清单 + 笔记摘录）。
const ParcelPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [stage, setStage] = useState('idle'); // idle | wrapped | opened
  const [items, setItems] = useState([]);
  const [noteExcerpts, setNoteExcerpts] = useState([]);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    getParcelState(chatId).then((state) => {
      if (!mountedRef.current) return;

      setItems(state?.items || []);
      setNoteExcerpts(state?.noteExcerpts || []);
      setStage(state?.status === 'ready' ? 'wrapped' : 'idle');
      setIsLoading(false);
    });

    return () => {
      mountedRef.current = false;
    };
  }, [chatId]);

  const handleOpen = () => {
    setStage('opened');
  };

  const handleAcknowledge = async () => {
    if (isAcknowledging) return;

    setIsAcknowledging(true);
    await acknowledgeParcel(chatId);

    if (!mountedRef.current) return;
    setIsAcknowledging(false);
    onBack?.();
  };

  return (
    <div
      className="parcel-page-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up"
      style={{ background: 'var(--bg-main)' }}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
          style={{ background: 'var(--control-soft-bg)' }}
          title="返回"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Package className="h-4 w-4" />
        <span className="text-sm font-medium">神秘快递</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-8">
        {isLoading ? null : stage === 'idle' ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-3xl"
              style={{ background: 'var(--control-soft-bg)', color: 'var(--text-muted)' }}
            >
              <Package className="h-7 w-7 opacity-50" />
            </div>
            <p className="mt-4 text-[12px] leading-relaxed opacity-60">
              快递柜空荡荡的，
              <br />
              说不定什么时候会有惊喜送到。
            </p>
          </div>
        ) : stage === 'wrapped' ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <button
              type="button"
              onClick={handleOpen}
              className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-[2rem] transition-transform active:scale-95"
              style={{
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
              }}
            >
              <Gift className="h-9 w-9" />
            </button>
            <p className="mt-5 text-[13px] font-medium">
              {character?.name || 'TA'} 悄悄给你准备了一份快递
            </p>
            <p className="mt-1.5 text-[11px] opacity-55">点一下，拆开看看</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[360px] flex-col gap-3">
            <div className="mb-1 flex items-center gap-2 text-[12px] opacity-60">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{character?.name || 'TA'} 准备的这份快递里有：</span>
            </div>

            {items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="rounded-2xl border p-3.5"
                style={{
                  borderColor: 'var(--card-border)',
                  background: 'var(--card-bg-gradient)',
                }}
              >
                <div className="text-[13.5px] font-semibold">{item.name}</div>
                <div className="mt-1 text-[12px] leading-relaxed opacity-70">
                  {item.description}
                </div>
              </div>
            ))}

            {noteExcerpts.length > 0 && (
              <div
                className="mt-2 rounded-2xl px-3.5 py-3 text-[12px] leading-relaxed"
                style={{
                  background: 'var(--control-soft-bg)',
                  color: 'var(--text-sub)',
                }}
              >
                <div className="mb-1.5 text-[11px] opacity-55">
                  TA准备期间悄悄留下的心里话
                </div>
                {noteExcerpts.map((note, index) => (
                  <div key={index} className="opacity-85">
                    "{note}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isLoading && stage === 'opened' && (
        <div
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-medium transition-opacity disabled:opacity-60"
            style={{
              background: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            <span>{isAcknowledging ? '收下中…' : '收下这份心意'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ParcelPage;