// src/apps/messages/interactions/drawGuess/DrawGuessInteraction.jsx
//
// 聊天里的"你画我猜"卡片：显示用户画的画，以及角色猜测的进度和结果。
// 三种状态：
// - guessing：角色正在看画。超过一段时间还没有结果，会出现重试入口，
//   应对页面中途被关掉导致请求丢失的情况；
// - failed：这次猜测没有成功，画还在，可以重新让角色猜；
// - resolved：显示答案、角色猜的内容和判定，判定不准时可以手动改判。

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DRAW_GUESS_STATUS } from './drawGuessRules';
import { retryDrawGuess, setDrawGuessVerdict } from './drawGuessService';
import './drawGuess.css';

// 猜测中超过这个时间仍无结果，就认为请求已经丢了，露出重试按钮。
const STALE_GUESSING_MS = 45000;

export const DrawGuessInteraction = ({ message, character }) => {
  const metadata = message?.metadata || {};
  const result = metadata.result || {};
  const status = metadata.status;
  const characterName = character?.name || 'TA';

  const [isStale, setIsStale] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (status !== DRAW_GUESS_STATUS.GUESSING) {
      setIsStale(false);
      return undefined;
    }

    const startedAt = new Date(
      metadata.guessStartedAt || metadata.createdAt || 0
    ).getTime();
    const remaining = STALE_GUESSING_MS - (Date.now() - startedAt);

    if (!Number.isFinite(remaining) || remaining <= 0) {
      setIsStale(true);
      return undefined;
    }

    setIsStale(false);
    const timer = window.setTimeout(() => setIsStale(true), remaining);

    return () => window.clearTimeout(timer);
  }, [status, metadata.guessStartedAt, metadata.createdAt]);

  const handleRetry = async () => {
    if (isBusy) return;

    setIsBusy(true);

    try {
      await retryDrawGuess(message.id);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleVerdict = async () => {
    if (isBusy) return;

    setIsBusy(true);

    try {
      await setDrawGuessVerdict(message.id, !result.isCorrect);
    } finally {
      setIsBusy(false);
    }
  };

  const isResolved = status === DRAW_GUESS_STATUS.RESOLVED;
  const isFailed = status === DRAW_GUESS_STATUS.FAILED;
  const showRetry = isFailed || (status === DRAW_GUESS_STATUS.GUESSING && isStale);

  return (
    <div className="dg-card drawguess-scope">
      <div className="dg-card-head">
        <span className="dg-card-title">你画我猜</span>
        {result.categoryLabel ? (
          <span className="dg-category">{result.categoryLabel}</span>
        ) : null}
      </div>

      {result.image ? (
        <img
          className="dg-card-image"
          src={result.image}
          alt="用户画的画"
          draggable={false}
        />
      ) : (
        <div className="dg-card-image dg-card-image--missing">
          这幅画没有保存下来
        </div>
      )}

      {status === DRAW_GUESS_STATUS.GUESSING && !isStale && (
        <div className="dg-card-status" role="status">
          <span>{characterName}正在看你的画</span>
          <span className="dg-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}

      {showRetry && (
        <div className="dg-card-status">
          <span>
            {isFailed ? '这次没能猜出来' : '等了好一会儿，还没有结果'}
          </span>
          <button
            type="button"
            className="dg-card-btn"
            onClick={handleRetry}
            disabled={isBusy}
          >
            <RefreshCw className="h-3 w-3" />
            重新让TA猜
          </button>
        </div>
      )}

      {isResolved && (
        <div className="dg-card-result">
          <div className="dg-card-row">
            <span className="dg-card-key">答案</span>
            <span className="dg-card-val">{result.word}</span>
          </div>
          <div className="dg-card-row">
            <span className="dg-card-key">{characterName}猜</span>
            <span className="dg-card-val">
              {result.guess || '没有给出确切答案'}
            </span>
          </div>
          <div className="dg-card-foot">
            <span
              className={`dg-verdict ${
                result.isCorrect ? 'is-correct' : 'is-wrong'
              }`}
            >
              {result.isCorrect ? '猜中了' : '没猜中'}
            </span>
            <button
              type="button"
              className="dg-card-link"
              onClick={handleToggleVerdict}
              disabled={isBusy}
            >
              判定不对？改成{result.isCorrect ? '没猜中' : '猜中了'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawGuessInteraction;
