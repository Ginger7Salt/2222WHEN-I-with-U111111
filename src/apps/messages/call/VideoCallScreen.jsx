import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Mic, MicOff, PhoneOff,RotateCw, Send, VideoOff, Volume2, VolumeX }from 'lucide-react';

import { startCamera } from './videoCameraService';
import './video-call-screen.css';

// FaceTime 翻转风格的视频通话界面：
// - 大屏 = 用户摄像头实时画面（铺满背景）
// - 右上角小窗 = char 的头像（带呼吸光晕）
// - 通话内容（轮次文字）叠加在大屏上方
//
// 摄像头的启动/停止由这个组件自己管理（挂载时启动，卸载时停止），
// 不用父组件 CallScreen 关心摄像头的生命周期。
//
// 截帧不在这里做——VideoCallScreen 把 videoRef 暴露给父组件
// 通过 onCaptureFrame prop 向外提供截图能力，实际何时截由
// callService.js 里的 sendCallTurn（video 分支）决定。

const VideoCallScreen = ({
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
  voiceInputAvailable,
  isRecording,
  isTranscribing,
 onToggleVoiceInput,
  // 点一下重新播放某一句的语音（自动播放被浏览器拦住时的备用入口）
  onPlayTurnAudio,
  // 父组件通过这个 ref拿到 <video> 元素来截帧
  videoRef: externalVideoRef,
}) => {
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;

  // char 小窗拖动状态
 const [pipPos, setPipPos] = useState(null);
  const pipRef = useRef(null);
  const dragState = useRef(null); // { startX, startY, origTop, origRight }

  const [pendingRerollId, setPendingRerollId] = useState(null);

  // 谁在大屏：'char' = char 全屏、你是右上角小窗；'user' = 你全屏、char 是小窗。
  // char 说话时 char 全屏，轮到你录像/打字时切成你全屏。
  const [phase, setPhase] = useState('char');

  useEffect(() => {
    if (isSending) setPhase('char');
  }, [isSending]);

  const handleStartTurn = () => {
    setPhase('user');
    if (voiceInputAvailable && !isRecording) {
      onToggleVoiceInput();
    }
  };

  // 启动摄像头
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const stream = await startCamera();
        if (cancelled) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setCameraReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[VideoCallScreen] 摄像头启动失败：', error);
          setCameraError(
            error.name === 'NotAllowedError'
              ? '摄像头权限被拒绝，请在浏览器设置里允许访问摄像头。'
              : `摄像头无法启动：${error.message || '未知错误'}`
          );
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      // 注意：stopCamera() 只在 callService 挂断时调用，
      // 这里只是解除 <video> 引用，防止内存泄漏
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // char 小窗拖动（触摸 + 鼠标双支持）
  const handlePipPointerDown = useCallback((event) => {
    event.preventDefault();
    const pip = pipRef.current;
    if (!pip) return;

    const rect = pip.getBoundingClientRect();
    const parentRect = pip.parentElement.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    dragState.current = {
      startX: clientX,
      startY: clientY,
      origRight: parentRect.right - rect.right,
      origTop: rect.top - parentRect.top,
    };

    const onMove = (moveEvent) => {
      if (!dragState.current) return;
      const mx = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const my = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const dx = mx - dragState.current.startX;
      const dy = my - dragState.current.startY;

      setPipPos({
        top: Math.max(0, dragState.current.origTop + dy),
        right: Math.max(0, dragState.current.origRight - dx),
      });
    };

    const onUp = () => {
      dragState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, []);

const handleRerollClick = async (turnId) => {
    if (pendingRerollId) return;
    setPendingRerollId(turnId);
    try {
      await onRerollTurn(turnId);
    } finally {
      setPendingRerollId(null);
    }
  };
 
  // char 当前的状态颜文字——取最新一条 AI 轮次自带的 moodText，挂在
  // char 头像（舞台或小窗）旁边，跟台词本身的逐字动画无关，不参与
  // 打字机效果，一次性直接显示。
  // 最近一条带状态的 AI 轮次：一次回复拆成几句时状态只挂在其中一句上，
  // 不能只看最后一条轮次。
  const latestMoodText = [...turns].reverse().find((turn) => (
    turn.by === 'ai' && turn.moodText
  ))?.moodText || null;
 
  // 视频通话只显示"最近这一轮"：从最后一条用户发言起往后的内容。更早的
  // 对话还在通话记录里，只是不再堆在画面上盖住头像。
  const lastUserIndex = turns.reduce((found, turn, index) => (
    turn.by === 'user' ? index : found
  ), -1);
  const visibleTurns = lastUserIndex > 0 ? turns.slice(lastUserIndex) : turns;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 用户摄像头大屏 */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className={phase === 'user' ? 'video-call__camera' : 'video-call__camera video-call__camera--pip'}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {/* 摄像头未就绪时的占位 */}
      {!cameraReady && !cameraError && (
        <div className="video-call__camera-loading" aria-hidden="true">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>正在启动摄像头...</span>
        </div>
      )}

      {/* 摄像头错误提示 */}
      {cameraError && (
        <div className="video-call__camera-loading" aria-live="polite">
          <VideoOff className="h-7 w-7 opacity-60" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* char 全屏舞台：char 说话时占满大屏 */}
      {phase === 'char' && (
        <div className="video-call__char-stage" aria-hidden="true">
          {character?.avatar && (
            <img src={character.avatar} alt="" className="video-call__char-stage-bg" />
          )}
          <div className="video-call__char-stage-main">
            <span className="video-call__char-glow video-call__char-glow--stage" />
          {character?.avatar ? (
              <img src={character.avatar} alt="" className="video-call__char-stage-avatar" />
            ) : (
              <div className="video-call__char-stage-avatar video-call__char-avatar-fallback">
                {character?.name?.[0] || 'C'}
              </div>
            )}
 
            {latestMoodText && (
              <span className="video-call__mood-badge video-call__mood-badge--stage">
                {latestMoodText}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 全屏暗色遮罩，让白色文字在任意背景下都可读 */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.35) 100%)' }}
        aria-hidden="true"
      />

      {/* 叠加层：小窗 + 内容 + 输入栏 */}
      <div className="video-call__overlay px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">

        {/* 顶部：状态计时 */}
        <div className="video-call__top-bar">
          <span className="video-call__status">{statusLabel}</span>
          {/* 右上角空间留给 pip 小窗，这里不放元素 */}
          <div style={{ width: 96 }} aria-hidden="true" />
        </div>

        {/* char 头像小窗（你全屏时在右上角，可拖动） */}
        {phase === 'user' && (
        <div
          ref={pipRef}
          className="video-call__char-pip"
          style={pipPos ? { top: pipPos.top, right: pipPos.right } : undefined}
          onMouseDown={handlePipPointerDown}
          onTouchStart={handlePipPointerDown}
          aria-label={`${character?.name || 'TA'} 的画面`}
        >
          {/* 呼吸光晕 */}
          <span className="video-call__char-glow" aria-hidden="true" />

          {/* 头像 */}
          {character?.avatar ? (
            <img
              src={character.avatar}
              alt={character?.name || ''}
              className="video-call__char-avatar"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="video-call__char-avatar-fallback">
              {character?.name?.[0] || 'C'}
            </div>
          )}

         {/* char 名字标签 */}
          {character?.name && (
            <span className="video-call__char-name">{character.name}</span>
          )}
 
          {latestMoodText && (
            <span className="video-call__mood-badge">{latestMoodText}</span>
          )}
        </div>
        )}

        {/* 通话内容滚动区 */}
        <div
          ref={transcriptRef}
          className={`video-call__flow ${phase === 'char' ? 'video-call__flow--char' : ''}`}
        >
          {visibleTurns.map((turn) => {
            const isLatestAi = turn.id === latestTurn?.id && turn.by === 'ai';
            const displayText = isLatestAi ? revealedText : turn.content;

            return (
              <div
                key={turn.id}
                className={`mb-5 text-center ${turn.by === 'ai' ? 'video-call__line--ai' : 'video-call__line--user'}`}
              >
                 {turn.by === 'ai' && turn.actionText && (
                  <p className="video-call__action-text">{turn.actionText}</p>
                )}
 
                {turn.by === 'ai' && turn.mode === 'video' && turn.audioStatus && turn.audioStatus !== 'removed' && (
                  <div className="video-call__audio-state">
                    {turn.audioStatus === 'pending' && (
                      <>
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        <span>语音生成中</span>
                      </>
                    )}
                    {turn.audioStatus === 'ready' && onPlayTurnAudio && (
                      <button
                        type="button"
                        onClick={() => onPlayTurnAudio(turn)}
                        className="video-call__audio-btn"
                        aria-label="播放语音"
                        title="播放语音"
                      >
                        <Volume2 className="h-2.5 w-2.5" />
                        <span>播放语音</span>
                      </button>
                    )}
                    {turn.audioStatus === 'failed' && (
                      <>
                        <VolumeX className="h-2.5 w-2.5" />
                        <span>语音未生成</span>
                      </>
                    )}
                  </div>
                )}
 
                <p>
                  {isLatestAi
                    ? displayText.split('').map((char, index) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <span key={index} className="video-call__char-anim">
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
                      <span className="video-call__turn-controls">
                        {hasVersions && (
                          <>
                            <button
                              type="button"
                              onClick={() => onSwitchTurnVersion(turn.id, 'prev')}
                              disabled={versionIndex <= 0}
                              className="video-call__turn-control-btn"
                              aria-label="上一个版本"
                              title="上一个版本"
                            >
                              <ChevronLeft className="h-2.5 w-2.5" />
                            </button>

                            <span className="video-call__turn-version-count">
                              {versionIndex + 1}/{versions.length}
                            </span>

                            <button
                              type="button"
                              onClick={() => onSwitchTurnVersion(turn.id, 'next')}
                              disabled={versionIndex >= versions.length - 1}
                              className="video-call__turn-control-btn"
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
                          className="video-call__turn-control-btn"
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
            <div className="video-call__thinking">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        {/* 底部：声波装饰 + 输入栏 */}
        <div className="video-call__bottom">
          <div className="video-call__ambient-wave" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="video-call__ambient-bar"
                style={{ animationDelay: `${index * 0.1}s` }}
              />
            ))}
          </div>

          {phase === 'char' ? (
            <div className="video-call__input-row">
              <button
                type="button"
                onClick={handleStartTurn}
                disabled={aiThinking || isSending}
                className="video-call__turn-btn"
              >
                {voiceInputAvailable ? '开始录像说话' : '轮到我了'}
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
          ) : (
            <div className="video-call__input-row">
              {voiceInputAvailable && (
                <button
                  type="button"
                  onClick={onToggleVoiceInput}
                  disabled={isTranscribing}
                  className={`video-call__mic-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40 ${
                    isRecording ? 'video-call__mic-btn--recording' : ''
                  }`}
                  aria-label={isRecording ? '说完了，点一下结束' : '开始录像'}
                  title={isRecording ? '说完了，点一下结束' : '开始录像'}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              )}

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
                placeholder={
                  isTranscribing
                    ? '正在识别你说的话...'
                    : isRecording
                      ? '正在录像，说完点左边的按钮结束'
                      : voiceInputAvailable
                        ? '点左边开始录像，或在这里打字...'
                        : '打字说话...'
                }
                className="video-call__input"
              />

              <button
                type="button"
                onClick={onSend}
                disabled={isSending || isRecording || !draftText.trim()}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallScreen;