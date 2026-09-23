import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookHeart } from 'lucide-react';

import { getMemoirsForChat } from './memoirService';
import { getMemoirEmotion } from './memoirEmotions';
import { pickForgingLine } from './memoirForgingLines';

const EVENT_TYPE_LABEL = {
  food: '外卖',
  transfer: '转账',
  mcp: 'MCP',
};

const formatTime = (iso) => {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MemoirCard = ({ memoir }) => {
  const emotion = getMemoirEmotion(memoir.emotion);

  return (
    <div
      className="rounded-2xl p-3.5 shadow-sm"
      style={{
        background: emotion ? emotion.bg : 'var(--card-bg)',
        border: `1px solid ${emotion ? emotion.border : 'var(--card-border)'}`,
        color: 'var(--text-main)',
      }}
    >
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-mono opacity-60">
        <span>{EVENT_TYPE_LABEL[memoir.eventType] || '经历'}</span>
        <span>{formatTime(memoir.timestamp)}</span>
      </div>

      <p className="text-[13px] leading-relaxed break-words">{memoir.summary}</p>

      {memoir.feeling && (
        <div
          className="mt-2 flex items-start gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] leading-relaxed"
          style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
        >
          {emotion && (
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: emotion.dot }}
            />
          )}
          <span>{memoir.feeling}</span>
        </div>
      )}
    </div>
  );
};

const MemoirPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [memoirs, setMemoirs] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getMemoirsForChat(chatId).then((rows) => {
      if (cancelled) return;
      setMemoirs(rows);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const forgingLine = pickForgingLine({ memoirs });

  const headerBar = (
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
      <BookHeart className="h-4 w-4" />
      <span className="text-sm font-medium">回忆录</span>
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: 'var(--bg-main)' }}>
      {headerBar}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: 'var(--card-bg-gradient, var(--card-bg))',
            border: '1px solid var(--card-border)',
            color: 'var(--text-sub)',
          }}
        >
          {forgingLine}
        </div>

        {isLoading ? null : memoirs.length === 0 ? (
          <div className="py-10 text-center text-[12px] leading-relaxed opacity-60">
            还没有值得记下的共同经历。点外卖、转账，或者让
            {character?.name || 'TA'}
            帮你做点事，都会留在这里。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {memoirs.map((memoir) => (
              <MemoirCard key={memoir.id} memoir={memoir} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoirPage;