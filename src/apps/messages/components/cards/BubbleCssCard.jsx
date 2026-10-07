import React, { useMemo, useState } from 'react';

import { scopeBubbleCss } from '../../bubbleCssSanitizer';
import { saveBubbleCssCard, revertBubbleCssCard } from '../../bubbleCustomStyleService';

/*
 * 角色自己写了一套气泡 CSS 之后，聊天里出现的这张"试用"卡片。
 * 样式此时已经在这个聊天窗里生效（chats.bubbleCharCss），卡片让用户选：
 *   - 保存：存进气泡设置里的样式库，以后可以直接选用；
 *   - 还原：撤掉这套样式。
 * 状态记在这条消息自己的 metadata.status（trial / saved / reverted）里，
 * 所以刷新页面、翻旧消息都能显示正确。
 */
const PREVIEW_SCOPE = 'bubble-css-card-preview';

const BubbleCssCard = ({ message }) => {
  const [busy, setBusy] = useState(false);
  const status = message?.metadata?.status || 'trial';
  const name = message?.metadata?.name || '角色的气泡样式';
  const css = message?.metadata?.css || '';

  const previewStyle = useMemo(() => scopeBubbleCss(css, `.${PREVIEW_SCOPE}`), [css]);

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveBubbleCssCard(message);
    } catch (error) {
      console.warn('[BubbleCssCard] 保存样式失败:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await revertBubbleCssCard(message);
    } catch (error) {
      console.warn('[BubbleCssCard] 还原样式失败:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-1 w-full max-w-sm select-none">
      <div
        className="relative overflow-hidden rounded-[1.75rem] p-4"
        style={{
          background: 'var(--card-bg-gradient, var(--card-bg))',
          border: '1px solid var(--card-border)',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>
            气泡新样式
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
          >
            {name}
          </span>
        </div>

        {message?.content ? (
          <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-main)' }}>
            {message.content}
          </p>
        ) : null}

        {/* 样式预览：作用域限定在卡片里，不会影响聊天窗其它地方 */}
        <style>{previewStyle}</style>
        <div className={`${PREVIEW_SCOPE} mb-3 space-y-1.5`}>
          <div className="relative user-bubble chat-font ml-auto max-w-[85%] p-2 text-right">
            这是你的消息
          </div>
          <div className="relative ai-bubble chat-font max-w-[85%] p-2 text-left">
            这是我的消息
          </div>
        </div>

        {status === 'trial' && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="flex-1 rounded-full py-1.5 text-[11px] font-medium"
                style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                保存到样式库
              </button>
              <button
                type="button"
                onClick={handleRevert}
                disabled={busy}
                className="rounded-full px-3 py-1.5 text-[11px]"
                style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
              >
                还原
              </button>
            </div>
            <p className="mt-2 text-[10px]" style={{ color: 'var(--text-sub)' }}>
              现在已经在试用，不保存的话也会一直保留，直到你还原或换了别的配色。
            </p>
          </>
        )}

        {status === 'saved' && (
          <div
            className="rounded-full px-3 py-1.5 text-center text-[11px]"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
          >
            已保存，之后可以在气泡设置里直接选用
          </div>
        )}

        {status === 'reverted' && (
          <div
            className="rounded-full px-3 py-1.5 text-center text-[11px]"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
          >
            已还原
          </div>
        )}
      </div>
    </div>
  );
};

export default BubbleCssCard;