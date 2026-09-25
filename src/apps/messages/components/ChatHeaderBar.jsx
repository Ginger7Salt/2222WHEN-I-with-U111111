import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Heart,
  ChevronUp,
  Edit3,
  Shield,
  Sparkles,
  Loader2,
  Radio,
  ListOrdered,
  Pencil,
} from 'lucide-react';

import { subscribeSummaryStatus } from '../../../services/aiService';
import ChatHeaderWeatherAmbience from './ChatHeaderWeatherAmbience';

export const ChatHeaderBar = ({
  character,
  chat,
  onOpenSettings,
  onSaveSummary,
  // 是否展开——现在由 ChatRoom 统一控制，这样同一颗爱心
  // 既能展开这里的身份卡片，也能一并带出顶部那一整排按钮，
  // 收起时就只剩这一颗爱心，不再有另外单独的按钮/横条。
  isExpanded,
  onToggleExpanded,
  headerCaption,
  onSaveHeaderCaption,
}) => {

  const [isSummarizing, setIsSummarizing] = useState(false);
  // 'idle'（默认，不显示铅笔，没写字就什么都不显示）

  // -> 'revealed'（点一下，露出铅笔/占位提示，但还不能编辑）
  // -> 'editing'（再点一下，才是真正的输入框）
  const [captionStage, setCaptionStage] = useState('idle');
  const [captionDraft, setCaptionDraft] = useState('');

  // 展开卡片中部（简介/总结 <-> 天气氛围）左右滑动的两页，做法跟首页
  // 应用区的 AppSwiper 一样：横向 scroll-snap + 底部圆点，不引入额外的
  // 手势库。
  const [detailPage, setDetailPage] = useState(0);
  const detailScrollerRef = useRef(null);
  const isProgrammaticDetailScroll = useRef(false);

  // 两页内容天然高矮不一样（简介/总结页矮，天气氛围页高）。横向
  // scroll-snap 的两个子项默认按"最高的那个"撑开整行高度，结果矮的
  // 那页下面会空出一大块。这里用 ResizeObserver 分别量出两页各自
  // 的真实高度，外层容器只跟着"当前显示的是哪一页"来定高，不显示
  // 的那一页多出来的高度会被 overflow-hidden 裁掉，不影响布局。
  const detailPage0Ref = useRef(null);
  const detailPage1Ref = useRef(null);
  const [detailPageHeights, setDetailPageHeights] = useState({ 0: null, 1: null });

  useEffect(() => {
    if (!isExpanded || typeof ResizeObserver === 'undefined') return undefined;

    const targets = [
      { index: 0, node: detailPage0Ref.current },
      { index: 1, node: detailPage1Ref.current },
    ].filter((item) => item.node);

    if (targets.length === 0) return undefined;

    const observer = new ResizeObserver((entries) => {
      setDetailPageHeights((previous) => {
        const next = { ...previous };

        entries.forEach((entry) => {
          const match = targets.find((item) => item.node === entry.target);
          if (match) next[match.index] = entry.contentRect.height;
        });

        return next;
      });
    });

    targets.forEach((item) => observer.observe(item.node));

    return () => observer.disconnect();
  }, [isExpanded]);

  const handleDetailScroll = () => {
    if (isProgrammaticDetailScroll.current) return;

    const node = detailScrollerRef.current;
    if (!node || node.clientWidth === 0) return;

    const index = Math.round(node.scrollLeft / node.clientWidth);
    setDetailPage((previous) => (previous === index ? previous : index));
  };

  const goToDetailPage = (index) => {
    const node = detailScrollerRef.current;
    if (!node) return;

    isProgrammaticDetailScroll.current = true;
    node.scrollTo({ left: index * node.clientWidth, behavior: 'smooth' });
    setDetailPage(index);

    window.setTimeout(() => {
      isProgrammaticDetailScroll.current = false;
    }, 400);
  };

  useEffect(() => {
    const unsubscribe = subscribeSummaryStatus(({ chatId, isSummarizing: nextIsSummarizing }) => {
      if (chatId === chat.id) {
        setIsSummarizing(nextIsSummarizing);
      }
    });

    return unsubscribe;
  }, [chat.id]);

  if (!character || !chat) return null;

  const currentStatus = useMemo(() => {
    if (Array.isArray(character.statusList) && character.statusList.length > 0) {
      return character.statusList[Math.floor(Math.random() * character.statusList.length)];
    }

    return '月色与你同在';
  }, [character.id, character.statusList]);

  const isRpMode = chat.mode === 'rp';

  const summaryEntries = useMemo(() => {
    if (Array.isArray(chat.summary)) return chat.summary;

    if (typeof chat.summary === 'string' && chat.summary.trim()) {
      return [
        {
          id: 'legacy',
          content: chat.summary,
          createdAt: '历史记录',
          isAuto: true
        }
      ];
    }

    return [];
  }, [chat.summary]);

  const modeLabel = isRpMode ? 'ROLE PLAY MODE' : 'REAL WORLD MODE';
  const modeDescription = isRpMode
    ? '沉浸于剧情背景与专属世界书中。'
    : '伴于现实，关注日常生活细节。';

  return (
    <div className="w-full shrink-0">
      {!isExpanded ? (
        <div className="flex flex-col items-center gap-1 py-1">
          <button
            type="button"
            onClick={() => onToggleExpanded(true)}
           className="chat-header-heart-button group relative flex h-8 w-8 items-center justify-center rounded-full border transition-transform duration-300 active:scale-90"
            style={{
              background: 'var(--card-bg-gradient)',
              borderColor: 'var(--card-border)',
             color: 'var(--text-muted)',
              boxShadow: 'var(--card-shadow)'
            }}
            title={`${character.name} · ${currentStatus}`}
            aria-label={`展开 ${character.name} 的对话状态栏`}
          >
            <span
              className="absolute inset-1 rounded-full opacity-30"
              style={{ background: 'var(--control-soft-bg)' }}
            />
           <Heart
  className="chat-header-heart-icon relative h-3.5 w-3.5"
  strokeWidth={1.7}
/>

          </button>

          {captionStage === 'editing' ? (
            <input
              type="text"
              value={captionDraft}
              onChange={(event) => setCaptionDraft(event.target.value)}
              onBlur={() => {
                setCaptionStage('idle');
                onSaveHeaderCaption?.(captionDraft.trim());
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  setCaptionStage('idle');
                  setCaptionDraft(headerCaption || '');
                }
              }}
              autoFocus
              maxLength={40}
              placeholder="写一句只有你们知道的话，留空也可以"
              className="w-48 rounded-full border bg-transparent px-3 py-1 text-center text-[11px] italic outline-none"
              style={{
                borderColor: 'var(--card-border)',
                color: 'var(--text-sub)',
                background: 'var(--control-soft-bg)',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (captionStage === 'revealed') {
                  setCaptionDraft(headerCaption || '');
                  setCaptionStage('editing');
                } else {
                  setCaptionStage('revealed');
                }
              }}
              className="flex min-h-[1.25rem] items-center gap-1 rounded-full px-2 py-0.5 opacity-70 transition-opacity hover:opacity-100"
              title="编辑这句话"
            >
              {/*
                默认（idle）什么都不显示——用户可以选择完全留空，不强行露出占位文字；
                点一下（revealed）才露出文字/占位提示和铅笔，再点一下才真正进入编辑。
              */}
              {(headerCaption || captionStage === 'revealed') && (
                <span
                  className="truncate text-[11px] italic"
                  style={{ color: 'var(--text-sub)', maxWidth: '11rem' }}
                >
                  {headerCaption || '写一句只有你们知道的话'}
                </span>
              )}

              {captionStage === 'revealed' && (
                <Pencil className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
          )}
        </div>
      ) : (
        <section
          className="chat-header-expanded relative w-full overflow-hidden rounded-[1.75rem] border px-4 py-4 text-left animate-fade-in-up"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-30 blur-3xl"
            style={{ background: 'var(--bg-blob-2)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/4 h-24 w-24 rounded-full opacity-25 blur-3xl"
            style={{ background: 'var(--bg-blob-1)' }}
          />

          <div className="relative flex items-center gap-3">
            {/* 左侧：头像与旋转唱片轨道 */}
            <div className="chat-header-avatar-stage relative h-[4.6rem] w-[4.6rem] shrink-0">
              <div
                className="chat-header-record-ring absolute inset-0 rounded-full"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0deg, var(--divider) 42deg, transparent 95deg, var(--card-border) 168deg, transparent 225deg, var(--divider) 300deg, transparent 360deg)'
                }}
              />

              <div
                className="absolute inset-[0.34rem] rounded-full"
                style={{
                  background: 'var(--control-soft-bg)',
                  boxShadow: 'inset 0 0 0 1px var(--divider)'
                }}
              />

              {character.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="absolute inset-[0.48rem] h-[3.65rem] w-[3.65rem] rounded-full border object-cover"
                  style={{
                    borderColor: 'var(--card-bg)',
                    boxShadow: '0 8px 18px color-mix(in srgb, var(--text-main) 16%, transparent)'
                  }} loading="lazy" decoding="async" />
              ) : (
                <div
                  className="absolute inset-[0.48rem] flex h-[3.65rem] w-[3.65rem] items-center justify-center rounded-full border font-serif text-lg font-semibold"
                  style={{
                    background: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-bg)',
                    color: 'var(--text-main)'
                  }}
                >
                  {character.name?.[0] || 'C'}
                </div>
              )}

              <span
                className="chat-header-online-dot absolute bottom-[0.36rem] right-[0.36rem] h-2.5 w-2.5 rounded-full border-2"
                style={{
                  background: 'var(--accent-color)',
                  borderColor: 'var(--card-bg)'
                }}
              />
            </div>

            {/* 中部：身份、姓名、状态 */}
            <div className="min-w-0 flex-1 py-0.5">
              <div
                className="mb-1 flex items-center gap-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--text-muted)' }}
              >
                <span
                  className="h-px w-3 shrink-0"
                  style={{ background: 'var(--divider)' }}
                />
                <span className="truncate">Private Frequency · {modeLabel}</span>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 truncate font-serif text-[1.1rem] font-semibold tracking-tight">
                  {character.name}
                </h3>

                <span
                  className="flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-[0.11em]"
                  style={{
                    background: 'var(--control-soft-bg)',
                    borderColor: 'var(--divider)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span
                    className="chat-header-status-dot h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--accent-color)' }}
                  />
                  Online
                </span>
              </div>

              <p
                className="mt-1 truncate font-serif text-[11px] italic leading-relaxed"
                style={{ color: 'var(--text-sub)' }}
              >
                “{currentStatus}”
              </p>
            </div>

            {/* 右侧：身份编号与均衡器 */}
            <div
              className="flex shrink-0 flex-col items-end justify-between self-stretch border-l pl-3"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="text-right">
                <p
                  className="font-mono text-[7px] uppercase tracking-[0.16em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Chat Archive
                </p>
                <p className="mt-0.5 font-mono text-[10px] font-semibold tracking-[0.08em]">
                  #{String(chat.id).padStart(4, '0')}
                </p>
              </div>

              <div
                className="chat-header-equalizer flex h-4 items-end gap-[3px]"
                aria-label="对话连接中"
              >
                <span style={{ background: 'var(--accent-color)' }} />
                <span style={{ background: 'var(--accent-color)' }} />
                <span style={{ background: 'var(--accent-color)' }} />
                <span style={{ background: 'var(--accent-color)' }} />
                <span style={{ background: 'var(--accent-color)' }} />
              </div>
            </div>
          </div>

          {/* 下半区：简介/总结 与 天气氛围，左右滑动切换 */}
          <div className="relative mt-3 border-t pt-3" style={{ borderColor: 'var(--divider)' }}>
            <div
              className="relative overflow-hidden"
              style={{
                height:
                  detailPageHeights[detailPage] != null
                    ? `${detailPageHeights[detailPage]}px`
                    : 'auto',
                transition: 'height 260ms ease',
              }}
            >
              <div
                ref={detailScrollerRef}
                onScroll={handleDetailScroll}
                className="hide-scrollbar flex items-start snap-x snap-mandatory overflow-x-auto scroll-smooth"
                style={{ scrollbarWidth: 'none' }}
              >
                <div ref={detailPage0Ref} className="w-full shrink-0 snap-start space-y-2.5 pr-0.5">
                  {character.bio && (
                    <p
                      className="rounded-2xl border px-3 py-2.5 font-serif text-[11px] italic leading-relaxed"
                      style={{
                        background: 'var(--control-soft-bg)',
                        borderColor: 'var(--divider)',
                        color: 'var(--text-sub)'
                      }}
                    >
                      “{character.bio}”
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className="rounded-2xl border px-3 py-2.5"
                      style={{
                        background: 'var(--control-soft-bg)',
                        borderColor: 'var(--divider)'
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Shield className="h-3 w-3" />
                        <span>Connection</span>
                      </div>

                      <p className="mt-1.5 text-[10px] leading-relaxed opacity-85">
                        {modeDescription}
                      </p>
                    </div>

                    <div
                      className="rounded-2xl border px-3 py-2.5"
                      style={{
                        background: 'var(--control-soft-bg)',
                        borderColor: 'var(--divider)'
                      }}
                    >
                      <div
                        className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span className="flex items-center gap-1.5">
                          <ListOrdered className="h-3 w-3" />
                          Summary
                        </span>
                        <span>{summaryEntries.length}</span>
                      </div>

                      {isSummarizing ? (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] italic opacity-70">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>正在整理最新心绪...</span>
                        </div>
                      ) : summaryEntries.length === 0 ? (
                        <p className="mt-1.5 text-[10px] italic opacity-60">
                          尚未留下阶段记录。
                        </p>
                      ) : (
                        <p className="mt-1.5 truncate text-[10px] leading-relaxed opacity-85">
                          {summaryEntries[summaryEntries.length - 1]?.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div ref={detailPage1Ref} className="w-full shrink-0 snap-start pl-0.5">
                  <ChatHeaderWeatherAmbience active={isExpanded && detailPage === 1} />
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center gap-1.5">
              {[0, 1].map((pageIndex) => (
                <button
                  key={pageIndex}
                  type="button"
                  aria-label={`第 ${pageIndex + 1} 页`}
                  onClick={() => goToDetailPage(pageIndex)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: pageIndex === detailPage ? '1.1rem' : '0.4rem',
                    height: '0.4rem',
                    backgroundColor:
                      pageIndex === detailPage ? 'var(--text-main)' : 'var(--card-border)',
                    opacity: pageIndex === detailPage ? 0.7 : 0.5,
                  }}
                />
              ))}
            </div>
          </div>

          {/* 操作区 */}
          <div className="relative mt-3 flex items-center justify-between">
            <div
              className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Radio className="h-3 w-3" />
              <span>{isSummarizing ? 'Memory Processing' : 'Channel Connected'}</span>
            </div>

            <div className="flex items-center gap-1.5">

              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-full border p-2 transition-all active:scale-95 hover:opacity-80"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)',
                  color: 'var(--text-main)'
                }}
                title="编辑伴侣人设"
                aria-label="编辑伴侣人设"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onToggleExpanded(false)}
                className="rounded-full border p-2 transition-all active:scale-95 hover:opacity-80"
                style={{
                  background: 'var(--accent-color)',
                  borderColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
                title="收起状态栏"
                aria-label="收起状态栏"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <style>{`
            .chat-header-heart-button:hover {
              transform: translateY(-1px);
            }

            .chat-header-record-ring {
              animation: chat-header-record-spin 13s linear infinite;
            }

            .chat-header-online-dot {
              animation: chat-header-online-pulse 2.4s ease-out infinite;
            }

            .chat-header-status-dot {
              animation: chat-header-status-pulse 2.1s ease-out infinite;
            }

            .chat-header-equalizer span {
              width: 2px;
              min-height: 3px;
              border-radius: 999px;
              transform-origin: bottom;
              animation: chat-header-eq-bounce 1.15s ease-in-out infinite alternate;
            }

            .chat-header-equalizer span:nth-child(1) {
              height: 38%;
              animation-delay: 0s;
            }

            .chat-header-equalizer span:nth-child(2) {
              height: 82%;
              animation-delay: 0.16s;
            }

            .chat-header-equalizer span:nth-child(3) {
              height: 54%;
              animation-delay: 0.33s;
            }

            .chat-header-equalizer span:nth-child(4) {
              height: 100%;
              animation-delay: 0.12s;
            }

            .chat-header-equalizer span:nth-child(5) {
              height: 46%;
              animation-delay: 0.27s;
            }

            @keyframes chat-header-record-spin {
              to {
                transform: rotate(360deg);
              }
            }

            @keyframes chat-header-online-pulse {
              0% {
                box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-color) 36%, transparent);
              }

              70% {
                box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent-color) 0%, transparent);
              }

              100% {
                box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-color) 0%, transparent);
              }
            }

            @keyframes chat-header-status-pulse {
              0%,
              100% {
                opacity: 0.55;
                transform: scale(0.88);
              }

              50% {
                opacity: 1;
                transform: scale(1);
              }
            }

            @keyframes chat-header-eq-bounce {
              0% {
                transform: scaleY(0.35);
                opacity: 0.45;
              }

              100% {
                transform: scaleY(1);
                opacity: 1;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .chat-header-record-ring,
              .chat-header-online-dot,
              .chat-header-status-dot,
              .chat-header-equalizer span {
                animation: none;
              }
            }
              .chat-header-heart-icon {
  fill: transparent;
  opacity: 0.72;
  transition:
    fill 220ms ease,
    color 220ms ease,
    opacity 220ms ease,
    transform 220ms ease;
}

.chat-header-heart-button:hover .chat-header-heart-icon {
  fill: var(--accent-color);
  color: var(--accent-color);
  opacity: 1;
  transform: scale(1.08);
}

          `}</style>
        </section>
      )}
    </div>
  );
};

export default ChatHeaderBar;