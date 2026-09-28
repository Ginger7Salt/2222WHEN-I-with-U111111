// src/apps/messages/interactions/LotteryDrawInteraction.jsx
//
// 抽签筒：跟硬币/骰子一样是"轻触揭晓"的两段式（pending -> resolved），
// 抽到的不是运势，是一句小剧场 paro 情景签——角色会顺着这个情景在
// 后面自动接一段即兴小剧场（生成逻辑在 interactionAiService.js）。

import React, { useState } from 'react';
import { resolveInteractionMessage } from './interactionService';

export const LotteryDrawInteraction = ({ message, onResolved }) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [displayScenario, setDisplayScenario] = useState(
    message.metadata?.result?.scenario || null
  );

  const status = message.metadata?.status || 'pending';
  const scenario = message.metadata?.result?.scenario || displayScenario;
  const isPending = status === 'pending';

  const handleDraw = async () => {
    if (!isPending || isRevealing) return;

    setIsRevealing(true);

    const metadata = await resolveInteractionMessage({
      messageId: message.id,
    });

    const nextScenario = metadata?.result?.scenario;

    if (!nextScenario) {
      setIsRevealing(false);
      return;
    }

    setDisplayScenario(nextScenario);

    window.setTimeout(() => {
      setIsRevealing(false);
      onResolved?.();
    }, 620);
  };

  return (
    <article
      className={`chat-interaction chat-interaction--lottery ${
        isPending ? 'chat-interaction--pending' : 'chat-interaction--resolved'
      }`}
    >
      <div className="interaction-heading">
        <span className="interaction-kicker">TABLE OBJECT</span>
        <span className="interaction-title">剧场签</span>
      </div>

      <button
        type="button"
        className="interaction-lottery-stage"
        onClick={handleDraw}
        disabled={!isPending || isRevealing}
        aria-label={isPending ? '摇一支剧场签' : `抽到的情景：${scenario}`}
      >
        {isPending ? (
          <span className="interaction-lottery-tube">
            <span className="interaction-lottery-sticks" />
            <span className="interaction-lottery-hint">轻触摇一支签</span>
          </span>
        ) : (
          <span
            className={`interaction-lottery-slip ${
              isRevealing ? 'interaction-lottery-slip--in' : ''
            }`}
          >
            {scenario}
          </span>
        )}
      </button>

      <div className="interaction-footer">
        {isPending ? (
          <span>签筒里的情景，抽到算数。</span>
        ) : (
          <span>抽到了这一支，接下来顺着它演。</span>
        )}
      </div>
    </article>
  );
};

export default LotteryDrawInteraction;