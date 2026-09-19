import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Loader2,
  Pause,
  Play,
  Volume2,
  X,
} from 'lucide-react';

import { setAudioRetention } from '../../../services/callService';

// 已结束通话的只读回看：点开一条"通话已结束"的记录条时弹出。
// 跟 CheckInSettings.jsx 一样用 createPortal 挂到 body 上，不受聊天
// 界面自己的 transform/overflow 影响。
//
// 真实语音的音频 Blob 是直接存进 IndexedDB 的（每一轮通话轮次落地时
// 就已经保存），这里不负责"要不要保存"——那件事已经发生了。这里负责
// 的是事后管理：要不要继续占着本地空间留着它、以及想不想把它下载
// 出去。只问一次，问过之后 metadata.audioRetentionDecided 就是 true，
// 不会再弹。

const formatCallDuration = (metadata) => {
  const { connectedAt, endedAt } = metadata || {};
  if (!connectedAt || !endedAt) return null;

  const totalSeconds = Math.max(
    0,
    Math.round((new Date(endedAt) - new Date(connectedAt)) / 1000)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatClockTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const extensionForMimeType = (mimeType) => (
  mimeType === 'audio/wav' ? 'wav' : 'mp3'
);

const downloadBlob = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
};

// 单条 AI 真实语音轮次的小播放器，样式参考 RealVoiceCard.jsx 的
// "声音留笺"卡片，保持通话回看和平时留言的听感一致。
const TurnAudioPlayer = ({ turn, characterName }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioBlob = turn.audio?.audioBlob;

  // Hooks 必须无条件调用——即使 audioBlob 缺失也要先跑完这个
  // effect（内部会自己判断要不要真的创建 object URL），再决定要不要
  // 整体渲染 null，不能在 useEffect 之前提前 return。
  useEffect(() => {
    if (!audioBlob || !audioRef.current) return undefined;
    const objectUrl = URL.createObjectURL(audioBlob);
    audioRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [audioBlob]);

  if (!audioBlob) return null;

  const handleToggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.warn('[CallReviewModal] 播放被浏览器拦截：', error);
    }
  };

  const handleDownload = () => {
    const extension = extensionForMimeType(turn.audio?.mimeType);
    const stamp = turn.at ? new Date(turn.at).getTime() : Date.now();
    downloadBlob(audioBlob, `${characterName || 'call'}-${stamp}.${extension}`);
  };

  return (
    <div
      className="mt-1.5 flex items-center gap-2 rounded-full px-2.5 py-1.5"
      style={{ background: 'var(--control-soft-bg)' }}
    >
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <button
        type="button"
        onClick={handleToggle}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ background: 'var(--card-bg-gradient)', color: 'var(--text-main)' }}
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
      </button>

      <span className="flex-1 text-[10px] opacity-55">通话语音</span>

      <button
        type="button"
        onClick={handleDownload}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
        aria-label="下载这段语音"
        title="下载这段语音"
      >
        <Download className="h-3 w-3" />
      </button>
    </div>
  );
};

const CallReviewModal = ({ message, character, userName, onClose }) => {
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false);
  const metadata = message.metadata || {};
  const turns = Array.isArray(metadata.turns) ? metadata.turns : [];
  const duration = formatCallDuration(metadata);

  const audioTurns = turns.filter((turn) => turn.audio?.audioBlob);
  const hasRetainedAudio = audioTurns.length > 0;
  const needsRetentionChoice = metadata.mode === 'real'
    && !metadata.audioRetentionDecided
    && (hasRetainedAudio || turns.some((turn) => turn.audioStatus === 'ready' || turn.audioStatus === 'removed'));

  const handleRetentionChoice = async (keepAudio) => {
    setIsUpdatingRetention(true);
    try {
      await setAudioRetention({ messageId: message.id, keepAudio });
    } finally {
      setIsUpdatingRetention(false);
    }
  };

  const handleDownloadAll = () => {
    audioTurns.forEach((turn, index) => {
      window.setTimeout(() => {
        const extension = extensionForMimeType(turn.audio?.mimeType);
        const stamp = turn.at ? new Date(turn.at).getTime() : Date.now();
        downloadBlob(turn.audio.audioBlob, `${character?.name || 'call'}-${stamp}.${extension}`);
      }, index * 350);
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="flex max-h-[82vh] w-full max-w-sm flex-col overflow-hidden rounded-t-[28px] sm:rounded-[24px]"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3.5" style={{ borderColor: 'var(--divider)' }}>
          {character?.avatar ? (
            <img src={character.avatar} alt={character.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: 'var(--control-soft-bg)' }}
            >
              {character?.name?.[0] || 'C'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13px] font-semibold">与 {character?.name} 的通话</h2>
            <p className="mt-0.5 text-[10.5px] opacity-55">
              {formatClockTime(metadata.startedAt)}
              {duration ? ` · 时长 ${duration}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
            style={{ background: 'var(--control-soft-bg)' }}
            aria-label="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        {needsRetentionChoice && (
          <div
            className="mx-4 mt-3 shrink-0 rounded-2xl px-3 py-2.5 text-[11.5px] leading-relaxed"
            style={{ background: 'var(--control-soft-bg)' }}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <Volume2 className="h-3.5 w-3.5" />
              这通电话有 {audioTurns.length} 段真实语音
            </p>
            <p className="mt-1 opacity-70">
              留在本地方便以后回听，但会占用存储空间；也可以只留文字记录，把语音删掉。
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={isUpdatingRetention}
                onClick={() => handleRetentionChoice(true)}
                className="flex-1 rounded-full py-1.5 text-[11px] font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--card-bg-gradient)', border: '1px solid var(--card-border)' }}
              >
                {isUpdatingRetention ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : '保留语音'}
              </button>
              <button
                type="button"
                disabled={isUpdatingRetention}
                onClick={() => handleRetentionChoice(false)}
                className="flex-1 rounded-full py-1.5 text-[11px] font-semibold opacity-75 transition-transform active:scale-95 disabled:opacity-50"
              >
                仅留文字
              </button>
            </div>
          </div>
        )}

        {!needsRetentionChoice && metadata.audioRetentionDecided && (
          <p className="mx-4 mt-3 shrink-0 text-[10.5px] opacity-50">
            {metadata.audioRetained ? '语音已保留在本地。' : '语音已删除，仅保留文字记录。'}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {turns.length === 0 ? (
            <p className="py-6 text-center text-[11px] opacity-50">这通电话没有留下任何对话内容。</p>
          ) : (
            <div className="space-y-3">
              {turns.map((turn) => (
                <div key={turn.id} className={`flex flex-col ${turn.by === 'ai' ? 'items-start' : 'items-end'}`}>
                  <span className="px-1 text-[9.5px] opacity-45">
                    {turn.by === 'ai' ? character?.name : (userName || '我')}
                  </span>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed"
                    style={{
                      background: turn.by === 'ai' ? 'var(--control-soft-bg)' : 'var(--card-bg-gradient)',
                      border: turn.by === 'user' ? '1px solid var(--card-border)' : 'none',
                    }}
                  >
                    {turn.content}
                  </div>

                  {turn.by === 'ai' && turn.audio?.audioBlob && (
                    <div className="w-full max-w-[85%]">
                      <TurnAudioPlayer turn={turn} characterName={character?.name} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {hasRetainedAudio && (
          <footer className="shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={handleDownloadAll}
              className="flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[11.5px] font-semibold"
              style={{ background: 'var(--control-soft-bg)' }}
            >
              <Download className="h-3.5 w-3.5" />
              打包下载全部语音（{audioTurns.length} 段）
            </button>
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
};

export default CallReviewModal;