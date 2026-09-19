import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, PhoneOff, RotateCw, Send, Volume2 } from 'lucide-react';

import './call-active-screen.css';

// 通话进行中的独立视觉层，从 CallScreen 里拆出来单独维护。
// 头像比旧版更大、光环呼吸更明显；"歌词流动"的字不再是整段一次性
// 换掉，而是拆成一个个字符，新出现的字带一次轻柔的淡入 + 上浮，
// 制造缓慢浮现的感觉——逐字揭示的节奏仍然由 CallScreen 里的打字机
// 定时器控制，这里只负责把已经揭示出来的字符逐个渲染成带动画的元素。
// 底部输入条上方加了一条常驻的装饰性声波，填一下原来太空的下半屏，
// 纯装饰，不跟真实音量绑定。
const CallActiveScreen = ({
  character,
  statusLabel,
  turns,
  latestTurn,
  revealedText,
  aiThinking,
  transcriptRef,
  draftText,
  onDraftChange,
  onSend,
  isSending,
  onHangUp,
  onRerollTurn,
  onSwitchTurnVersion,
}) => {
  // 重 roll 是异步的（要等一次 AI 请求），这里只用本地状态标记"当前
  // 正在重 roll 哪一句"，防止同一句被连点好几次、也让按钮能转起来。
  // 不用全局的 aiThinking，因为那个是给"角色要说下一句了"用的，跟
  // "正在重说某一句旧话"是两件不搭边的事。
  const [pendingRerollId, setPendingRerollId] = useState(null);

  const handleRerollClick = async (turnId) => {
    if (pendingRerollId) return;

    setPendingRerollId(turnId);

    try {
      await onRerollTurn(turnId);
    } finally {
      setPendingRerollId(null);
    }
  };

  return (
  <div className="call-active flex h-full flex-col items-center">
    <div className="flex shrink-0 flex-col items-center gap-2.5 pb-2">
      <div className="call-active__avatar-ring relative flex h-28 w-28 items-center justify-center rounded-full">
        <span className="call-active__avatar-glow absolute inset-0 rounded-full" aria-hidden="true" />

        {character?.avatar ? (
          <img
            src={character.avatar}
            alt={character.name}
            className="relative h-24 w-24 rounded-full border object-cover"
            style={{ borderColor: 'rgba(255,255,255,0.5)' }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full border font-serif text-3xl font-semibold"
            style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            {character?.name?.[0] || 'C'}
          </div>
        )}
      </div>

      <h2
        className="font-serif text-base font-semibold"
        style={{ textShadow: '0 1px 10px rgba(0,0,0,0.45)' }}
      >
        {character?.name}
      </h2>

      <p
        className="font-mono text-[11px] tracking-[0.08em]"
        style={{ color: 'rgba(255,255,255,0.75)' }}
      >
        {statusLabel}
      </p>
    </div>

    <div
      ref={transcriptRef}
      className="call-active__flow mt-2 w-full max-w-sm flex-1 space-y-5 overflow-y-auto no-scrollbar"
    >
      {turns.map((turn) => {
        const isLatestAi = turn.id === latestTurn?.id && turn.by === 'ai';
        const displayText = isLatestAi ? revealedText : turn.content;

        return (
          <div
            key={turn.id}
            className={`call-active__line text-center ${
              turn.by === 'ai' ? 'call-active__line--ai' : 'call-active__line--user'
            }`}
          >
            {turn.by === 'ai' && turn.mode === 'real' && (
              <div className="mb-1 flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.14em] opacity-60">
                {turn.audioStatus === 'pending' ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Volume2 className="h-2.5 w-2.5" />
                )}
                语音
              </div>
            )}
            <p>
              {isLatestAi
                ? displayText.split('').map((char, index) => (
                  <span key={index} className="call-active__char">
                    {char === ' ' ? ' ' : char}
                  </span>
                ))
                : displayText}

              {turn.by === 'ai' && (!isLatestAi || displayText.length >= turn.content.length) && (() => {
              const versions = Array.isArray(turn.versions) ? turn.versions : [];
              const hasVersions = versions.length > 1;
              const versionIndex = turn.currentVersionIndex ?? (versions.length - 1);
              const isRerolling = pendingRerollId === turn.id;

              return (
                <span className="call-active__turn-controls">
                  {hasVersions && (
                    <>
                      <button
                        type="button"
                        onClick={() => onSwitchTurnVersion(turn.id, 'prev')}
                        disabled={versionIndex <= 0}
                        className="call-active__turn-control-btn"
                        aria-label="上一个版本"
                        title="上一个版本"
                      >
                        <ChevronLeft className="h-2.5 w-2.5" />
                      </button>

                      <span className="call-active__turn-version-count">
                        {versionIndex + 1}/{versions.length}
                      </span>

                      <button
                        type="button"
                        onClick={() => onSwitchTurnVersion(turn.id, 'next')}
                        disabled={versionIndex >= versions.length - 1}
                        className="call-active__turn-control-btn"
                        aria-label="下一个版本"
                        title="下一个版本"
                      >
                        <ChevronRight className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRerollClick(turn.id)}
                    disabled={Boolean(pendingRerollId) || aiThinking}
                    className="call-active__turn-control-btn"
                    aria-label="重 roll 这句"
                    title="重 roll 这句"
                  >
                    <RotateCw className={`h-2.5 w-2.5 ${isRerolling ? 'animate-spin' : ''}`} />
                  </button>
                </span>
              );
            })()}
            </p>
          </div>
        );
      })}

      {aiThinking && (
        <div className="call-active__thinking flex items-center justify-center gap-1.5">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>

    <div className="call-active__ambient-wave flex shrink-0 items-end justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          className="call-active__ambient-bar"
          style={{ animationDelay: `${index * 0.09}s` }}
        />
      ))}
    </div>

    <div className="mt-3 flex w-full max-w-sm shrink-0 items-center gap-2">
      <input
        type="text"
        value={draftText}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="在通话中打字说话..."
        className="call-active__input min-w-0 flex-1 rounded-full px-4 py-3 text-[13px] outline-none"
      />

      <button
        type="button"
        onClick={onSend}
        disabled={isSending || !draftText.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
        style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
        aria-label="发送"
        title="发送"
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>

      <button
        type="button"
        onClick={onHangUp}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/90 text-white transition-transform active:scale-95"
        aria-label="挂断"
        title="挂断"
      >
        <PhoneOff className="h-4 w-4" />
      </button>
    </div>
  </div>
  );
};

export default CallActiveScreen;